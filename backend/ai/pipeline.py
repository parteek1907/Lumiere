import pandas as pd
import os
import sys
import asyncio
from datetime import datetime
from features import (
    calculate_name_jaro_winkler,
    calculate_name_phonetic,
    calculate_dob_score,
    calculate_ssn_score,
    calculate_address_score,
    calculate_gender_score
)

# WEIGHTS — mirrors the AI system prompt exactly
WEIGHTS = {
    "name_jaro_winkler": 0.25,
    "name_phonetic":     0.15,
    "dob":               0.30,
    "ssn":               0.20,
    "address":           0.07,
    "gender":            0.03,
}

class IdentityPipeline:
    def __init__(self, csv_path):
        self.csv_path = csv_path

    def generate_scores(self, rec1, rec2):
        """Compute all similarity scores and return a PII-free score object."""
        age1 = (datetime.now() - datetime.strptime(rec1['created_at'], '%Y-%m-%d')).days
        age2 = (datetime.now() - datetime.strptime(rec2['created_at'], '%Y-%m-%d')).days

        scores = {
            "name_jaro_winkler": calculate_name_jaro_winkler(rec1['name'], rec2['name']),
            "name_phonetic":     calculate_name_phonetic(rec1['name'], rec2['name']),
            "dob":               calculate_dob_score(rec1['dob'], rec2['dob']),
            "ssn":               calculate_ssn_score(
                                     rec1['ssn_full_hash'], rec2['ssn_full_hash'],
                                     rec1['ssn_last4_hash'], rec2['ssn_last4_hash']),
            "address":           calculate_address_score(rec1['address'], rec2['address']),
            "gender":            calculate_gender_score(rec1['gender'], rec2['gender']),
        }

        return {
            "pair_id":          f"{rec1['id']}-{rec2['id']}",
            "scores":           scores,
            "source_systems":   [rec1['source_system'], rec2['source_system']],
            "record_ages_days": [age1, age2],
        }

    def classify_locally(self, score_obj):
        """
        Full local implementation of the AI classifier decision logic.
        Mirrors the AI system prompt (Steps 1-4) 100% locally.
        NO Groq tokens are consumed here.
        Returns a result dict in the same shape as the AI response.
        """
        s = score_obj['scores']
        src = score_obj['source_systems']
        ages = score_obj['record_ages_days']

        # ── Step 1: Hard Disqualifiers ──────────────────────────────────────
        if s['ssn'] == 0.0 and s['dob'] == 0.0:
            return {
                "pair_id": score_obj['pair_id'],
                "decision": "separate", "confidence": 0.05, "weighted_raw": 0.0,
                "adjustments_applied": [], "hard_disqualifier": True,
                "reasoning": "Hard disqualifier: Both SSN and DOB scores are 0.0 — primary identifiers disagree too strongly."
            }

        if s['gender'] == 0.0 and s['name_phonetic'] == 0.0 and s['name_jaro_winkler'] < 0.5:
            return {
                "pair_id": score_obj['pair_id'],
                "decision": "separate", "confidence": 0.05, "weighted_raw": 0.0,
                "adjustments_applied": [], "hard_disqualifier": True,
                "reasoning": "Hard disqualifier: No similarity across gender, phonetic name, or Jaro-Winkler — likely different people."
            }

        if s['gender'] == 0.0 and s['name_jaro_winkler'] < 0.85:
            return {
                "pair_id": score_obj['pair_id'],
                "decision": "separate", "confidence": 0.05, "weighted_raw": 0.0,
                "adjustments_applied": [], "hard_disqualifier": True,
                "reasoning": "Hard disqualifier: Gender mismatch with insufficient name similarity to justify a merge."
            }

        if s['ssn'] == 0.5 and s['dob'] == 0.0 and s['name_jaro_winkler'] < 0.85:
            return {
                "pair_id": score_obj['pair_id'],
                "decision": "separate", "confidence": 0.05, "weighted_raw": 0.0,
                "adjustments_applied": [], "hard_disqualifier": True,
                "reasoning": "Hard disqualifier: SSN last-4 partial match but conflicting DOB and weak name signal."
            }

        # ── Step 2: Weighted Confidence Score ───────────────────────────────
        weighted_raw = sum(s[field] * weight for field, weight in WEIGHTS.items())

        # ── Step 3: Contextual Adjustments ──────────────────────────────────
        adjustments = []
        confidence = weighted_raw

        # Boost: same trusted source
        if src[0] == src[1] and src[0] in ("Epic EHR", "Lab LIS"):
            confidence += 0.05
            adjustments.append("Boost: same trusted source system")

        # Boost: phonetic + DOB both strong
        if s['name_phonetic'] == 1.0 and s['dob'] == 1.0:
            confidence += 0.05
            adjustments.append("Boost: phonetic match + exact DOB")

        # Penalty: low-trust source
        if any(sys in ("scanned PDF", "voice note") for sys in src):
            confidence -= 0.05
            adjustments.append("Penalty: low-trust source system (OCR/voice)")

        # Penalty: stale address
        oldest = max(ages)
        if oldest > 1825 and s['address'] < 0.6:
            confidence -= 0.05
            adjustments.append("Penalty: record older than 5 years with low address score")

        # Cap & floor
        confidence = round(max(0.05, min(0.95, confidence)), 4)

        # ── Step 4: Decision ─────────────────────────────────────────────────
        if confidence >= 0.86:
            decision = "merge"
            reasoning = (
                f"High confidence ({confidence}): strong alignment across name, DOB, and SSN. "
                "Records are safely merged into a golden profile."
            )
        elif confidence >= 0.60:
            decision = "review"
            reasoning = (
                f"Moderate confidence ({confidence}): some identifiers align but conflicts remain. "
                "Reviewer should examine: " +
                ", ".join(
                    f"{k} ({v:.2f})" for k, v in s.items() if v < 0.7
                ) + "."
            )
        else:
            decision = "separate"
            reasoning = (
                f"Low confidence ({confidence}): insufficient agreement across identifiers. "
                "Records are kept distinct."
            )

        return {
            "pair_id":              score_obj['pair_id'],
            "decision":             decision,
            "confidence":           confidence,
            "weighted_raw":         round(weighted_raw, 4),
            "adjustments_applied":  adjustments,
            "hard_disqualifier":    False,
            "reasoning":            reasoning,
        }

    async def resolve(self, query):
        # RELOAD DATA fresh on every request
        df = pd.read_csv(self.csv_path).fillna("")

        # 1. Find matching records for the query
        q = query.lower()
        results = df[
            (df['name'].str.lower().str.contains(q, na=False)) |
            (df['phone'].str.replace('-', '').str.contains(q.replace('-', ''), na=False)) |
            (df['email'].str.lower().str.contains(q, na=False))
        ]

        if results.empty:
            return {
                "status": "no_records_found",
                "summary": f"No patient records matched '{query}' in the database."
            }

        auto_merges = []
        pending_reviews = []
        distinct_records = []
        seen_pairs = set()

        # 2. Compare each found record against the full database pool
        for _, source_rec in results.iterrows():
            for _, pool_rec in df.iterrows():
                if source_rec['id'] == pool_rec['id']:
                    continue

                pair_key = tuple(sorted([source_rec['id'], pool_rec['id']]))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                # Blocking filter: skip obviously unrelated pairs early
                simple_name_score = calculate_name_jaro_winkler(source_rec['name'], pool_rec['name'])
                if simple_name_score < 0.7 and source_rec['phone'] != pool_rec['phone']:
                    continue

                # Compute scores — this is ALL the backend sends to "AI" (locally)
                score_obj = self.generate_scores(source_rec, pool_rec)

                # Classify entirely locally — NO Groq call
                analysis = self.classify_locally(score_obj)

                entry = {
                    "pair_id":    score_obj['pair_id'],
                    "records":    [source_rec.to_dict(), pool_rec.to_dict()],
                    "ai_analysis": analysis,
                }

                if analysis['decision'] == "merge":
                    auto_merges.append(entry)
                elif analysis['decision'] == "review":
                    pending_reviews.append(entry)
                else:
                    distinct_records.append(entry)

        # 3. Build a plain-English verdict locally (no AI token cost)
        total = len(auto_merges) + len(pending_reviews) + len(distinct_records)
        if len(auto_merges) > 0:
            verdict = (
                f"Successfully unified {len(auto_merges)} duplicate record(s) into a golden profile. "
                f"{len(pending_reviews)} pair(s) require human review. "
                f"{len(distinct_records)} pair(s) confirmed as distinct individuals."
            )
        elif len(pending_reviews) > 0:
            verdict = (
                f"No automatic merges were performed. "
                f"{len(pending_reviews)} pair(s) have been flagged for human review due to ambiguous identifiers. "
                f"{len(distinct_records)} pair(s) confirmed as distinct."
            )
        else:
            verdict = (
                f"Analysis complete. All {total} candidate pair(s) were evaluated and confirmed as separate individuals. "
                "No merges were required."
            )

        return {
            "status": "success",
            "search_results": results.to_dict(orient='records'),
            "action_report": {
                "auto_merges_completed":       auto_merges,
                "pending_human_review":        pending_reviews,
                "confirmed_duplicates_ignored": distinct_records,
            },
            "summary": verdict,
        }


# Shared instance
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
identity_pipeline = IdentityPipeline(os.path.join(BASE_DIR, "ehr_data.csv"))

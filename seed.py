"""
seed.py — Faker-based seeder for Intelligent Clinical Data Integration
Generates realistic synthetic healthcare data for the Master Patient Index.
"""

import hashlib
import json
import random
import uuid
from datetime import date, datetime, timedelta, timezone

import jellyfish
import psycopg2
import psycopg2.extras
from faker import Faker

# ── Configuration ──────────────────────────────────────────────
DB_DSN = "postgresql://postgres:hackathon123@localhost:5432/clinical_db"
fake = Faker()
Faker.seed(42)
random.seed(42)

# Register UUID adapter for psycopg2
psycopg2.extras.register_uuid()


def get_conn():
    return psycopg2.connect(DB_DSN)


def sha256_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# ── 1. Source Systems (4 rows) ─────────────────────────────────
SOURCE_SYSTEMS = [
    ("Epic EHR", "EHR", "https://epic.internal.hospital/api"),
    ("LabCorp", "LIS", "https://labcorp.com/api/v2"),
    ("PDF Archive", "PDF", None),
    ("Voice System", "VOICE", None),
]


def seed_source_systems(cur):
    print("Seeding source_systems ...")
    ids = []
    for name, stype, url in SOURCE_SYSTEMS:
        sid = uuid.uuid4()
        cur.execute(
            """INSERT INTO source_systems (id, system_name, system_type, base_url)
               VALUES (%s, %s, %s, %s)""",
            (sid, name, stype, url),
        )
        ids.append(sid)
    print(f"  -> {len(ids)} source systems inserted.")
    return ids


# ── 2. FHIR Patients (500 base + 200 duplicates = ~700) ───────
US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]


def make_patient():
    given = fake.first_name()
    family = fake.last_name()
    ssn = fake.ssn()
    dob = fake.date_of_birth(minimum_age=1, maximum_age=95)
    gender = random.choice(["male", "female", "other"])
    full_name = f"{given} {family}"
    return {
        "fhir_id": str(uuid.uuid4()),
        "given_name": given,
        "family_name": family,
        "dob": dob,
        "gender": gender,
        "ssn_hash": sha256_hash(ssn),
        "phone": fake.phone_number()[:20],
        "address_line": fake.street_address()[:255],
        "city": fake.city()[:100],
        "state": random.choice(US_STATES),
        "zip": fake.zipcode()[:10],
        "name_soundex": jellyfish.soundex(full_name)[:20],
        "name_nysiis": jellyfish.nysiis(full_name)[:100],
    }


def mutate_patient(orig: dict) -> dict:
    """Create a slightly mutated copy to simulate a duplicate record."""
    dup = dict(orig)
    dup["fhir_id"] = str(uuid.uuid4())

    mutation = random.choice(["swap_name", "typo_dob", "drop_middle", "typo_zip"])
    if mutation == "swap_name":
        dup["given_name"], dup["family_name"] = dup["family_name"], dup["given_name"]
    elif mutation == "typo_dob":
        delta = random.choice([-1, 1])
        dup["dob"] = dup["dob"] + timedelta(days=delta)
    elif mutation == "drop_middle":
        # Truncate given_name to first letter as if middle initial was stripped
        dup["given_name"] = dup["given_name"][0]
    elif mutation == "typo_zip":
        z = list(dup["zip"])
        if len(z) >= 2:
            z[-1] = str(random.randint(0, 9))
        dup["zip"] = "".join(z)

    # Recompute phonetic codes
    full = f"{dup['given_name']} {dup['family_name']}"
    dup["name_soundex"] = jellyfish.soundex(full)[:20]
    dup["name_nysiis"] = jellyfish.nysiis(full)[:100]
    # Keep same ssn_hash so entity resolution can detect it
    return dup


def insert_patient(cur, p: dict) -> uuid.UUID:
    pid = uuid.uuid4()
    cur.execute(
        """INSERT INTO fhir_patients
           (id, fhir_id, given_name, family_name, dob, gender,
            ssn_hash, phone, address_line, city, state, zip,
            name_soundex, name_nysiis)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            pid, p["fhir_id"], p["given_name"], p["family_name"],
            p["dob"], p["gender"], p["ssn_hash"], p["phone"],
            p["address_line"], p["city"], p["state"], p["zip"],
            p["name_soundex"], p["name_nysiis"],
        ),
    )
    return pid


def seed_patients(cur):
    print("Seeding fhir_patients (500 base + 200 duplicates) ...")
    base_patients = []
    base_ids = []
    for _ in range(500):
        p = make_patient()
        pid = insert_patient(cur, p)
        base_patients.append(p)
        base_ids.append(pid)

    # Create 200 intentional duplicates from first 200 patients
    dup_pairs = []  # (original_id, duplicate_id)
    for i in range(200):
        dup = mutate_patient(base_patients[i])
        dup_id = insert_patient(cur, dup)
        dup_pairs.append((base_ids[i], dup_id))

    print(f"  -> {len(base_ids)} base + {len(dup_pairs)} duplicates = {len(base_ids) + len(dup_pairs)} total.")
    return base_ids, dup_pairs


# ── 3. Entity Resolution Candidates & MPI ─────────────────────
def seed_entity_resolution(cur, dup_pairs, all_patient_ids):
    print("Seeding entity_resolution_candidates & master_patient_index ...")
    for orig_id, dup_id in dup_pairs:
        soundex_s = round(random.uniform(0.5, 1.0), 4)
        nysiis_s = round(random.uniform(0.5, 1.0), 4)
        dob_match = random.random() > 0.3
        ssn_partial = random.random() > 0.2
        vec_sim = round(random.uniform(0.4, 1.0), 4)
        composite = round(
            0.25 * soundex_s + 0.25 * nysiis_s + 0.15 * float(dob_match)
            + 0.15 * float(ssn_partial) + 0.20 * vec_sim,
            4,
        )
        composite = min(composite, 1.0)

        blocking_key = f"BLK-{fake.lexify('??????').upper()}"

        cur.execute(
            """INSERT INTO entity_resolution_candidates
               (record_a_id, record_b_id, blocking_key,
                soundex_score, nysiis_score, dob_match, ssn_partial_match,
                vector_similarity, composite_score)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                orig_id, dup_id, blocking_key,
                soundex_s, nysiis_s, dob_match, ssn_partial,
                vec_sim, composite,
            ),
        )

        # Determine MPI status
        if composite > 0.85:
            status = "AUTO_MATCHED"
        elif composite >= 0.60:
            status = "MANUAL_REVIEW"
        else:
            status = "MANUAL_REVIEW"  # edge cases still go to review

        golden_id = orig_id  # original is the golden patient
        mpi_id = uuid.uuid4()
        cur.execute(
            """INSERT INTO master_patient_index
               (id, golden_patient_id, confidence_score, resolution_status)
               VALUES (%s,%s,%s,%s)""",
            (mpi_id, golden_id, composite, status),
        )

        # Link both records to the MPI entry
        for src_id, weight in [(orig_id, 1.0), (dup_id, composite)]:
            cur.execute(
                """INSERT INTO mpi_source_links (mpi_id, source_patient_id, link_weight)
                   VALUES (%s,%s,%s)""",
                (mpi_id, src_id, weight),
            )

    print(f"  -> {len(dup_pairs)} candidate pairs, MPI entries, and source links inserted.")


# ── 4. Raw Patient Records (500 rows) ─────────────────────────
def seed_raw_records(cur, source_system_ids, patient_ids):
    print("Seeding raw_patient_records (500 rows) ...")
    methods = ["API", "CSV", "OCR", "VOICE"]
    statuses = ["PENDING", "PROCESSING", "DONE", "FAILED"]
    raw_ids = []
    for _ in range(500):
        rid = uuid.uuid4()
        payload = {
            "patient_name": fake.name(),
            "mrn": fake.bothify("MRN-########"),
            "encounter_date": fake.date_this_decade().isoformat(),
            "chief_complaint": fake.sentence(nb_words=6),
        }
        cur.execute(
            """INSERT INTO raw_patient_records
               (id, source_system_id, external_patient_id, raw_payload,
                ingestion_method, ingestion_status)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (
                rid,
                random.choice(source_system_ids),
                fake.bothify("EXT-######"),
                json.dumps(payload),
                random.choice(methods),
                random.choices(statuses, weights=[10, 5, 80, 5])[0],
            ),
        )
        raw_ids.append(rid)
    print(f"  -> {len(raw_ids)} raw records inserted.")
    return raw_ids


# ── 5. FHIR Observations (1000 rows) ──────────────────────────
OBS_TYPES = {
    "lab": [
        ("GLU", "mg/dL", 70, 200),
        ("HBA1C", "%", 4.0, 14.0),
        ("WBC", "10^3/uL", 3.5, 15.0),
        ("HGB", "g/dL", 8.0, 18.0),
        ("PLT", "10^3/uL", 100, 400),
        ("CRP", "mg/L", 0.1, 50.0),
    ],
    "vital": [
        ("HR", "bpm", 50, 120),
        ("BP_SYS", "mmHg", 90, 180),
        ("BP_DIA", "mmHg", 50, 110),
        ("TEMP", "°F", 96.0, 104.0),
        ("SPO2", "%", 85, 100),
        ("RR", "breaths/min", 10, 30),
    ],
    "note": [
        ("PROG_NOTE", None, None, None),
        ("DISCHARGE", None, None, None),
        ("CONSULT", None, None, None),
    ],
}


def seed_observations(cur, patient_ids, raw_ids):
    print("Seeding fhir_observations (1000 rows) ...")
    for _ in range(1000):
        obs_type = random.choice(["lab", "vital", "note"])
        spec = random.choice(OBS_TYPES[obs_type])
        code = spec[0]
        unit = spec[1]
        if obs_type == "note":
            value = fake.paragraph(nb_sentences=3)
            notes = value
        else:
            value = str(round(random.uniform(spec[2], spec[3]), 2))
            notes = None

        cur.execute(
            """INSERT INTO fhir_observations
               (patient_id, source_record_id, obs_type, obs_code,
                obs_value, obs_unit, obs_datetime, notes_text,
                embedding, embedding_model, embedding_status)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                random.choice(patient_ids),
                random.choice(raw_ids),
                obs_type,
                code,
                value,
                unit,
                fake.date_time_between(
                    start_date="-2y", end_date="now", tzinfo=timezone.utc
                ),
                notes,
                None,  # embedding left NULL — ML team populates
                None,  # embedding_model
                'PENDING',
            ),
        )
    print("  -> 1000 observations inserted.")


# ── 6. FHIR Medications (300 rows) ────────────────────────────
MEDICATIONS = [
    ("Metformin", "500mg", "twice daily"),
    ("Metformin", "1000mg", "once daily"),
    ("Lisinopril", "10mg", "once daily"),
    ("Lisinopril", "20mg", "once daily"),
    ("Atorvastatin", "40mg", "once daily"),
    ("Amlodipine", "5mg", "once daily"),
    ("Omeprazole", "20mg", "once daily"),
    ("Levothyroxine", "50mcg", "once daily"),
    ("Albuterol", "90mcg", "as needed"),
    ("Prednisone", "10mg", "once daily"),
    ("Amoxicillin", "500mg", "three times daily"),
    ("Ibuprofen", "400mg", "every 6 hours"),
    ("Acetaminophen", "500mg", "every 4-6 hours"),
    ("Gabapentin", "300mg", "three times daily"),
    ("Hydrochlorothiazide", "25mg", "once daily"),
    ("Losartan", "50mg", "once daily"),
    ("Metoprolol", "25mg", "twice daily"),
    ("Sertraline", "50mg", "once daily"),
    ("Fluoxetine", "20mg", "once daily"),
    ("Montelukast", "10mg", "once daily"),
    ("Pantoprazole", "40mg", "once daily"),
    ("Clopidogrel", "75mg", "once daily"),
    ("Warfarin", "5mg", "once daily"),
    ("Insulin Glargine", "20 units", "once daily"),
    ("Rosuvastatin", "10mg", "once daily"),
]


def seed_medications(cur, patient_ids, raw_ids):
    print("Seeding fhir_medications (300 rows) ...")
    for _ in range(300):
        med = random.choice(MEDICATIONS)
        start = fake.date_between(start_date="-3y", end_date="today")
        # ~40% still active (NULL end_date)
        end = None if random.random() < 0.4 else fake.date_between(
            start_date=start, end_date="today"
        )
        cur.execute(
            """INSERT INTO fhir_medications
               (patient_id, medication_name, dosage, frequency,
                start_date, end_date, prescriber, source_record_id)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                random.choice(patient_ids),
                med[0],
                med[1],
                med[2],
                start,
                end,
                f"Dr. {fake.last_name()}",
                random.choice(raw_ids),
            ),
        )
    print("  -> 300 medications inserted.")


# ── 7. Ingestion Jobs (20 rows) ───────────────────────────────
def seed_ingestion_jobs(cur, source_system_ids):
    print("Seeding ingestion_jobs (20 rows) ...")
    job_types = ["API_PULL", "CSV_IMPORT", "OCR", "VOICE"]
    statuses = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"]
    for _ in range(20):
        status = random.choice(statuses)
        started = fake.date_time_between(start_date="-30d", end_date="now", tzinfo=timezone.utc)
        completed = None
        error = None
        if status == "COMPLETED":
            completed = started + timedelta(minutes=random.randint(1, 120))
        elif status == "FAILED":
            completed = started + timedelta(minutes=random.randint(1, 30))
            error = random.choice([
                "Connection timeout to source system",
                "Invalid CSV format: missing header row",
                "OCR confidence below threshold (0.45)",
                "Voice transcription service unavailable",
                "Authentication token expired",
            ])

        cur.execute(
            """INSERT INTO ingestion_jobs
               (source_system_id, job_type, status, started_at,
                completed_at, records_processed, error_message)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (
                random.choice(source_system_ids),
                random.choice(job_types),
                status,
                started if status != "QUEUED" else None,
                completed,
                random.randint(0, 500) if status == "COMPLETED" else 0,
                error,
            ),
        )
    print("  -> 20 ingestion jobs inserted.")


# ── 8. Audit Log (sample entries) ─────────────────────────────
def seed_audit_log(cur, patient_ids):
    print("Seeding audit_log (sample entries) ...")
    count = 0
    for pid in patient_ids[:50]:
        cur.execute(
            """INSERT INTO audit_log
               (table_name, record_id, action, performed_by, new_value, ip_address)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (
                "fhir_patients",
                pid,
                "INSERT",
                "seed.py",
                json.dumps({"event": "initial_seed"}),
                "127.0.0.1",
            ),
        )
        count += 1
    print(f"  -> {count} audit log entries inserted.")


# ── 9. ML Training Features (400 rows: 200 positive + 200 negative) ──
def _assign_split():
    """70% train, 15% val, 15% test."""
    r = random.random()
    if r < 0.70:
        return "train"
    elif r < 0.85:
        return "val"
    else:
        return "test"


def _compute_ml_features(cur, patient_a_id, patient_b_id, candidate_id, label):
    """Fetch both patients and compute ML feature row."""
    cur.execute(
        """SELECT given_name, family_name, dob, ssn_hash, zip,
                  name_soundex, name_nysiis
           FROM fhir_patients WHERE id = %s""",
        (patient_a_id,),
    )
    a = cur.fetchone()
    cur.execute(
        """SELECT given_name, family_name, dob, ssn_hash, zip,
                  name_soundex, name_nysiis
           FROM fhir_patients WHERE id = %s""",
        (patient_b_id,),
    )
    b = cur.fetchone()
    if not a or not b:
        return None

    name_a = f"{a[0]} {a[1]}"
    name_b = f"{b[0]} {b[1]}"

    jw = round(jellyfish.jaro_winkler_similarity(name_a, name_b), 6)
    lev = jellyfish.levenshtein_distance(name_a, name_b)
    dob_exact = a[2] == b[2]
    dob_year = a[2].year == b[2].year if (a[2] and b[2]) else False
    dob_off_by_one = abs((a[2] - b[2]).days) == 1 if (a[2] and b[2]) else False
    ssn_last4 = (a[3][-4:] == b[3][-4:]) if (a[3] and b[3]) else False
    zip_match = a[4] == b[4] if (a[4] and b[4]) else False
    phonetic = (a[5] == b[5]) or (a[6] == b[6])

    return (
        candidate_id, jw, lev, dob_exact, dob_year, dob_off_by_one,
        ssn_last4, zip_match, phonetic, label, _assign_split(),
    )


def seed_ml_training_features(cur, dup_pairs, all_patient_ids):
    print("Seeding ml_training_features (400 rows: 200 positive + 200 negative) ...")

    # --- 200 positive pairs (label=1) from entity_resolution_candidates ---
    positive_count = 0
    for orig_id, dup_id in dup_pairs:
        # Look up the candidate row id
        cur.execute(
            """SELECT id FROM entity_resolution_candidates
               WHERE record_a_id = %s AND record_b_id = %s LIMIT 1""",
            (orig_id, dup_id),
        )
        row = cur.fetchone()
        if not row:
            continue
        cand_id = row[0]

        feat = _compute_ml_features(cur, orig_id, dup_id, cand_id, 1)
        if feat:
            cur.execute(
                """INSERT INTO ml_training_features
                   (candidate_id, jaro_winkler_name, levenshtein_name,
                    dob_exact_match, dob_year_match, dob_off_by_one,
                    ssn_last4_match, zip_match, phonetic_name_match,
                    label, dataset_split)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                feat,
            )
            positive_count += 1

    # --- 200 negative pairs (label=0) from confirmed non-duplicates ---
    # Pick patients far apart: different DOB year, different soundex, different zip
    negative_count = 0
    used_pairs = set()
    attempts = 0
    while negative_count < 200 and attempts < 5000:
        attempts += 1
        idx_a = random.randint(0, len(all_patient_ids) - 1)
        idx_b = random.randint(0, len(all_patient_ids) - 1)
        if idx_a == idx_b:
            continue
        pair_key = (min(idx_a, idx_b), max(idx_a, idx_b))
        if pair_key in used_pairs:
            continue

        pid_a = all_patient_ids[idx_a]
        pid_b = all_patient_ids[idx_b]

        # Verify they are genuinely different
        cur.execute(
            "SELECT dob, name_soundex, zip FROM fhir_patients WHERE id = %s", (pid_a,)
        )
        pa = cur.fetchone()
        cur.execute(
            "SELECT dob, name_soundex, zip FROM fhir_patients WHERE id = %s", (pid_b,)
        )
        pb = cur.fetchone()
        if not pa or not pb:
            continue
        if pa[0] and pb[0] and pa[0].year == pb[0].year:
            continue
        if pa[1] == pb[1]:
            continue
        if pa[2] == pb[2]:
            continue

        used_pairs.add(pair_key)

        # Insert a candidate row (so we have a FK), then the feature row
        cand_id = uuid.uuid4()
        cur.execute(
            """INSERT INTO entity_resolution_candidates
               (id, record_a_id, record_b_id, blocking_key,
                soundex_score, nysiis_score, dob_match, ssn_partial_match,
                vector_similarity, composite_score)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                cand_id, pid_a, pid_b,
                f"NEG-{fake.lexify('??????').upper()}",
                round(random.uniform(0.0, 0.3), 4),
                round(random.uniform(0.0, 0.3), 4),
                False, False,
                round(random.uniform(0.0, 0.3), 4),
                round(random.uniform(0.0, 0.3), 4),
            ),
        )

        feat = _compute_ml_features(cur, pid_a, pid_b, cand_id, 0)
        if feat:
            cur.execute(
                """INSERT INTO ml_training_features
                   (candidate_id, jaro_winkler_name, levenshtein_name,
                    dob_exact_match, dob_year_match, dob_off_by_one,
                    ssn_last4_match, zip_match, phonetic_name_match,
                    label, dataset_split)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                feat,
            )
            negative_count += 1

    print(f"  -> {positive_count} positive (label=1) + {negative_count} negative (label=0) = {positive_count + negative_count} total.")


# ── Main ───────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Intelligent Clinical Data Integration — Database Seeder")
    print("=" * 60)

    conn = get_conn()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Seed in dependency order
        source_ids = seed_source_systems(cur)
        base_ids, dup_pairs = seed_patients(cur)
        all_patient_ids = base_ids + [d[1] for d in dup_pairs]
        raw_ids = seed_raw_records(cur, source_ids, all_patient_ids)
        seed_observations(cur, all_patient_ids, raw_ids)
        seed_medications(cur, all_patient_ids, raw_ids)
        seed_entity_resolution(cur, dup_pairs, all_patient_ids)
        seed_ml_training_features(cur, dup_pairs, all_patient_ids)
        seed_ingestion_jobs(cur, source_ids)
        seed_audit_log(cur, all_patient_ids)

        conn.commit()
        print("\n" + "=" * 60)
        print("Seeding complete!")
        print("=" * 60)

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()

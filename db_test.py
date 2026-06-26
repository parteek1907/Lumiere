"""
db_test.py — Quick sanity check for the clinical database.
Run after seeding to verify everything is in place.

Usage:
    python db_test.py
"""

import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:hackathon123@localhost:5432/clinical_db",
)

EXPECTED_TABLES = [
    "source_systems",
    "raw_patient_records",
    "fhir_patients",
    "fhir_observations",
    "fhir_medications",
    "entity_resolution_candidates",
    "master_patient_index",
    "mpi_source_links",
    "audit_log",
    "ingestion_jobs",
    "ml_training_features",
]

results = []


def check(name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    msg = f"  [{status}] {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append(passed)


def main():
    print("=" * 60)
    print("Database Sanity Check")
    print("=" * 60)

    # 1. Connection
    try:
        conn = psycopg2.connect(DATABASE_URL)
        psycopg2.extras.register_uuid()
        cur = conn.cursor()
        check("Can connect to database?", True, "YES")
    except Exception as e:
        check("Can connect to database?", False, f"NO — {e}")
        sys.exit(1)

    try:
        # 2. fhir_patients count (~700)
        cur.execute("SELECT COUNT(*) FROM fhir_patients")
        count = cur.fetchone()[0]
        check("fhir_patients count", 650 <= count <= 750, f"{count} (expect ~700)")

        # 3. entity_resolution_candidates count (~200+)
        cur.execute("SELECT COUNT(*) FROM entity_resolution_candidates")
        count = cur.fetchone()[0]
        check("entity_resolution_candidates count", count >= 200, f"{count} (expect >= 200)")

        # 4. ml_training_features count + label balance
        cur.execute("SELECT COUNT(*) FROM ml_training_features")
        total_ml = cur.fetchone()[0]
        cur.execute("SELECT label, COUNT(*) FROM ml_training_features GROUP BY label ORDER BY label")
        label_rows = dict(cur.fetchall())
        zeros = label_rows.get(0, 0)
        ones = label_rows.get(1, 0)
        check(
            "ml_training_features count + balance",
            total_ml >= 390 and abs(ones - zeros) <= 20,
            f"{total_ml} total, label=1: {ones}, label=0: {zeros}",
        )

        # 5. Dataset split counts
        cur.execute(
            "SELECT dataset_split, COUNT(*) FROM ml_training_features GROUP BY dataset_split ORDER BY dataset_split"
        )
        splits = dict(cur.fetchall())
        train_n = splits.get("train", 0)
        val_n = splits.get("val", 0)
        test_n = splits.get("test", 0)
        check(
            "Dataset split distribution",
            train_n > val_n and train_n > test_n,
            f"train={train_n}, val={val_n}, test={test_n} (expect ~70/15/15)",
        )

        # 6. fhir_observations with embeddings
        cur.execute("SELECT COUNT(*) FROM fhir_observations WHERE embedding IS NOT NULL")
        embed_count = cur.fetchone()[0]
        check(
            "fhir_observations with embeddings",
            True,  # informational — 0 is expected before embed script
            f"{embed_count} (expect 0 until embed_observations.py is run)",
        )

        # 7. pgvector extension loaded?
        cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        has_pgvec = cur.fetchone() is not None
        check("pgvector extension loaded?", has_pgvec, "YES" if has_pgvec else "NO")

        # 8. All 11 tables present?
        cur.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
        existing = {r[0] for r in cur.fetchall()}
        missing = [t for t in EXPECTED_TABLES if t not in existing]
        all_present = len(missing) == 0
        detail = "YES — all 11 tables" if all_present else f"NO — missing: {', '.join(missing)}"
        check("All 11 tables present?", all_present, detail)

    finally:
        cur.close()
        conn.close()

    # Summary
    passed = sum(results)
    total = len(results)
    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} checks passed")
    if passed == total:
        print("ALL CHECKS PASSED")
    else:
        print("SOME CHECKS FAILED — review output above")
    print("=" * 60)
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()

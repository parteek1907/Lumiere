"""
export_for_ml.py — Export ML training features to CSV for XGBoost training.
Run once after seeding the database.

Usage:
    python export_for_ml.py
"""

import csv
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

COLUMNS = [
    "id", "candidate_id",
    "jaro_winkler_name", "levenshtein_name",
    "dob_exact_match", "dob_year_match", "dob_off_by_one",
    "ssn_last4_match", "zip_match", "phonetic_name_match",
    "label", "dataset_split",
]

FEATURE_COLS = [c for c in COLUMNS if c not in ("id", "candidate_id", "dataset_split")]


def export_split(cur, split_name: str, filename: str) -> int:
    cur.execute(
        f"SELECT {', '.join(FEATURE_COLS)} FROM ml_training_features WHERE dataset_split = %s",
        (split_name,),
    )
    rows = cur.fetchall()
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(FEATURE_COLS)
        writer.writerows(rows)
    return len(rows)


def main():
    psycopg2.extras.register_uuid()
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        train_n = export_split(cur, "train", "train.csv")
        val_n = export_split(cur, "val", "val.csv")
        test_n = export_split(cur, "test", "test.csv")

        # Count label balance
        cur.execute("SELECT label, COUNT(*) FROM ml_training_features GROUP BY label ORDER BY label")
        label_counts = dict(cur.fetchall())
        zeros = label_counts.get(0, 0)
        ones = label_counts.get(1, 0)

        print(f"Train: {train_n} rows | Val: {val_n} rows | Test: {test_n} rows | Label balance: {ones}/{zeros} (1s/0s)")
        print(f"\nFiles created: train.csv, val.csv, test.csv")

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()

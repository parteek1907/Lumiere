"""
embed_observations.py — Generate 384-dim embeddings for clinical notes using
the free all-MiniLM-L6-v2 model (sentence-transformers). No API key needed.

Usage:
    pip install sentence-transformers pgvector psycopg2-binary
    python embed_observations.py
"""

import os

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:hackathon123@localhost:5432/clinical_db",
)
MODEL_NAME = "all-MiniLM-L6-v2"
BATCH_LOG_INTERVAL = 50


def main():
    psycopg2.extras.register_uuid()
    print(f"Loading model: {MODEL_NAME} ...")
    model = SentenceTransformer(MODEL_NAME)

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Fetch observations that need embedding
        cur.execute(
            """SELECT id, notes_text FROM fhir_observations
               WHERE embedding IS NULL AND notes_text IS NOT NULL"""
        )
        rows = cur.fetchall()
        total = len(rows)
        print(f"Found {total} observations to embed.")

        if total == 0:
            print("Nothing to do.")
            return

        embedded = 0
        for obs_id, notes_text in rows:
            vec = model.encode(notes_text).tolist()
            cur.execute(
                """UPDATE fhir_observations
                   SET embedding = %s::vector,
                       embedding_model = %s,
                       embedding_status = 'DONE'
                   WHERE id = %s""",
                (str(vec), MODEL_NAME, obs_id),
            )
            embedded += 1

            if embedded % BATCH_LOG_INTERVAL == 0:
                conn.commit()
                print(f"  Progress: {embedded}/{total} embedded ...")

        conn.commit()
        print(f"\nDone! Total embedded: {embedded}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()

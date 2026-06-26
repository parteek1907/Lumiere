# Intelligent Clinical Data Integration

**Master Patient Index (Golden Record)** from fragmented hospital records.

Healthcare hackathon project — PostgreSQL 16 + pgvector + SQLAlchemy 2.x.

---

## Tech Stack (100% Free)

| Component        | Technology                             |
| ---------------- | -------------------------------------- |
| Database         | PostgreSQL 16 + pgvector               |
| ORM              | SQLAlchemy 2.x, psycopg2-binary       |
| Migrations       | Alembic                                |
| Seed Data        | Faker + jellyfish                      |
| Infrastructure   | Docker + docker-compose                |
| DB Admin UI      | pgAdmin 4                              |

---

## Quick Start

### 1. Start the database and pgAdmin

```bash
docker compose up -d
```

This launches:
- **PostgreSQL 16** (with pgvector) on port `5432`
- **pgAdmin 4** on port `5050`

The `schema.sql` file is automatically executed on first startup, creating all 11 tables, indexes, and triggers.

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Seed the database

```bash
python seed.py
```

This generates:
- 4 source systems (Epic EHR, LabCorp, PDF Archive, Voice System)
- 700 FHIR patients (500 base + 200 intentional duplicates)
- 400+ entity resolution candidate pairs (200 duplicates + 200 non-duplicates)
- 200 Master Patient Index golden records with source links
- 400 ML training features (balanced 50/50, split 70/15/15 train/val/test)
- 1,000 FHIR observations (labs, vitals, notes)
- 300 FHIR medications
- 500 raw patient records
- 20 ingestion jobs
- 50 audit log entries

### 4. Open pgAdmin

Navigate to [http://localhost:5050](http://localhost:5050)

- **Email:** `admin@hackathon.com`
- **Password:** `admin123`

### 5. Connect to the database in pgAdmin

Add a new server with:

| Field    | Value            |
| -------- | ---------------- |
| Host     | `postgres`       |
| Port     | `5432`           |
| Username | `postgres`       |
| Password | `hackathon123`   |
| Database | `clinical_db`    |

---

## Database Schema (11 Tables)

```
source_systems              — Upstream data sources (EHR, LIS, PDF, Voice)
raw_patient_records         — Raw ingested records (JSONB payload)
fhir_patients               — FHIR R4 normalized patient model
fhir_observations           — Labs, vitals, notes + pgvector embedding (384-dim)
fhir_medications            — Full medication history
entity_resolution_candidates — Candidate duplicate pairs with match scores
master_patient_index        — Golden Record with confidence scoring
mpi_source_links            — Links source patients → golden record
audit_log                   — Immutable HIPAA compliance log
ingestion_jobs              — Pipeline job tracking
ml_training_features        — Pre-computed ML features for XGBoost (label 0/1)
```

### Entity Resolution Flow

```
raw_patient_records
        │
        ▼
  fhir_patients (normalized)
        │
        ▼
entity_resolution_candidates (blocking + scoring)
        │
        ├── score > 0.85  → AUTO_MATCHED
        ├── 0.60 – 0.85   → MANUAL_REVIEW
        └── < 0.60         → REJECTED
        │
        ▼
master_patient_index (Golden Record)
        │
        ▼
mpi_source_links (N source patients → 1 golden)
```

---

## Key Features

- **pgvector embeddings** on `fhir_observations.embedding` (384-dim, all-MiniLM-L6-v2) for RAG-powered clinical search
- **ML training pipeline** — balanced label=0/1 dataset with pre-computed Jaro-Winkler, Levenshtein, phonetic features
- **Phonetic matching** with precomputed Soundex and NYSIIS codes on patient names
- **SHA-256 SSN hashing** — plain SSNs are never stored; a trigger enforces valid hex format
- **Immutable audit log** — triggers block UPDATE and DELETE on `audit_log`
- **Auto-updated timestamps** — `updated_at` triggers on key tables
- **GIN index** on JSONB raw payloads for fast document queries
- **IVFFlat index** on vector embeddings for approximate nearest-neighbor search

---

## Alembic Migrations

The migration at `migrations/versions/001_initial.py` replicates the full schema.sql programmatically.

```bash
# Run migrations (alternative to docker-entrypoint schema.sql)
alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "description"
```

---

## Project Structure

```
├── docker-compose.yml          # PostgreSQL 16 + pgAdmin 4
├── schema.sql                  # Full DDL (auto-executed on first docker start)
├── models.py                   # SQLAlchemy 2.x ORM models (11 tables)
├── seed.py                     # Faker-based synthetic data seeder
├── export_for_ml.py            # Export ML features to train/val/test CSV
├── embed_observations.py       # Generate 384-dim embeddings for clinical notes
├── db_test.py                  # Sanity check script (PASS/FAIL per check)
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variable template
├── alembic.ini                 # Alembic configuration
├── migrations/
│   ├── env.py                  # Alembic environment
│   ├── script.py.mako          # Migration template
│   └── versions/
│       └── 001_initial.py      # Initial migration (all 11 tables)
└── README.md
```

---

## ML Training Pipeline

After seeding, export the pre-computed features for your ML teammate:

```bash
python export_for_ml.py
```

Outputs `train.csv`, `val.csv`, `test.csv` with balanced labels (50/50) and a 70/15/15 split.

---

## Embedding Clinical Notes

Generate 384-dim embeddings for all clinical notes using the free `all-MiniLM-L6-v2` model:

```bash
python embed_observations.py
```

This updates `fhir_observations.embedding` and sets `embedding_status='DONE'` for every row with `notes_text`.

---

## Sanity Check

Run `db_test.py` to verify the database is correctly set up:

```bash
python db_test.py
```

Checks: connection, row counts, label balance, dataset splits, pgvector extension, and all 11 tables.

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable           | Default                                                      |
| ------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`     | `postgresql://postgres:hackathon123@localhost:5432/clinical_db` |
| `PGADMIN_EMAIL`    | `admin@hackathon.com`                                        |
| `PGADMIN_PASSWORD` | `admin123`                                                   |

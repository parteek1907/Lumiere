"""Initial schema — all 11 tables, indexes, triggers

Revision ID: 001_initial
Revises: None
Create Date: 2026-04-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP, INET

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Extensions ---
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    # --- TABLE 1: source_systems ---
    op.create_table(
        "source_systems",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("system_name", sa.String(100), nullable=False),
        sa.Column("system_type", sa.String(20)),
        sa.Column("base_url", sa.Text),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("system_type IN ('EHR','LIS','PDF','VOICE')", name="ck_source_systems_type"),
        comment="Tracks each upstream data source (Epic, LabCorp, PDF archive, Voice)",
    )

    # --- TABLE 2: raw_patient_records ---
    op.create_table(
        "raw_patient_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source_system_id", UUID(as_uuid=True), sa.ForeignKey("source_systems.id")),
        sa.Column("external_patient_id", sa.String(100)),
        sa.Column("raw_payload", JSONB, nullable=False),
        sa.Column("ingestion_method", sa.String(10)),
        sa.Column("ingestion_status", sa.String(15), server_default=sa.text("'PENDING'")),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("ingestion_method IN ('API','CSV','OCR','VOICE')", name="ck_raw_ingestion_method"),
        sa.CheckConstraint("ingestion_status IN ('PENDING','PROCESSING','DONE','FAILED')", name="ck_raw_ingestion_status"),
        comment="Raw records before normalization — never modify after insert",
    )

    # --- TABLE 3: fhir_patients ---
    op.create_table(
        "fhir_patients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("fhir_id", sa.String(100), unique=True),
        sa.Column("family_name", sa.String(100)),
        sa.Column("given_name", sa.String(100)),
        sa.Column("dob", sa.Date),
        sa.Column("gender", sa.String(10)),
        sa.Column("ssn_hash", sa.String(64)),
        sa.Column("phone", sa.String(20)),
        sa.Column("address_line", sa.String(255)),
        sa.Column("city", sa.String(100)),
        sa.Column("state", sa.String(50)),
        sa.Column("zip", sa.String(10)),
        sa.Column("name_soundex", sa.String(20)),
        sa.Column("name_nysiis", sa.String(100)),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        comment="FHIR R4 normalized canonical patient model",
    )

    # --- TABLE 4: fhir_observations ---
    op.create_table(
        "fhir_observations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("fhir_patients.id", ondelete="CASCADE")),
        sa.Column("source_record_id", UUID(as_uuid=True), sa.ForeignKey("raw_patient_records.id")),
        sa.Column("obs_type", sa.String(50)),
        sa.Column("obs_code", sa.String(50)),
        sa.Column("obs_value", sa.Text),
        sa.Column("obs_unit", sa.String(30)),
        sa.Column("obs_datetime", TIMESTAMP(timezone=True)),
        sa.Column("notes_text", sa.Text),
        sa.Column("embedding", sa.Text, nullable=True),  # placeholder; raw SQL below creates vector type
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        comment="Lab results, vitals, physician notes. embedding column powers the RAG pipeline",
    )
    # Replace the text placeholder with actual vector(384) column
    op.execute("ALTER TABLE fhir_observations DROP COLUMN embedding")
    op.execute("ALTER TABLE fhir_observations ADD COLUMN embedding vector(384)")
    op.execute("ALTER TABLE fhir_observations ADD COLUMN embedding_model VARCHAR(100) DEFAULT NULL")
    op.execute("ALTER TABLE fhir_observations ADD COLUMN embedding_status VARCHAR(20) DEFAULT 'PENDING' CHECK (embedding_status IN ('PENDING','DONE','FAILED'))")

    # --- TABLE 5: fhir_medications ---
    op.create_table(
        "fhir_medications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("fhir_patients.id", ondelete="CASCADE")),
        sa.Column("medication_name", sa.String(200)),
        sa.Column("dosage", sa.String(100)),
        sa.Column("frequency", sa.String(100)),
        sa.Column("start_date", sa.Date),
        sa.Column("end_date", sa.Date),
        sa.Column("prescriber", sa.String(200)),
        sa.Column("source_record_id", UUID(as_uuid=True), sa.ForeignKey("raw_patient_records.id")),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        comment="Full medication history per patient",
    )

    # --- TABLE 6: entity_resolution_candidates ---
    op.create_table(
        "entity_resolution_candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("record_a_id", UUID(as_uuid=True), sa.ForeignKey("fhir_patients.id")),
        sa.Column("record_b_id", UUID(as_uuid=True), sa.ForeignKey("fhir_patients.id")),
        sa.Column("blocking_key", sa.String(100)),
        sa.Column("soundex_score", sa.Float),
        sa.Column("nysiis_score", sa.Float),
        sa.Column("dob_match", sa.Boolean, server_default=sa.text("false")),
        sa.Column("ssn_partial_match", sa.Boolean, server_default=sa.text("false")),
        sa.Column("vector_similarity", sa.Float),
        sa.Column("composite_score", sa.Float),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("soundex_score BETWEEN 0 AND 1", name="ck_erc_soundex"),
        sa.CheckConstraint("nysiis_score BETWEEN 0 AND 1", name="ck_erc_nysiis"),
        sa.CheckConstraint("vector_similarity BETWEEN 0 AND 1", name="ck_erc_vector"),
        sa.CheckConstraint("composite_score BETWEEN 0 AND 1", name="ck_erc_composite"),
        comment="Candidate duplicate pairs generated by the blocking step before ML classification",
    )

    # --- TABLE 7: master_patient_index ---
    op.create_table(
        "master_patient_index",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("golden_patient_id", UUID(as_uuid=True), nullable=False),
        sa.Column("confidence_score", sa.Float),
        sa.Column("resolution_status", sa.String(20), server_default=sa.text("'MANUAL_REVIEW'")),
        sa.Column("resolved_by", sa.String(100)),
        sa.Column("resolved_at", TIMESTAMP(timezone=True)),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("confidence_score BETWEEN 0 AND 1", name="ck_mpi_confidence"),
        sa.CheckConstraint(
            "resolution_status IN ('AUTO_MATCHED','MANUAL_REVIEW','CONFIRMED','REJECTED')",
            name="ck_mpi_status",
        ),
        comment="The Golden Record. AUTO_MATCHED if score > 0.85, MANUAL_REVIEW if 0.6-0.85, REJECTED if < 0.6",
    )

    # --- TABLE 8: mpi_source_links ---
    op.create_table(
        "mpi_source_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("mpi_id", UUID(as_uuid=True), sa.ForeignKey("master_patient_index.id", ondelete="CASCADE")),
        sa.Column("source_patient_id", UUID(as_uuid=True), sa.ForeignKey("fhir_patients.id")),
        sa.Column("link_weight", sa.Float),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        comment="Maps multiple source patient records to one golden record",
    )

    # --- TABLE 9: audit_log ---
    op.create_table(
        "audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("table_name", sa.String(100), nullable=False),
        sa.Column("record_id", UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(20)),
        sa.Column("performed_by", sa.String(100)),
        sa.Column("old_value", JSONB),
        sa.Column("new_value", JSONB),
        sa.Column("ip_address", INET),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "action IN ('INSERT','UPDATE','DELETE','MANUAL_REVIEW')", name="ck_audit_action"
        ),
        comment="Immutable HIPAA compliance log. No UPDATE or DELETE ever allowed on this table",
    )

    # --- TABLE 10: ingestion_jobs ---
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source_system_id", UUID(as_uuid=True), sa.ForeignKey("source_systems.id")),
        sa.Column("job_type", sa.String(20)),
        sa.Column("status", sa.String(15), server_default=sa.text("'QUEUED'")),
        sa.Column("started_at", TIMESTAMP(timezone=True)),
        sa.Column("completed_at", TIMESTAMP(timezone=True)),
        sa.Column("records_processed", sa.Integer, server_default=sa.text("0")),
        sa.Column("error_message", sa.Text),
        sa.CheckConstraint("job_type IN ('API_PULL','CSV_IMPORT','OCR','VOICE')", name="ck_job_type"),
        sa.CheckConstraint("status IN ('QUEUED','RUNNING','COMPLETED','FAILED')", name="ck_job_status"),
        comment="Job queue for tracking every data pipeline run",
    )

    # --- TABLE 11: ml_training_features ---
    op.create_table(
        "ml_training_features",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("entity_resolution_candidates.id")),
        sa.Column("jaro_winkler_name", sa.Float),
        sa.Column("levenshtein_name", sa.Integer),
        sa.Column("dob_exact_match", sa.Boolean),
        sa.Column("dob_year_match", sa.Boolean),
        sa.Column("dob_off_by_one", sa.Boolean),
        sa.Column("ssn_last4_match", sa.Boolean),
        sa.Column("zip_match", sa.Boolean),
        sa.Column("phonetic_name_match", sa.Boolean),
        sa.Column("label", sa.SmallInteger),
        sa.Column("dataset_split", sa.String(10)),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.CheckConstraint("label IN (0,1)", name="ck_ml_label"),
        sa.CheckConstraint("dataset_split IN ('train','val','test')", name="ck_ml_split"),
        comment="Pre-computed ML features for XGBoost training. This is what the ML teammate trains on.",
    )

    # ===== INDEXES =====
    op.create_index("idx_fhir_patients_ssn_dob", "fhir_patients", ["ssn_hash", "dob"])
    op.create_index("idx_fhir_patients_soundex", "fhir_patients", ["name_soundex"])
    op.create_index("idx_fhir_patients_nysiis", "fhir_patients", ["name_nysiis"])
    op.execute("CREATE INDEX idx_raw_patient_payload_gin ON raw_patient_records USING GIN (raw_payload)")
    op.create_index("idx_mpi_resolution_status", "master_patient_index", ["resolution_status"])
    op.create_index("idx_audit_log_table_record", "audit_log", ["table_name", "record_id"])
    op.execute(
        "CREATE INDEX idx_fhir_obs_embedding ON fhir_observations "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    op.create_index("idx_ml_features_split", "ml_training_features", ["dataset_split"])

    # ===== TRIGGERS =====

    # 1. Auto-update updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    for tbl in ("raw_patient_records", "fhir_patients", "master_patient_index"):
        op.execute(f"""
            CREATE TRIGGER set_updated_at_{tbl}
                BEFORE UPDATE ON {tbl}
                FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
        """)

    # 2. Block DELETE and UPDATE on audit_log
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_audit_log_immutable()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log is immutable';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER audit_log_no_update
            BEFORE UPDATE ON audit_log
            FOR EACH ROW EXECUTE FUNCTION trg_audit_log_immutable();
    """)
    op.execute("""
        CREATE TRIGGER audit_log_no_delete
            BEFORE DELETE ON audit_log
            FOR EACH ROW EXECUTE FUNCTION trg_audit_log_immutable();
    """)

    # 3. SSN guard on fhir_patients
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_ssn_hash_guard()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.ssn_hash IS NOT NULL AND NEW.ssn_hash !~ '^[0-9a-f]{64}$' THEN
                RAISE EXCEPTION 'Only SHA-256 hashes allowed in ssn_hash';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER ssn_hash_guard
            BEFORE INSERT OR UPDATE ON fhir_patients
            FOR EACH ROW EXECUTE FUNCTION trg_ssn_hash_guard();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS ssn_hash_guard ON fhir_patients")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log")
    for tbl in ("raw_patient_records", "fhir_patients", "master_patient_index"):
        op.execute(f"DROP TRIGGER IF EXISTS set_updated_at_{tbl} ON {tbl}")
    op.execute("DROP FUNCTION IF EXISTS trg_ssn_hash_guard()")
    op.execute("DROP FUNCTION IF EXISTS trg_audit_log_immutable()")
    op.execute("DROP FUNCTION IF EXISTS trg_set_updated_at()")

    # Drop tables in reverse dependency order
    for tbl in (
        "ml_training_features",
        "ingestion_jobs",
        "audit_log",
        "mpi_source_links",
        "master_patient_index",
        "entity_resolution_candidates",
        "fhir_medications",
        "fhir_observations",
        "fhir_patients",
        "raw_patient_records",
        "source_systems",
    ):
        op.drop_table(tbl)

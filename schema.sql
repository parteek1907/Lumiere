-- ============================================================
-- Intelligent Clinical Data Integration — PostgreSQL 16 Schema
-- Master Patient Index (Golden Record) from fragmented hospital records
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch"; -- soundex(), difference()
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector for RAG embeddings

-- ============================================================
-- TABLE 1: source_systems
-- Tracks each upstream data source (Epic, LabCorp, PDF archive, Voice)
-- ============================================================
CREATE TABLE source_systems (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_name     VARCHAR(100) NOT NULL,
    system_type     VARCHAR(20) CHECK (system_type IN ('EHR','LIS','PDF','VOICE')),
    base_url        TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE source_systems IS 'Tracks each upstream data source (Epic, LabCorp, PDF archive, Voice)';

-- ============================================================
-- TABLE 2: raw_patient_records
-- Raw records before normalization — never modify after insert
-- ============================================================
CREATE TABLE raw_patient_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system_id    UUID REFERENCES source_systems(id),
    external_patient_id VARCHAR(100),
    raw_payload         JSONB NOT NULL,
    ingestion_method    VARCHAR(10) CHECK (ingestion_method IN ('API','CSV','OCR','VOICE')),
    ingestion_status    VARCHAR(15) CHECK (ingestion_status IN ('PENDING','PROCESSING','DONE','FAILED')) DEFAULT 'PENDING',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE raw_patient_records IS 'Raw records before normalization — never modify after insert';

-- ============================================================
-- TABLE 3: fhir_patients
-- FHIR R4 normalized canonical patient model
-- ============================================================
CREATE TABLE fhir_patients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fhir_id         VARCHAR(100) UNIQUE,
    family_name     VARCHAR(100),
    given_name      VARCHAR(100),
    dob             DATE,
    gender          VARCHAR(10),
    ssn_hash        CHAR(64),           -- SHA-256 only, NEVER store plain SSN
    phone           VARCHAR(20),
    address_line    VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(50),
    zip             VARCHAR(10),
    name_soundex    VARCHAR(20),        -- precomputed Soundex
    name_nysiis     VARCHAR(100),       -- precomputed NYSIIS
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE fhir_patients IS 'FHIR R4 normalized canonical patient model';

-- ============================================================
-- TABLE 4: fhir_observations
-- Lab results, vitals, physician notes. embedding column powers the RAG pipeline
-- ============================================================
CREATE TABLE fhir_observations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        UUID REFERENCES fhir_patients(id) ON DELETE CASCADE,
    source_record_id  UUID REFERENCES raw_patient_records(id),
    obs_type          VARCHAR(50),
    obs_code          VARCHAR(50),
    obs_value         TEXT,
    obs_unit          VARCHAR(30),
    obs_datetime      TIMESTAMPTZ,
    notes_text        TEXT,
    embedding         vector(384),      -- pgvector column for RAG (all-MiniLM-L6-v2)
    embedding_model   VARCHAR(100) DEFAULT NULL,
    embedding_status  VARCHAR(20) CHECK (embedding_status IN ('PENDING','DONE','FAILED')) DEFAULT 'PENDING',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE fhir_observations IS 'Lab results, vitals, physician notes. embedding column powers the RAG pipeline';

-- ============================================================
-- TABLE 5: fhir_medications
-- Full medication history per patient
-- ============================================================
CREATE TABLE fhir_medications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        UUID REFERENCES fhir_patients(id) ON DELETE CASCADE,
    medication_name   VARCHAR(200),
    dosage            VARCHAR(100),
    frequency         VARCHAR(100),
    start_date        DATE,
    end_date          DATE,             -- NULL means currently active
    prescriber        VARCHAR(200),
    source_record_id  UUID REFERENCES raw_patient_records(id),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE fhir_medications IS 'Full medication history per patient';

-- ============================================================
-- TABLE 6: entity_resolution_candidates
-- Candidate duplicate pairs generated by the blocking step before ML classification
-- ============================================================
CREATE TABLE entity_resolution_candidates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_a_id       UUID REFERENCES fhir_patients(id),
    record_b_id       UUID REFERENCES fhir_patients(id),
    blocking_key      VARCHAR(100),
    soundex_score     FLOAT CHECK (soundex_score BETWEEN 0 AND 1),
    nysiis_score      FLOAT CHECK (nysiis_score BETWEEN 0 AND 1),
    dob_match         BOOLEAN DEFAULT FALSE,
    ssn_partial_match BOOLEAN DEFAULT FALSE,
    vector_similarity FLOAT CHECK (vector_similarity BETWEEN 0 AND 1),
    composite_score   FLOAT CHECK (composite_score BETWEEN 0 AND 1),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE entity_resolution_candidates IS 'Candidate duplicate pairs generated by the blocking step before ML classification';

-- ============================================================
-- TABLE 7: master_patient_index
-- The Golden Record. AUTO_MATCHED if score > 0.85, MANUAL_REVIEW if 0.6-0.85, REJECTED if < 0.6
-- ============================================================
CREATE TABLE master_patient_index (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    golden_patient_id   UUID NOT NULL,
    confidence_score    FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    resolution_status   VARCHAR(20) CHECK (resolution_status IN ('AUTO_MATCHED','MANUAL_REVIEW','CONFIRMED','REJECTED')) DEFAULT 'MANUAL_REVIEW',
    resolved_by         VARCHAR(100),       -- NULL until human acts on it
    resolved_at         TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE master_patient_index IS 'The Golden Record. AUTO_MATCHED if score > 0.85, MANUAL_REVIEW if 0.6-0.85, REJECTED if < 0.6';

-- ============================================================
-- TABLE 8: mpi_source_links
-- Maps multiple source patient records to one golden record
-- ============================================================
CREATE TABLE mpi_source_links (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mpi_id            UUID REFERENCES master_patient_index(id) ON DELETE CASCADE,
    source_patient_id UUID REFERENCES fhir_patients(id),
    link_weight       FLOAT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE mpi_source_links IS 'Maps multiple source patient records to one golden record';

-- ============================================================
-- TABLE 9: audit_log
-- Immutable HIPAA compliance log. No UPDATE or DELETE ever allowed on this table
-- ============================================================
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name      VARCHAR(100) NOT NULL,
    record_id       UUID NOT NULL,
    action          VARCHAR(20) CHECK (action IN ('INSERT','UPDATE','DELETE','MANUAL_REVIEW')),
    performed_by    VARCHAR(100),
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE audit_log IS 'Immutable HIPAA compliance log. No UPDATE or DELETE ever allowed on this table';

-- ============================================================
-- TABLE 10: ingestion_jobs
-- Job queue for tracking every data pipeline run
-- ============================================================
CREATE TABLE ingestion_jobs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system_id  UUID REFERENCES source_systems(id),
    job_type          VARCHAR(20) CHECK (job_type IN ('API_PULL','CSV_IMPORT','OCR','VOICE')),
    status            VARCHAR(15) CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED')) DEFAULT 'QUEUED',
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    records_processed INT DEFAULT 0,
    error_message     TEXT
);
COMMENT ON TABLE ingestion_jobs IS 'Job queue for tracking every data pipeline run';

-- ============================================================
-- TABLE 11: ml_training_features
-- Pre-computed ML features for XGBoost training
-- ============================================================
CREATE TABLE ml_training_features (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID REFERENCES entity_resolution_candidates(id),
    jaro_winkler_name   FLOAT,
    levenshtein_name    INT,
    dob_exact_match     BOOLEAN,
    dob_year_match      BOOLEAN,
    dob_off_by_one      BOOLEAN,
    ssn_last4_match     BOOLEAN,
    zip_match           BOOLEAN,
    phonetic_name_match BOOLEAN,
    label               SMALLINT CHECK (label IN (0,1)),
    dataset_split       VARCHAR(10) CHECK (dataset_split IN ('train','val','test')),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE ml_training_features IS 'Pre-computed ML features for XGBoost training. This is what the ML teammate trains on.';


-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_fhir_patients_ssn_dob      ON fhir_patients(ssn_hash, dob);
CREATE INDEX idx_fhir_patients_soundex      ON fhir_patients(name_soundex);
CREATE INDEX idx_fhir_patients_nysiis       ON fhir_patients(name_nysiis);
CREATE INDEX idx_raw_patient_payload_gin    ON raw_patient_records USING GIN (raw_payload);
CREATE INDEX idx_mpi_resolution_status      ON master_patient_index(resolution_status);
CREATE INDEX idx_audit_log_table_record     ON audit_log(table_name, record_id);
-- IVFFlat index for vector similarity — requires rows to exist before creation;
-- create it after seeding data or use the following (works on empty tables in pg16+pgvector 0.5+):
CREATE INDEX idx_fhir_obs_embedding         ON fhir_observations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_ml_features_split           ON ml_training_features(dataset_split);


-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- 1. Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_raw_patient_records
    BEFORE UPDATE ON raw_patient_records
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_fhir_patients
    BEFORE UPDATE ON fhir_patients
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_master_patient_index
    BEFORE UPDATE ON master_patient_index
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- 2. Block DELETE and UPDATE on audit_log
CREATE OR REPLACE FUNCTION trg_audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log_immutable();

CREATE TRIGGER audit_log_no_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log_immutable();

-- 3. SSN guard on fhir_patients
CREATE OR REPLACE FUNCTION trg_ssn_hash_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ssn_hash IS NOT NULL AND NEW.ssn_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Only SHA-256 hashes allowed in ssn_hash';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ssn_hash_guard
    BEFORE INSERT OR UPDATE ON fhir_patients
    FOR EACH ROW EXECUTE FUNCTION trg_ssn_hash_guard();

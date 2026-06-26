"""
SQLAlchemy 2.x ORM models for Intelligent Clinical Data Integration.
Maps all 11 tables for the Master Patient Index (Golden Record) system.
"""

import uuid
from datetime import date, datetime
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ------------------------------------------------------------------
# TABLE 1: source_systems
# ------------------------------------------------------------------
class SourceSystem(Base):
    __tablename__ = "source_systems"
    __table_args__ = (
        CheckConstraint(
            "system_type IN ('EHR','LIS','PDF','VOICE')",
            name="ck_source_systems_type",
        ),
        {"comment": "Tracks each upstream data source (Epic, LabCorp, PDF archive, Voice)"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    system_name: Mapped[str] = mapped_column(String(100), nullable=False)
    system_type: Mapped[Optional[str]] = mapped_column(String(20))
    base_url: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    raw_records = relationship("RawPatientRecord", back_populates="source_system")
    ingestion_jobs = relationship("IngestionJob", back_populates="source_system")


# ------------------------------------------------------------------
# TABLE 2: raw_patient_records
# ------------------------------------------------------------------
class RawPatientRecord(Base):
    __tablename__ = "raw_patient_records"
    __table_args__ = (
        CheckConstraint(
            "ingestion_method IN ('API','CSV','OCR','VOICE')",
            name="ck_raw_ingestion_method",
        ),
        CheckConstraint(
            "ingestion_status IN ('PENDING','PROCESSING','DONE','FAILED')",
            name="ck_raw_ingestion_status",
        ),
        {"comment": "Raw records before normalization — never modify after insert"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    source_system_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_systems.id")
    )
    external_patient_id: Mapped[Optional[str]] = mapped_column(String(100))
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    ingestion_method: Mapped[Optional[str]] = mapped_column(String(10))
    ingestion_status: Mapped[Optional[str]] = mapped_column(
        String(15), server_default=text("'PENDING'")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    source_system = relationship("SourceSystem", back_populates="raw_records")
    observations = relationship("FHIRObservation", back_populates="source_record")
    medications = relationship("FHIRMedication", back_populates="source_record")


# ------------------------------------------------------------------
# TABLE 3: fhir_patients
# ------------------------------------------------------------------
class FHIRPatient(Base):
    __tablename__ = "fhir_patients"
    __table_args__ = (
        {"comment": "FHIR R4 normalized canonical patient model"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    fhir_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    family_name: Mapped[Optional[str]] = mapped_column(String(100))
    given_name: Mapped[Optional[str]] = mapped_column(String(100))
    dob: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(10))
    ssn_hash: Mapped[Optional[str]] = mapped_column(String(64))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    address_line: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(50))
    zip: Mapped[Optional[str]] = mapped_column(String(10))
    name_soundex: Mapped[Optional[str]] = mapped_column(String(20))
    name_nysiis: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    observations = relationship("FHIRObservation", back_populates="patient", cascade="all, delete-orphan")
    medications = relationship("FHIRMedication", back_populates="patient", cascade="all, delete-orphan")
    candidate_a = relationship(
        "EntityResolutionCandidate",
        foreign_keys="EntityResolutionCandidate.record_a_id",
        back_populates="record_a",
    )
    candidate_b = relationship(
        "EntityResolutionCandidate",
        foreign_keys="EntityResolutionCandidate.record_b_id",
        back_populates="record_b",
    )
    mpi_links = relationship("MPISourceLink", back_populates="source_patient")


# ------------------------------------------------------------------
# TABLE 4: fhir_observations
# ------------------------------------------------------------------
class FHIRObservation(Base):
    __tablename__ = "fhir_observations"
    __table_args__ = (
        {"comment": "Lab results, vitals, physician notes. embedding column powers the RAG pipeline"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fhir_patients.id", ondelete="CASCADE")
    )
    source_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("raw_patient_records.id")
    )
    obs_type: Mapped[Optional[str]] = mapped_column(String(50))
    obs_code: Mapped[Optional[str]] = mapped_column(String(50))
    obs_value: Mapped[Optional[str]] = mapped_column(Text)
    obs_unit: Mapped[Optional[str]] = mapped_column(String(30))
    obs_datetime: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    notes_text: Mapped[Optional[str]] = mapped_column(Text)
    embedding = mapped_column(Vector(384), nullable=True)
    embedding_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    embedding_status: Mapped[Optional[str]] = mapped_column(
        String(20), server_default=text("'PENDING'")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    patient = relationship("FHIRPatient", back_populates="observations")
    source_record = relationship("RawPatientRecord", back_populates="observations")


# ------------------------------------------------------------------
# TABLE 5: fhir_medications
# ------------------------------------------------------------------
class FHIRMedication(Base):
    __tablename__ = "fhir_medications"
    __table_args__ = (
        {"comment": "Full medication history per patient"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fhir_patients.id", ondelete="CASCADE")
    )
    medication_name: Mapped[Optional[str]] = mapped_column(String(200))
    dosage: Mapped[Optional[str]] = mapped_column(String(100))
    frequency: Mapped[Optional[str]] = mapped_column(String(100))
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    prescriber: Mapped[Optional[str]] = mapped_column(String(200))
    source_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("raw_patient_records.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    patient = relationship("FHIRPatient", back_populates="medications")
    source_record = relationship("RawPatientRecord", back_populates="medications")


# ------------------------------------------------------------------
# TABLE 6: entity_resolution_candidates
# ------------------------------------------------------------------
class EntityResolutionCandidate(Base):
    __tablename__ = "entity_resolution_candidates"
    __table_args__ = (
        CheckConstraint("soundex_score BETWEEN 0 AND 1", name="ck_erc_soundex"),
        CheckConstraint("nysiis_score BETWEEN 0 AND 1", name="ck_erc_nysiis"),
        CheckConstraint("vector_similarity BETWEEN 0 AND 1", name="ck_erc_vector"),
        CheckConstraint("composite_score BETWEEN 0 AND 1", name="ck_erc_composite"),
        {"comment": "Candidate duplicate pairs generated by the blocking step before ML classification"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    record_a_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fhir_patients.id")
    )
    record_b_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fhir_patients.id")
    )
    blocking_key: Mapped[Optional[str]] = mapped_column(String(100))
    soundex_score: Mapped[Optional[float]] = mapped_column(Float)
    nysiis_score: Mapped[Optional[float]] = mapped_column(Float)
    dob_match: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    ssn_partial_match: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    vector_similarity: Mapped[Optional[float]] = mapped_column(Float)
    composite_score: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    record_a = relationship(
        "FHIRPatient", foreign_keys=[record_a_id], back_populates="candidate_a"
    )
    record_b = relationship(
        "FHIRPatient", foreign_keys=[record_b_id], back_populates="candidate_b"
    )
    ml_features = relationship("MLTrainingFeature", back_populates="candidate")


# ------------------------------------------------------------------
# TABLE 7: master_patient_index
# ------------------------------------------------------------------
class MasterPatientIndex(Base):
    __tablename__ = "master_patient_index"
    __table_args__ = (
        CheckConstraint("confidence_score BETWEEN 0 AND 1", name="ck_mpi_confidence"),
        CheckConstraint(
            "resolution_status IN ('AUTO_MATCHED','MANUAL_REVIEW','CONFIRMED','REJECTED')",
            name="ck_mpi_status",
        ),
        {"comment": "The Golden Record. AUTO_MATCHED if score > 0.85, MANUAL_REVIEW if 0.6-0.85, REJECTED if < 0.6"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    golden_patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float)
    resolution_status: Mapped[Optional[str]] = mapped_column(
        String(20), server_default=text("'MANUAL_REVIEW'")
    )
    resolved_by: Mapped[Optional[str]] = mapped_column(String(100))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    source_links = relationship("MPISourceLink", back_populates="mpi", cascade="all, delete-orphan")


# ------------------------------------------------------------------
# TABLE 8: mpi_source_links
# ------------------------------------------------------------------
class MPISourceLink(Base):
    __tablename__ = "mpi_source_links"
    __table_args__ = (
        {"comment": "Maps multiple source patient records to one golden record"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    mpi_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("master_patient_index.id", ondelete="CASCADE")
    )
    source_patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fhir_patients.id")
    )
    link_weight: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    mpi = relationship("MasterPatientIndex", back_populates="source_links")
    source_patient = relationship("FHIRPatient", back_populates="mpi_links")


# ------------------------------------------------------------------
# TABLE 9: audit_log
# ------------------------------------------------------------------
class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (
        CheckConstraint(
            "action IN ('INSERT','UPDATE','DELETE','MANUAL_REVIEW')",
            name="ck_audit_action",
        ),
        {"comment": "Immutable HIPAA compliance log. No UPDATE or DELETE ever allowed on this table"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    table_name: Mapped[str] = mapped_column(String(100), nullable=False)
    record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[Optional[str]] = mapped_column(String(20))
    performed_by: Mapped[Optional[str]] = mapped_column(String(100))
    old_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    ip_address = mapped_column(INET, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )


# ------------------------------------------------------------------
# TABLE 10: ingestion_jobs
# ------------------------------------------------------------------
class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    __table_args__ = (
        CheckConstraint(
            "job_type IN ('API_PULL','CSV_IMPORT','OCR','VOICE')",
            name="ck_job_type",
        ),
        CheckConstraint(
            "status IN ('QUEUED','RUNNING','COMPLETED','FAILED')",
            name="ck_job_status",
        ),
        {"comment": "Job queue for tracking every data pipeline run"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    source_system_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_systems.id")
    )
    job_type: Mapped[Optional[str]] = mapped_column(String(20))
    status: Mapped[Optional[str]] = mapped_column(
        String(15), server_default=text("'QUEUED'")
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    records_processed: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    source_system = relationship("SourceSystem", back_populates="ingestion_jobs")


# ------------------------------------------------------------------
# TABLE 11: ml_training_features
# ------------------------------------------------------------------
class MLTrainingFeature(Base):
    __tablename__ = "ml_training_features"
    __table_args__ = (
        CheckConstraint("label IN (0,1)", name="ck_ml_label"),
        CheckConstraint("dataset_split IN ('train','val','test')", name="ck_ml_split"),
        {"comment": "Pre-computed ML features for XGBoost training. This is what the ML teammate trains on."},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    candidate_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entity_resolution_candidates.id")
    )
    jaro_winkler_name: Mapped[Optional[float]] = mapped_column(Float)
    levenshtein_name: Mapped[Optional[int]] = mapped_column(Integer)
    dob_exact_match: Mapped[Optional[bool]] = mapped_column(Boolean)
    dob_year_match: Mapped[Optional[bool]] = mapped_column(Boolean)
    dob_off_by_one: Mapped[Optional[bool]] = mapped_column(Boolean)
    ssn_last4_match: Mapped[Optional[bool]] = mapped_column(Boolean)
    zip_match: Mapped[Optional[bool]] = mapped_column(Boolean)
    phonetic_name_match: Mapped[Optional[bool]] = mapped_column(Boolean)
    label: Mapped[Optional[int]] = mapped_column(SmallInteger)
    dataset_split: Mapped[Optional[str]] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("NOW()")
    )

    candidate = relationship("EntityResolutionCandidate", back_populates="ml_features")

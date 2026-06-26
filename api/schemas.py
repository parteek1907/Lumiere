"""
Pydantic v2 response/request schemas for the Clinical Data Integration API.
These are the shapes your frontend receives from every endpoint.
"""

from __future__ import annotations
import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ── helpers ─────────────────────────────────────────────────────────────────
class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Source Systems ────────────────────────────────────────────────────────────
class SourceSystemOut(_Base):
    id: uuid.UUID
    system_name: str
    system_type: Optional[str]
    base_url: Optional[str]
    is_active: bool
    created_at: datetime


# ── FHIR Patient ─────────────────────────────────────────────────────────────
class PatientOut(_Base):
    id: uuid.UUID
    fhir_id: Optional[str]
    family_name: Optional[str]
    given_name: Optional[str]
    dob: Optional[date]
    gender: Optional[str]
    phone: Optional[str]
    address_line: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip: Optional[str]
    created_at: datetime
    updated_at: datetime


class PatientDetailOut(PatientOut):
    observations: List[ObservationOut] = []
    medications: List[MedicationOut] = []
    mpi_links: List[MPISourceLinkOut] = []


# ── FHIR Observations ─────────────────────────────────────────────────────────
class ObservationOut(_Base):
    id: uuid.UUID
    patient_id: Optional[uuid.UUID]
    obs_type: Optional[str]
    obs_code: Optional[str]
    obs_value: Optional[str]
    obs_unit: Optional[str]
    obs_datetime: Optional[datetime]
    notes_text: Optional[str]
    embedding_status: Optional[str]
    created_at: datetime


# ── FHIR Medications ─────────────────────────────────────────────────────────
class MedicationOut(_Base):
    id: uuid.UUID
    patient_id: Optional[uuid.UUID]
    medication_name: Optional[str]
    dosage: Optional[str]
    frequency: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    prescriber: Optional[str]
    created_at: datetime


# ── Entity Resolution Candidates (Duplicate Pairs) ───────────────────────────
class DuplicateCandidateOut(_Base):
    id: uuid.UUID
    record_a_id: Optional[uuid.UUID]
    record_b_id: Optional[uuid.UUID]
    blocking_key: Optional[str]
    soundex_score: Optional[float]
    nysiis_score: Optional[float]
    dob_match: bool
    ssn_partial_match: bool
    vector_similarity: Optional[float]
    composite_score: Optional[float]
    created_at: datetime
    record_a: Optional[PatientOut] = None
    record_b: Optional[PatientOut] = None


# ── Master Patient Index (Golden Record) ─────────────────────────────────────
class MPISourceLinkOut(_Base):
    id: uuid.UUID
    mpi_id: Optional[uuid.UUID]
    source_patient_id: Optional[uuid.UUID]
    link_weight: Optional[float]
    created_at: datetime


class GoldenRecordOut(_Base):
    id: uuid.UUID
    golden_patient_id: uuid.UUID
    confidence_score: Optional[float]
    resolution_status: Optional[str]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    source_links: List[MPISourceLinkOut] = []
    # Enriched fields — joined from fhir_patients at query time
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    patient_gender: Optional[str] = None


class PatientCreateIn(BaseModel):
    given_name: str
    family_name: str
    dob: date
    gender: str
    phone: str
    gov_id: Optional[str] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    source_system: Optional[str] = None


class GoldenRecordUpdateIn(BaseModel):
    resolution_status: Optional[str] = None   # AUTO_MATCHED | MANUAL_REVIEW | CONFIRMED | REJECTED
    resolved_by: Optional[str] = None
    notes: Optional[str] = None


# ── Ingestion request schemas ──────────────────────────────────────────────────

class VoiceIngestIn(BaseModel):
    transcript: str
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    observation_notes: Optional[str] = None


class PdfIngestIn(BaseModel):
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    observation_notes: Optional[str] = None
    raw_text: Optional[str] = None


class MatchRunOut(_Base):
    candidates_created: int
    patients_processed: int


class AskIn(BaseModel):
    question: str
    patient_id: Optional[str] = None


class AskOut(BaseModel):
    answer: str
    confidence: float
    sources: List[str]


# ── Audit Log ─────────────────────────────────────────────────────────────────
class AuditLogOut(_Base):
    id: uuid.UUID
    table_name: str
    record_id: uuid.UUID
    action: Optional[str]
    performed_by: Optional[str]
    created_at: datetime


# ── Ingestion Jobs ────────────────────────────────────────────────────────────
class IngestionJobOut(_Base):
    id: uuid.UUID
    source_system_id: Optional[uuid.UUID]
    job_type: Optional[str]
    status: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    records_processed: int
    error_message: Optional[str]


# ── ML Training Features ──────────────────────────────────────────────────────
class MLFeatureOut(_Base):
    id: uuid.UUID
    candidate_id: Optional[uuid.UUID]
    jaro_winkler_name: Optional[float]
    levenshtein_name: Optional[int]
    dob_exact_match: Optional[bool]
    dob_year_match: Optional[bool]
    dob_off_by_one: Optional[bool]
    ssn_last4_match: Optional[bool]
    zip_match: Optional[bool]
    phonetic_name_match: Optional[bool]
    label: Optional[int]
    dataset_split: Optional[str]


# ── Pagination wrapper ────────────────────────────────────────────────────────
class PageOut(BaseModel):
    total: int
    page: int
    page_size: int
    items: list


# fix forward refs
PatientDetailOut.model_rebuild()

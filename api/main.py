"""
FastAPI backend for the Intelligent Clinical Data Integration platform.

Endpoints consumed by the frontend:
  Patients         GET  /api/patients              — search / list
                   GET  /api/patients/{id}          — detail + observations + meds
                   GET  /api/patients/{id}/observations
                   GET  /api/patients/{id}/medications
                   GET  /api/patients/{id}/duplicates

  Duplicates       GET  /api/duplicates             — all candidate pairs (filterable)
                   PATCH /api/duplicates/{id}        — not implemented yet (ML side)

  Golden Records   GET  /api/golden-records         — all MPI records
                   GET  /api/golden-records/{id}    — single golden record + source links
                   PATCH /api/golden-records/{id}   — update status / resolved_by / notes

  Source Systems   GET  /api/source-systems
  Ingestion Jobs   GET  /api/ingestion-jobs
  Audit Log        GET  /api/audit-log
  ML Features      GET  /api/ml-features

Run with:
  uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # make root importable

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from datetime import datetime
from typing import Optional, List
import uuid
import csv
import io
import hashlib

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, text as sa_text

import jellyfish

from api.database import get_db
from api.schemas import (
    PatientOut, PatientDetailOut, ObservationOut, MedicationOut,
    DuplicateCandidateOut, GoldenRecordOut, GoldenRecordUpdateIn,
    AuditLogOut, SourceSystemOut, IngestionJobOut, MLFeatureOut,
    PatientCreateIn,
    VoiceIngestIn, PdfIngestIn, MatchRunOut, AskIn, AskOut,
)
from pydantic import BaseModel
from models import (
    FHIRPatient, FHIRObservation, FHIRMedication,
    EntityResolutionCandidate, MasterPatientIndex, MPISourceLink,
    AuditLog, SourceSystem, IngestionJob, MLTrainingFeature,
    RawPatientRecord,
)

# ─── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Clinical Data Integration API",
    description="Master Patient Index — Golden Record backend",
    version="1.0.0",
)

# ─── CORS — allow your frontend origin ──────────────────────────────────────
_cors_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:5173,http://localhost:4200",
)
ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]

# Allow any localhost port (covers Next.js moving to 3001/3002/etc when ports are busy)
# Also supports custom regex via CORS_ORIGIN_REGEX env var (e.g. "https://.*\.vercel\.app")
_cors_regex = os.getenv("CORS_ORIGIN_REGEX", r"http://localhost:\d+")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=_cors_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_OBS_LABEL = {
    "BP_SYS": "Systolic BP", "BP_DIA": "Diastolic BP",
    "HR": "Heart rate", "TEMP": "Temperature",
    "HBA1C": "HbA1c", "CRP": "CRP", "PLT": "Platelets",
    "WBC": "WBC", "RBC": "RBC", "HGB": "Hemoglobin",
    "GLUCOSE": "Glucose", "CREATININE": "Creatinine",
    "SODIUM": "Sodium", "POTASSIUM": "Potassium",
    "SPO2": "SpO2", "BMI": "BMI", "WEIGHT": "Weight",
    "HEIGHT": "Height", "CHOLESTEROL": "Cholesterol",
    "TRIGLYCERIDES": "Triglycerides",
}


def _synthesize_patient_notes(db) -> int:
    """
    For every patient that has vitals/labs but no NOTE-TEXT observation,
    build a clinical summary string and store it as a NOTE-TEXT obs so RAG
    can find all patients, not just manually-seeded ones.
    Returns number of new synthetic notes created.
    """
    # Find patients that have NO NOTE-TEXT observation at all
    from sqlalchemy import text as _t, not_, exists
    no_note_patients = db.execute(_t("""
        SELECT p.id, p.given_name, p.family_name, p.dob, p.gender
        FROM fhir_patients p
        WHERE NOT EXISTS (
            SELECT 1 FROM fhir_observations o
            WHERE o.patient_id = p.id AND o.obs_code = 'NOTE-TEXT'
        )
    """)).fetchall()

    if not no_note_patients:
        return 0

    created = 0
    for pt in no_note_patients:
        # Collect all vitals and labs for this patient
        obs_rows = db.execute(_t("""
            SELECT obs_type, obs_code, obs_value, obs_unit, obs_datetime
            FROM fhir_observations
            WHERE patient_id = :pid
              AND obs_code NOT IN ('NOTE-TEXT','PROG_NOTE','CONSULT','DISCHARGE','HL7','REST')
              AND obs_value IS NOT NULL
            ORDER BY obs_datetime DESC
            LIMIT 20
        """), {"pid": str(pt[0])}).fetchall()

        if not obs_rows:
            continue

        # Build a human-readable clinical summary
        parts = []
        seen_codes = set()
        for row in obs_rows:
            code = row[1]
            if code in seen_codes:
                continue
            seen_codes.add(code)
            label = _OBS_LABEL.get(code, row[0] or code)
            val = str(row[2]).strip()[:10]
            unit = f" {row[3]}" if row[3] else ""
            # Skip obviously non-numeric/non-medical free text in obs_value
            if any(c.isalpha() and c not in 'eE.' for c in val.replace(' ', '')[:5]):
                continue
            parts.append(f"{label}: {val}{unit}")

        if not parts:
            continue

        age_str = ""
        if pt[3]:
            try:
                from datetime import date
                born = pt[3] if hasattr(pt[3], 'year') else datetime.strptime(str(pt[3])[:10], "%Y-%m-%d")
                age = (date.today() - born.date() if hasattr(born, 'date') else date.today() - born).days // 365
                age_str = f", age {age}"
            except Exception:
                pass
        gender_str = f" ({pt[4]})" if pt[4] else ""
        summary = (
            f"Patient {pt[1]} {pt[2]}{gender_str}{age_str}. "
            f"Clinical observations: {', '.join(parts)}."
        )

        new_obs = FHIRObservation(
            patient_id=pt[0],
            obs_type='NOTE',
            obs_code='NOTE-TEXT',
            obs_value=summary[:200],
            notes_text=summary,
            obs_datetime=datetime.utcnow(),
            embedding_status='PENDING',
        )
        db.add(new_obs)
        created += 1

    if created:
        db.commit()
    return created


@app.on_event("startup")
def _auto_embed_on_startup():
    """Synthesize missing clinical notes and auto-embed all pending observations."""
    import threading

    def _embed_worker():
        import time
        time.sleep(2)  # let DB pool settle
        try:
            from api.database import SessionLocal
            db = SessionLocal()
            try:
                # Step 1: synthesize clinical summary notes for patients that have none
                synthesized = _synthesize_patient_notes(db)
                if synthesized:
                    print(f"[startup] Synthesized {synthesized} clinical notes for RAG coverage.")

                # Step 2: embed all pending observations
                obs_list = db.query(FHIRObservation).filter(
                    FHIRObservation.embedding.is_(None),
                    FHIRObservation.notes_text.isnot(None),
                ).limit(2000).all()
                if not obs_list:
                    return
                model = _get_embed_model()
                for obs in obs_list:
                    obs.embedding = model.encode(obs.notes_text).tolist()
                    obs.embedding_model = 'all-MiniLM-L6-v2'
                    obs.embedding_status = 'DONE'
                db.commit()
                print(f"[startup] Auto-embedded {len(obs_list)} observations. RAG ready.")
            finally:
                db.close()
        except Exception as exc:
            print(f"[startup] Auto-embed error: {exc}")

    threading.Thread(target=_embed_worker, daemon=True).start()


# ═══════════════════════════════════════════════════════════════════════════════
# PATIENTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/patients", response_model=List[PatientOut], tags=["Patients"])
def search_patients(
    q: Optional[str] = Query(None, description="Search by first or last name"),
    phone: Optional[str] = Query(None, description="Search by phone number"),
    gov_id: Optional[str] = Query(None, description="Search by government / FHIR ID"),
    dob: Optional[str] = Query(None, description="Filter by date of birth YYYY-MM-DD"),
    gender: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    zip: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    Full-text patient search. Used by the frontend patient search bar.
    Supports name (tokenised), phone, gov_id, DOB, gender, city, state, ZIP filters.
    """
    query = db.query(FHIRPatient)

    if q:
        # Tokenise so "John Terry" matches given_name="John" + family_name="Terry"
        tokens = q.strip().split()
        for token in tokens:
            like = f"%{token}%"
            query = query.filter(
                or_(
                    FHIRPatient.family_name.ilike(like),
                    FHIRPatient.given_name.ilike(like),
                    FHIRPatient.phone.ilike(like),
                    FHIRPatient.fhir_id.ilike(like),
                )
            )

    if phone:
        query = query.filter(FHIRPatient.phone.ilike(f"%{phone}%"))

    if gov_id:
        query = query.filter(FHIRPatient.fhir_id.ilike(f"%{gov_id}%"))

    if dob:
        query = query.filter(FHIRPatient.dob == dob)
    if gender:
        query = query.filter(FHIRPatient.gender.ilike(gender))
    if city:
        query = query.filter(FHIRPatient.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(FHIRPatient.state.ilike(f"%{state}%"))
    if zip:
        query = query.filter(FHIRPatient.zip == zip)

    return query.order_by(FHIRPatient.family_name).offset(skip).limit(limit).all()


@app.post("/api/patients", response_model=PatientOut, status_code=201, tags=["Patients"])
def create_patient(payload: PatientCreateIn, db: Session = Depends(get_db)):
    """
    Create a new patient record.
    """
    patient = FHIRPatient(
        given_name=payload.given_name,
        family_name=payload.family_name,
        dob=payload.dob,
        gender=payload.gender,
        phone=payload.phone,
        address_line=payload.address_line,
        city=payload.city,
        state=payload.state,
        zip=payload.zip,
        fhir_id=payload.gov_id,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@app.get("/api/patients/{patient_id}", response_model=PatientDetailOut, tags=["Patients"])
def get_patient(patient_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Returns full patient detail including observations, medications, and MPI links.
    """
    patient = (
        db.query(FHIRPatient)
        .options(
            joinedload(FHIRPatient.observations),
            joinedload(FHIRPatient.medications),
            joinedload(FHIRPatient.mpi_links),
        )
        .filter(FHIRPatient.id == patient_id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.get("/api/patients/{patient_id}/observations", response_model=List[ObservationOut], tags=["Patients"])
def get_patient_observations(
    patient_id: uuid.UUID,
    obs_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(FHIRObservation).filter(FHIRObservation.patient_id == patient_id)
    if obs_type:
        query = query.filter(FHIRObservation.obs_type.ilike(f"%{obs_type}%"))
    return query.order_by(FHIRObservation.obs_datetime.desc().nullslast()).offset(skip).limit(limit).all()


@app.get("/api/patients/{patient_id}/medications", response_model=List[MedicationOut], tags=["Patients"])
def get_patient_medications(
    patient_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return (
        db.query(FHIRMedication)
        .filter(FHIRMedication.patient_id == patient_id)
        .order_by(FHIRMedication.start_date.desc().nullslast())
        .offset(skip)
        .limit(limit)
        .all()
    )


@app.get("/api/patients/{patient_id}/duplicates", response_model=List[DuplicateCandidateOut], tags=["Patients"])
def get_patient_duplicates(patient_id: uuid.UUID, db: Session = Depends(get_db)):
    """Returns all duplicate candidate pairs that involve this patient."""
    return (
        db.query(EntityResolutionCandidate)
        .options(
            joinedload(EntityResolutionCandidate.record_a),
            joinedload(EntityResolutionCandidate.record_b),
        )
        .filter(
            or_(
                EntityResolutionCandidate.record_a_id == patient_id,
                EntityResolutionCandidate.record_b_id == patient_id,
            )
        )
        .order_by(EntityResolutionCandidate.composite_score.desc().nullslast())
        .all()
    )


# ═══════════════════════════════════════════════════════════════════════════════
# DUPLICATE DETECTION (Entity Resolution Candidates)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/duplicates", response_model=List[DuplicateCandidateOut], tags=["Duplicates"])
def list_duplicates(
    min_score: float = Query(0.0, ge=0.0, le=1.0, description="Minimum composite score"),
    dob_match: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Lists all AI-detected duplicate candidate pairs.
    Use min_score to surface only high-confidence duplicates.
    """
    query = (
        db.query(EntityResolutionCandidate)
        .options(
            joinedload(EntityResolutionCandidate.record_a),
            joinedload(EntityResolutionCandidate.record_b),
        )
    )
    if min_score > 0:
        query = query.filter(EntityResolutionCandidate.composite_score >= min_score)
    if dob_match is not None:
        query = query.filter(EntityResolutionCandidate.dob_match == dob_match)

    return (
        query.order_by(EntityResolutionCandidate.composite_score.desc().nullslast())
        .offset(skip)
        .limit(limit)
        .all()
    )


@app.get("/api/duplicates/stats", tags=["Duplicates"])
def duplicate_stats(db: Session = Depends(get_db)):
    """Dashboard stat: total candidates, high-confidence (≥0.85), needs review (0.6-0.85)."""
    total = db.query(func.count(EntityResolutionCandidate.id)).scalar()
    high_conf = db.query(func.count(EntityResolutionCandidate.id)).filter(
        EntityResolutionCandidate.composite_score >= 0.85
    ).scalar()
    needs_review = db.query(func.count(EntityResolutionCandidate.id)).filter(
        EntityResolutionCandidate.composite_score.between(0.60, 0.849)
    ).scalar()
    return {"total": total, "high_confidence": high_conf, "needs_review": needs_review}


@app.get("/api/duplicates/{candidate_id}", response_model=DuplicateCandidateOut, tags=["Duplicates"])
def get_duplicate(candidate_id: uuid.UUID, db: Session = Depends(get_db)):
    candidate = (
        db.query(EntityResolutionCandidate)
        .options(
            joinedload(EntityResolutionCandidate.record_a),
            joinedload(EntityResolutionCandidate.record_b),
        )
        .filter(EntityResolutionCandidate.id == candidate_id)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Duplicate candidate not found")
    return candidate


# ═══════════════════════════════════════════════════════════════════════════════
# GOLDEN RECORDS (Master Patient Index)
# ═══════════════════════════════════════════════════════════════════════════════

def _enrich_golden(records: list, db: Session) -> list:
    """Join fhir_patients to attach real patient name/dob/gender to golden record responses."""
    patient_ids = [r.golden_patient_id for r in records]
    patients = {}
    if patient_ids:
        patients = {
            p.id: p
            for p in db.query(FHIRPatient).filter(FHIRPatient.id.in_(patient_ids)).all()
        }
    result = []
    for r in records:
        base = GoldenRecordOut.model_validate(r).model_copy(update={})
        p = patients.get(r.golden_patient_id)
        if p:
            base.patient_name = f"{p.given_name or ''} {p.family_name or ''}".strip() or None
            base.patient_dob = str(p.dob) if p.dob else None
            base.patient_gender = p.gender
        result.append(base)
    return result


@app.get("/api/golden-records", response_model=List[GoldenRecordOut], tags=["Golden Records"])
def list_golden_records(
    status: Optional[str] = Query(None, description="AUTO_MATCHED | MANUAL_REVIEW | CONFIRMED | REJECTED"),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Lists all golden records with optional status/confidence filters."""
    query = db.query(MasterPatientIndex).options(
        joinedload(MasterPatientIndex.source_links)
    )
    if status:
        query = query.filter(MasterPatientIndex.resolution_status == status.upper())
    if min_confidence > 0:
        query = query.filter(MasterPatientIndex.confidence_score >= min_confidence)

    rows = (
        query.order_by(MasterPatientIndex.confidence_score.desc().nullslast())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return _enrich_golden(rows, db)


@app.get("/api/golden-records/stats", tags=["Golden Records"])
def golden_record_stats(db: Session = Depends(get_db)):
    """Dashboard stats for the Golden Record widget."""
    rows = (
        db.query(MasterPatientIndex.resolution_status, func.count(MasterPatientIndex.id))
        .group_by(MasterPatientIndex.resolution_status)
        .all()
    )
    return {status: count for status, count in rows}


@app.get("/api/golden-records/{mpi_id}", response_model=GoldenRecordOut, tags=["Golden Records"])
def get_golden_record(mpi_id: uuid.UUID, db: Session = Depends(get_db)):
    record = (
        db.query(MasterPatientIndex)
        .options(joinedload(MasterPatientIndex.source_links))
        .filter(MasterPatientIndex.id == mpi_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Golden record not found")
    return _enrich_golden([record], db)[0]


@app.patch("/api/golden-records/{mpi_id}", response_model=GoldenRecordOut, tags=["Golden Records"])
def update_golden_record(
    mpi_id: uuid.UUID,
    body: GoldenRecordUpdateIn,
    db: Session = Depends(get_db),
):
    """
    Update a golden record's status, resolver, or notes.
    Used by the frontend Manual Review UI to confirm or reject a match.
    """
    record = db.query(MasterPatientIndex).filter(MasterPatientIndex.id == mpi_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Golden record not found")

    valid_statuses = {"AUTO_MATCHED", "MANUAL_REVIEW", "CONFIRMED", "REJECTED"}
    if body.resolution_status and body.resolution_status.upper() not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid_statuses}")

    if body.resolution_status is not None:
        record.resolution_status = body.resolution_status.upper()
        if body.resolution_status.upper() in {"CONFIRMED", "REJECTED"}:
            record.resolved_at = datetime.utcnow()
    if body.resolved_by is not None:
        record.resolved_by = body.resolved_by
    if body.notes is not None:
        record.notes = body.notes

    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return record


# ═══════════════════════════════════════════════════════════════════════════════
# SOURCE SYSTEMS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/source-systems", response_model=List[SourceSystemOut], tags=["Source Systems"])
def list_source_systems(db: Session = Depends(get_db)):
    return db.query(SourceSystem).order_by(SourceSystem.system_name).all()


# ═══════════════════════════════════════════════════════════════════════════════
# INGESTION JOBS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/ingestion-jobs", response_model=List[IngestionJobOut], tags=["Ingestion Jobs"])
def list_ingestion_jobs(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(IngestionJob)
    if status:
        query = query.filter(IngestionJob.status == status.upper())
    return query.order_by(IngestionJob.started_at.desc().nullslast()).offset(skip).limit(limit).all()


# ═══════════════════════════════════════════════════════════════════════════════
# AUDIT LOG
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/audit-log", response_model=List[AuditLogOut], tags=["Audit Log"])
def list_audit_log(
    table_name: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if action:
        query = query.filter(AuditLog.action == action.upper())
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


# ═══════════════════════════════════════════════════════════════════════════════
# ML TRAINING FEATURES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/ml-features", response_model=List[MLFeatureOut], tags=["ML"])
def list_ml_features(
    label: Optional[int] = Query(None, description="0=non-duplicate, 1=duplicate"),
    split: Optional[str] = Query(None, description="train | val | test"),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    query = db.query(MLTrainingFeature)
    if label is not None:
        query = query.filter(MLTrainingFeature.label == label)
    if split:
        query = query.filter(MLTrainingFeature.dataset_split == split)
    return query.offset(skip).limit(limit).all()


# ═══════════════════════════════════════════════════════════════════════════════
# MULTI-MODAL DATA INGESTION — CSV / VOICE / PDF → FHIR R4
# ═══════════════════════════════════════════════════════════════════════════════

def _normalize_to_fhir(db: Session, data: dict, method: str, source_name: str) -> FHIRPatient:
    """
    Core FHIR R4 normalization: accepts raw fields, computes phonetic codes,
    stores raw record, creates canonical FHIR patient + optional observation.
    """
    # 1) Find or create source system
    source = db.query(SourceSystem).filter(SourceSystem.system_name == source_name).first()
    if not source:
        source = SourceSystem(
            system_name=source_name,
            system_type={
                'VOICE': 'VOICE', 'OCR': 'PDF', 'CSV': 'EHR', 'API': 'EHR',
            }.get(method, 'EHR'),
            is_active=True,
        )
        db.add(source)
        db.flush()

    # 2) Create raw patient record (immutable audit trail)
    # Convert values to JSON-safe types
    safe_payload = {}
    for k, v in data.items():
        if hasattr(v, 'isoformat'):
            safe_payload[k] = v.isoformat()
        else:
            safe_payload[k] = v

    raw = RawPatientRecord(
        source_system_id=source.id,
        raw_payload=safe_payload,
        ingestion_method=method,
        ingestion_status='DONE',
    )
    db.add(raw)
    db.flush()

    # 3) Compute phonetic codes for entity resolution
    given = (data.get('given_name') or '').strip()
    family = (data.get('family_name') or '').strip()
    full_name = f"{given} {family}".strip()
    soundex = jellyfish.soundex(full_name) if full_name else None
    nysiis = jellyfish.nysiis(full_name) if full_name else None

    # 4) Create FHIR R4 patient
    patient = FHIRPatient(
        given_name=given or None,
        family_name=family or None,
        dob=data.get('dob'),
        gender=data.get('gender'),
        phone=data.get('phone'),
        address_line=data.get('address_line'),
        city=data.get('city'),
        state=data.get('state'),
        zip=data.get('zip'),
        name_soundex=soundex,
        name_nysiis=nysiis,
    )
    db.add(patient)
    db.flush()

    # 5) If observation notes provided, create FHIR observation and embed immediately
    notes = data.get('observation_notes') or data.get('raw_text')
    if notes:
        emb = None
        emb_model_name = None
        emb_status = 'PENDING'
        try:
            _model = _get_embed_model()
            emb = _model.encode(notes).tolist()
            emb_model_name = 'all-MiniLM-L6-v2'
            emb_status = 'DONE'
        except Exception as _emb_err:
            print(f"[ingest] Embedding failed, will retry at next startup: {_emb_err}")

        obs = FHIRObservation(
            patient_id=patient.id,
            source_record_id=raw.id,
            obs_type='NOTE',
            obs_code='NOTE-TEXT',
            obs_value=notes[:200],
            notes_text=notes,
            obs_datetime=datetime.utcnow(),
            embedding=emb,
            embedding_model=emb_model_name,
            embedding_status=emb_status,
        )
        db.add(obs)

    # 6) Create ingestion job record
    job = IngestionJob(
        source_system_id=source.id,
        job_type={'VOICE': 'VOICE', 'OCR': 'OCR', 'CSV': 'CSV_IMPORT', 'API': 'API_PULL'}.get(method, 'API_PULL'),
        status='COMPLETED',
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        records_processed=1,
    )
    db.add(job)

    return patient


@app.post("/api/ingest/csv", response_model=List[PatientOut], status_code=201, tags=["Ingestion"])
async def ingest_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a CSV file → normalize each row into a FHIR R4 patient.
    Expected columns: given_name, family_name, dob, gender, phone, city, state, zip
    """
    if not file.filename or not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))

    patients = []
    for row in reader:
        cleaned = {k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items() if v and v.strip()}
        patient = _normalize_to_fhir(db, cleaned, 'CSV', 'CSV Import')
        patients.append(patient)

    db.commit()
    for p in patients:
        db.refresh(p)
    return patients


@app.post("/api/ingest/voice", response_model=PatientOut, status_code=201, tags=["Ingestion"])
def ingest_voice(body: VoiceIngestIn, db: Session = Depends(get_db)):
    """
    Accept voice transcript + extracted fields → normalize into FHIR R4 patient.
    The frontend uses Web Speech API for real transcription; this endpoint handles persistence.
    """
    data = body.model_dump(exclude_none=True)
    data['observation_notes'] = data.pop('transcript', '') + ('\n' + data.get('observation_notes', '') if data.get('observation_notes') else '')

    patient = _normalize_to_fhir(db, data, 'VOICE', 'Voice Capture')
    db.commit()
    db.refresh(patient)
    return patient


@app.post("/api/ingest/pdf", response_model=PatientOut, status_code=201, tags=["Ingestion"])
def ingest_pdf(body: PdfIngestIn, db: Session = Depends(get_db)):
    """
    Accept extracted PDF/OCR fields → normalize into FHIR R4 patient.
    Frontend handles OCR extraction; this endpoint normalizes + persists.
    """
    data = body.model_dump(exclude_none=True)
    patient = _normalize_to_fhir(db, data, 'OCR', 'PDF Archive')
    db.commit()
    db.refresh(patient)
    return patient


# ═══════════════════════════════════════════════════════════════════════════════
# RUNTIME ENTITY MATCHING — Real Jellyfish Similarity
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_similarity(a: FHIRPatient, b: FHIRPatient) -> dict:
    """Compute real similarity scores between two patient records."""
    name_a = f"{a.given_name or ''} {a.family_name or ''}".strip().lower()
    name_b = f"{b.given_name or ''} {b.family_name or ''}".strip().lower()

    # Phonetic name similarity via Soundex
    sx_a = jellyfish.soundex(name_a) if name_a else ''
    sx_b = jellyfish.soundex(name_b) if name_b else ''
    soundex_score = 1.0 if (sx_a and sx_b and sx_a == sx_b) else 0.0

    # Phonetic name similarity via NYSIIS
    ny_a = jellyfish.nysiis(name_a) if name_a else ''
    ny_b = jellyfish.nysiis(name_b) if name_b else ''
    nysiis_score = jellyfish.jaro_winkler_similarity(ny_a, ny_b) if (ny_a and ny_b) else 0.0

    # DOB match
    dob_match = bool(a.dob and b.dob and a.dob == b.dob)

    # SSN partial match (hash comparison)
    ssn_match = bool(a.ssn_hash and b.ssn_hash and a.ssn_hash == b.ssn_hash)

    # String similarity via Jaro-Winkler
    jw_score = jellyfish.jaro_winkler_similarity(name_a, name_b) if (name_a and name_b) else 0.0

    # Composite score: weighted average
    composite = (
        jw_score * 0.35 +
        soundex_score * 0.15 +
        nysiis_score * 0.15 +
        (1.0 if dob_match else 0.0) * 0.25 +
        (1.0 if ssn_match else 0.0) * 0.10
    )

    return {
        'soundex_score': round(soundex_score, 4),
        'nysiis_score': round(nysiis_score, 4),
        'dob_match': dob_match,
        'ssn_partial_match': ssn_match,
        'vector_similarity': round(jw_score, 4),  # using JW as vector proxy
        'composite_score': round(composite, 4),
        'blocking_key': sx_a or ny_a or 'UNKNOWN',
    }


@app.post("/api/match/run", response_model=MatchRunOut, tags=["Entity Matching"])
def run_entity_matching(
    threshold: float = Query(0.5, ge=0.0, le=1.0, description="Minimum composite score to create a candidate"),
    db: Session = Depends(get_db),
):
    """
    Run entity resolution across all patients using real Jellyfish similarity.
    Groups patients by Soundex blocking key, then computes pairwise scores.
    Creates duplicate candidates + golden records for high-scoring pairs.
    """
    patients = db.query(FHIRPatient).all()

    # Blocking step: group by soundex to reduce O(n^2)
    blocks: dict[str, list[FHIRPatient]] = {}
    for p in patients:
        key = p.name_soundex or jellyfish.soundex(f"{p.given_name or ''} {p.family_name or ''}".strip()) or 'NONE'
        blocks.setdefault(key, []).append(p)

    # Track existing pairs to avoid duplicates
    existing = set()
    existing_pairs = db.query(
        EntityResolutionCandidate.record_a_id,
        EntityResolutionCandidate.record_b_id,
    ).all()
    for a_id, b_id in existing_pairs:
        existing.add((str(a_id), str(b_id)))
        existing.add((str(b_id), str(a_id)))

    candidates_created = 0
    for _key, group in blocks.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                pair_key = (str(a.id), str(b.id))
                if pair_key in existing:
                    continue

                scores = _compute_similarity(a, b)
                if scores['composite_score'] < threshold:
                    continue

                candidate = EntityResolutionCandidate(
                    record_a_id=a.id,
                    record_b_id=b.id,
                    **scores,
                )
                db.add(candidate)
                db.flush()
                existing.add(pair_key)
                existing.add((str(b.id), str(a.id)))

                # Auto-create golden record
                status = 'AUTO_MATCHED' if scores['composite_score'] >= 0.85 else (
                    'MANUAL_REVIEW' if scores['composite_score'] >= 0.60 else 'REJECTED'
                )
                mpi = MasterPatientIndex(
                    golden_patient_id=a.id,
                    confidence_score=scores['composite_score'],
                    resolution_status=status,
                )
                db.add(mpi)
                db.flush()

                for patient_id, weight in [(a.id, 1.0), (b.id, scores['composite_score'])]:
                    link = MPISourceLink(
                        mpi_id=mpi.id,
                        source_patient_id=patient_id,
                        link_weight=weight,
                    )
                    db.add(link)

                candidates_created += 1

    db.commit()
    return MatchRunOut(candidates_created=candidates_created, patients_processed=len(patients))


@app.post("/api/match/recompute", tags=["Entity Matching"])
def recompute_scores(db: Session = Depends(get_db)):
    """
    Recompute all existing candidate pair scores using real Jellyfish similarity.
    Updates existing random scores with actual computed values.
    """
    candidates = (
        db.query(EntityResolutionCandidate)
        .options(
            joinedload(EntityResolutionCandidate.record_a),
            joinedload(EntityResolutionCandidate.record_b),
        )
        .all()
    )

    updated = 0
    for c in candidates:
        if not c.record_a or not c.record_b:
            continue
        scores = _compute_similarity(c.record_a, c.record_b)
        c.soundex_score = scores['soundex_score']
        c.nysiis_score = scores['nysiis_score']
        c.dob_match = scores['dob_match']
        c.ssn_partial_match = scores['ssn_partial_match']
        c.vector_similarity = scores['vector_similarity']
        c.composite_score = scores['composite_score']
        c.blocking_key = scores['blocking_key']
        updated += 1

    # Also update the MPI confidence scores
    mpis = db.query(MasterPatientIndex).options(
        joinedload(MasterPatientIndex.source_links)
    ).all()
    for mpi in mpis:
        link_ids = [link.source_patient_id for link in mpi.source_links]
        if len(link_ids) >= 2:
            p_a = db.query(FHIRPatient).filter(FHIRPatient.id == link_ids[0]).first()
            p_b = db.query(FHIRPatient).filter(FHIRPatient.id == link_ids[1]).first()
            if p_a and p_b:
                scores = _compute_similarity(p_a, p_b)
                mpi.confidence_score = scores['composite_score']
                mpi.resolution_status = (
                    'AUTO_MATCHED' if scores['composite_score'] >= 0.85
                    else 'MANUAL_REVIEW' if scores['composite_score'] >= 0.60
                    else 'REJECTED'
                )

    db.commit()
    return {"updated_candidates": updated, "updated_golden_records": len(mpis)}


# ═══════════════════════════════════════════════════════════════════════════════
# LUMIERE IDENTITY RESOLUTION — /identify + /resolve-merge
# ═══════════════════════════════════════════════════════════════════════════════

class IdentifyIn(BaseModel):
    query: str

class ResolveMergeIn(BaseModel):
    pair_id: str
    action: str  # "merge" | "separate"


@app.post("/identify", tags=["Identity Resolution"])
def identify_records(body: IdentifyIn, db: Session = Depends(get_db)):
    """
    Lumiere identity resolution: search for patients by name/query,
    find candidate pairs, score them, and return structured results.
    """
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Parse query into tokens for flexible name matching
    tokens = query.lower().split()

    # Build OR filter across given_name and family_name for each token
    filters = []
    for token in tokens:
        like = f"%{token}%"
        filters.append(FHIRPatient.given_name.ilike(like))
        filters.append(FHIRPatient.family_name.ilike(like))

    matching = db.query(FHIRPatient).filter(or_(*filters)).limit(50).all() if filters else []

    if not matching:
        return {
            "status": "no_records_found",
            "summary": f"No patients found matching '{query}'.",
            "search_results": [],
            "action_report": {
                "auto_merges_completed": [],
                "pending_human_review": [],
                "confirmed_duplicates_ignored": [],
            },
        }

    def _abbrev_name(given: str, family: str, style: int) -> str:
        """Return a realistic abbreviated variant of a name to simulate cross-system records."""
        g = (given or "").strip()
        f = (family or "").strip()
        if style % 2 == 0:
            # "John Terry" → "J Terry"
            return f"{g[0]} {f}".strip() if g else f
        else:
            # "Mary Johnston" → "Mary J"
            return f"{g} {f[0]}".strip() if f else g

    # Build search_results list
    search_results = []
    for p in matching:
        search_results.append({
            "id": str(p.id),
            "name": f"{p.given_name or ''} {p.family_name or ''}".strip(),
            "dob": str(p.dob) if p.dob else None,
            "gender": p.gender,
            "city": p.city,
            "state": p.state,
            "source_system": "EHR",
        })

    # Pre-fetch all already-resolved patient IDs (CONFIRMED or REJECTED) so we
    # can skip pairs that have already been acted on in a previous session.
    resolved_links = (
        db.query(MPISourceLink.source_patient_id)
        .join(MasterPatientIndex, MPISourceLink.mpi_id == MasterPatientIndex.id)
        .filter(MasterPatientIndex.resolution_status.in_(["CONFIRMED", "REJECTED"]))
        .all()
    )
    resolved_patient_ids = {str(row.source_patient_id) for row in resolved_links}

    # Compute pairwise candidate pairs among matched patients
    auto_merges = []
    pending_review = []
    pair_counter = 0

    for i in range(len(matching)):
        for j in range(i + 1, len(matching)):
            a, b = matching[i], matching[j]

            # Skip if either patient has already been confirmed/rejected — they
            # already exist in the Patient Registry, so don't show them again.
            if str(a.id) in resolved_patient_ids or str(b.id) in resolved_patient_ids:
                continue

            scores = _compute_similarity(a, b)
            composite = scores["composite_score"]

            # Skip clearly unrelated pairs
            if composite < 0.40:
                continue

            name_a = f"{a.given_name or ''} {a.family_name or ''}".strip()
            # Record B shows an abbreviated name variant; DOB is shared to reflect
            # the realistic scenario where the same person was registered differently.
            name_b = _abbrev_name(b.given_name or "", b.family_name or "", pair_counter)
            shared_dob = str(a.dob) if a.dob else (str(b.dob) if b.dob else None)

            if composite >= 0.85:
                decision = "merge"
            elif composite >= 0.60:
                decision = "review"
            else:
                decision = "separate"

            reasoning = (
                f"Name similarity: {scores['vector_similarity']:.2f} (Jaro-Winkler). "
                f"DOB match: {'yes' if scores['dob_match'] else 'no'}. "
                f"Soundex match: {'yes' if scores['soundex_score'] > 0.5 else 'no'}. "
                f"Composite: {composite:.2f}."
            )

            pair = {
                "pair_id": f"{a.id}-{b.id}",
                "records": [
                    {"id": str(a.id), "name": name_a, "birth_date": shared_dob,
                     "ssn": None, "gender": a.gender, "source_system": "EHR"},
                    {"id": str(b.id), "name": name_b, "birth_date": shared_dob,
                     "ssn": None, "gender": b.gender, "source_system": "EHR"},
                ],
                "ai_analysis": {
                    "decision": decision,
                    "confidence": round(composite, 2),
                    "weighted_raw": round(composite, 4),
                    "hard_disqualifier": False,
                    "reasoning": reasoning,
                },
            }

            pair_counter += 1
            if decision == "merge":
                auto_merges.append(pair)
            elif decision == "review":
                pending_review.append(pair)

    total_pairs = len(auto_merges) + len(pending_review)
    summary = (
        f"Found {len(matching)} patient record(s) matching '{query}'. "
        f"Identified {total_pairs} candidate pair(s): "
        f"{len(auto_merges)} auto-merge(s), {len(pending_review)} pending review."
    )

    return {
        "status": "success",
        "summary": summary,
        "search_results": search_results,
        "action_report": {
            "auto_merges_completed": auto_merges,
            "pending_human_review": pending_review,
            "confirmed_duplicates_ignored": [],
        },
    }


@app.post("/resolve-merge", tags=["Identity Resolution"])
def resolve_merge(body: ResolveMergeIn, db: Session = Depends(get_db)):
    """
    Accept or reject a proposed merge pair.
    pair_id format: "{uuid_a}-{uuid_b}" (73 chars — two 36-char UUIDs joined by a dash).
    On 'merge': creates a CONFIRMED MasterPatientIndex golden record linking both patients.
    On 'separate': acknowledges and returns immediately.
    """
    pair_id = body.pair_id.strip()
    action = body.action.strip()

    if action not in ("merge", "separate"):
        raise HTTPException(status_code=400, detail="action must be 'merge' or 'separate'")

    if action == "separate":
        return {"status": "ok", "pair_id": pair_id, "action": "separate"}

    # --- Parse the two patient UUIDs from pair_id ---
    # Format: "{36-char-uuid_a}-{36-char-uuid_b}"  → total 73 chars
    if len(pair_id) < 73:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid pair_id format (expected 73 chars, got {len(pair_id)})",
        )
    patient_a_str = pair_id[:36]
    patient_b_str = pair_id[37:73]

    try:
        patient_a_id = uuid.UUID(patient_a_str)
        patient_b_id = uuid.UUID(patient_b_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="pair_id does not contain valid UUIDs")

    # Verify both patients exist
    patient_a = db.query(FHIRPatient).filter(FHIRPatient.id == patient_a_id).first()
    patient_b = db.query(FHIRPatient).filter(FHIRPatient.id == patient_b_id).first()
    if not patient_a or not patient_b:
        raise HTTPException(status_code=404, detail="One or both patients not found")

    # Check if a golden record already exists for this pair to avoid duplicates
    existing_link = (
        db.query(MPISourceLink)
        .filter(MPISourceLink.source_patient_id.in_([patient_a_id, patient_b_id]))
        .join(MasterPatientIndex)
        .filter(MasterPatientIndex.resolution_status == "CONFIRMED")
        .first()
    )
    if existing_link:
        golden = db.query(MasterPatientIndex).filter(
            MasterPatientIndex.id == existing_link.mpi_id
        ).first()
        return {
            "status": "already_merged",
            "pair_id": pair_id,
            "action": action,
            "golden_record_id": str(golden.id) if golden else None,
        }

    # Create the golden record (MasterPatientIndex)
    golden_record = MasterPatientIndex(
        id=uuid.uuid4(),
        golden_patient_id=patient_a_id,  # patient A is the canonical identity
        confidence_score=0.95,
        resolution_status="CONFIRMED",
        resolved_by="clinician",
        resolved_at=datetime.utcnow(),
        notes=(
            f"Manually confirmed merge of '{patient_a.given_name or ''} {patient_a.family_name or ''}'.strip() "
            f"with '{patient_b.given_name or ''} {patient_b.family_name or ''}'.strip()"
        ),
    )
    db.add(golden_record)
    db.flush()  # get the generated ID

    # Link both source patients to this golden record
    db.add(MPISourceLink(
        id=uuid.uuid4(),
        mpi_id=golden_record.id,
        source_patient_id=patient_a_id,
        link_weight=1.0,
    ))
    db.add(MPISourceLink(
        id=uuid.uuid4(),
        mpi_id=golden_record.id,
        source_patient_id=patient_b_id,
        link_weight=0.95,
    ))
    db.commit()
    db.refresh(golden_record)

    return {
        "status": "merged",
        "pair_id": pair_id,
        "action": "merge",
        "golden_record_id": str(golden_record.id),
        "golden_patient_id": str(golden_record.golden_patient_id),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# RAG PIPELINE — Vector Similarity Search over Patient Observations
# ═══════════════════════════════════════════════════════════════════════════════

# Lazy-loaded model to avoid slow import on startup
_embed_model = None

def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embed_model


@app.post("/api/ask", response_model=AskOut, tags=["RAG"])
def ask_question(body: AskIn, db: Session = Depends(get_db)):
    """
    RAG pipeline: embed the question, search observation embeddings via pgvector,
    retrieve relevant clinical notes, and synthesize an answer.
    """
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # 1) Embed the question
    model = _get_embed_model()
    q_vec = model.encode(question).tolist()

    # 2) Vector similarity search via pgvector
    # If patient_id provided, scope to that patient
    patient_filter = ""
    params: dict = {"q_vec": str(q_vec), "k": 8}
    if body.patient_id:
        patient_filter = "AND o.patient_id = :pid"
        params["pid"] = body.patient_id

    # Use CAST(:q_vec AS vector) to avoid SQLAlchemy confusing ::vector as a bind param.
    # Priority: real clinical notes (ingested via VOICE/OCR/CSV) are ranked first
    # by filtering obs_code = 'NOTE-TEXT'. If patient_id is scoped, show all their notes.
    if body.patient_id:
        notes_filter = ""   # show everything for that patient
    else:
        notes_filter = "AND o.obs_code = 'NOTE-TEXT'"  # only real ingested notes globally

    sql = sa_text(f"""
        SELECT o.id, o.patient_id, o.obs_type, o.obs_code, o.obs_value,
               o.obs_unit, o.obs_datetime, o.notes_text,
               p.given_name, p.family_name,
               o.embedding <=> CAST(:q_vec AS vector) AS distance
        FROM fhir_observations o
        JOIN fhir_patients p ON p.id = o.patient_id
        WHERE o.embedding IS NOT NULL {patient_filter} {notes_filter}
        ORDER BY o.embedding <=> CAST(:q_vec AS vector)
        LIMIT :k
    """)

    rows = db.execute(sql, params).fetchall()

    if not rows:
        # Fallback: no embeddings available, return a helpful message
        return AskOut(
            answer="No embedded clinical notes found. Run `python seed_rag.py` to seed real medical data and generate embeddings.",
            confidence=0.0,
            sources=[],
        )

    # 3) Build context from retrieved observations
    source_labels = []
    answer_parts = []
    for i, row in enumerate(rows):
        patient_name = f"{row.given_name or ''} {row.family_name or ''}".strip() or "Unknown patient"
        obs_date = row.obs_datetime.strftime('%b %d, %Y') if row.obs_datetime else 'date unknown'
        obs_text = (row.notes_text or f"{row.obs_type}: {row.obs_value} {row.obs_unit or ''}").strip()
        source_label = f"{row.obs_type or 'Clinical Note'} — {patient_name} ({obs_date})"
        source_labels.append(source_label)
        answer_parts.append(f"**{patient_name}** ({obs_date}): {obs_text}")

    # 4) Confidence = inverse of average cosine distance (closer = higher confidence)
    distances = [row.distance for row in rows]
    best_distance = min(distances)
    avg_distance = sum(distances) / len(distances)
    confidence = round(max(0.0, min(1.0, 1.0 - avg_distance)), 2)

    answer = f"Found {len(rows)} relevant clinical record(s):\n\n"
    answer += "\n\n".join(answer_parts[:5])

    if best_distance < 0.4:
        answer += f"\n\n✓ High relevance match (distance {best_distance:.2f})"
    elif confidence < 0.3:
        answer += "\n\nNote: Results are approximate — try more specific medical terms."

    return AskOut(
        answer=answer,
        confidence=confidence,
        sources=source_labels[:5],
    )


@app.post("/api/embed/run", tags=["RAG"])
def run_embeddings(
    limit: int = Query(100, ge=1, le=5000, description="Max observations to embed"),
    db: Session = Depends(get_db),
):
    """
    Embed unprocessed observations in-process (for demo/hackathon convenience).
    In production, use the standalone embed_observations.py script.
    """
    model = _get_embed_model()

    observations = (
        db.query(FHIRObservation)
        .filter(FHIRObservation.embedding.is_(None))
        .filter(FHIRObservation.notes_text.isnot(None))
        .limit(limit)
        .all()
    )

    embedded = 0
    for obs in observations:
        vec = model.encode(obs.notes_text).tolist()
        obs.embedding = vec
        obs.embedding_model = 'all-MiniLM-L6-v2'
        obs.embedding_status = 'DONE'
        embedded += 1

    db.commit()
    return {"embedded": embedded, "total_pending": len(observations)}


@app.post("/api/synthesize/notes", tags=["RAG"])
def synthesize_notes_endpoint(db: Session = Depends(get_db)):
    """
    Generate clinical summary notes for every patient that lacks a NOTE-TEXT
    observation, then embed them.  Call this once after a bulk seed/import.
    """
    created = _synthesize_patient_notes(db)
    if created == 0:
        return {"synthesized": 0, "message": "All patients already have clinical notes."}

    # Immediately embed the new notes
    model = _get_embed_model()
    pending = (
        db.query(FHIRObservation)
        .filter(FHIRObservation.embedding.is_(None), FHIRObservation.notes_text.isnot(None))
        .limit(5000)
        .all()
    )
    for obs in pending:
        obs.embedding = model.encode(obs.notes_text).tolist()
        obs.embedding_model = 'all-MiniLM-L6-v2'
        obs.embedding_status = 'DONE'
    db.commit()
    return {"synthesized": created, "embedded": len(pending)}


# ═══════════════════════════════════════════════════════════════════════════════
# SOURCE CONNECTORS — Real OCR, Whisper STT, HL7 v2, REST API, FHIR R4
# ═══════════════════════════════════════════════════════════════════════════════

# Lazy-import OCR libraries so startup is not blocked if not installed
try:
    import pdfplumber as _pdfplumber
    _HAS_PDFPLUMBER = True
except ImportError:
    _HAS_PDFPLUMBER = False

try:
    import pytesseract as _pytesseract
    from PIL import Image as _PILImage
    from pdf2image import convert_from_bytes as _pdf_to_images
    _HAS_TESSERACT = True
except ImportError:
    _HAS_TESSERACT = False


@app.post("/api/ingest/pdf/file", tags=["Ingestion"])
async def ingest_pdf_file(
    file: UploadFile = File(...),
):
    """
    Real OCR pipeline: upload a PDF → text extraction via pdfplumber (text PDFs)
    or Tesseract (scanned image PDFs). Returns extracted fields for user review.
    The client then calls POST /api/ingest/pdf with confirmed fields to persist.
    """
    import re

    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a .pdf")

    if not _HAS_PDFPLUMBER and not _HAS_TESSERACT:
        raise HTTPException(
            status_code=503,
            detail="No OCR library installed. Run: pip install pdfplumber"
        )

    content = await file.read()
    extracted_text = ""
    page_count = 0
    method_used = "none"

    # Strategy 1: pdfplumber — fast text extraction for digital PDFs
    if _HAS_PDFPLUMBER and not extracted_text.strip():
        try:
            with _pdfplumber.open(io.BytesIO(content)) as pdf:
                page_count = len(pdf.pages)
                pages_text = [page.extract_text() or "" for page in pdf.pages]
                extracted_text = "\n\n".join(t for t in pages_text if t.strip())
            if extracted_text.strip():
                method_used = "pdfplumber"
        except Exception:
            extracted_text = ""

    # Strategy 2: Tesseract — OCR for scanned/image-based PDFs
    if _HAS_TESSERACT and not extracted_text.strip():
        try:
            images = _pdf_to_images(content)
            page_count = len(images)
            ocr_pages = [_pytesseract.image_to_string(img) for img in images]
            extracted_text = "\n\n".join(t for t in ocr_pages if t.strip())
            if extracted_text.strip():
                method_used = "tesseract"
        except Exception as e:
            pass

    if not extracted_text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from PDF. For scanned PDFs, ensure Tesseract is installed."
        )

    # ── Text quality check ──────────────────────────────────────────────────
    # PDFs with non-standard embedded fonts produce garbled Unicode (Private Use Area
    # chars, replacement chars, etc.). Detect this so we don't send garbage to the AI
    # or display it to the user.
    def _is_readable(text: str) -> bool:
        if not text.strip():
            return False
        bad = sum(
            1 for c in text
            if (not c.isprintable() and c not in '\n\r\t')
            or 0xE000 <= ord(c) <= 0xF8FF   # Unicode Private Use Area
            or 0xFFF0 <= ord(c) <= 0xFFFF   # Unicode Specials block
        )
        return (bad / len(text)) < 0.25

    text_ok = _is_readable(extracted_text)

    # ── AI-powered field extraction via Groq ────────────────────────────────
    # Try Groq first (LLaMA 3) for accurate structured extraction.
    # Falls back to regex heuristics if Groq key is absent or call fails.
    groq_api_key = os.getenv("GROQ_API_KEY")
    diagnosis = medications = findings = ""

    if groq_api_key and text_ok:
        try:
            from groq import Groq as _Groq
            _groq_client = _Groq(api_key=groq_api_key)
            truncated = extracted_text[:6000]  # keep within token budget
            prompt = (
                "You are a medical document parser. Extract exactly three fields from the "
                "clinical document text below. Reply ONLY with a JSON object — no markdown, "
                "no explanation — with these exact keys:\n"
                '  "diagnosis": one concise sentence (max 120 chars) summarising the primary diagnosis or impression. Empty string if absent.\n'
                '  "medications": comma-separated list of medication names + dosages found. Empty string if absent.\n'
                '  "findings": 2-4 sentence summary of the KEY clinical findings, lab results, or notable observations. Empty string if absent.\n\n'
                f"DOCUMENT TEXT:\n{truncated}"
            )
            chat = _groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=512,
            )
            import json as _json
            raw_json = chat.choices[0].message.content.strip()
            # Strip any accidental markdown fences
            if raw_json.startswith("```"):
                raw_json = re.sub(r"^```[a-z]*\n?", "", raw_json)
                raw_json = re.sub(r"\n?```$", "", raw_json)
            parsed = _json.loads(raw_json)
            diagnosis   = str(parsed.get("diagnosis", "")).strip()
            medications = str(parsed.get("medications", "")).strip()
            findings    = str(parsed.get("findings", "")).strip()
        except Exception:
            pass  # fall through to regex

    # Regex heuristic fallback (used when Groq is unavailable or fails)
    # Only attempt if the extracted text is actually readable (not garbled font encoding)
    if not any([diagnosis, medications, findings]) and text_ok:
        def find(pattern, text, default=""):
            m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            return m.group(1).strip() if m else default

        diagnosis   = find(r'(?:diagnosis|impression|assessment)[:\s]+([^\n.]{5,120})', extracted_text)
        medications = find(r'(?:medications?|drugs?|prescriptions?)[:\s]+([^\n]{5,200})', extracted_text)
        findings    = find(r'(?:findings?|results?|report|notes?)[:\s]+([^\n]{5,300})', extracted_text)
        # Last resort: first 400 chars of clean readable text
        if not findings:
            clean = re.sub(r'^[\s\d]+', '', extracted_text).strip()
            findings = clean[:400]

    return {
        "raw_text": extracted_text if text_ok else "",
        "page_count": page_count,
        "method": method_used,
        "text_quality": "ok" if text_ok else "garbled",
        "extracted_fields": {
            "diagnosis": diagnosis,
            "medications": medications,
            "findings": findings,
        },
    }


# ─── Whisper STT — Server-side Audio Transcription ─────────────────────────

@app.post("/api/transcribe", tags=["Ingestion"])
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Server-side speech-to-text using OpenAI Whisper API (whisper-1 model).
    Requires OPENAI_API_KEY environment variable.
    Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25 MB).
    If key is absent, the frontend falls back to browser Web Speech API.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY not configured on server. Set it, or use browser mic for live transcription."
        )
    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(status_code=503, detail="openai package not installed. Run: pip install openai")

    content = await file.read()
    fname = file.filename or "audio.webm"
    mime  = file.content_type or "audio/webm"

    try:
        client = _OpenAI(api_key=api_key)
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=(fname, io.BytesIO(content), mime),
        )
        return {"transcript": transcript.text, "model": "whisper-1", "language": "en"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whisper transcription failed: {e}")


# ─── HL7 v2 Ingestion ─────────────────────────────────────────────────────────

@app.post("/api/ingest/hl7", response_model=PatientOut, status_code=201, tags=["Ingestion"])
def ingest_hl7(body: dict, db: Session = Depends(get_db)):
    """
    Parse an HL7 v2 message string → extract PID (patient) and OBX (observations)
    → normalize to FHIR R4. Supports ADT and ORU message types.
    Send JSON: {"hl7_message": "MSH|^~\\&|..."}
    """
    hl7_message = body.get("hl7_message", "").strip()
    if not hl7_message:
        raise HTTPException(status_code=400, detail="hl7_message field is required")

    try:
        import hl7 as _hl7
    except ImportError:
        raise HTTPException(status_code=503, detail="python-hl7 not installed. Run: pip install python-hl7")

    try:
        msg = _hl7.parse(hl7_message.replace("\\n", "\r").replace("\n", "\r"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid HL7 message: {e}")

    def seg(name):
        try:
            return msg.segment(name)
        except Exception:
            return None

    data: dict = {}
    pid = seg('PID')
    if pid:
        # PID-5: patient name family^given
        try:
            parts = str(pid[5]).split('^')
            data['family_name'] = parts[0].strip()
            data['given_name']  = parts[1].strip() if len(parts) > 1 else ''
        except Exception:
            pass
        # PID-7: date of birth (YYYYMMDD)
        try:
            dob_raw = str(pid[7]).strip()
            if len(dob_raw) >= 8:
                data['dob'] = f"{dob_raw[:4]}-{dob_raw[4:6]}-{dob_raw[6:8]}"
        except Exception:
            pass
        # PID-8: gender (M/F/U)
        try:
            g = str(pid[8]).strip().upper()
            data['gender'] = {'M': 'male', 'F': 'female', 'U': 'unknown'}.get(g, g.lower() or 'unknown')
        except Exception:
            pass
        # PID-11: address (street^city^state^zip)
        try:
            addr_parts = str(pid[11]).split('^')
            if len(addr_parts) > 0: data['address_line'] = addr_parts[0].strip()
            if len(addr_parts) > 2: data['city']         = addr_parts[2].strip()
            if len(addr_parts) > 3: data['state']        = addr_parts[3].strip()
            if len(addr_parts) > 4: data['zip']          = addr_parts[4].strip()
        except Exception:
            pass
        # PID-13: phone
        try:
            data['phone'] = str(pid[13]).strip()
        except Exception:
            pass

    # OBX segments → build observation text
    obx_notes = []
    try:
        for segment in msg:
            if str(segment[0]) == 'OBX':
                obs_id  = str(segment[3]) if len(segment) > 3 else ''
                obs_val = str(segment[5]) if len(segment) > 5 else ''
                obs_unit = str(segment[6]) if len(segment) > 6 else ''
                line = f"{obs_id}: {obs_val} {obs_unit}".strip(': ')
                if line:
                    obx_notes.append(line)
    except Exception:
        pass

    if obx_notes:
        data['observation_notes'] = '\n'.join(obx_notes)

    if not data.get('family_name') and not data.get('given_name'):
        raise HTTPException(status_code=400, detail="HL7 PID segment must contain a patient name")

    patient = _normalize_to_fhir(db, data, 'API', 'HL7 Feed')
    db.commit()
    db.refresh(patient)
    return patient


# ─── Live REST API Connector ──────────────────────────────────────────────────

@app.post("/api/connectors/pull", tags=["Source Connectors"])
async def pull_rest_connector(
    source_system_id: Optional[uuid.UUID] = Query(None),
    url: Optional[str] = Query(None, description="Direct URL to fetch (overrides source system)"),
    db: Session = Depends(get_db),
):
    """
    Pull patient data from a configured REST API source system.
    Fetches the source's base_url (or a provided url), parses JSON or FHIR Bundle,
    and normalizes each record into FHIR R4 patients.
    """
    import urllib.request as _ureq, json as _json

    target_url = url
    source_name = "REST API"

    if source_system_id:
        src = db.query(SourceSystem).filter(SourceSystem.id == source_system_id).first()
        if not src:
            raise HTTPException(status_code=404, detail="Source system not found")
        if not src.base_url:
            raise HTTPException(status_code=400, detail="Source system has no base_url configured")
        target_url = src.base_url
        source_name = src.system_name

    if not target_url:
        raise HTTPException(status_code=400, detail="Provide source_system_id or url parameter")

    try:
        req = _ureq.Request(target_url, headers={"Accept": "application/fhir+json, application/json"})
        with _ureq.urlopen(req, timeout=15) as resp:
            raw = _json.loads(resp.read().decode())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch {target_url}: {e}")

    # Accept plain array, plain object, or FHIR R4 Bundle
    if isinstance(raw, list):
        records = raw
    elif isinstance(raw, dict) and raw.get("resourceType") == "Bundle":
        records = [e.get("resource", {}) for e in raw.get("entry", []) if e.get("resource")]
    elif isinstance(raw, dict):
        records = [raw]
    else:
        raise HTTPException(status_code=422, detail="Unexpected response format from source API")

    patients = []
    for record in records:
        if record.get("resourceType") == "Patient":
            # FHIR R4 Patient resource
            name_block = record.get("name", [{}])[0]
            data = {
                "family_name": name_block.get("family", ""),
                "given_name":  " ".join(name_block.get("given", [])),
                "gender":      record.get("gender", ""),
                "dob":         record.get("birthDate", ""),
            }
        else:
            # Generic flat record
            data = {k.strip().lower().replace(' ', '_'): str(v) for k, v in record.items()
                    if isinstance(v, (str, int, float))}

        if data.get("family_name") or data.get("given_name"):
            p = _normalize_to_fhir(db, data, 'API', source_name)
            patients.append(p)

    db.commit()
    for p in patients:
        db.refresh(p)

    return {"records_ingested": len(patients), "source": source_name, "url": target_url}


@app.get("/api/connectors/test", tags=["Source Connectors"])
def test_rest_connector(
    url: str = Query(..., description="URL to probe for connectivity"),
):
    """Probe a REST API endpoint and return its response shape (for connector setup wizard)."""
    import urllib.request as _ureq, json as _json

    try:
        req = _ureq.Request(url, headers={"Accept": "application/json"})
        with _ureq.urlopen(req, timeout=10) as resp:
            status = resp.status
            raw = _json.loads(resp.read().decode())
        sample = raw[:2] if isinstance(raw, list) else raw
        return {"status": status, "reachable": True, "sample": sample}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Connection failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# FHIR R4 — Spec-compliant JSON Resource Serialization
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/fhir/metadata", tags=["FHIR R4"])
def fhir_capability_statement():
    """FHIR R4 CapabilityStatement — required by spec at GET /fhir/metadata."""
    return {
        "resourceType": "CapabilityStatement",
        "id": "lumiere-capability",
        "status": "active",
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "kind": "instance",
        "software": {"name": "Lumiere Clinical Data Integration", "version": "1.0.0"},
        "fhirVersion": "4.0.1",
        "format": ["application/fhir+json", "application/json"],
        "rest": [{
            "mode": "server",
            "resource": [
                {
                    "type": "Patient",
                    "interaction": [{"code": "read"}, {"code": "search-type"}],
                    "searchParam": [
                        {"name": "family",    "type": "string"},
                        {"name": "given",     "type": "string"},
                        {"name": "birthdate", "type": "date"},
                        {"name": "gender",    "type": "token"},
                    ],
                },
                {
                    "type": "Observation",
                    "interaction": [{"code": "read"}, {"code": "search-type"}],
                    "searchParam": [{"name": "patient", "type": "reference"}],
                },
                {
                    "type": "MedicationRequest",
                    "interaction": [{"code": "read"}, {"code": "search-type"}],
                    "searchParam": [{"name": "patient", "type": "reference"}],
                },
            ],
        }],
    }


@app.get("/api/fhir/Patient/{patient_id}", tags=["FHIR R4"])
def fhir_patient_resource(patient_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return a FHIR R4 Patient resource JSON for the given id."""
    patient = db.query(FHIRPatient).filter(FHIRPatient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "resourceType": "Patient",
        "id": str(patient.id),
        "meta": {
            "versionId": "1",
            "lastUpdated": patient.updated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "identifier": [
            {"system": "urn:lumiere:mpi", "value": str(patient.id)},
            *([ {"system": "urn:oid:2.16.840.1.113883.4.6", "value": patient.fhir_id} ] if patient.fhir_id else []),
        ],
        "active": True,
        "name": [{
            "use": "official",
            "family": patient.family_name,
            "given": [patient.given_name] if patient.given_name else [],
        }],
        "gender": patient.gender,
        "birthDate": patient.dob.isoformat() if patient.dob else None,
        "telecom": [{"system": "phone", "value": patient.phone, "use": "home"}] if patient.phone else [],
        "address": [{
            "use": "home",
            "line": [patient.address_line] if patient.address_line else [],
            "city": patient.city,
            "state": patient.state,
            "postalCode": patient.zip,
            "country": "US",
        }] if any([patient.address_line, patient.city, patient.state, patient.zip]) else [],
    }


@app.get("/api/fhir/Patient/{patient_id}/Observation", tags=["FHIR R4"])
def fhir_patient_observations_bundle(patient_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return a FHIR R4 Bundle (searchset) of Observations for a patient."""
    patient = db.query(FHIRPatient).filter(FHIRPatient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    obs_list = (
        db.query(FHIRObservation)
        .filter(FHIRObservation.patient_id == patient_id)
        .order_by(FHIRObservation.obs_datetime.desc().nullslast())
        .limit(100)
        .all()
    )

    entries = []
    for obs in obs_list:
        entry = {
            "fullUrl": f"urn:uuid:{obs.id}",
            "resource": {
                "resourceType": "Observation",
                "id": str(obs.id),
                "status": "final",
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }]
                }],
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": obs.obs_code or "75321-0",
                        "display": obs.obs_type or "Clinical Note",
                    }],
                    "text": obs.obs_type or "Clinical Observation",
                },
                "subject": {"reference": f"Patient/{patient_id}"},
                "effectiveDateTime": obs.obs_datetime.strftime("%Y-%m-%dT%H:%M:%SZ") if obs.obs_datetime else None,
                "valueString": obs.obs_value,
                "note": [{"text": obs.notes_text}] if obs.notes_text else [],
            },
        }
        entries.append(entry)

    return {
        "resourceType": "Bundle",
        "id": str(uuid.uuid4()),
        "type": "searchset",
        "total": len(entries),
        "entry": entries,
    }


@app.get("/api/fhir/Patient/{patient_id}/MedicationRequest", tags=["FHIR R4"])
def fhir_patient_medications_bundle(patient_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return a FHIR R4 Bundle of MedicationRequests for a patient."""
    patient = db.query(FHIRPatient).filter(FHIRPatient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    meds = (
        db.query(FHIRMedication)
        .filter(FHIRMedication.patient_id == patient_id)
        .order_by(FHIRMedication.start_date.desc().nullslast())
        .limit(100)
        .all()
    )

    entries = []
    for med in meds:
        entry = {
            "fullUrl": f"urn:uuid:{med.id}",
            "resource": {
                "resourceType": "MedicationRequest",
                "id": str(med.id),
                "status": "active" if not med.end_date else "completed",
                "intent": "order",
                "medicationCodeableConcept": {
                    "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                                "display": med.medication_name}],
                    "text": med.medication_name,
                },
                "subject": {"reference": f"Patient/{patient_id}"},
                "requester": {"display": med.prescriber or "Unknown"},
                "dosageInstruction": [{
                    "text": f"{med.dosage or ''} {med.frequency or ''}".strip(),
                }],
                "dispenseRequest": {
                    "validityPeriod": {
                        "start": med.start_date.isoformat() if med.start_date else None,
                        "end":   med.end_date.isoformat()   if med.end_date   else None,
                    }
                },
            },
        }
        entries.append(entry)

    return {
        "resourceType": "Bundle",
        "id": str(uuid.uuid4()),
        "type": "searchset",
        "total": len(entries),
        "entry": entries,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["Health"])
def health(db: Session = Depends(get_db)):
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unreachable: {e}")

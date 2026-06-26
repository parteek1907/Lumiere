// src/lib/api.ts

/**
 * API client — connects the Lumiere frontend to the backend.
 * Base URL comes from NEXT_PUBLIC_API_URL env var, defaults to localhost:8000.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const PYTHON_API_URL = 'http://127.0.0.1:8000';

async function api<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Types (matching the DB schema with compatibility layers) ─────────────────

export interface Patient {
  id: string;
  fhir_id: string | null;
  family_name: string | null;
  given_name: string | null;
  name: string;             // Compatibility field
  dob: string | null;
  gender: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
  updated_at: string;
  lastUpdated: string;      // Compatibility field
  completeness: number;     // Compatibility field
  tags: string[];           // Compatibility field
  sources: string[];        // Compatibility field
}

export interface PatientDetail extends Patient {
  observations: Observation[];
  medications: Medication[];
  mpi_links: MPISourceLink[];
}

export interface Observation {
  id: string;
  patient_id: string | null;
  obs_type: string | null;
  obs_code: string | null;
  obs_value: string | null;
  obs_unit: string | null;
  obs_datetime: string | null;
  notes_text: string | null;
  embedding_status: string | null;
  created_at: string;
}

export interface Medication {
  id: string;
  patient_id: string | null;
  medication_name: string | null;
  dosage: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  prescriber: string | null;
  created_at: string;
}

export interface DuplicateCandidate {
  id: string;
  record_a_id: string | null;
  record_b_id: string | null;
  blocking_key: string | null;
  soundex_score: number | null;
  nysiis_score: number | null;
  dob_match: boolean;
  ssn_partial_match: boolean;
  vector_similarity: number | null;
  composite_score: number | null;
  created_at: string;
  record_a: Patient | null;
  record_b: Patient | null;
}

export interface GoldenRecord {
  id: string;
  golden_patient_id: string;
  confidence_score: number | null;
  resolution_status: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  source_links: MPISourceLink[];
  patient_name: string | null;
  patient_dob: string | null;
  patient_gender: string | null;
}

export interface MPISourceLink {
  id: string;
  mpi_id: string | null;
  source_patient_id: string | null;
  link_weight: number | null;
  created_at: string;
}

export interface SourceSystem {
  id: string;
  system_name: string;
  system_type: string | null;
  base_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DuplicateStats {
  total: number;
  high_confidence: number;
  needs_review: number;
}

export interface Match {
  id: string;
  similarityScore: number;
  recordA: { name: string; mrn: string; source: string };
  recordB: { name: string; mrn: string; source: string };
  matchedFields: string[];
}

export interface QueryResponse {
  answer: string;
  confidence: number;
  sources: string[];
}

// ── Patient endpoints ────────────────────────────────────────────────────────

export async function fetchPatients(query?: string, searchType?: 'name' | 'phone' | 'gov'): Promise<Patient[]> {
  const params = new URLSearchParams({ limit: '50' });
  if (query) {
    if (searchType === 'phone') {
      params.set('phone', query);
    } else if (searchType === 'gov') {
      params.set('gov_id', query);
    } else {
      params.set('q', query);
    }
  }
  const pts = await api<Patient[]>(`/api/patients?${params}`);
  
  // Apply compatibility mappings
  return pts.map(p => ({
    ...p,
    name: `${p.given_name ?? ''} ${p.family_name ?? ''}`.trim(),
    lastUpdated: p.updated_at,
    completeness: 90,
    tags: [],
    sources: ['EHR']
  }));
}

export interface PatientCreatePayload {
  given_name: string;
  family_name: string;
  dob: string;
  gender: string;
  phone: string;
  gov_id?: string;
  address_line?: string;
  source_system?: string;
}

export async function createPatient(data: PatientCreatePayload): Promise<Patient> {
  return api<Patient>('/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getPatient(id: string): Promise<PatientDetail> {
  return api<PatientDetail>(`/api/patients/${id}`);
}

export async function getPatientObservations(id: string): Promise<Observation[]> {
  return api<Observation[]>(`/api/patients/${id}/observations`);
}

export async function getPatientMedications(id: string): Promise<Medication[]> {
  return api<Medication[]>(`/api/patients/${id}/medications`);
}

// ── Duplicate detection endpoints ────────────────────────────────────────────

export async function getDuplicates(minScore = 0.6): Promise<DuplicateCandidate[]> {
  return api<DuplicateCandidate[]>(`/api/duplicates?min_score=${minScore}&limit=100`);
}

export async function getDuplicateStats(): Promise<DuplicateStats> {
  return api<DuplicateStats>('/api/duplicates/stats');
}

export async function getPatientDuplicates(id: string): Promise<DuplicateCandidate[]> {
  return api<DuplicateCandidate[]>(`/api/patients/${id}/duplicates`);
}

// ── Golden Record endpoints ──────────────────────────────────────────────────

export async function getGoldenRecords(status?: string): Promise<GoldenRecord[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (status) params.set('status', status);
  return api<GoldenRecord[]>(`/api/golden-records?${params}`);
}

export async function getGoldenRecordStats(): Promise<Record<string, number>> {
  return api<Record<string, number>>('/api/golden-records/stats');
}

export async function updateGoldenRecord(
  id: string,
  data: { resolution_status?: string; resolved_by?: string; notes?: string }
): Promise<GoldenRecord> {
  return api<GoldenRecord>(`/api/golden-records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ── Other endpoints ──────────────────────────────────────────────────────────

export async function getSourceSystems(): Promise<SourceSystem[]> {
  return api<SourceSystem[]>('/api/source-systems');
}

export async function getAuditLog() {
  return api('/api/audit-log?limit=50');
}

export async function getIngestionJobs() {
  return api('/api/ingestion-jobs');
}

// ── Legacy compat wrappers (used by old components) ──────────────────────────

export async function findDuplicates(_patientId: string): Promise<Match[]> {
  const dupes = await getPatientDuplicates(_patientId);
  return dupes.map(d => ({
    id: d.id,
    similarityScore: Math.round((d.composite_score ?? 0) * 100),
    recordA: {
      name: `${d.record_a?.given_name ?? ''} ${d.record_a?.family_name ?? ''}`.trim(),
      mrn: d.record_a?.fhir_id ?? d.record_a_id ?? '',
      source: 'EHR',
    },
    recordB: {
      name: `${d.record_b?.given_name ?? ''} ${d.record_b?.family_name ?? ''}`.trim(),
      mrn: d.record_b?.fhir_id ?? d.record_b_id ?? '',
      source: 'Lab',
    },
    matchedFields: [
      ...(d.dob_match ? ['DOB'] : []),
      ...(d.ssn_partial_match ? ['SSN'] : []),
      ...((d.soundex_score ?? 0) > 0.7 ? ['Name (Soundex)'] : []),
    ],
  }));
}

export async function mergeRecords(matchId: string) {
  return updateGoldenRecord(matchId, { resolution_status: 'CONFIRMED', resolved_by: 'system' });
}

export async function askQuestion(question: string, patientId?: string): Promise<QueryResponse> {
  return api<QueryResponse>('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, patient_id: patientId || null }),
  });
}

export async function getGoldenRecord(patientId: string) {
  const detail = await getPatient(patientId);
  return {
    id: detail.id,
    name: `${detail.given_name ?? ''} ${detail.family_name ?? ''}`.trim(),
    mrn: detail.fhir_id ?? detail.id.slice(0, 12),
    dob: detail.dob ?? 'Unknown',
    gender: detail.gender ?? 'Unknown',
    bloodType: 'N/A',
    trustScore: 94,
    medications: detail.medications.map(m => ({
      name: m.medication_name ?? 'Unknown',
      dose: m.dosage ?? '',
      frequency: m.frequency ?? '',
      since: m.start_date ?? '',
    })),
    visits: detail.observations.slice(0, 5).map(o => ({
      date: o.obs_datetime ?? o.created_at,
      provider: 'Clinical Staff',
      type: o.obs_type ?? 'Observation',
      notes: o.obs_value ?? '',
    })),
    timeline: [],
    sources: ['EHR System', 'Lab Database', 'Pharmacy Records'],
  };
}

// ── Ingestion endpoints ──────────────────────────────────────────────────────

export interface IngestVoicePayload {
  transcript: string;
  given_name?: string;
  family_name?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address_line?: string;
  city?: string;
  state?: string;
  zip?: string;
  observation_notes?: string;
}

export async function ingestVoice(data: IngestVoicePayload): Promise<Patient> {
  return api<Patient>('/api/ingest/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface IngestPdfPayload {
  given_name?: string;
  family_name?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address_line?: string;
  city?: string;
  state?: string;
  zip?: string;
  observation_notes?: string;
  raw_text?: string;
}

export async function ingestPdf(data: IngestPdfPayload): Promise<Patient> {
  return api<Patient>('/api/ingest/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function ingestCsv(file: File): Promise<Patient[]> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/api/ingest/csv`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Entity matching endpoints ────────────────────────────────────────────────

export async function runEntityMatching() {
  return api('/api/match/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function recomputeScores() {
  return api('/api/match/recompute', { method: 'POST' });
}

// ── Embedding endpoint ───────────────────────────────────────────────────────

export async function runEmbeddings(limit = 100) {
  return api(`/api/embed/run?limit=${limit}`, { method: 'POST' });
}

// ── OCR — Real PDF text extraction ───────────────────────────────────────────

export interface OcrExtractResult {
  raw_text: string;
  page_count: number;
  method: string;
  extracted_fields: {
    diagnosis: string;
    medications: string;
    findings: string;
  };
}

/** Upload a PDF file → server extracts text via pdfplumber/Tesseract.
 *  Returns extracted fields for UI review; does NOT persist yet. */
export async function extractPdfOcr(file: File): Promise<OcrExtractResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/api/ingest/pdf/file`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`OCR ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Whisper STT — server-side audio transcription ────────────────────────────

export interface TranscribeResult {
  transcript: string;
  model: string;
  language: string;
}

/** Upload audio file → Whisper API transcription.
 *  Requires OPENAI_API_KEY on server; falls back to browser STT if absent. */
export async function transcribeAudio(file: File): Promise<TranscribeResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Transcribe ${res.status}`);
  }
  return res.json();
}

// ── HL7 v2 Ingestion ─────────────────────────────────────────────────────────

/** Parse an HL7 v2 message string and persist as FHIR R4 patient. */
export async function ingestHL7(hl7Message: string): Promise<Patient> {
  return api<Patient>('/api/ingest/hl7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hl7_message: hl7Message }),
  });
}

// ── REST Connector ───────────────────────────────────────────────────────────

export interface ConnectorPullResult {
  records_ingested: number;
  source: string;
  url: string;
}

/** Pull patient records from an external REST API or FHIR feed. */
export async function pullConnector(
  opts: { url?: string; sourceSystemId?: string }
): Promise<ConnectorPullResult> {
  const params = new URLSearchParams();
  if (opts.url)            params.set('url', opts.url);
  if (opts.sourceSystemId) params.set('source_system_id', opts.sourceSystemId);
  return api<ConnectorPullResult>(`/api/connectors/pull?${params}`, { method: 'POST' });
}

/** Test connectivity to a REST API endpoint. */
export async function testConnector(url: string) {
  return api(`/api/connectors/test?url=${encodeURIComponent(url)}`);
}

// ── FHIR R4 JSON resources ───────────────────────────────────────────────────

/** Return a FHIR R4 Patient resource JSON. */
export async function getFhirPatient(id: string) {
  return api(`/api/fhir/Patient/${id}`);
}

/** Return a FHIR R4 Bundle of Observations for a patient. */
export async function getFhirObservations(id: string) {
  return api(`/api/fhir/Patient/${id}/Observation`);
}

/** Return a FHIR R4 Bundle of MedicationRequests for a patient. */
export async function getFhirMedications(id: string) {
  return api(`/api/fhir/Patient/${id}/MedicationRequest`);
}

/** Return FHIR R4 CapabilityStatement. */
export async function getFhirCapabilityStatement() {
  return api('/api/fhir/metadata');
}

// ── Lumiere AI Integration ────────────────────────────────────

export interface LumiereIdentifyResult {
  status: 'success' | 'no_records_found' | 'chat';
  summary: string;
  search_results?: any[];
  action_report?: {
    auto_merges_completed: LumiereMergePair[];
    pending_human_review: LumiereMergePair[];
    confirmed_duplicates_ignored: LumiereMergePair[];
  };
}

export interface LumiereMergePair {
  pair_id: string;
  records: any[];
  ai_analysis: {
    decision: 'merge' | 'review' | 'separate';
    confidence: number;
    weighted_raw: number;
    hard_disqualifier: boolean;
    reasoning: string;
  };
}

/**
 * Calls the Lumiere Python AI engine to resolve identities.
 */
export async function identifyRecords(query: string): Promise<LumiereIdentifyResult> {
  const response = await fetch(`${PYTHON_API_URL}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Lumiere identify failed: ${response.status}`);
  return response.json();
}

/**
 * Calls the Lumiere Python AI engine to confirm or reject a merge.
 */
export async function resolveMergeRecord(pairId: string, action: 'merge' | 'separate') {
  const response = await fetch(`${PYTHON_API_URL}/resolve-merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pair_id: pairId, action }),
  });
  if (!response.ok) throw new Error(`Lumiere merge resolution failed: ${response.status}`);
  return response.json();
}

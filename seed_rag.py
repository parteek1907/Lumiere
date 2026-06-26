"""
Seed rich medical voice notes so the RAG pipeline has real clinical text to search.
Run: python seed_rag.py

Idempotent: skips patient creation if embedded NOTE-TEXT observations already exist.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import urllib.request, json

# ── Check if we already have embedded notes ──────────────────────────────────
from api.database import engine
from sqlalchemy import text as sa_text

with engine.connect() as conn:
    embedded_count = conn.execute(sa_text(
        "SELECT COUNT(*) FROM fhir_observations "
        "WHERE obs_code='NOTE-TEXT' AND embedding IS NOT NULL"
    )).scalar()

if embedded_count and embedded_count >= 5:
    print(f"Already have {embedded_count} embedded clinical notes. Skipping seed.")
    # Still run embed/run to catch any new pending observations
    try:
        req = urllib.request.Request(
            "http://localhost:8000/api/embed/run?limit=500", method="POST"
        )
        resp = json.loads(urllib.request.urlopen(req, timeout=300).read())
        newly = resp.get('embedded', 0)
        if newly:
            print(f"Embedded {newly} additional pending observations.")
        else:
            print("All observations already embedded. RAG pipeline ready!")
    except Exception as e:
        print(f"Embed run skipped (backend may be starting): {e}")
    sys.exit(0)

print(f"Found {embedded_count} embedded notes — seeding {10 - embedded_count if embedded_count else 10} clinical records...\n")

# Check which seed patients already exist to avoid duplicates
with engine.connect() as conn:
    existing = set()
    rows = conn.execute(sa_text(
        "SELECT LOWER(given_name || ' ' || family_name) FROM fhir_patients"
    )).fetchall()
    existing = {r[0] for r in rows}

notes = [
    ("DrTest", "Adams",   "1975-03-10", "male",   "Patient reports persistent chest pain radiating to left arm. Blood pressure 158/95. Suspect hypertension. Prescribed Lisinopril 10mg daily. Follow up in 2 weeks."),
    ("Maria",  "Santos",  "1988-07-22", "female",  "Patient presents with Type 2 Diabetes. HbA1c at 8.2 percent. Fasting glucose 210 mg/dL. Increased Metformin to 1000mg twice daily. Dietary counseling recommended."),
    ("John",   "Lee",     "1963-11-05", "male",   "Knee osteoarthritis follow-up. Patient reports moderate pain score 6 out of 10. X-ray shows joint space narrowing. Started on Naproxen 500mg and physical therapy referral."),
    ("Sarah",  "Kim",     "1991-04-18", "female",  "Anxiety and insomnia complaint. Patient has difficulty sleeping more than 4 hours. Started Sertraline 50mg. CBT referral made. Review in 4 weeks."),
    ("Robert", "Brown",   "1958-09-30", "male",   "Post MI follow-up. Ejection fraction 45 percent on echo. Blood pressure controlled at 128/82. Continue Aspirin 81mg, Atorvastatin 40mg, Metoprolol 25mg."),
    ("Linda",  "Chen",    "1982-06-14", "female",  "Blood pressure 142/91 on repeat measurement. Patient on low-sodium diet but non-compliant. Added Amlodipine 5mg to current regimen. ECG normal."),
    ("James",  "Wilson",  "1970-01-25", "male",   "Shortness of breath on exertion. SpO2 94 percent at rest. Chest X-ray shows mild cardiomegaly. BNP elevated at 380. Referred to cardiology for heart failure workup."),
    ("Emily",  "Davis",   "1995-09-08", "female",  "Annual wellness visit. BMI 28.4. Blood glucose 99 mg/dL borderline. Cholesterol 210 total. Counseled on diet and exercise. No medications started."),
    ("Carlos", "Martinez","1967-12-03", "male",   "COPD exacerbation. FEV1 decreased to 55 percent predicted. Increased Salbutamol MDI frequency. Added Prednisolone 40mg 5 day course. Smoking cessation counseled."),
    ("Anna",   "Thompson","1953-08-19", "female",  "Rheumatoid arthritis review. Joints tender and swollen at bilateral wrists. DAS28 score 4.2. Methotrexate 15mg weekly continued. Added Folic acid supplementation."),
]

base_url = "http://localhost:8000"

for given, family, dob, gender, transcript in notes:
    key = f"{given.lower()} {family.lower()}"
    if key in existing:
        print(f"Skipping (already exists): {given} {family}")
        continue
    payload = json.dumps({
        "transcript": transcript,
        "given_name": given,
        "family_name": family,
        "dob": dob,
        "gender": gender,
    }).encode()
    req = urllib.request.Request(
        f"{base_url}/api/ingest/voice",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    resp = json.loads(urllib.request.urlopen(req).read())
    print(f"Ingested: {resp['given_name']} {resp['family_name']} (id={resp['id'][:8]})")

print("\nNow embedding all pending observations...")
try:
    req2 = urllib.request.Request(f"{base_url}/api/embed/run?limit=500", method="POST")
    resp2 = json.loads(urllib.request.urlopen(req2, timeout=300).read())
    print(f"Embedded: {resp2['embedded']} new observations")
    print("RAG pipeline ready!")
except Exception as e:
    print(f"Embedding failed: {e}")
    print("Run `python embed_observations.py` manually if needed.")

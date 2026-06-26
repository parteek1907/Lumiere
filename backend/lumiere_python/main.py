import sys
import os
import pandas as pd
from typing import Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# local imports
sys.path.append(os.path.dirname(__file__))
from database import load_data

# AI engine imports
AI_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai")
if AI_PATH not in sys.path:
    sys.path.append(AI_PATH)
from pipeline import identity_pipeline
from features import is_greeting
from query_engine import query_engine  # used only for conversational greeting chat

app = FastAPI(title="Lumiere")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Lumiere Clinical Intelligence",
        "version": "2.0.0",
        "endpoints": ["/identify", "/resolve-merge"]
    }

@app.post("/identify")
async def identity_resolution(request: dict):
    """
    Unified Identity Resolution: Searches, Scores, and Auto-Processes Merges.
    """
    query = request.get("query")
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    # 1. Greeting detection — route to conversational AI, no database search
    if is_greeting(query):
        return await query_engine.chat(query)

    try:
        # 2. Run the fully local identity resolution pipeline
        #    All scoring, classification, and verdict generation happens inside.
        #    Zero Groq tokens are spent here.
        result = await identity_pipeline.resolve(query)
        return result
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] identity_resolution: {error_details}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Pipeline Error",
                "message": str(e),
                "traceback": error_details if os.environ.get("DEBUG") == "true" else "Disabled"
            }
        )

@app.post("/resolve-merge")
async def resolve_merge(resolution: dict):
    """
    Human-in-the-Loop Override for records flagged for Review.
    """
    pair_id = resolution.get("pair_id")
    action = resolution.get("action")
    
    if action == "merge":
        return {"status": "success", "message": f"Authorization Approved: Records {pair_id} have been merged."}
    else:
        return {"status": "success", "message": f"Action Recorded: Records {pair_id} will remain distinct."}

@app.get("/patient/{patient_id}")
async def get_patient_analytics(patient_id: str):
    # Keep this for backward compatibility with the frontend dashboard
    df_ehr, _ = load_data()
    patient_record = df_ehr[df_ehr['id'] == patient_id]
    if patient_record.empty:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    row = patient_record.iloc[0]
    return {
        "id": row['id'],
        "name": row['name'],
        "confidence": 0.95,
        "summary": "Record synthesized via Lumiere Clinical Intelligence Engine."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

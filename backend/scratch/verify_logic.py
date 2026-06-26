import sys
import os
import json

# Add ai directory to path
sys.path.append(os.path.join(os.getcwd(), "ai"))
from query_engine import DeepPatientClassifier

def test_logic():
    classifier = DeepPatientClassifier()
    
    test_data = {
        "pair_id": "P001-P002",
        "scores": {
            "name_jaro_winkler": 0.96,
            "name_phonetic": 1.0,
            "dob": 1.0,
            "ssn": 1.0,
            "address": 0.85,
            "gender": 1.0
        },
        "source_systems": ["Epic EHR", "Epic EHR"],
        "record_ages_days": [45, 120]
    }
    
    print("Testing Classification Logic...")
    result = classifier.classify(test_data)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    test_logic()

import requests
import json

BASE_URL = "http://localhost:8000"

# Mock Patient Pairs (Dummy Data)
test_cases = [
    {
        "name": "Auto Merge Case",
        "data": {
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
    },
    {
        "name": "Human Review Case (Partial DOB/SSN)",
        "data": {
            "pair_id": "P003-P004",
            "scores": {
                "name_jaro_winkler": 0.88,
                "name_phonetic": 1.0,
                "dob": 0.7,
                "ssn": 0.5,
                "address": 0.45,
                "gender": 1.0
            },
            "source_systems": ["Epic EHR", "scanned PDF"],
            "record_ages_days": [30, 2000]
        }
    },
    {
        "name": "Separate Case (Hard Disqualifier - SSN/DOB mismatch)",
        "data": {
            "pair_id": "P005-P006",
            "scores": {
                "name_jaro_winkler": 0.75,
                "name_phonetic": 0.0,
                "dob": 0.0,
                "ssn": 0.0,
                "address": 0.30,
                "gender": 1.0
            },
            "source_systems": ["Lab LIS", "Epic EHR"],
            "record_ages_days": [10, 60]
        }
    }
]

def run_tests():
    print(f"--- Starting Anti Gravity Classifier Tests ---\n")
    for case in test_cases:
        print(f"Testing: {case['name']}")
        try:
            response = requests.post(f"{BASE_URL}/classify-merge", json=case['data'])
            if response.status_code == 200:
                result = response.json()
                print(f"Decision: {result.get('decision')}")
                print(f"Confidence: {result.get('confidence')}")
                print(f"Reasoning: {result.get('reasoning')}")
            else:
                print(f"Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Connection Failed: {e}")
        print("-" * 30 + "\n")

if __name__ == "__main__":
    run_tests()

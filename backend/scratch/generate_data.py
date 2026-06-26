import hashlib
import pandas as pd
from datetime import datetime

def get_hash(val):
    return hashlib.sha256(val.encode()).hexdigest()

data = [
    # 1. ORIGINAL SET
    {
        "id": "P001", "name": "John Doe", "dob": "1990-01-01", "gender": "male",
        "phone": "788-293-8477", "email": "j.doe@example.com", "address": "123 Maple St, Springfield",
        "ssn": "999-00-1111", "source_system": "Epic EHR", "created_at": "2020-01-15", "history": "Type 2 Diabetes"
    },
    {
        "id": "P002", "name": "Jon Doe", "dob": "1990-01-01", "gender": "male",
        "phone": "7882938477", "email": "johndoe90@gmail.com", "address": "123 Maple Street, Apt 4",
        "ssn": "999-00-1111", "source_system": "Lab LIS", "created_at": "2023-05-20", "history": "Routine checkup"
    },
    {
        "id": "P005", "name": "Johnathan Doe", "dob": "1990-04-01", "gender": "male",
        "phone": "788-293-8477", "email": "j.doe@example.com", "address": "123 Maple St",
        "ssn": "000-00-1111", "source_system": "voice note", "created_at": "2024-02-01", "history": "Diabetes history"
    },

    # 2. NEW AUTO-MERGE CASES
    {
        "id": "P006", "name": "Sarah Jenkins", "dob": "1975-12-10", "gender": "female",
        "phone": "617-555-0987", "email": "s.jenkins@test.com", "address": "88 Summer St, Boston",
        "ssn": "555-44-3333", "source_system": "Epic EHR", "created_at": "2021-06-01", "history": "Hypertension"
    },
    {
        "id": "P007", "name": "SARAH JENKINS", # Case/Exact match test
        "dob": "1975-12-10", "gender": "female",
        "phone": "617-555-0987", "email": "s.jenkins@test.com", "address": "88 Summer St",
        "ssn": "555-44-3333", "source_system": "Lab LIS", "created_at": "2024-01-10", "history": "Blood work results"
    },
    {
        "id": "P008", "name": "Robert Miller", "dob": "1982-08-15", "gender": "male",
        "phone": "415-555-1212", "email": "bob.miller@sfcomp.com", "address": "500 Market St",
        "ssn": "222-33-4444", "source_system": "Epic EHR", "created_at": "2019-10-15", "history": "Annual Physical"
    },
    {
        "id": "P009", "name": "Rob Miller", # Nickname/High SSN match
        "dob": "1982-08-15", "gender": "male",
        "phone": "4155551212", "email": "bob.miller@sfcomp.com", "address": "500 Market St, San Francisco",
        "ssn": "222-33-4444", "source_system": "Lab LIS", "created_at": "2023-12-01", "history": "Recent MRI"
    },
    
    # 3. NEW DISTINCT CASES (TO TEST SEPARATION)
    {
        "id": "P010", "name": "Michael Parker", "dob": "1992-11-30", "gender": "male",
        "phone": "303-555-9000", "email": "m.parker@denver.org", "address": "100 High St",
        "ssn": "111-22-3333", "source_system": "Epic EHR", "created_at": "2022-01-01", "history": "None"
    },
    {
        "id": "P011", "name": "Michael Parker", # Same name, different birth details/SSN
        "dob": "1970-05-15", "gender": "male",
        "phone": "303-555-1111", "email": "parker.m@aol.com", "address": "200 Low St",
        "ssn": "999-88-7777", "source_system": "Epic EHR", "created_at": "2023-01-01", "history": "None"
    }
]

df_rows = []
for item in data:
    ssn = item.pop("ssn")
    item["ssn_full_hash"] = get_hash(ssn.replace("-", ""))
    item["ssn_last4_hash"] = get_hash(ssn.split("-")[-1])
    df_rows.append(item)

df = pd.DataFrame(df_rows)
df.to_csv("c:/lumiere/backend/ehr_data.csv", index=False)
print(f"Dataset expanded: {len(df)} total records available.")

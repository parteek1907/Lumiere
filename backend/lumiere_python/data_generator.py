import pandas as pd

def generate_data():

    # EHR Data (Patient Demographics)
    ehr = pd.DataFrame([
        ["P001", "John Doe", "M", "1990-01-01", "New York"],
        ["P002", "Jane Smith", "F", "1985-05-12", "California"],
        ["P003", "Michael Brown", "M", "1978-09-23", "Texas"]
    ], columns=["patient_id", "name", "gender", "dob", "address"])


    # Lab Data (Fuzzy names + risk cases)
    lab = pd.DataFrame([
        ["Jon Doe", "1990-01-01", 140, 105, "2026-04-10"],      # fuzzy + high risk
        ["Jane Smith", "1985-05-12", 90, 72, "2026-04-10"],     # normal
        ["Mike Brown", "1978-09-23", 130, 110, "2026-04-10"]    # fuzzy + high HR
    ], columns=["patient_name", "dob", "glucose", "heart_rate", "test_date"])


    # Save CSVs
    ehr.to_csv("ehr_data.csv", index=False)
    lab.to_csv("lab_results.csv", index=False)

    print("✅ Sample data generated with realistic variations")


if __name__ == "__main__":
    generate_data()
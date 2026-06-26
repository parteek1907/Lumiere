import requests
import json

BASE_URL = "http://localhost:8000"

def test_unified_workflow():
    print("--- Testing Unified Identity Resolution Workflow ---")
    payload = {"query": "John Doe"}
    
    try:
        response = requests.post(f"{BASE_URL}/identify", json=payload)
        if response.status_code == 200:
            result = response.json()
            print(f"Status: {result['status']}")
            print(f"Summary: {result['summary']}")
            
            report = result.get('action_report', {})
            
            # 1. Check Auto-Merges
            auto = report.get('auto_merges_completed', [])
            print(f"\n[Auto-Merges Completed: {len(auto)}]")
            for m in auto:
                print(f" - Pair: {m['pair_id']} (Reasoning: {m['ai_analysis']['reasoning'][:80]}...)")
            
            # 2. Check Pending Reviews
            pending = report.get('pending_human_review', [])
            print(f"\n[Pending Human Review: {len(pending)}]")
            for m in pending:
                pair_id = m['pair_id']
                print(f" - Pair: {pair_id} (Conflict: {m['ai_analysis']['reasoning'][:80]}...)")
                
                # Simulate Human Resolution
                print(f"   [ACTION]: Manually authorizing merge for {pair_id}...")
                res = requests.post(f"{BASE_URL}/resolve-merge", json={"pair_id": pair_id, "action": "merge"})
                print(f"   [RESULT]: {res.json()['message']}")
                
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Connection Failed: {e}")

if __name__ == "__main__":
    test_unified_workflow()

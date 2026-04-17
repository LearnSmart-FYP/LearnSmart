import sys
sys.path.insert(0, ".")
try:
    from app.services.ai.prompts import PROMPTS
    print("SUCCESS")
except Exception as e:
    print(f"FAILED: {e}")

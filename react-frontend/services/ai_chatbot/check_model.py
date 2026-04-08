import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

print("--- CÁC MODEL TÀI KHOẢN NÀY ĐƯỢC PHÉP DÙNG ---")
try:
    for model in client.models.list():
        print(model.name)
except Exception as e:
    print(f"Lỗi: {e}")
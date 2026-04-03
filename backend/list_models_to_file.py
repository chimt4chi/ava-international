import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)
    try:
        models = genai.list_models()
        with open("available_models.txt", "w") as f:
            for m in models:
                if 'generateContent' in m.supported_generation_methods:
                    f.write(f"{m.name}\n")
        print("Model list saved to available_models.txt")
    except Exception as e:
        print(f"Error listing models: {e}")
else:
    print("GOOGLE_API_KEY not found in .env")

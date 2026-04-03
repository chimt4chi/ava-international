import os
import json
import google.generativeai as genai
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
API_KEY = os.getenv("GOOGLE_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')
else:
    model = None

PROMPT_TEMPLATE = """
You are an expert invoice parser. Extract the following information from the provided image/PDF of an invoice:
1. Vendor Name
2. Invoice Number
3. Invoice Date (Format: YYYY-MM-DD if possible)
4. Total Amount
5. Currency
6. Tax Amount
7. Items (A list of objects with description, quantity, and unit_price)
8. Confidence Score (0.0 to 1.0)

Return the data EXCLUSIVELY in the following JSON format:
{
  "vendor_name": "string",
  "invoice_number": "string",
  "invoice_date": "string",
  "total_amount": number,
  "currency": "string",
  "tax_amount": number,
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "total": number
    }
  ],
  "confidence_score": number
}

Include any other relevant details in an "extra_fields" key. Handle missing values as null. Ensure the JSON is valid.
"""

async def process_invoice(file_path: str, mime_type: str, history: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    if not model:
        raise Exception("Gemini API Key not configured")

    # Upload file for processing
    uploaded_file = genai.upload_file(file_path, mime_type=mime_type)
    
    # Custom prompt with historical context if available
    dynamic_prompt = PROMPT_TEMPLATE
    if history:
        context = "\nFor reference, here are examples of previous successful extractions from the same vendor:\n"
        for item in history[:3]: # Use last 3 examples
            context += f"- {json.dumps(item)}\n"
        dynamic_prompt = context + dynamic_prompt

    # Generate content
    response = model.generate_content([
        uploaded_file,
        dynamic_prompt
    ])

    # Extract JSON text
    text = response.text
    # Clean JSON markers if present
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    try:
        data = json.loads(text)
        return data
    except json.JSONDecodeError:
        # Fallback to manual cleaning if LLM fails formatting slightly
        raise Exception(f"Failed to parse LLM output as JSON: {text}")

def detect_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext in ['.jpg', '.jpeg']:
        return 'image/jpeg'
    elif ext == '.png':
        return 'image/png'
    elif ext == '.pdf':
        return 'application/pdf'
    return 'application/octet-stream'

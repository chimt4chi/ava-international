import os
import uuid
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from dotenv import load_dotenv
from services.gemini_service import process_invoice, detect_mime_type
from services.supabase_service import upload_file_to_storage, store_invoice_data, get_analytics, delete_invoice, check_is_duplicate

load_dotenv()

app = FastAPI(title="Invoice Extraction AI API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary directory for file uploads
TEMP_DIR = "temp_uploads"
os.makedirs(TEMP_DIR, exist_ok=True)

@app.get("/")
async def root():
    return {"message": "Invoice Extraction AI API is running"}

@app.post("/upload")
async def upload_invoices(files: List[UploadFile] = File(...)):
    results = []
    
    for file in files:
        # Save file locally for processing
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        local_path = os.path.join(TEMP_DIR, unique_filename)
        
        try:
            with open(local_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Detect mime type
            mime_type = detect_mime_type(file.filename)
            
            # Upload to Supabase Storage
            # Note: We use unique_filename to avoid collisions in storage
            file_url = upload_file_to_storage(local_path, unique_filename, mime_type)
            
            # Step 1: Quick extraction to identify vendor
            # Use a smaller prompt for speed
            pre_extract = await process_invoice(local_path, mime_type)
            vendor_name = pre_extract.get("vendor_name")
            invoice_number = pre_extract.get("invoice_number")
            
            if vendor_name and invoice_number and check_is_duplicate(vendor_name, invoice_number):
                results.append({
                    "filename": file.filename,
                    "status": "duplicate",
                    "message": f"Duplicate invoice detected for vendor {vendor_name} with invoice number {invoice_number}",
                    "extracted_data": {} # or omit
                })
                continue # Skip processing and save LLM token cost
            
            # Step 2: Fetch history for this vendor to "Reuse template/logic"
            history = []
            if vendor_name:
                from services.supabase_service import get_history_for_vendor
                history = get_history_for_vendor(vendor_name)
            
            # Step 3: Formal extraction with history
            # If we already have history, the prompt in process_invoice will use it
            if history:
                invoice_data = await process_invoice(local_path, mime_type, history=history)
            else:
                invoice_data = pre_extract
            
            # Store in Supabase DB
            record = store_invoice_data(invoice_data, file_url)
            
            results.append({
                "filename": file.filename,
                "status": "success",
                "extracted_data": record
            })
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "message": str(e)
            })
        finally:
            # Clean up local file
            if os.path.exists(local_path):
                os.remove(local_path)
    
    return {"results": results}

@app.get("/analytics")
async def fetch_analytics():
    try:
        data = get_analytics()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/invoices/{invoice_id}")
async def remove_invoice(invoice_id: str):
    try:
        delete_invoice(invoice_id)
        return {"success": True, "deleted_id": invoice_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

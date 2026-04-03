import os
import httpx
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

load_dotenv()

# Configuration
URL = os.getenv("SUPABASE_URL")
# Service role key is needed for bypass RLS and direct storage uploads
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") 
STORAGE_BUCKET = "invoice-files"

def get_headers():
    if not KEY:
        raise Exception("SUPABASE_SERVICE_ROLE_KEY missing in .env")
    return {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation" # To get data back after insert
    }

def upload_file_to_storage(file_path: str, filename: str, mime_type: str) -> Optional[str]:
    if not URL or not KEY:
        raise Exception("Supabase not configured in .env")

    # Step 1: Upload via Storage API
    upload_url = f"{URL}/storage/v1/object/{STORAGE_BUCKET}/{filename}"
    
    with open(file_path, "rb") as f:
        headers = {
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": mime_type
        }
        with httpx.Client(timeout=30.0) as client:
            response = client.post(upload_url, content=f.read(), headers=headers)
            
            if response.status_code not in [200, 201]:
                # If bucket doesn't exist, this might fail. We assume user created bucket 'invoice-files'
                raise Exception(f"File upload failed ({response.status_code}): {response.text}")

    # Step 2: Return public URL (assuming the bucket 'invoice-files' is public)
    return f"{URL}/storage/v1/object/public/{STORAGE_BUCKET}/{filename}"

def store_invoice_data(invoice_data: Dict[str, Any], file_url: str) -> Dict[str, Any]:
    if not URL:
        raise Exception("Supabase URL missing")

    record = {
        "vendor_name": invoice_data.get("vendor_name"),
        "invoice_number": invoice_data.get("invoice_number"),
        "invoice_date": invoice_data.get("invoice_date"),
        "total_amount": invoice_data.get("total_amount"),
        "currency": invoice_data.get("currency"),
        "tax_amount": invoice_data.get("tax_amount"),
        "raw_json": invoice_data,
        "file_url": file_url,
        "status": "processed",
        "confidence_score": invoice_data.get("confidence_score")
    }

    insert_url = f"{URL}/rest/v1/invoices"
    with httpx.Client(timeout=10.0) as client:
        response = client.post(insert_url, json=record, headers=get_headers())
        
        if response.status_code not in [200, 201]:
            raise Exception(f"Failed to store invoice data ({response.status_code}): {response.text}")
        
        data = response.json()
        return data[0] if isinstance(data, list) and len(data) > 0 else (data if data else {})

def get_analytics() -> Dict[str, Any]:
    if not URL:
        return {"total_spend": 0, "total_processed": 0, "vendor_totals": {}, "invoices": []}

    query_url = f"{URL}/rest/v1/invoices?select=*"
    with httpx.Client(timeout=10.0) as client:
        response = client.get(query_url, headers=get_headers())
        
        if response.status_code != 200:
            raise Exception(f"Failed to fetch analytics ({response.status_code}): {response.text}")
        
        invoices = response.json()
        
        # Calculate totals
        total_spend = sum([inv.get("total_amount") or 0 for inv in invoices])
        total_processed = len(invoices)
        
        vendor_totals = {}
        for inv in invoices:
            v_name = inv.get("vendor_name") or "Unknown"
            vendor_totals[v_name] = vendor_totals.get(v_name, 0) + (inv.get("total_amount") or 0)

        return {
            "total_spend": total_spend,
            "total_processed": total_processed,
            "vendor_totals": vendor_totals,
            "invoices": sorted(invoices, key=lambda x: x.get('created_at', ''), reverse=True)
        }

def delete_invoice(invoice_id: str) -> bool:
    if not URL:
        raise Exception("Supabase URL missing")

    delete_url = f"{URL}/rest/v1/invoices?id=eq.{invoice_id}"
    with httpx.Client(timeout=10.0) as client:
        response = client.delete(delete_url, headers=get_headers())

        if response.status_code not in [200, 204]:
            raise Exception(f"Failed to delete invoice ({response.status_code}): {response.text}")

    return True

def get_history_for_vendor(vendor_name: str) -> List[Dict[str, Any]]:
    if not URL or not vendor_name:
        return []

    # Filter keyword (simple ILIKE)
    query_url = f"{URL}/rest/v1/invoices?select=raw_json&vendor_name=ilike.*{vendor_name}*&limit=3"
    with httpx.Client(timeout=10.0) as client:
        response = client.get(query_url, headers=get_headers())
        
        if response.status_code != 200:
            return []
            
        data = response.json()
        return [rec["raw_json"] for rec in data if "raw_json" in rec]

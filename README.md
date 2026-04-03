# Invoice Extraction AI

An AI-powered application that extracts structured data from invoices (JPG, PNG, PDF), stores them in Supabase, and provides a real-time analytics dashboard.

## 🚀 Features
- **Multimodal AI Extraction**: Uses Gemini 1.5 Flash for high-accuracy OCR and field parsing.
- **Dynamic Analytics**: Real-time charts for spend trends, vendor totals, and processing stats.
- **Format Learning**: Remembers previous extractions from vendors to improve future results.
- **Bulk Upload**: Support for uploading multiple documents at once.
- **Glassmorphism UI**: Premium, modern interface designed for visual excellence.

## 🛠 Tech Stack
- **Frontend**: React (Vite), Recharts, Lucide-React, Vanilla CSS
- **Backend**: FastAPI (Python), Google Generative AI, Supabase SDK
- **Database/Storage**: Supabase (PostgreSQL + S3 Storage)

## 📦 Setup & Installation

### 1. Backend Setup
1. Navigate to the `backend` directory.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file based on `.env.template`:
   ```env
   SUPABASE_URL=your-supabase-url 
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   GOOGLE_API_KEY=your-gemini-api-key
   ```
4. Run the server:
   ```bash
   python main.py
   ```

### 2. Database Schema (Supabase SQL Editor)
Run the following SQL in your Supabase project to initialize the database:
```sql
CREATE TABLE invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_name TEXT,
    invoice_number TEXT,
    invoice_date DATE,
    total_amount NUMERIC,
    currency TEXT,
    tax_amount NUMERIC,
    raw_json JSONB,
    file_url TEXT,
    status TEXT DEFAULT 'processed',
    confidence_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable public bucket for storage: 'invoice-files'
```

### 3. Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## 🧠 AI Strategy
- **Prompt Engineering**: The LLM is instructed to output specific JSON schemas to ensure type safety.
- **Learning Mechanism**: Before extraction, the system checks the database for historical data from the same vendor and provides it as few-shot context to the AI, ensuring consistency in formatting and field mapping for recurring invoice types.
- **Fallback**: Handles noisy OCR by providing raw multimodal image processing directly through Gemini.

## 📊 Analytics
Available metrics:
- **Total Spend by Vendor** (Bar Chart)
- **Daily/Monthly Expense Trends** (Area Chart)
- **Total Invoices Processed**
- **Average Confidence Score**

## 💡 Potential Improvements
- [ ] User authentication with Supabase Auth.
- [ ] Manual override editing for extracted fields.
- [ ] Highlighting extracted fields on the original document (bounding box mapping).
- [ ] Multi-currency conversion via an external exchange rate API.

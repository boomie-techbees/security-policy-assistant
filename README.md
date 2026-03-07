# Security Questionnaire Assistant

MVP v1: Upload security policies (PDF/DOCX), paste questionnaire questions, get AI-generated draft answers with citations. Data is stored and processed locally except for answer generation (Claude API).

## Stack

- **Backend:** Python 3.10+, FastAPI, local embeddings (sentence-transformers), Claude API for answers
- **Frontend:** React, TypeScript, Vite, Mantine UI

## Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY
```

Run the API (from **project root** so you can rerun the same command anytime):

```bash
./scripts/start-backend.sh
```

Or from anywhere inside the project (e.g. if your terminal is already in `backend`):

```bash
../scripts/start-backend.sh
```

(One-off from inside `backend`: `source .venv/bin/activate && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.)

### Frontend

From project root:

```bash
./scripts/start-frontend.sh
```

Or: `cd frontend && npm install && npm run dev` (then `npm run dev` on later runs).

Open http://localhost:5173. The dev server proxies `/api` to the backend.

### Stopping servers / freeing ports

- **Best practice:** Stop dev servers with **Ctrl+C** in the terminal before closing the project or switching to another one.
- If you get "Address already in use" when starting:
  - Backend (8000): `kill $(lsof -t -i :8000)` then start uvicorn again.
  - Frontend (5173): `kill $(lsof -t -i :5173)` then run `npm run dev` again.
- To see what’s using a port: `lsof -i :8000` (or `:5173`).

## Usage

1. **Documents:** Upload PDF or DOCX policy files, then click **Index** for each. Indexed documents are used for RAG.
2. **Questionnaire:** Paste questions (one per line), or use the common-question suggestions; click **Generate draft answers**. Each answer shows cited policy sections. Results persist across refresh; use **Export to Word** or **Clear questionnaire** as needed.

## Documentation

- **[How the RAG pipeline works](docs/RAG-OVERVIEW.md)** – ingestion (chunking, embeddings), retrieval (similarity search), and generation (Claude + citations). For the curious.

## Data & privacy

- Uploaded files and the embedding index are stored under `backend/data/` (local only).
- Embeddings are computed locally (sentence-transformers). Only the **question** and **retrieved policy excerpts** are sent to Claude when generating answers.

# Architecture

High-level structure of the Security Questionnaire Assistant: how backend and frontend are split, how they talk, and where the code lives.

---

## Overview

The app is a **local-first** stack: a Python API (FastAPI) and a browser app (React). Both run on your machine. Policy files and the search index stay on disk; only when you generate answers does the **question + retrieved excerpts** go to Claude’s API.

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (http://localhost:5173)                            │
│  React + TypeScript + Vite + Mantine                        │
│  • Documents page (upload, index, delete)                   │
│  • Questionnaire page (questions, generate, export)         │
└───────────────────────────┬─────────────────────────────────┘
                            │ fetch /api/...
                            │ (Vite proxies to backend)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend (http://127.0.0.1:8000)                            │
│  FastAPI                                                    │
│  • Document upload/index/delete                              │
│  • RAG: embeddings (local) + Claude (API) for answers       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Local disk                                                 │
│  backend/data/uploads/   ← uploaded PDF/DOCX                │
│  backend/data/index/     ← metadata.json + vectors.npy       │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend (Python)

- **Framework:** FastAPI.
- **Location:** `backend/`
- **Entry:** `backend/app/main.py` (uvicorn runs `app.main:app`).

**Layout:**

| Path | Role |
|------|------|
| `app/main.py` | App setup, CORS, all API routes. |
| `app/config.py` | Paths for `data/`, `uploads/`, `index/`; settings from `.env` (e.g. `ANTHROPIC_API_KEY`). |
| `app/models/schemas.py` | Pydantic models for request/response (DocumentInfo, AnswerResult, Citation, etc.). |
| `app/services/documents.py` | Load PDF/DOCX and chunk into text + metadata. |
| `app/services/embeddings.py` | Sentence-transformers (local), store/load index (metadata.json + vectors.npy), search by similarity. |
| `app/services/rag.py` | RAG: retrieve chunks → format context → call Claude → parse citations. |

**API routes (all under `/api`):**

| Method | Path | Purpose |
|--------|------|--------|
| POST | `/documents/upload` | Upload a policy file (PDF/DOCX). |
| GET | `/uploads` | List uploaded files and whether each is indexed. |
| DELETE | `/uploads/{filename}` | Delete an uploaded file (and remove from index). |
| POST | `/documents/{filename}/index` | Index a file: chunk, embed, append to index. |
| GET | `/documents` | List documents in the index. |
| DELETE | `/documents/{document_id}` | Remove a document from the index only. |
| POST | `/answers/generate` | Body: `{ "question": "..." }`. Returns draft answer + citations. |
| POST | `/questionnaire/process` | Body: `{ "questions": ["...", ...] }`. Returns array of answer + citations per question. |
| GET | `/health` | Status + whether API key is set. |

---

## Frontend (React)

- **Stack:** React 19, TypeScript, Vite, Mantine UI, React Router.
- **Location:** `frontend/`
- **Entry:** `index.html` → `src/main.tsx` → `App.tsx`.

**Layout:**

| Path | Role |
|------|------|
| `src/App.tsx` | Shell: header, nav (Documents / Questionnaire), `<Routes>`. |
| `src/DocumentLibrary.tsx` | Documents page: upload, list uploads, index, delete file, list/remove from index. |
| `src/Questionnaire.tsx` | Questionnaire page: questions textarea, common questions, generate, results (accordion), copy/export/clear. |
| `src/api.ts` | All `fetch` calls to `/api/*` and shared types. |
| `vite.config.ts` | Dev server proxy: `/api` → `http://127.0.0.1:8000`. |

The browser talks to the backend only via `fetch('/api/...')`. In development, Vite serves the app and proxies `/api` to the FastAPI server, so the frontend doesn’t need to know the backend port.

---

## How they connect

1. You run **backend** (`./scripts/start-backend.sh`) → uvicorn on **8000**.
2. You run **frontend** (`./scripts/start-frontend.sh`) → Vite on **5173**.
3. You open **http://localhost:5173**. The page is served by Vite; any request to `/api/...` is proxied to `http://127.0.0.1:8000` (see `frontend/vite.config.ts`).
4. So the frontend always uses relative URLs (`/api/documents`, etc.); no CORS issues in dev because the browser thinks it’s same origin.

CORS is still set in FastAPI for `http://localhost:5173` and `http://127.0.0.1:5173` so the browser allows the responses.

---

## Scripts (project root)

| Script | Effect |
|--------|--------|
| `./scripts/start-backend.sh` | Frees port 8000, then runs `uvicorn app.main:app --reload` from `backend/`. |
| `./scripts/start-frontend.sh` | Frees port 5173, then runs `npm run dev` from `frontend/`. |

Both scripts resolve the project root from their own path, so you can run them from the root or from a subfolder (e.g. `../scripts/start-backend.sh`).

---

## Summary

- **Backend:** FastAPI app in `backend/app/`; services for documents, embeddings, and RAG; all persistence under `backend/data/`.
- **Frontend:** Single-page React app in `frontend/src/`; two main views (Documents, Questionnaire); API calls go to `/api/*` and are proxied to the backend in dev.
- **No database:** Uploads and index are files on disk; questionnaire results are in the browser (localStorage) only.

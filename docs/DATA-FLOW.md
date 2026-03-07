# Data Flow

Where data lives and how it moves: uploads, index, questionnaire results, and what leaves your machine.

---

## On disk (backend)

All of this is under **`backend/data/`** (created automatically, and listed in `.gitignore` so it isn’t committed).

### `backend/data/uploads/`

- **What:** Raw policy files you upload (PDF, DOCX).
- **When:** Filled by **POST /api/documents/upload**. Each file is saved with a safe filename (no path traversal, single extension).
- **Used by:** Indexing reads from here; delete upload removes the file and its chunks from the index.

### `backend/data/index/`

- **What:** The RAG “index”: chunk metadata + vectors.
  - **`metadata.json`** – One object per chunk: `chunk_id`, `document_id`, `document_name`, `page_number`, `section_title`, `text`.
  - **`vectors.npy`** – NumPy array of shape `(n_chunks, 384)` (embedding dimension for all-MiniLM-L6-v2).
- **When:** Updated when you **POST /api/documents/{filename}/index** (append) or **DELETE /api/documents/{document_id}** (remove that doc’s chunks).
- **Used by:** Every **POST /api/answers/generate** and **POST /api/questionnaire/process** loads this index to run the similarity search (see [RAG-OVERVIEW.md](RAG-OVERVIEW.md)).

So: **uploads** = original files; **index** = chunked text + embeddings for retrieval. Both stay local.

---

## In the browser (frontend)

### Questionnaire results (localStorage)

- **What:** The list of Q&A items (question, answer, citations) shown on the Questionnaire page.
- **Where:** Stored in the browser’s **localStorage** under the key `security-questionnaire-assistant-results`.
- **When:** Updated whenever you generate new answers (append) or clear the questionnaire (key removed). Restored on page load so results survive refresh and tab switch.
- **Scope:** Per origin (e.g. `http://localhost:5173`). Different browsers or devices have separate data.

Nothing in localStorage is sent to the backend or to Claude; it’s only for persistence in the UI.

---

## What goes over the network

### Frontend ↔ backend (local)

- All **`/api/*`** requests from the React app to the FastAPI server (in dev, via Vite proxy to `http://127.0.0.1:8000`).
- Payloads: file uploads (multipart), JSON for index/delete/generate/questionnaire, and JSON responses. All stay on your machine.

### Backend ↔ Anthropic (internet)

- **Only** when generating answers: **POST** to Claude’s API with:
  - The **question** (or each question in a batch).
  - The **retrieved policy excerpts** (top-k chunks) and their labels (e.g. [CIT-1], [CIT-2]).
- No full documents, no embedding vectors, and no questionnaire history are sent. The API key is read from `backend/.env` (`ANTHROPIC_API_KEY`) and never sent to the frontend.

---

## End-to-end flows

### Upload and index

1. User selects a file → frontend **POST /api/documents/upload** (multipart) → backend saves to `backend/data/uploads/{filename}`.
2. User clicks Index → frontend **POST /api/documents/{filename}/index** → backend loads file, chunks it (`documents.py`), embeds chunks (`embeddings.py`), appends to `metadata.json` and `vectors.npy`.

### Generate answers

1. User clicks Generate draft answers → frontend **POST /api/questionnaire/process** with `{ "questions": ["...", ...] }`.
2. Backend for each question: load index → embed question → similarity search → top-k chunks → **send question + chunks to Claude** → get answer + citations → return JSON.
3. Frontend appends results to state and writes to localStorage so they persist.

### Delete

- **Delete file:** **DELETE /api/uploads/{filename}** → backend removes file from `uploads/` and removes that document’s chunks from the index (by document_id derived from file path).
- **Remove from index:** **DELETE /api/documents/{document_id}** → backend removes that document’s chunks from the index only; file in `uploads/` is left as-is.

---

## Summary table

| Data | Location | Sent to Claude? |
|------|----------|------------------|
| Uploaded policy files | `backend/data/uploads/` | No |
| Chunk text + embeddings | `backend/data/index/` | Only retrieved excerpts (per request) |
| Questionnaire Q&A list | Browser localStorage | No |
| Question text | In each API request | Yes (with excerpts) |

So: **all storage is local** except the one-off send of **question + retrieved excerpts** to Claude when you generate answers.

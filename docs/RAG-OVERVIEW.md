# RAG Code Overview

How the Security Questionnaire Assistant’s RAG (Retrieval Augmented Generation) pipeline works.

---

## RAG = Retrieve, then Generate

RAG does two things: **find** the right bits of your policies, then **generate** an answer from those bits (plus the question). That way the model answers from your docs instead of guessing.

---

## 1. Ingestion (when you click “Index”)

**`backend/app/services/documents.py`** – turn a file into **chunks** with metadata:

- **PDF:** Opens with PyMuPDF (`fitz`), gets text per page, splits each page’s text into chunks (~512 chars, 64-char overlap). Each chunk keeps: `document_id`, `document_name`, `page_number`, `section_title` (none for PDF), `text`.
- **DOCX:** Uses `python-docx`, walks paragraphs. When it hits a Heading/Title, it flushes the current “section” into chunks. Those chunks get that heading as `section_title`. So you get chunks like “Information Security Policy – Password requirements” with the right title.
- **Chunking (`_chunk_text`):** Splits by **words** until length ~512 chars, then starts the next chunk but keeps the last ~64 chars’ worth of words so sentences don’t get cut in a bad place.

**`backend/app/services/embeddings.py`** – turn chunks into vectors and store them:

- **Embedding model:** `sentence-transformers` with **all-MiniLM-L6-v2** (runs locally; your policy text never leaves the machine).
- **`add_document`:** For each new file it:
  1. Calls `load_document()` to get chunks.
  2. Encodes all chunk texts: `model.encode(texts)` → one 384‑dim vector per chunk.
  3. Loads the existing index from disk (`metadata.json` + `vectors.npy`).
  4. Appends the new chunk metadata to `_metadata` and the new vectors to `_vectors`, then saves both back to disk.

So “Index” = **doc → chunks (with doc name, page, section) → embeddings → stored in the simple file-based index**.

---

## 2. Retrieval (when you ask a question)

**`backend/app/services/embeddings.py` – `search(query, top_k=8)`:**

1. Loads the index (metadata + vectors) from disk.
2. Encodes the **question** with the same model: `qv = model.encode([query])` → one 384‑dim vector.
3. **Similarity:** For every chunk vector, computes **cosine similarity** with the question vector:
   - `scores = dot(chunk_vectors, query_vector) / (norm(chunk_vectors) * norm(query_vector))`
   - Values between -1 and 1; higher = more similar.
4. Takes the **top_k** (default 8) chunk indices by score and returns the corresponding metadata (including full `text`) for those chunks.

So retrieval = **question → same embedding model → cosine similarity → top 8 chunks**. No vector DB in MVP; it’s just numpy and the two files on disk.

---

## 3. Generation (draft answer + citations)

**`backend/app/services/rag.py` – `generate_answer(question)`:**

1. **Retrieve:** `chunks = store.search(question, top_k=8)` (the step above).
2. **Format context:** Builds one string with all 8 chunks, each labeled for citation:
   - `[CIT-1] (DocumentName, section, page)\n<chunk text>`
   - `---`
   - `[CIT-2] ...`
   - etc.
3. **Prompt:** Sends to Claude:
   - **System:** “You are a security officer. Use ONLY the policy excerpts below. Don’t invent. Cite with [CIT-1], [CIT-2], etc.”
   - **User:** That formatted context + “Question: …” + “Draft answer (cite with [CIT-n]):”
4. **Parse citations:** After Claude replies, `_parse_citations(answer)` finds all `[CIT-n]` in the answer and collects which chunk indices were cited.
5. **Return:** The raw answer text plus a **citations** list: for each cited chunk, you get `document_name`, `section_title`, `page_number`, and the chunk `text` so the UI can show “where this came from.”

So generation = **top chunks + question → one Claude call → answer with [CIT-n] → we map those back to real doc/section/page/text for the UI**.

---

## Flow summary

| Step       | Where                    | What happens |
|-----------|---------------------------|--------------|
| **Ingest**  | `documents.py` → `embeddings.py` | PDF/DOCX → chunks (with metadata) → embed with MiniLM → save in `metadata.json` + `vectors.npy`. |
| **Retrieve**| `embeddings.py` `search()`       | Question → embed with same model → cosine similarity → return top 8 chunks. |
| **Generate**| `rag.py` `generate_answer()`     | Format chunks as [CIT-1]…[CIT-8], send to Claude with strict “only use these excerpts + cite,” then map [CIT-n] back to doc/section/page for citations. |

Only the **question** and those **retrieved excerpts** are sent to the API; the rest (full docs, embeddings) stays local.

---

## Tweaking later

- **Chunk size/overlap:** `documents.py` – `_chunk_text(..., chunk_size=512, overlap=64)`.
- **How many chunks per question:** `rag.py` – `store.search(question, top_k=8)`.
- **Stricter/looser answers:** `rag.py` – `SYSTEM_PROMPT` and the user prompt.

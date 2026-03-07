"""Security Questionnaire Assistant - FastAPI backend."""
import hashlib
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

from app.config import get_uploads_dir, get_index_dir, settings
from app.models.schemas import DocumentInfo, AnswerResult, Citation, QuestionnaireSubmit, GenerateAnswerRequest
from app.services.embeddings import get_store
from app.services.rag import generate_answer


ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_uploads_dir()
    get_index_dir()
    yield


app = FastAPI(
    title="Security Questionnaire Assistant",
    description="Upload policies, ask questions, get AI draft answers with citations.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _safe_filename(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in "._- ") or "document"


def _safe_upload_filename(original: str) -> str:
    """Return a safe filename preserving the extension once (no duplicate .pdf.pdf)."""
    p = Path(original or "document")
    stem = _safe_filename(p.stem) or "document"
    suffix = p.suffix.lower()
    return stem + suffix if suffix in ALLOWED_EXTENSIONS else stem + ".pdf"


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile) -> dict:
    """Upload a policy document (PDF or DOCX). Stored locally."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format. Use {', '.join(ALLOWED_EXTENSIONS)}")
    uploads_dir = get_uploads_dir()
    safe_name = _safe_upload_filename(file.filename or "document")
    path = uploads_dir / safe_name
    content = await file.read()
    path.write_bytes(content)
    return {"filename": safe_name, "path": str(path)}


@app.post("/api/documents/{filename}/index")
async def index_document(filename: str) -> dict:
    """Index an uploaded document: chunk and embed. Data stays local."""
    uploads_dir = get_uploads_dir()
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    path = uploads_dir / filename
    if not path.exists():
        raise HTTPException(404, "File not found")
    suffix = path.suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported format")
    try:
        store = get_store()
        chunks = store.add_document(path, path.name)
        return {"indexed": len(chunks), "document_name": path.name}
    except Exception as e:
        log.exception("Indexing failed")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Indexing failed: {e!s}", "error_type": type(e).__name__},
        )


@app.get("/api/documents", response_model=list[DocumentInfo])
async def list_documents():
    """List documents currently in the index."""
    store = get_store()
    return store.list_documents()


@app.delete("/api/uploads/{filename}")
async def delete_upload(filename: str) -> dict:
    """Delete an uploaded file from disk. Also removes it from the index if it was indexed."""
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    uploads_dir = get_uploads_dir()
    path = uploads_dir / filename
    if not path.exists():
        raise HTTPException(404, "File not found")
    doc_id = hashlib.sha256(str(path.resolve()).encode()).hexdigest()[:16]
    store = get_store()
    store.remove_document(doc_id)
    path.unlink(missing_ok=True)
    return {"deleted": filename}


@app.get("/api/uploads")
async def list_uploads() -> list[dict]:
    """List uploaded files. 'indexed' indicates whether each is in the search index."""
    uploads_dir = get_uploads_dir()
    store = get_store()
    indexed_names = {d["document_name"] for d in store.list_documents()}
    files = [f.name for f in uploads_dir.iterdir() if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS]
    return [{"filename": f, "indexed": f in indexed_names} for f in sorted(files)]


@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: str) -> dict:
    """Remove a document from the index (does not delete uploaded file)."""
    store = get_store()
    store.remove_document(document_id)
    return {"removed": document_id}


@app.post("/api/answers/generate", response_model=AnswerResult)
async def generate_draft_answer(body: GenerateAnswerRequest) -> AnswerResult:
    """Generate a draft answer for one question using RAG + Claude. Only question and retrieved excerpts are sent to the API."""
    result = generate_answer(body.question)
    return AnswerResult(
        answer=result["answer"],
        citations=[Citation(**c) for c in result["citations"]],
        chunks_used=result["chunks_used"],
    )


@app.post("/api/questionnaire/process")
async def process_questionnaire(body: QuestionnaireSubmit) -> list[dict]:
    """Process a list of questions; returns draft answer + citations for each."""
    out = []
    for q in body.questions:
        q = (q or "").strip()
        if not q:
            continue
        result = generate_answer(q)
        out.append({
            "question": q,
            "answer": result["answer"],
            "citations": result["citations"],
            "chunks_used": result.get("chunks_used", []),
        })
    return out


@app.get("/api/health")
async def health():
    return {"status": "ok", "has_api_key": bool(settings.anthropic_api_key)}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    """Log unhandled errors and return JSON so the UI can show the message."""
    log.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "error_type": type(exc).__name__},
    )

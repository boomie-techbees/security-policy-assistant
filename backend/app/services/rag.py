"""RAG: retrieve relevant policy chunks and generate draft answers via Claude."""
import re
from typing import Any

from anthropic import Anthropic

from app.config import settings
from app.services.embeddings import get_store


SYSTEM_PROMPT = """You are a security officer answering a customer security questionnaire. Use ONLY the provided policy excerpts below to draft a concise, professional answer. If the excerpts do not contain enough information to answer fully, say so and base your answer only on what is provided. Do not invent details. For each claim you make, cite the relevant excerpt using its label in square brackets (e.g. [CIT-1], [CIT-2])."""


def _format_context(chunks: list[dict[str, Any]]) -> str:
    """Format retrieved chunks with citation labels."""
    lines = []
    for i, c in enumerate(chunks, 1):
        label = f"[CIT-{i}]"
        doc = c.get("document_name", "Policy")
        page = c.get("page_number")
        section = c.get("section_title")
        parts = [f"{label} ({doc}"]
        if section:
            parts.append(f", {section}")
        if page is not None:
            parts.append(f", page {page}")
        parts.append(")")
        header = "".join(parts) + "\n"
        lines.append(header + (c.get("text") or ""))
    return "\n\n---\n\n".join(lines)


def _parse_citations(answer: str) -> list[int]:
    """Extract citation indices mentioned in the answer (e.g. [CIT-1] -> 1)."""
    seen: set[int] = set()
    for m in re.finditer(r"\[CIT-(\d+)\]", answer):
        seen.add(int(m.group(1)))
    return sorted(seen)


def generate_answer(question: str, top_k: int = 8) -> dict[str, Any]:
    """
    Retrieve relevant chunks, call Claude, return draft answer and citation metadata.
    Only the question and retrieved excerpts are sent to the API.
    """
    store = get_store()
    chunks = store.search(question, top_k=top_k)
    if not chunks:
        return {
            "answer": "No relevant policy sections were found in the indexed documents. Please add policy documents and re-index.",
            "citations": [],
            "chunks_used": [],
        }

    context = _format_context(chunks)
    user_content = f"""Policy excerpts:\n\n{context}\n\nQuestion:\n{question}\n\nDraft answer (cite with [CIT-n]):"""

    if not settings.anthropic_api_key:
        return {
            "answer": "[Configure ANTHROPIC_API_KEY to generate answers.]",
            "citations": [],
            "chunks_used": [{"document_name": c["document_name"], "section_title": c.get("section_title"), "page_number": c.get("page_number"), "text_preview": (c.get("text") or "")[:200]} for c in chunks],
        }

    client = Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model=settings.model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    text = msg.content[0].text if msg.content else ""

    cited_indices = _parse_citations(text)
    cited_chunks = [chunks[i - 1] for i in cited_indices if 1 <= i <= len(chunks)]

    return {
        "answer": text,
        "citations": [
            {
                "document_name": c.get("document_name"),
                "section_title": c.get("section_title"),
                "page_number": c.get("page_number"),
                "text": c.get("text"),
            }
            for c in cited_chunks
        ],
        "chunks_used": [
            {
                "document_name": c.get("document_name"),
                "section_title": c.get("section_title"),
                "page_number": c.get("page_number"),
                "text_preview": (c.get("text") or "")[:300],
            }
            for c in chunks
        ],
    }

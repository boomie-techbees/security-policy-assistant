"""Document loading and chunking for PDF and DOCX. All processing is local."""
from pathlib import Path
from dataclasses import dataclass
from typing import Iterator

import fitz  # pymupdf
from docx import Document as DocxDocument


@dataclass
class DocChunk:
    """A chunk of text from a policy document with citation metadata."""
    text: str
    document_id: str
    document_name: str
    page_number: int | None
    section_title: str | None
    chunk_index: int


def _chunk_text(
    text: str,
    document_id: str,
    document_name: str,
    page_number: int | None,
    section_title: str | None,
    chunk_size: int = 512,
    overlap: int = 64,
) -> list[DocChunk]:
    """Split text into overlapping chunks (by character count for simplicity)."""
    words = text.split()
    chunks: list[DocChunk] = []
    current: list[str] = []
    current_len = 0
    idx = 0
    for w in words:
        current.append(w)
        current_len += len(w) + 1
        if current_len >= chunk_size:
            chunk_text = " ".join(current)
            chunks.append(
                DocChunk(
                    text=chunk_text,
                    document_id=document_id,
                    document_name=document_name,
                    page_number=page_number,
                    section_title=section_title,
                    chunk_index=idx,
                )
            )
            idx += 1
            # overlap: keep last few words
            overlap_words = int(overlap / 5)  # rough
            current = current[-overlap_words:] if overlap_words else []
            current_len = sum(len(x) + 1 for x in current)
    if current:
        chunks.append(
            DocChunk(
                text=" ".join(current),
                document_id=document_id,
                document_name=document_name,
                page_number=page_number,
                section_title=section_title,
                chunk_index=idx,
            )
        )
    return chunks


def load_pdf(path: Path, document_id: str, document_name: str) -> Iterator[DocChunk]:
    """Extract text from PDF by page and yield chunks."""
    doc = fitz.open(path)
    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            if not text.strip():
                continue
            for chunk in _chunk_text(
                text, document_id, document_name, page_num + 1, None
            ):
                yield chunk
    finally:
        doc.close()


def load_docx(path: Path, document_id: str, document_name: str) -> Iterator[DocChunk]:
    """Extract text from DOCX by paragraph; use heading as section_title when available."""
    doc = DocxDocument(path)
    section_title: str | None = None
    current_paragraphs: list[str] = []
    chunk_index = 0

    for para in doc.paragraphs:
        style = para.style.name if para.style else ""
        text = para.text.strip()
        if not text:
            continue
        if "Heading" in style or "Title" in style:
            if current_paragraphs:
                block = "\n".join(current_paragraphs)
                for c in _chunk_text(
                    block, document_id, document_name, None, section_title
                ):
                    yield DocChunk(
                        text=c.text,
                        document_id=c.document_id,
                        document_name=c.document_name,
                        page_number=c.page_number,
                        section_title=c.section_title,
                        chunk_index=chunk_index,
                    )
                    chunk_index += 1
            section_title = text
            current_paragraphs = [text]
        else:
            current_paragraphs.append(text)

    if current_paragraphs:
        block = "\n".join(current_paragraphs)
        for c in _chunk_text(
            block, document_id, document_name, None, section_title
        ):
            yield DocChunk(
                text=c.text,
                document_id=c.document_id,
                document_name=c.document_name,
                page_number=c.page_number,
                section_title=c.section_title,
                chunk_index=chunk_index,
            )
            chunk_index += 1


def load_document(path: Path, document_id: str, document_name: str | None = None) -> list[DocChunk]:
    """Load a document (PDF or DOCX) and return all chunks."""
    name = document_name or path.name
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return list(load_pdf(path, document_id, name))
    if suffix in (".docx", ".doc"):
        return list(load_docx(path, document_id, name))
    raise ValueError(f"Unsupported format: {suffix}. Use PDF or DOCX.")

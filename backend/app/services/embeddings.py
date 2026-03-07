"""Simple local embeddings and in-memory retrieval. No vector DB for MVP."""
from pathlib import Path
import json
import hashlib
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import get_index_dir
from app.services.documents import DocChunk, load_document


INDEX_META = "metadata.json"
INDEX_VECTORS = "vectors.npy"
CHUNK_SIZE = 512
OVERLAP = 64


def _get_doc_id(path: Path) -> str:
    """Stable id from file path."""
    return hashlib.sha256(str(path.resolve()).encode()).hexdigest()[:16]


class SimpleEmbeddingStore:
    """Store embeddings and metadata on disk; load into memory for search."""

    def __init__(self, index_dir: Path | None = None):
        self.index_dir = index_dir or get_index_dir()
        self.model: SentenceTransformer | None = None
        self._vectors: np.ndarray | None = None
        self._metadata: list[dict[str, Any]] = []

    def _get_model(self) -> SentenceTransformer:
        if self.model is None:
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
        return self.model

    def _load_index(self) -> None:
        meta_path = self.index_dir / INDEX_META
        vec_path = self.index_dir / INDEX_VECTORS
        if not meta_path.exists() or not vec_path.exists():
            self._vectors = np.array([]).reshape(0, 384)
            self._metadata = []
            return
        with open(meta_path, "r", encoding="utf-8") as f:
            self._metadata = json.load(f)
        self._vectors = np.load(vec_path)

    def _save_index(self) -> None:
        if self._vectors is None or self._metadata is None:
            return
        self.index_dir.mkdir(parents=True, exist_ok=True)
        with open(self.index_dir / INDEX_META, "w", encoding="utf-8") as f:
            json.dump(self._metadata, f, indent=2, ensure_ascii=False)
        np.save(self.index_dir / INDEX_VECTORS, self._vectors)

    def add_document(self, file_path: Path, document_name: str | None = None) -> list[dict[str, Any]]:
        """Load doc, chunk, embed, append to index. Returns list of chunk metadata."""
        doc_id = _get_doc_id(file_path)
        name = document_name or file_path.name
        chunks = load_document(file_path, doc_id, name)
        if not chunks:
            return []

        texts = [c.text for c in chunks]
        model = self._get_model()
        vectors = model.encode(texts)

        self._load_index()
        n = len(self._metadata)
        meta_entries = []
        for i, c in enumerate(chunks):
            entry = {
                "chunk_id": n + i,
                "document_id": c.document_id,
                "document_name": c.document_name,
                "page_number": c.page_number,
                "section_title": c.section_title,
                "chunk_index": c.chunk_index,
                "text": c.text,
            }
            self._metadata.append(entry)
            meta_entries.append(entry)
        self._vectors = (
            np.vstack([self._vectors, vectors])
            if self._vectors is not None and len(self._vectors) > 0
            else vectors
        )
        self._save_index()
        return meta_entries

    def remove_document(self, document_id: str) -> None:
        """Remove all chunks for a document from the index."""
        self._load_index()
        new_meta = [m for m in self._metadata if m["document_id"] != document_id]
        if len(new_meta) == len(self._metadata):
            return
        indices = [i for i, m in enumerate(self._metadata) if m["document_id"] == document_id]
        mask = np.ones(len(self._metadata), dtype=bool)
        mask[indices] = False
        self._vectors = self._vectors[mask]
        self._metadata = new_meta
        self._save_index()

    def search(self, query: str, top_k: int = 8) -> list[dict[str, Any]]:
        """Return top_k chunks most similar to query (cosine similarity)."""
        self._load_index()
        if self._vectors is None or len(self._metadata) == 0:
            return []
        model = self._get_model()
        qv = model.encode([query])
        scores = np.dot(self._vectors, qv.T).flatten() / (
            np.linalg.norm(self._vectors, axis=1) * np.linalg.norm(qv) + 1e-9
        )
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [self._metadata[i] for i in top_indices]

    def list_documents(self) -> list[dict[str, Any]]:
        """List unique documents in the index."""
        self._load_index()
        seen: set[str] = set()
        out = []
        for m in self._metadata:
            did = m["document_id"]
            if did not in seen:
                seen.add(did)
                out.append({
                    "document_id": did,
                    "document_name": m["document_name"],
                })
        return out


def get_store() -> SimpleEmbeddingStore:
    return SimpleEmbeddingStore()

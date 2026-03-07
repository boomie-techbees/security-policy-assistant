const API = '/api';

/** Parse error response so UI shows backend detail (e.g. "Indexing failed: ...") instead of raw JSON. */
async function errorMessage(r: Response): Promise<string> {
  const text = await r.text();
  try {
    const j = JSON.parse(text);
    if (typeof j?.detail === 'string') return j.detail;
  } catch {
    /* ignore */
  }
  return text || r.statusText || 'Request failed';
}

export type DocumentInfo = { document_id: string; document_name: string };
export type UploadInfo = { filename: string; indexed: boolean };
export type Citation = {
  document_name: string | null;
  section_title: string | null;
  page_number: number | null;
  text: string | null;
};
export type AnswerResult = {
  answer: string;
  citations: Citation[];
  chunks_used: Array<{ document_name?: string; section_title?: string; page_number?: number; text_preview?: string }>;
};
export type QuestionnaireItem = {
  question: string;
  answer: string;
  citations: Citation[];
  chunks_used?: unknown[];
};

export async function listUploads(): Promise<UploadInfo[]> {
  const r = await fetch(`${API}/uploads`);
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const r = await fetch(`${API}/documents`);
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

export async function uploadDocument(file: File): Promise<{ filename: string }> {
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${API}/documents/upload`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

export async function indexDocument(filename: string): Promise<{ indexed: number; document_name: string }> {
  const r = await fetch(`${API}/documents/${encodeURIComponent(filename)}/index`, { method: 'POST' });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

export async function deleteUpload(filename: string): Promise<{ deleted: string }> {
  const r = await fetch(`${API}/uploads/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

export async function deleteDocument(documentId: string): Promise<void> {
  const r = await fetch(`${API}/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await errorMessage(r));
}

export async function generateAnswer(question: string): Promise<AnswerResult> {
  const r = await fetch(`${API}/answers/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

export async function processQuestionnaire(questions: string[]): Promise<QuestionnaireItem[]> {
  const r = await fetch(`${API}/questionnaire/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

export async function health(): Promise<{ status: string; has_api_key: boolean }> {
  const r = await fetch(`${API}/health`);
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

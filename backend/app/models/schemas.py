"""Pydantic schemas for API request/response."""
from pydantic import BaseModel


class DocumentInfo(BaseModel):
    document_id: str
    document_name: str


class Citation(BaseModel):
    document_name: str | None
    section_title: str | None
    page_number: int | None
    text: str | None


class AnswerResult(BaseModel):
    answer: str
    citations: list[Citation]
    chunks_used: list[dict]


class GenerateAnswerRequest(BaseModel):
    question: str


class QuestionnaireSubmit(BaseModel):
    questions: list[str]


class QuestionnaireItem(BaseModel):
    question: str
    answer: str | None = None
    citations: list[Citation] = []
    status: str = "draft"

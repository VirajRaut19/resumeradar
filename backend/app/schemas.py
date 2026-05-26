from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ResumeOut(BaseModel):
    id: UUID
    filename: Optional[str]
    class Config:
        from_attributes = True

class AnalysisOut(BaseModel):
    id: UUID
    score: float
    class Config:
        from_attributes = True

class MatchRequest(BaseModel):
    resume_id: str
    jd_text: str

class MatchOut(BaseModel):
    score: float
    top_chunks: list[str]
    resume_id: str
    resume_name: str
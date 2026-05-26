from sqlalchemy import Column, String, Float, Text, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    filename = Column(String)
    raw_text = Column(Text)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    resume_id = Column(UUID(as_uuid=True), nullable=False)
    resume_name = Column(String)
    jd_preview = Column(String)
    score = Column(Float)
    matched_keywords = Column(JSON)
    missing_keywords = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import models
from app.schemas import ResumeOut
import uuid
from pypdf import PdfReader
import io

router = APIRouter()

def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = " ".join(page.extract_text() or "" for page in reader.pages)
        return text.strip()
    except Exception as e:
        raise HTTPException(400, f"Could not read PDF: {e}")

@router.post("/upload", response_model=ResumeOut)
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    if file.filename.endswith(".pdf"):
        text = extract_text_from_pdf(content)
    else:
        text = content.decode("utf-8", errors="ignore")
    if not text:
        raise HTTPException(400, "Could not extract text from file")
    resume = models.Resume(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        filename=file.filename,
        raw_text=text
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume

@router.get("/list")
def list_resumes(db: Session = Depends(get_db)):
    return db.query(models.Resume).all()
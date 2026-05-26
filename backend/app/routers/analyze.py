from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db import get_db
from app import models
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import httpx
import json
import re
import uuid

router = APIRouter()

print(">>> Loading embedding model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print(">>> Embedding model loaded!")

TECH_KEYWORDS = [
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby",
    "react", "next.js", "vue", "angular", "svelte", "tailwind", "css", "html",
    "fastapi", "django", "flask", "express", "node.js", "spring", "laravel",
    "postgresql", "mysql", "mongodb", "redis", "sqlite", "firebase", "supabase",
    "docker", "kubernetes", "aws", "gcp", "azure", "terraform", "ansible",
    "git", "github", "gitlab", "ci/cd", "github actions", "jenkins",
    "rest", "graphql", "grpc", "websockets", "microservices", "api",
    "machine learning", "deep learning", "nlp", "computer vision", "pytorch", "tensorflow",
    "pandas", "numpy", "scikit-learn", "langchain", "openai", "llm", "rag",
    "linux", "bash", "nginx", "apache", "vercel", "railway", "heroku",
    "agile", "scrum", "jira", "figma", "postman",
    "sql", "nosql", "orm", "prisma", "sqlalchemy",
    "jwt", "oauth", "authentication", "authorization",
    "testing", "pytest", "jest", "unit testing", "integration testing",
    "pgvector", "chromadb", "pinecone", "weaviate", "vector database",
    "celery", "rabbitmq", "kafka", "message queue",
    "pydantic", "zod", "validation"
]

def extract_keywords(text: str) -> set[str]:
    text_lower = text.lower()
    found = set()
    for keyword in TECH_KEYWORDS:
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, text_lower):
            found.add(keyword)
    return found

def chunk_text(text: str, size: int = 200) -> list[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), size):
        chunk = " ".join(words[i:i+size])
        chunks.append(chunk)
    return chunks

class MatchRequest(BaseModel):
    resume_id: str
    jd_text: str

class RewriteRequest(BaseModel):
    bullet: str
    jd_text: str

@router.post("/match")
def match(req: MatchRequest, db: Session = Depends(get_db)):
    from app.cache import get_cached_result, set_cached_result

    # Check cache first
    cached = get_cached_result(req.resume_id, req.jd_text)
    if cached:
        return {**cached, "from_cache": True}

    # Get resume
    resume = db.query(models.Resume).filter(
        models.Resume.id == req.resume_id
    ).first()
    if not resume:
        raise HTTPException(404, "Resume not found")
    if not resume.raw_text:
        raise HTTPException(400, "Resume has no text")

    # Embedding match score
    chunks = chunk_text(resume.raw_text)
    if not chunks:
        raise HTTPException(400, "Could not process resume text")

    jd_embedding = model.encode([req.jd_text])
    chunk_embeddings = model.encode(chunks)
    similarities = cosine_similarity(jd_embedding, chunk_embeddings)[0]

    top_scores = sorted(similarities, reverse=True)[:5]
    score = float(np.mean(top_scores)) * 100

    top_indices = np.argsort(similarities)[::-1][:3]
    top_chunks = [chunks[i] for i in top_indices]

    # Skills gap
    jd_keywords = extract_keywords(req.jd_text)
    resume_keywords = extract_keywords(resume.raw_text)
    matched_keywords = sorted(jd_keywords & resume_keywords)
    missing_keywords = sorted(jd_keywords - resume_keywords)

    # Save to PostgreSQL
    analysis = models.Analysis(
        id=uuid.uuid4(),
        user_id=resume.user_id,
        resume_id=resume.id,
        resume_name=resume.filename,
        jd_preview=req.jd_text[:120] + "..." if len(req.jd_text) > 120 else req.jd_text,
        score=round(score, 1),
        matched_keywords=matched_keywords,
        missing_keywords=missing_keywords,
    )
    db.add(analysis)
    db.commit()

    result = {
        "score": round(score, 1),
        "top_chunks": top_chunks,
        "resume_id": req.resume_id,
        "resume_name": resume.filename,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "from_cache": False
    }

    # Save to cache
    set_cached_result(req.resume_id, req.jd_text, result)

    return result

@router.post("/rewrite")
async def rewrite(req: RewriteRequest):
    prompt = f"""You are a professional resume coach. Rewrite the resume bullet point below to better match the job description. Make it more specific, impactful, and use keywords from the job description. Return only the rewritten bullet point, nothing else.

Job Description:
{req.jd_text[:800]}

Original Bullet:
{req.bullet}

Rewritten Bullet:"""

    async def stream_response():
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    "http://localhost:11434/api/generate",
                    json={"model": "mistral", "prompt": prompt, "stream": True}
                ) as response:
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                token = data.get("response", "")
                                if token:
                                    yield token
                                if data.get("done"):
                                    break
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            yield f"\n[Error connecting to Ollama: {e}]"

    return StreamingResponse(stream_response(), media_type="text/plain")

@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    analyses = db.query(models.Analysis).order_by(
        models.Analysis.created_at.desc()
    ).limit(20).all()
    return [
        {
            "id": str(a.id),
            "resume_name": a.resume_name,
            "jd_preview": a.jd_preview,
            "score": a.score,
            "matched_keywords": a.matched_keywords or [],
            "missing_keywords": a.missing_keywords or [],
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in analyses
    ]
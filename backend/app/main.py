import logging
logging.basicConfig(level=logging.DEBUG)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, resume, analyze
from app.db import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ResumeRadar API")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f">>> incoming request: {request.method} {request.url}")
    response = await call_next(request)
    print(f">>> response status: {response.status_code}")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(resume.router, prefix="/resume", tags=["resume"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])

@app.get("/")
def root():
    return {"message": "ResumeRadar API is running"}
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas
from jose import jwt
import bcrypt
import os, datetime

router = APIRouter()
SECRET = os.getenv("JWT_SECRET", "changeme")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def make_token(user_id: str):
    payload = {
        "sub": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

@router.post("/register", response_model=schemas.Token)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        if db.query(models.User).filter_by(email=data.email).first():
            raise HTTPException(400, "Email already registered")
        user = models.User(
            email=data.email,
            hashed_password=hash_password(data.password)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"access_token": make_token(str(user.id)), "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(">>> EXCEPTION:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=schemas.Token)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    try:
        user = db.query(models.User).filter_by(email=data.email).first()
        if not user or not verify_password(data.password, user.hashed_password):
            raise HTTPException(401, "Invalid credentials")
        return {"access_token": make_token(str(user.id)), "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(">>> EXCEPTION:", e)
        raise HTTPException(status_code=500, detail=str(e))
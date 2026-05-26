# ResumeRadar 🎯
### AI-Powered Resume Analyzer & Job Matcher

ResumeRadar is a full-stack AI application that analyzes how well your resume matches a job description using semantic embeddings, identifies skills gaps, and rewrites your resume bullets using a local LLM — all running locally on your machine.

---

## ✨ Features

- **AI Match Scoring** — Computes semantic similarity between your resume and job description using `sentence-transformer` embeddings and cosine similarity
- **Skills Gap Analysis** — Extracts keywords from job descriptions and shows which ones are present or missing from your resume as visual tags
- **AI Bullet Rewriter** — Streams rewritten resume bullets in real time using Ollama + Mistral 7B locally
- **Analysis History** — Every match result is saved to PostgreSQL and shown on your dashboard
- **Redis Caching** — Repeat analyses on the same resume + JD pair return instantly from cache
- **JWT Authentication** — Secure register/login with bcrypt password hashing and token-based auth
- **Docker Compose** — One command starts the entire backend stack

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL 15 |
| Caching | Redis 7 |
| AI / Embeddings | sentence-transformers (`all-MiniLM-L6-v2`) |
| Local LLM | Ollama + Mistral 7B |
| ORM | SQLAlchemy |
| Auth | JWT (python-jose), bcrypt |
| Validation | Pydantic |
| Containerization | Docker, Docker Compose |

---

## 🏗️ Architecture

![Architecture](architecture.png)
```
Browser (Next.js — port 3000)
        ↕ REST API
FastAPI Backend (port 8000)
    ├── /auth        → register, login (JWT)
    ├── /resume      → upload PDF/TXT, extract text
    └── /analyze     → match score, skills gap, bullet rewrite
        ↕                    ↕                    ↕
   PostgreSQL           sentence-transformers    Ollama
   (port 5432)          embeddings + cosine      Mistral 7B
   Redis cache          similarity               (port 11434)
   (port 6379)
```

---

## 📁 Project Structure

```
resumeradar/
├── docker-compose.yml
├── frontend/                   # Next.js app
│   ├── app/
│   │   ├── auth/
│   │   │   └── page.tsx        # Login / Register page
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Main app — upload, analyze, history
│   │   └── page.tsx            # Redirects to /auth
│   └── lib/
│       └── api.ts              # Typed API client
└── backend/                    # FastAPI app
    ├── Dockerfile
    ├── requirements.txt
    ├── .env
    └── app/
        ├── main.py             # App entry point, CORS, router registration
        ├── db.py               # PostgreSQL connection, session factory
        ├── models.py           # SQLAlchemy ORM models (User, Resume, Analysis)
        ├── schemas.py          # Pydantic request/response schemas
        ├── cache.py            # Redis cache helpers
        └── routers/
            ├── auth.py         # /auth/register, /auth/login
            ├── resume.py       # /resume/upload, /resume/list
            └── analyze.py      # /analyze/match, /analyze/rewrite, /analyze/history
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js 18+](https://nodejs.org)
- [Python 3.11+](https://python.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Git](https://git-scm.com)
- [Ollama](https://ollama.com) — for the bullet rewriter feature

### 1. Clone the repository

```bash
git clone https://github.com/VirajRaut19/resumeradar.git
cd resumeradar
```

### 2. Pull the Mistral model

```bash
ollama pull mistral
ollama serve
```

### 3. Start the backend stack (PostgreSQL + Redis + FastAPI)

```bash
docker compose up --build
```

Wait until you see:
```
resumeradar-backend | >>> Embedding model loaded!
resumeradar-backend | INFO: Application startup complete.
```

### 4. Start the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

### 5. Open the app

Go to [http://localhost:3000](http://localhost:3000)

Register an account, upload your resume (PDF or TXT), paste a job description, and click **Analyze Match**.

---

## ⚙️ Environment Variables

Create a `backend/.env` file with the following:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resumeradar
JWT_SECRET=supersecretkey123
REDIS_HOST=localhost
REDIS_PORT=6379
```

> ⚠️ Never commit your `.env` file to GitHub. It is already in `.gitignore`.

---

## 📸 How It Works

### Match Scoring
1. Resume is uploaded and text is extracted (PDF or TXT)
2. Text is split into 200-word chunks
3. Job description and resume chunks are embedded using `all-MiniLM-L6-v2`
4. Cosine similarity is computed between the JD embedding and each chunk
5. Score = mean of top-5 similarity scores × 100

### Skills Gap Analysis
- A curated list of 60+ tech keywords is matched against both the resume and JD
- Keywords found in both → shown as green tags
- Keywords in JD but missing from resume → shown as red tags

### Bullet Rewriter
- Takes a resume bullet + the job description
- Sends a structured prompt to Mistral 7B via Ollama
- Streams the rewritten bullet token by token back to the frontend

### Redis Caching
- Cache key = `match:{resume_id}:{sha256(jd_text)[:16]}`
- Cache TTL = 1 hour
- Same resume + JD pair returns instantly on repeat analysis

---

## 🗄️ Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Resumes table
CREATE TABLE resumes (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    filename TEXT,
    raw_text TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Analyses table
CREATE TABLE analyses (
    id UUID PRIMARY KEY,
    user_id UUID,
    resume_id UUID,
    resume_name TEXT,
    jd_preview TEXT,
    score FLOAT,
    matched_keywords JSON,
    missing_keywords JSON,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🔄 Daily Development Workflow

```bash
# Terminal 1 — start backend stack
docker compose up

# Terminal 2 — start frontend
cd frontend && npm run dev

# When done
docker compose down
wsl --shutdown    # Windows only — frees RAM
```

---

## 📝 API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and get JWT token |
| POST | `/resume/upload` | Upload a PDF or TXT resume |
| GET | `/resume/list` | List all uploaded resumes |
| POST | `/analyze/match` | Get match score + skills gap |
| POST | `/analyze/rewrite` | Stream AI bullet rewrite |
| GET | `/analyze/history` | Get past analysis history |

Full interactive API docs available at [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🔮 Roadmap

- [ ] pgvector — store embeddings in PostgreSQL for persistent vector search
- [ ] GitHub Actions CI/CD pipeline
- [ ] Deploy to Railway with live URL
- [ ] Multiple resume management
- [ ] Export rewritten resume as PDF

---

## 👤 Author

**Viraj Raut**
- GitHub: [@VirajRaut19](https://github.com/VirajRaut19)
- LinkedIn: [linkedin.com/in/Viraj-Raut](https://linkedin.com/in/Viraj-Raut)
- Email: 19viraj2005@gmail.com

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

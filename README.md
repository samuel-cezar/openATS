# openATS

A multi-tenant applicant tracking API that ranks candidates against job positions using semantic similarity of skills.

## How it works

Positions and candidates are each processed through an LLM pipeline that extracts hard skills and soft skills from free-text (job descriptions and resumes), then generates separate dense vector embeddings for each skill category.

Ranking is computed as a weighted cosine similarity:

```
score(candidate, position) = α · sim(hardSkills) + β · sim(softSkills)
```

Each tenant configures their own `α` and `β` weights, allowing organisations to tune how much technical fit versus interpersonal fit influences the ranking.

## Stack

- **Node.js / Express** — REST API (`/api/v1`)
- **MongoDB / Mongoose** — document store with per-document `tenantId` isolation
- **Multer** — PDF resume uploads
- **React + Vite** — recruiter-facing SPA (`frontend/`)
- **Docker Compose** — MongoDB + API + frontend services

## Pipeline

The processing pipeline is split into five stages (`1_trigger` → `2_ocr` → `3_rag` → `4_embeddings` → `5_matching`). The API exposes stub endpoints (`POST /positions/:id/process`, `POST /candidates/:id/process`) that will trigger this pipeline once each stage is implemented.

## Frontend

The `frontend/` directory contains a Vite + React SPA with four views: **Processes**, **Positions**, **Candidates**, and **Ranking**.

```bash
cd frontend && pnpm install   # install deps
cd frontend && pnpm dev       # dev server at http://localhost:5173
```

The UI talks directly to `http://localhost:3000/api/v1` with `X-Tenant-Id: demo` hardcoded. The API must be running locally or via Docker Compose before opening the app.

`docker compose up` starts all three services (MongoDB + API + frontend). The SPA is then available at **http://localhost:5173**.

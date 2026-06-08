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
- **Docker Compose** — MongoDB + API services

## Pipeline

The processing pipeline is split into five stages (`1_trigger` → `2_ocr` → `3_rag` → `4_embeddings` → `5_matching`). The API exposes stub endpoints (`POST /positions/:id/process`, `POST /candidates/:id/process`) that will trigger this pipeline once each stage is implemented.

Below are the **API requirements** derived from the data models presented in the PDF, along with a ready‑to‑use **Node.js/Express + Mongoose** implementation blueprint and **Docker Compose** setup for the API and MongoDB.

The design follows the entities described in *Figura 2 – Modelo de Dados* (pages 26‑28 of the PDF) and supports multi‑tenant isolation via the `tenantId` field (single MongoDB database, but each document belongs to a tenant). All endpoints are prefixed with `/api/v1` and require a `X-Tenant-Id` header to identify the organisation.

---

## 1. Data Models (Mongoose Schemas)

```javascript
// models/Tenant.js
const tenantSchema = {
  name: { type: String, required: true },
  alpha: { type: Number, default: 0.6 },   // weight for hard skills
  beta:  { type: Number, default: 0.4 },   // weight for soft skills (alpha+beta=1)
  createdAt: { type: Date, default: Date.now }
};

// models/User.js
const userSchema = {
  tenantId: { type: String, required: true, index: true },
  name: String,
  email: { type: String, required: true },
  role: { type: String, enum: ['recruiter', 'admin'], default: 'recruiter' }
};

// models/SelectionProcess.js
const selectionProcessSchema = {
  tenantId: { type: String, required: true, index: true },
  name: String,
  description: String,
  startDate: Date,
  endDate: Date
};

// models/Position.js
const positionSchema = {
  tenantId: { type: String, required: true, index: true },
  selectionProcessId: { type: mongoose.Schema.Types.ObjectId, ref: 'SelectionProcess' },
  title: String,
  jobDescription: String,               // raw text from PDF/document
  hardSkillsRequired: [String],         // extracted hard skills
  softSkillsRequired: [String],         // extracted soft skills
  embeddingHS: [Number],                // dense vector for hard skills (e.g., 1536-dim)
  embeddingSS: [Number],                // dense vector for soft skills
  processed: { type: Boolean, default: false }
};

// models/Candidate.js
const candidateSchema = {
  tenantId: { type: String, required: true, index: true },
  name: String,
  email: String,
  resumePdfUrl: String,                 // path or SharePoint reference
  extractedText: String,                // raw text from OCR/pdf parser
  hardSkills: [String],
  softSkills: [String],
  embeddingHS: [Number],
  embeddingSS: [Number],
  processed: { type: Boolean, default: false }
};

// models/Match.js
const matchSchema = {
  tenantId: { type: String, required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  totalScore: Number,                   // S(c,p) = alpha*sim_hs + beta*sim_ss
  hardScore: Number,                    // cosine similarity of hard skills
  softScore: Number,                    // cosine similarity of soft skills
  rank: Number,                         // position in the ordered list for this job
  computedAt: { type: Date, default: Date.now }
};
```

---

## 2. API Endpoints

### 2.1 Tenant & User Management

| Method | Endpoint                     | Description                         |
|--------|------------------------------|-------------------------------------|
| POST   | `/tenants`                   | Create a new tenant                |
| GET    | `/tenants/:id`               | Get tenant details (incl. α, β)    |
| PUT    | `/tenants/:id/weights`       | Update α and β                     |
| POST   | `/users`                     | Create a user (belongs to tenant)  |
| GET    | `/users`                     | List users of current tenant       |

### 2.2 Selection Processes & Positions

| Method | Endpoint                              | Description                           |
|--------|---------------------------------------|---------------------------------------|
| POST   | `/selection-processes`                | Create a new selection process        |
| GET    | `/selection-processes`                | List all processes of the tenant      |
| POST   | `/positions`                          | Create a position (raw job description) |
| POST   | `/positions/:id/process`              | Trigger LLM extraction (hard/soft skills + embeddings) |
| GET    | `/positions/:id`                      | Get position details                  |

### 2.3 Candidates & Resume Processing

| Method | Endpoint                     | Description                                           |
|--------|------------------------------|-------------------------------------------------------|
| POST   | `/candidates`                | Create a candidate (metadata + optionally PDF URL)   |
| POST   | `/candidates/:id/upload`     | Upload a PDF resume (multipart) → store & trigger OCR |
| POST   | `/candidates/:id/process`    | Run OCR → RAG skill extraction → generate embeddings |
| GET    | `/candidates/:id`            | Get candidate profile with extracted skills           |

### 2.4 Matching & Ranking

| Method | Endpoint                              | Description                                                   |
|--------|---------------------------------------|---------------------------------------------------------------|
| POST   | `/matches/position/:positionId`       | Compute/update matches for all candidates against one position |
| GET    | `/positions/:positionId/ranking`      | Return ordered list of candidates with totalScore, hardScore, softScore |
| GET    | `/candidates/:candidateId/matches`    | List all positions with match scores for a given candidate      |

---

## 3. Core Business Logic (Helpers)

### Cosine Similarity
```javascript
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.hypot(...vecA);
  const magB = Math.hypot(...vecB);
  return dot / (magA * magB);
}
```

### Match Score Calculation
```javascript
async function computeMatch(candidateId, positionId, tenant) {
  const [cand, pos] = await Promise.all([
    Candidate.findById(candidateId),
    Position.findById(positionId)
  ]);
  const simHS = cosineSimilarity(cand.embeddingHS, pos.embeddingHS);
  const simSS = cosineSimilarity(cand.embeddingSS, pos.embeddingSS);
  const total = tenant.alpha * simHS + tenant.beta * simSS;
  return { total, hard: simHS, soft: simSS };
}
```

### Ranking for a Position
```javascript
// After computing/updating all matches for a position, assign ranks:
const matches = await Match.find({ positionId }).sort({ totalScore: -1 });
for (let i = 0; i < matches.length; i++) {
  matches[i].rank = i + 1;
  await matches[i].save();
}
```

---

## 4. Docker Compose Configuration

Create a `docker-compose.yml` in the project root:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    container_name: recruitment-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: secret123
    volumes:
      - mongo-data:/data/db

  api:
    build: .
    container_name: recruitment-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      - mongodb
    environment:
      NODE_ENV: development
      PORT: 3000
      MONGO_URI: mongodb://admin:secret123@mongodb:27017/recruitment?authSource=admin
      OPENAI_API_KEY: ${OPENAI_API_KEY}   # optional, for LLM calls
    volumes:
      - ./uploads:/app/uploads   # persist uploaded PDFs

volumes:
  mongo-data:
```

### Dockerfile (for the Node.js API)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

### `package.json` essentials
```json
{
  "name": "recruitment-api",
  "scripts": { "start": "node src/server.js" },
  "dependencies": {
    "express": "^4.18",
    "mongoose": "^7.5",
    "multer": "^1.4",
    "cors": "^2.8",
    "dotenv": "^16.3"
  }
}
```

---

## 5. Environment Variables

Create a `.env` file (or pass via Docker `environment`):

```env
PORT=3000
MONGO_URI=mongodb://admin:secret123@localhost:27017/recruitment?authSource=admin
OPENAI_API_KEY=your-key-here   # if using real LLM/embeddings
```

---

## 6. Sample Express Server Skeleton

```javascript
// src/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Tenant middleware
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) return res.status(400).json({ error: 'X-Tenant-Id header required' });
  req.tenantId = tenantId;
  next();
});

// Routes (examples)
app.use('/api/v1/tenants', require('./routes/tenants'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/positions', require('./routes/positions'));
app.use('/api/v1/candidates', require('./routes/candidates'));
app.use('/api/v1/matches', require('./routes/matches'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(process.env.PORT, () => console.log(`API running on port ${process.env.PORT}`)));
```

"""openATS embedding stage (services/4_embeddings).

Cloud-function-style HTTP handler, invoked by the monitor (services/1_monitor)
with payload {jobId, tenantId, entityType, entityId}. Runs locally under
functions-framework, so the same handler is deployable to a cloud-function
platform unchanged.

Reads the entity's skill lists (stored by services/3_rag) — candidates:
hardSkills/softSkills, positions: hardSkillsRequired/softSkillsRequired —
joins each list into one string, and embeds the two strings with Gemini
(`gemini-embedding-001`, 768 dimensions, SEMANTIC_SIMILARITY task type) in a
single batched call. The vectors are stored as embeddingHS / embeddingSS on
the entity; api/src/routes/matches.ts later computes cosine similarity
between candidate and position vectors, so every entity must be embedded
with the same model and dimensionality — changing EMBEDDING_MODEL or
EMBEDDING_DIM invalidates all previously stored embeddings.

(Vectors at non-native dimensionality are not unit-normalized by the API;
that is fine because the matcher's cosineSimilarity normalizes internally.)
"""

import logging
import os

import functions_framework
from bson import ObjectId
from bson.errors import InvalidId
from google import genai
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/recruitment")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "gemini-embedding-001")
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "768"))

ENTITY_SKILL_FIELDS = {
    "position": ("positions", "hardSkillsRequired", "softSkillsRequired"),
    "candidate": ("candidates", "hardSkills", "softSkills"),
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [embeddings] %(message)s",
)
log = logging.getLogger(__name__)

# Created lazily on first request: functions-framework (gunicorn) forks worker
# processes after import, and these clients must not cross a fork.
_db = None
_gemini = None


def get_db():
    global _db
    if _db is None:
        _db = MongoClient(MONGO_URI).get_default_database("recruitment")
    return _db


def get_gemini() -> genai.Client:
    global _gemini
    if _gemini is None:
        _gemini = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY from env
    return _gemini


def embed(texts: list[str]) -> list[list[float]]:
    response = get_gemini().models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config={
            "task_type": "SEMANTIC_SIMILARITY",
            "output_dimensionality": EMBEDDING_DIM,
        },
    )
    return [embedding.values for embedding in response.embeddings]


@functions_framework.http
def generate_embeddings(request):
    payload = request.get_json(silent=True) or {}
    entity_type = payload.get("entityType")
    tenant_id = payload.get("tenantId")

    if entity_type not in ENTITY_SKILL_FIELDS:
        return {"error": f"Unknown entityType: {entity_type!r}"}, 400
    if not tenant_id:
        return {"error": "Missing tenantId"}, 400
    try:
        entity_id = ObjectId(payload.get("entityId"))
    except (InvalidId, TypeError):
        return {"error": f"Invalid entityId: {payload.get('entityId')!r}"}, 400

    collection_name, hard_field, soft_field = ENTITY_SKILL_FIELDS[entity_type]
    collection = get_db()[collection_name]
    entity_filter = {"_id": entity_id, "tenantId": tenant_id}
    entity = collection.find_one(entity_filter, {hard_field: 1, soft_field: 1})
    if entity is None:
        return {"error": f"{entity_type} {entity_id} not found"}, 404

    hard_skills = [s for s in entity.get(hard_field) or [] if isinstance(s, str) and s.strip()]
    soft_skills = [s for s in entity.get(soft_field) or [] if isinstance(s, str) and s.strip()]
    if not hard_skills or not soft_skills:
        return {
            "error": f"Entity has no {hard_field}/{soft_field} (run the rag stage first)"
        }, 400

    log.info(
        "Embedding %d hard / %d soft skills for %s %s",
        len(hard_skills), len(soft_skills), entity_type, entity_id,
    )
    embedding_hs, embedding_ss = embed([", ".join(hard_skills), ", ".join(soft_skills)])
    collection.update_one(
        entity_filter,
        {"$set": {"embeddingHS": embedding_hs, "embeddingSS": embedding_ss}},
    )
    log.info(
        "Stored %d-dim embeddings for %s %s (model=%s)",
        len(embedding_hs), entity_type, entity_id, EMBEDDING_MODEL,
    )
    return {
        "model": EMBEDDING_MODEL,
        "dimensions": len(embedding_hs),
        "hardSkillsEmbedded": len(hard_skills),
        "softSkillsEmbedded": len(soft_skills),
    }

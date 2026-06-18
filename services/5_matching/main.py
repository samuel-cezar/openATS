"""openATS matching stage (services/5_matching).

Cloud-function-style HTTP handler, invoked by the monitor (services/1_monitor)
with payload {jobId, tenantId, entityType, entityId}. Runs locally under
functions-framework, so the same handler is deployable to a cloud-function
platform unchanged.

Replicates the API's matching logic (api/src/routes/matches.ts +
api/src/helpers/similarity.ts) in Python:

    totalScore = alpha * cosine(candidateHS, positionHS)
               + beta  * cosine(candidateSS, positionSS)

alpha/beta are per-tenant weights from the `tenants` collection (defaults
0.6/0.4). A job for a position scores it against all of the tenant's processed
candidates; a job for a candidate scores it against all of the tenant's
processed positions. Match documents are upserted on
{tenantId, candidateId, positionId}, then every affected position's matches
are re-ranked by totalScore descending (rank = 1..n).

The triggering entity is matched on its embeddings, never on `processed` —
the monitor only sets processed=true after all stages succeed, so it is still
false while this stage runs. Counterparts missing embeddings score 0 via the
cosine rules, matching the API's behavior.
"""

import logging
import math
import os
from datetime import datetime, timezone

import functions_framework
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING, MongoClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/recruitment")

DEFAULT_ALPHA = 0.6
DEFAULT_BETA = 0.4

ENTITY_COLLECTIONS = {"position": "positions", "candidate": "candidates"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [matching] %(message)s",
)
log = logging.getLogger(__name__)

# Created lazily on first request: functions-framework (gunicorn) forks worker
# processes after import, and the client must not cross a fork.
_db = None


def get_db():
    global _db
    if _db is None:
        _db = MongoClient(MONGO_URI).get_default_database("recruitment")
    return _db


def cosine_similarity(vec_a, vec_b) -> float:
    """Mirror of cosineSimilarity in api/src/helpers/similarity.ts."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.hypot(*vec_a)
    mag_b = math.hypot(*vec_b)
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def get_weights(db, tenant_id: str) -> tuple[float, float]:
    tenant = None
    try:
        tenant = db["tenants"].find_one(
            {"_id": ObjectId(tenant_id)}, {"alpha": 1, "beta": 1}
        )
    except InvalidId:
        pass  # non-ObjectId tenant ids (e.g. test tenants) fall back to defaults
    tenant = tenant or {}
    return tenant.get("alpha", DEFAULT_ALPHA), tenant.get("beta", DEFAULT_BETA)


@functions_framework.http
def compute_matches(request):
    payload = request.get_json(silent=True) or {}
    entity_type = payload.get("entityType")
    tenant_id = payload.get("tenantId")

    if entity_type not in ENTITY_COLLECTIONS:
        return {"error": f"Unknown entityType: {entity_type!r}"}, 400
    if not tenant_id:
        return {"error": "Missing tenantId"}, 400
    try:
        entity_id = ObjectId(payload.get("entityId"))
    except (InvalidId, TypeError):
        return {"error": f"Invalid entityId: {payload.get('entityId')!r}"}, 400

    db = get_db()
    own_collection = ENTITY_COLLECTIONS[entity_type]
    counterpart_type = "candidate" if entity_type == "position" else "position"
    counterpart_collection = ENTITY_COLLECTIONS[counterpart_type]

    embedding_projection = {"embeddingHS": 1, "embeddingSS": 1}
    entity = db[own_collection].find_one(
        {"_id": entity_id, "tenantId": tenant_id}, embedding_projection
    )
    if entity is None:
        return {"error": f"{entity_type} {entity_id} not found"}, 404
    if not entity.get("embeddingHS") or not entity.get("embeddingSS"):
        return {
            "error": f"{entity_type} has no embeddings (run the embeddings stage first)"
        }, 400

    # The triggering entity is matched on its embeddings (it is still
    # processed=false mid-pipeline); counterparts mirror the API's
    # processed=true filter.
    counterparts = list(
        db[counterpart_collection].find(
            {"tenantId": tenant_id, "processed": True}, embedding_projection
        )
    )

    alpha, beta = get_weights(db, tenant_id)
    matches = db["matches"]
    now = datetime.now(timezone.utc)
    affected_position_ids = set()
    upserted = 0

    for counterpart in counterparts:
        if entity_type == "position":
            candidate, position = counterpart, entity
            candidate_id, position_id = counterpart["_id"], entity_id
        else:
            candidate, position = entity, counterpart
            candidate_id, position_id = entity_id, counterpart["_id"]

        hard = cosine_similarity(candidate.get("embeddingHS"), position.get("embeddingHS"))
        soft = cosine_similarity(candidate.get("embeddingSS"), position.get("embeddingSS"))
        total = alpha * hard + beta * soft

        matches.update_one(
            {"tenantId": tenant_id, "candidateId": candidate_id, "positionId": position_id},
            {
                "$set": {
                    "totalScore": total,
                    "hardScore": hard,
                    "softScore": soft,
                    "computedAt": now,
                }
            },
            upsert=True,
        )
        upserted += 1
        affected_position_ids.add(position_id)

    if entity_type == "position":
        affected_position_ids.add(entity_id)  # re-rank even with zero counterparts

    for position_id in affected_position_ids:
        ranked = matches.find(
            {"tenantId": tenant_id, "positionId": position_id}
        ).sort("totalScore", DESCENDING)
        for rank, match in enumerate(ranked, start=1):
            matches.update_one({"_id": match["_id"]}, {"$set": {"rank": rank}})

    log.info(
        "Matched %s %s against %d %ss (alpha=%s beta=%s), %d matches upserted, "
        "%d positions re-ranked",
        entity_type, entity_id, len(counterparts), counterpart_type,
        alpha, beta, upserted, len(affected_position_ids),
    )
    return {
        "entityType": entity_type,
        "counterparts": len(counterparts),
        "matchesUpserted": upserted,
        "positionsReranked": len(affected_position_ids),
        "alpha": alpha,
        "beta": beta,
    }

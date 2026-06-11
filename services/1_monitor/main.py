"""openATS pipeline monitor (services/1_monitor).

Polls MongoDB on an interval for pending processing jobs and orchestrates the
pipeline stages in order: text -> rag -> embeddings -> matching. Each stage is
a cloud-function-style handler living in services/2_text ... 5_matching; this
monitor stands in for the cloud trigger by invoking a stage over HTTP when its
URL is configured, and skips (logs) stages that are not deployed yet.

Job documents live in the `processingjobs` collection and are inserted by the
API's POST /positions/:id/process and /candidates/:id/process endpoints:

    {
        tenantId:   str,
        entityType: "position" | "candidate",
        entityId:   ObjectId,      # _id in the positions/candidates collection
        status:     "pending" | "running" | "completed" | "failed",
        stage:      str | None,    # stage currently or last executed
        error:      str | None,
        createdAt / startedAt / completedAt: datetime (UTC)
    }

Jobs are claimed atomically (pending -> running via find_one_and_update), so
multiple monitor replicas never run the same job twice. On success the target
Position/Candidate document gets processed=true and skillsStale=false.
"""

import logging
import os
import signal
import time
from datetime import datetime, timezone

import requests
from pymongo import ASCENDING, MongoClient, ReturnDocument

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/recruitment")
POLL_INTERVAL_SECONDS = float(os.environ.get("POLL_INTERVAL_SECONDS", "5"))
STAGE_TIMEOUT_SECONDS = float(os.environ.get("STAGE_TIMEOUT_SECONDS", "300"))

# Pipeline stages in execution order. An empty URL means the stage service is
# not deployed yet: the monitor logs and skips it instead of failing the job.
STAGES = [
    ("text", os.environ.get("TEXT_SERVICE_URL", "")),
    ("rag", os.environ.get("RAG_SERVICE_URL", "")),
    ("embeddings", os.environ.get("EMBEDDINGS_SERVICE_URL", "")),
    ("matching", os.environ.get("MATCHING_SERVICE_URL", "")),
]

ENTITY_COLLECTIONS = {"position": "positions", "candidate": "candidates"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [monitor] %(message)s",
)
log = logging.getLogger(__name__)

shutdown_requested = False


def request_shutdown(signum: int, _frame: object) -> None:
    global shutdown_requested
    shutdown_requested = True
    log.info("Received signal %s, finishing current job then exiting", signum)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def claim_next_job(jobs):
    """Atomically claim the oldest pending job (pending -> running)."""
    return jobs.find_one_and_update(
        {"status": "pending"},
        {"$set": {"status": "running", "startedAt": utcnow(), "error": None}},
        sort=[("createdAt", ASCENDING)],
        return_document=ReturnDocument.AFTER,
    )


def invoke_stage(stage: str, url: str, payload: dict) -> None:
    """Invoke one cloud-function-style stage handler over HTTP."""
    if not url:
        log.info("Stage '%s' has no service URL configured, skipping (stub)", stage)
        return
    log.info("Invoking stage '%s' at %s", stage, url)
    response = requests.post(url, json=payload, timeout=STAGE_TIMEOUT_SECONDS)
    response.raise_for_status()


def run_job(db, job) -> None:
    jobs = db["processingjobs"]
    job_id = job["_id"]
    entity_type = job.get("entityType")
    entity_id = job.get("entityId")
    collection_name = ENTITY_COLLECTIONS.get(entity_type)

    log.info("Running job %s (%s %s)", job_id, entity_type, entity_id)

    try:
        if collection_name is None:
            raise ValueError(f"Unknown entityType: {entity_type!r}")

        entity_filter = {"_id": entity_id, "tenantId": job["tenantId"]}
        if db[collection_name].find_one(entity_filter, {"_id": 1}) is None:
            raise ValueError(f"{entity_type} {entity_id} not found")

        payload = {
            "jobId": str(job_id),
            "tenantId": job["tenantId"],
            "entityType": entity_type,
            "entityId": str(entity_id),
        }
        for stage, url in STAGES:
            jobs.update_one({"_id": job_id}, {"$set": {"stage": stage}})
            invoke_stage(stage, url, payload)

        db[collection_name].update_one(
            entity_filter,
            {"$set": {"processed": True, "skillsStale": False}},
        )
        jobs.update_one(
            {"_id": job_id},
            {"$set": {"status": "completed", "completedAt": utcnow()}},
        )
        log.info("Job %s completed", job_id)
    except Exception as err:
        log.exception("Job %s failed", job_id)
        jobs.update_one(
            {"_id": job_id},
            {"$set": {"status": "failed", "error": str(err), "completedAt": utcnow()}},
        )


def main() -> None:
    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    client = MongoClient(MONGO_URI)
    db = client.get_default_database("recruitment")
    jobs = db["processingjobs"]
    jobs.create_index([("status", ASCENDING), ("createdAt", ASCENDING)])

    log.info(
        "Monitor started (db=%s, poll every %ss)", db.name, POLL_INTERVAL_SECONDS
    )

    while not shutdown_requested:
        try:
            job = claim_next_job(jobs)
            if job is not None:
                run_job(db, job)
                continue  # drain the queue before sleeping again
        except Exception:
            log.exception("Poll iteration failed")
        time.sleep(POLL_INTERVAL_SECONDS)

    client.close()
    log.info("Monitor stopped")


if __name__ == "__main__":
    main()

"""openATS skill-extraction (RAG) stage (services/3_rag).

Cloud-function-style HTTP handler, invoked by the monitor (services/1_monitor)
with payload {jobId, tenantId, entityType, entityId}. Runs locally under
functions-framework, so the same handler is deployable to a cloud-function
platform unchanged.

Reads the entity's `extractedText` (stored by services/2_text) and extracts
skills with Gemini, grounded in the O*NET occupational database:

1. Gemini identifies the occupation the document corresponds to.
2. O*NET Web Services (X-API-Key auth) is queried for matching occupations and
   their Skills (soft-skill vocabulary) + Technology Skills (hard-skill
   vocabulary). Responses are cached in-process per occupation code.
3. A second Gemini call selects the final skills evidenced in the document,
   preferring canonical O*NET names; clearly evidenced skills missing from the
   vocabulary may be included free-form.

If O*NET credentials are missing or the API fails, the service degrades to a
single ungrounded Gemini extraction instead of failing the job.

Results are stored on the entity: candidates get hardSkills/softSkills,
positions get hardSkillsRequired/softSkillsRequired.
"""

import json
import logging
import os

import functions_framework
import requests
from bson import ObjectId
from bson.errors import InvalidId
from google import genai
from pydantic import BaseModel
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/recruitment")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
ONET_API_KEY = os.environ.get("ONET_API_KEY", "")
ONET_BASE_URL = os.environ.get("ONET_BASE_URL", "https://services.onetcenter.org/ws")
ONET_MAX_OCCUPATIONS = int(os.environ.get("ONET_MAX_OCCUPATIONS", "2"))
# Documents are truncated to this many characters before being sent to Gemini.
MAX_TEXT_CHARS = int(os.environ.get("MAX_TEXT_CHARS", "15000"))

ENTITY_SKILL_FIELDS = {
    "position": ("positions", "hardSkillsRequired", "softSkillsRequired"),
    "candidate": ("candidates", "hardSkills", "softSkills"),
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [rag] %(message)s",
)
log = logging.getLogger(__name__)

# Created lazily on first request: functions-framework (gunicorn) forks worker
# processes after import, and these clients must not cross a fork.
_db = None
_gemini = None
_onet_cache: dict[str, tuple[list[str], list[str]]] = {}


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


class DocumentAnalysis(BaseModel):
    occupation: str


class ExtractedSkills(BaseModel):
    hardSkills: list[str]
    softSkills: list[str]


def generate(prompt: str, schema: type[BaseModel]) -> BaseModel:
    response = get_gemini().models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": schema,
        },
    )
    if response.parsed is not None:
        return response.parsed
    return schema(**json.loads(response.text))


def onet_get(path: str, params: dict | None = None) -> dict:
    response = requests.get(
        f"{ONET_BASE_URL}{path}",
        params=params,
        headers={"X-API-Key": ONET_API_KEY, "Accept": "application/json"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def onet_vocabulary(occupation_code: str) -> tuple[list[str], list[str]]:
    """Return (hard, soft) skill vocabulary for one O*NET occupation."""
    if occupation_code in _onet_cache:
        return _onet_cache[occupation_code]

    soft = [
        element["name"]
        for element in onet_get(
            f"/online/occupations/{occupation_code}/summary/skills"
        ).get("element", [])
        if element.get("name")
    ]
    hard: list[str] = []
    for category in onet_get(
        f"/online/occupations/{occupation_code}/summary/technology_skills"
    ).get("category", []):
        title = category.get("title")
        if isinstance(title, dict) and title.get("name"):
            hard.append(title["name"])
        for example in category.get("example", []):
            if example.get("name"):
                hard.append(example["name"])

    _onet_cache[occupation_code] = (hard, soft)
    return hard, soft


def retrieve_vocabulary(occupation_query: str) -> tuple[list[str], list[str]]:
    """Search O*NET for the occupation and merge vocabularies of top matches."""
    search = onet_get("/online/search", params={"keyword": occupation_query})
    occupations = search.get("occupation", [])[:ONET_MAX_OCCUPATIONS]
    if not occupations:
        raise ValueError(f"O*NET returned no occupations for {occupation_query!r}")

    hard: list[str] = []
    soft: list[str] = []
    for occupation in occupations:
        log.info(
            "O*NET occupation match: %s (%s)",
            occupation.get("title"), occupation.get("code"),
        )
        occupation_hard, occupation_soft = onet_vocabulary(occupation["code"])
        hard.extend(occupation_hard)
        soft.extend(occupation_soft)
    return dedupe(hard), dedupe(soft)


def dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        cleaned = item.strip()
        if cleaned and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            result.append(cleaned)
    return result


SELECTION_RULES = """\
Extract the skills evidenced in the document below.
- hardSkills: technical skills — tools, technologies, programming languages,
  frameworks, methodologies, domain-specific competencies. At most 30.
- softSkills: interpersonal and behavioral skills. At most 15.
Only include skills actually evidenced by the document. Use concise names in
Title Case and do not repeat skills."""


def extract_grounded(text: str, hard_vocab: list[str], soft_vocab: list[str]) -> ExtractedSkills:
    prompt = (
        f"{SELECTION_RULES}\n"
        "Prefer the exact canonical names from these vocabulary lists when the "
        "document evidences them; skills clearly evidenced but missing from the "
        "lists may be added with your own concise name.\n\n"
        f"Hard-skill vocabulary: {json.dumps(hard_vocab)}\n\n"
        f"Soft-skill vocabulary: {json.dumps(soft_vocab)}\n\n"
        f"Document:\n{text}"
    )
    return generate(prompt, ExtractedSkills)


def extract_ungrounded(text: str) -> ExtractedSkills:
    return generate(f"{SELECTION_RULES}\n\nDocument:\n{text}", ExtractedSkills)


@functions_framework.http
def extract_skills(request):
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
    entity = collection.find_one(entity_filter, {"extractedText": 1})
    if entity is None:
        return {"error": f"{entity_type} {entity_id} not found"}, 404

    text = (entity.get("extractedText") or "").strip()[:MAX_TEXT_CHARS]
    if not text:
        return {"error": "Entity has no extractedText (run the text stage first)"}, 400

    log.info("Extracting skills for %s %s (%d chars)", entity_type, entity_id, len(text))
    grounded = False
    if ONET_API_KEY:
        try:
            analysis = generate(
                "Identify the occupation this resume or job description most "
                "closely corresponds to. Reply with a short English occupation "
                "search phrase (2-4 words) suitable for the O*NET occupational "
                f"database.\n\nDocument:\n{text}",
                DocumentAnalysis,
            )
            log.info("Occupation query: %s", analysis.occupation)
            hard_vocab, soft_vocab = retrieve_vocabulary(analysis.occupation)
            skills = extract_grounded(text, hard_vocab, soft_vocab)
            grounded = True
        except Exception:
            log.exception("O*NET grounding failed, falling back to ungrounded extraction")
            skills = extract_ungrounded(text)
    else:
        log.warning("ONET_API_KEY not set, running ungrounded extraction")
        skills = extract_ungrounded(text)

    hard = dedupe(skills.hardSkills)[:30]
    soft = dedupe(skills.softSkills)[:15]
    collection.update_one(entity_filter, {"$set": {hard_field: hard, soft_field: soft}})
    log.info(
        "Stored %d hard / %d soft skills for %s %s (grounded=%s)",
        len(hard), len(soft), entity_type, entity_id, grounded,
    )
    return {"hardSkills": hard, "softSkills": soft, "grounded": grounded}

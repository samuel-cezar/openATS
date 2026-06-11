"""openATS text-extraction stage (services/2_text).

Cloud-function-style HTTP handler, invoked by the monitor (services/1_monitor)
with payload {jobId, tenantId, entityType, entityId}. Runs locally under
functions-framework, so the same handler is deployable to a cloud-function
platform unchanged.

Reads the entity's uploaded file (position: jobDescriptionFileUrl, PDF/DOCX;
candidate: resumePdfUrl, PDF) and extracts its text:

- PDF: pdfplumber first; any page yielding too little text (image-only /
  scanned page) is rendered to an image and run through Tesseract OCR.
- DOCX: python-docx paragraphs.

The result is stored on the entity document as `extractedText`. File URLs are
stored by the API relative to its working dir (e.g. "uploads/<name>.pdf"), so
this service mounts the same uploads directory and resolves them under
FILES_ROOT.
"""

import logging
import os
from pathlib import Path

import functions_framework
import pdfplumber
import pytesseract
from bson import ObjectId
from bson.errors import InvalidId
from docx import Document
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/recruitment")
FILES_ROOT = os.environ.get("FILES_ROOT", "/app")
OCR_LANG = os.environ.get("OCR_LANG", "eng")
OCR_RESOLUTION = int(os.environ.get("OCR_RESOLUTION", "300"))
# A PDF page whose embedded text is shorter than this is treated as image-only
# (scanned) and falls back to OCR.
MIN_PAGE_CHARS = int(os.environ.get("MIN_PAGE_CHARS", "32"))

ENTITY_FILE_FIELDS = {
    "position": ("positions", "jobDescriptionFileUrl"),
    "candidate": ("candidates", "resumePdfUrl"),
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [text] %(message)s",
)
log = logging.getLogger(__name__)

# Created lazily on first request: functions-framework (gunicorn) forks worker
# processes after import, and a MongoClient must not cross a fork.
_db = None


def get_db():
    global _db
    if _db is None:
        _db = MongoClient(MONGO_URI).get_default_database("recruitment")
    return _db


def extract_pdf(path: Path) -> tuple[str, int]:
    """Extract text from a PDF; returns (text, number of pages OCR'd)."""
    pages: list[str] = []
    ocr_pages = 0
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, start=1):
            text = (page.extract_text() or "").strip()
            if len(text) < MIN_PAGE_CHARS:
                log.info("Page %d has no usable text layer, running OCR", number)
                image = page.to_image(resolution=OCR_RESOLUTION).original
                text = pytesseract.image_to_string(image, lang=OCR_LANG).strip()
                ocr_pages += 1
            pages.append(text)
    return "\n\n".join(p for p in pages if p), ocr_pages


def extract_docx(path: Path) -> tuple[str, int]:
    document = Document(str(path))
    return "\n".join(p.text for p in document.paragraphs if p.text.strip()), 0


@functions_framework.http
def extract_text(request):
    payload = request.get_json(silent=True) or {}
    entity_type = payload.get("entityType")
    tenant_id = payload.get("tenantId")

    if entity_type not in ENTITY_FILE_FIELDS:
        return {"error": f"Unknown entityType: {entity_type!r}"}, 400
    if not tenant_id:
        return {"error": "Missing tenantId"}, 400
    try:
        entity_id = ObjectId(payload.get("entityId"))
    except (InvalidId, TypeError):
        return {"error": f"Invalid entityId: {payload.get('entityId')!r}"}, 400

    collection_name, file_field = ENTITY_FILE_FIELDS[entity_type]
    collection = get_db()[collection_name]
    entity_filter = {"_id": entity_id, "tenantId": tenant_id}
    entity = collection.find_one(entity_filter, {file_field: 1})
    if entity is None:
        return {"error": f"{entity_type} {entity_id} not found"}, 404

    file_url = entity.get(file_field)
    if not file_url:
        return {"error": f"{entity_type} has no uploaded file ({file_field} empty)"}, 400
    path = Path(FILES_ROOT) / file_url
    if not path.is_file():
        return {"error": f"File not found on disk: {path}"}, 404

    log.info("Extracting text for %s %s from %s", entity_type, entity_id, path)
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        text, ocr_pages = extract_pdf(path)
    elif suffix == ".docx":
        text, ocr_pages = extract_docx(path)
    else:
        return {"error": f"Unsupported file type: {suffix}"}, 400

    collection.update_one(entity_filter, {"$set": {"extractedText": text}})
    log.info(
        "Stored extractedText for %s %s (%d chars, %d pages OCR'd)",
        entity_type, entity_id, len(text), ocr_pages,
    )
    return {"extractedChars": len(text), "ocrPages": ocr_pages}

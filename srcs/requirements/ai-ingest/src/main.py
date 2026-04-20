import os
import base64
import binascii
import logging
import psycopg2
import y_py as Y
import re
import hashlib
from uuid import UUID
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field, field_validator
from pgvector.psycopg2 import register_vector
from langchain_community.embeddings import OllamaEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI-Ingest")

app = FastAPI(title="AI Ingest Service - Data Processing")

# --- Configuration ---
DB_URL = os.getenv("VECTOR_DB_URL")
BASE_URL = os.getenv("LLM_BASE_URL", "http://host.docker.internal:11434/v1")
OLLAMA_HOST = BASE_URL.replace("/v1", "")
EMBEDDING_MODEL = os.getenv("LLM_EMBEDDING_MODEL", "mxbai-embed-large")

# --- Global State ---
processing_locks = set()
last_processed_hashes = {}

# PRECISION CHUNKING
TEXT_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=600,
    chunk_overlap=150,
    length_function=len,
    separators=["\n\n", "\n", ".", " ", ""]
)

INGEST_PAYLOAD_MAX = 10 * 1024 * 1024  # 10 MiB of base64 (~7.5 MiB of Y.js update)


class IngestRequest(BaseModel):
    note_id: str
    user_id: str
    binary_data: str = Field(min_length=1, max_length=INGEST_PAYLOAD_MAX)

    @field_validator("note_id", "user_id")
    @classmethod
    def _must_be_uuid(cls, value: str) -> str:
        try:
            UUID(value)
        except ValueError as err:
            raise ValueError("must be a valid UUID") from err
        return value

    @field_validator("binary_data")
    @classmethod
    def _must_be_base64(cls, value: str) -> str:
        # Reject malformed base64 at the API boundary so we return 422 instead
        # of a generic 500 from deep inside process_and_save.
        try:
            base64.b64decode(value, validate=True)
        except binascii.Error as err:
            raise ValueError("must be valid base64") from err
        return value

def clean_html_to_text(xml_str: str) -> str:
    s = re.sub(r'</?(p|div|h[1-6]|li|br|tr|td)[^>]*>', '\n', xml_str)
    s = re.sub(r'<[^<]+?>', '', s)
    lines = [line.strip() for line in s.split('\n') if line.strip()]
    return "\n".join(lines)

def extract_content(doc: Y.YDoc):
    title = str(doc.get_text("title")).strip()
    body = ""
    for key in ["default", "content"]:
        xml_item = None
        if hasattr(doc, "get_xml_fragment"):
            xml_item = doc.get_xml_fragment(key)
        elif hasattr(doc, "get_xml_element"):
            xml_item = doc.get_xml_element("default")
        
        if xml_item:
            extracted = clean_html_to_text(str(xml_item))
            if extracted:
                body = extracted
                break
    if not body:
        body = str(doc.get_text("default")).strip()
    return title, body

def process_and_save(note_id: str, user_id: str, base64_blob: str):
    if note_id in processing_locks:
        return

    try:
        processing_locks.add(note_id)
        binary_data = base64.b64decode(base64_blob)
        doc = Y.YDoc()
        Y.apply_update(doc, binary_data)
        
        title, body = extract_content(doc)
        full_text_for_hash = f"{title}\n{body}"
        
        if not full_text_for_hash.strip():
            return

        content_hash = hashlib.sha256(full_text_for_hash.encode()).hexdigest()
        if last_processed_hashes.get(note_id) == content_hash:
            logger.info(f"SKIP: {note_id} unchanged.")
            return

        # Simple Chunks without noisy prefixes
        chunks = TEXT_SPLITTER.split_text(body)
        if title:
            chunks.insert(0, f"TITLE: {title}")

        total = len(chunks)
        logger.info(f"START CLEAN INGEST: User {user_id} - {total} chunks.")

        embeddings = OllamaEmbeddings(base_url=OLLAMA_HOST, model=EMBEDDING_MODEL)
        
        conn = psycopg2.connect(DB_URL)
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM embeddings WHERE note_id = %s", (note_id,))
            for i, chunk in enumerate(chunks):
                vector = embeddings.embed_query(chunk)
                cur.execute(
                    "INSERT INTO embeddings (note_id, user_id, content, embedding) VALUES (%s, %s, %s, %s)",
                    (note_id, user_id, chunk, vector)
                )
                if (i + 1) % 100 == 0 or (i + 1) == total:
                    logger.info(f"Progress {note_id}: {i+1}/{total}")
        
        conn.commit()
        conn.close()
        last_processed_hashes[note_id] = content_hash
        logger.info(f"FINISH: Note {note_id} clean re-indexed.")
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
    finally:
        processing_locks.discard(note_id)

@app.post("/ingest")
async def ingest_note(request: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_and_save, request.note_id, request.user_id, request.binary_data)
    return {"status": "accepted"}

@app.delete("/embeddings/by-user/{user_id}")
async def delete_embeddings_by_user(user_id: str):
    try:
        UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user id")
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM embeddings WHERE user_id = %s::uuid", (user_id,))
            deleted = cur.rowcount
        conn.commit()
        logger.info(f"Deleted {deleted} embeddings for user {user_id}")
        return {"deleted": deleted}
    except Exception as e:
        logger.error(f"Failed to delete embeddings for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete embeddings")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

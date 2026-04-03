import os
import base64
import logging
import psycopg2
import y_py as Y
import re
import hashlib
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
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
EMBEDDING_MODEL = os.getenv("LLM_EMBEDDING_MODEL", "llama3")

# --- Global State for Smart Ingest ---
# Tracks note IDs currently being vectorized to prevent parallel conflicts
processing_locks = set()
# Tracks the last processed text hash per note to skip redundant work
last_processed_hashes = {}

# Chunking Configuration
TEXT_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=100,
    length_function=len,
    separators=["\n\n", "\n", ".", " ", ""]
)

class IngestRequest(BaseModel):
    note_id: str
    user_id: str
    binary_data: str

def clean_html_to_text(xml_str: str) -> str:
    s = re.sub(r'</?(p|div|h[1-6]|li|br|tr|td)[^>]*>', '\n', xml_str)
    s = re.sub(r'<[^<]+?>', '', s)
    lines = [line.strip() for line in s.split('\n') if line.strip()]
    return "\n".join(lines)

def extract_all_text(doc: Y.YDoc) -> str:
    text_parts = []
    for key in ["title", "default"]:
        try:
            xml_item = None
            if hasattr(doc, "get_xml_fragment"):
                xml_item = doc.get_xml_fragment(key)
            elif hasattr(doc, "get_xml_element"):
                xml_item = doc.get_xml_element(key)
            
            if xml_item and len(str(xml_item)) > 0:
                extracted = clean_html_to_text(str(xml_item))
                if extracted: text_parts.append(extracted)
            else:
                t = str(doc.get_text(key)).strip()
                if t: text_parts.append(t)
        except:
            continue
    return "\n\n".join(text_parts)

def process_and_save(note_id: str, user_id: str, base64_blob: str):
    # 1. Immediate Lock Check
    if note_id in processing_locks:
        logger.info(f"THROTTLE: Note {note_id} is already being processed. Skipping this trigger.")
        return

    try:
        processing_locks.add(note_id)
        
        # 2. Extract Text
        binary_data = base64.b64decode(base64_blob)
        doc = Y.YDoc()
        Y.apply_update(doc, binary_data)
        full_content = extract_all_text(doc)
        
        if not full_content.strip():
            return

        # 3. Hash Check (Content Change Detection)
        content_hash = hashlib.sha256(full_content.encode()).hexdigest()
        if last_processed_hashes.get(note_id) == content_hash:
            logger.info(f"SKIP: Content for note {note_id} hasn't changed. Vectorization skipped.")
            return

        # 4. Split into Chunks
        chunks = TEXT_SPLITTER.split_text(full_content)
        total = len(chunks)
        logger.info(f"START SMART INGEST: User {user_id} - {total} chunks.")

        embeddings = OllamaEmbeddings(base_url=OLLAMA_HOST, model=EMBEDDING_MODEL)
        
        conn = psycopg2.connect(DB_URL)
        register_vector(conn)
        with conn.cursor() as cur:
            # Atomic swap: Delete old and insert new
            cur.execute("DELETE FROM embeddings WHERE note_id = %s", (note_id,))
            for i, chunk in enumerate(chunks):
                vector = embeddings.embed_query(chunk)
                cur.execute(
                    "INSERT INTO embeddings (note_id, user_id, content, embedding) VALUES (%s, %s, %s, %s)",
                    (note_id, user_id, chunk, vector)
                )
                if (i + 1) % 50 == 0 or (i + 1) == total:
                    logger.info(f"Progress {note_id}: {i+1}/{total}")
        
        conn.commit()
        conn.close()
        
        # 5. Update Hash Cache after success
        last_processed_hashes[note_id] = content_hash
        logger.info(f"FINISH SUCCESS: Note {note_id} re-indexed.")
        
    except Exception as e:
        logger.error(f"Ingestion Error for {note_id}: {str(e)}")
    finally:
        # Always release the lock
        processing_locks.discard(note_id)

@app.post("/ingest")
async def ingest_note(request: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_and_save, request.note_id, request.user_id, request.binary_data)
    return {"status": "accepted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

import os
import base64
import logging
import psycopg2
import y_py as Y
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from pgvector.psycopg2 import register_vector
from langchain_community.embeddings import OllamaEmbeddings

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI-Ingest")

app = FastAPI(title="AI Ingest Service - Data Processing")

# --- Configuration ---
DB_URL = os.getenv("VECTOR_DB_URL")
BASE_URL = os.getenv("LLM_BASE_URL", "http://host.docker.internal:11434/v1")
OLLAMA_HOST = BASE_URL.replace("/v1", "")
EMBEDDING_MODEL = os.getenv("LLM_EMBEDDING_MODEL", "llama3")

class IngestRequest(BaseModel):
    note_id: str
    user_id: str
    binary_data: str

def extract_all_text(doc: Y.YDoc) -> str:
    """
    A very aggressive text extractor that tries to find ANY text inside the YDoc.
    """
    text_parts = []
    
    # 1. Try common keys for title and content
    for key in ["title", "default", "content"]:
        try:
            # Try as plain text
            t = str(doc.get_text(key)).strip()
            if t: text_parts.append(t)
            
            # Try as XML (Tiptap style)
            # We try different method names because y-py versions vary
            xml_item = None
            if hasattr(doc, "get_xml_fragment"):
                xml_item = doc.get_xml_fragment(key)
            elif hasattr(doc, "get_xml_element"):
                xml_item = doc.get_xml_element(key)
            
            if xml_item:
                import re
                raw_xml = str(xml_item)
                # Strip HTML tags to get plain text
                clean_text = re.sub('<[^<]+?>', '', raw_xml).strip()
                if clean_text and clean_text not in text_parts:
                    text_parts.append(clean_text)
        except:
            continue
            
    return " ".join(text_parts)

def process_and_save(note_id: str, user_id: str, base64_blob: str):
    try:
        # 1. Extract Text
        binary_data = base64.b64decode(base64_blob)
        doc = Y.YDoc()
        Y.apply_update(doc, binary_data)
        
        full_content = extract_all_text(doc)
        
        if not full_content.strip():
            logger.info(f"Skipping empty note {note_id}")
            return

        # 2. Generate Vector Embeddings
        embeddings = OllamaEmbeddings(base_url=OLLAMA_HOST, model=EMBEDDING_MODEL)
        vector = embeddings.embed_query(full_content)

        # 3. Persist
        conn = psycopg2.connect(DB_URL)
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM embeddings WHERE note_id = %s", (note_id,))
            cur.execute(
                "INSERT INTO embeddings (note_id, user_id, content, embedding) VALUES (%s, %s, %s, %s)",
                (note_id, user_id, full_content, vector)
            )
        conn.commit()
        conn.close()
        logger.info(f"SUCCESS: Vectorized note {note_id} (Length: {len(full_content)})")
        
    except Exception as e:
        logger.error(f"CRITICAL Ingestion Error: {str(e)}")

@app.post("/ingest")
async def ingest_note(request: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_and_save, request.note_id, request.user_id, request.binary_data)
    return {"status": "processing"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

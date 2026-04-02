import os
import logging
import httpx
import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pgvector.psycopg2 import register_vector
from langchain_community.embeddings import OllamaEmbeddings

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI-RAG")

app = FastAPI(title="AI RAG Service - Orchestrator")

# --- Configuration ---
DB_URL = os.getenv("VECTOR_DB_URL")
LLM_GATEWAY_URL = os.getenv("LLM_GATEWAY_URL", "http://llm-gateway:8001/stream")

BASE_URL = os.getenv("LLM_BASE_URL", "http://host.docker.internal:11434/v1")
OLLAMA_HOST = BASE_URL.replace("/v1", "")
EMBEDDING_MODEL = os.getenv("LLM_EMBEDDING_MODEL", "llama3")

class ChatRequest(BaseModel):
    user_id: str
    query: str

def get_context(user_id: str, query: str):
    try:
        logger.info(f"Searching context for user: {user_id}")
        embeddings = OllamaEmbeddings(base_url=OLLAMA_HOST, model=EMBEDDING_MODEL)
        query_vector = embeddings.embed_query(query)
        
        conn = psycopg2.connect(DB_URL)
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT content FROM embeddings WHERE user_id = %s ORDER BY embedding <=> %s::vector LIMIT 3",
                (user_id, query_vector)
            )
            rows = cur.fetchall()
        conn.close()
        
        if not rows:
            logger.warning(f"No embeddings found for user {user_id}")
            return "DATABASE STATUS: No notes found for this user."
        
        context_str = "\n---\n".join([r[0] for r in rows])
        return context_str
    except Exception as e:
        logger.error(f"Retrieval Error: {str(e)}")
        return f"ERROR: {str(e)}"

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        context = get_context(request.user_id, request.query)
        
        system_prompt = f"""You are a personal project assistant.
		Answer the question ONLY based on the context below.
		If the answer is not contained in the context, you MUST reply exactly with "I do not know the answer based on the provided context." Do not use outside knowledge.

		Context:
		{context}
		"""
        # LOGGING FINAL PROMPT
        print("\n" + "="*50)
        print("FINAL PROMPT SENT TO LLM")
        print(f"SYSTEM PROMPT:\n{system_prompt}")
        print(f"USER QUERY: {request.query}")
        print("="*50 + "\n")
        
        payload = {"prompt": request.query, "system_prompt": system_prompt}

        async def stream_generator():
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", LLM_GATEWAY_URL, json=payload) as response:
                    async for line in response.aiter_lines():
                        if line:
                            yield f"{line}\n\n"

        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

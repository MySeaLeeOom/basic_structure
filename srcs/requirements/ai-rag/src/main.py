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
        conn = psycopg2.connect(DB_URL)
        register_vector(conn)
        
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM embeddings WHERE user_id = %s", (user_id,))
            count = cur.fetchone()[0]
            logger.info(f"User {user_id} has {count} total chunks in database.")

        logger.info(f"Searching context for query: {query}")
        embeddings = OllamaEmbeddings(base_url=OLLAMA_HOST, model=EMBEDDING_MODEL)
        query_vector = embeddings.embed_query(query)
        
        with conn.cursor() as cur:
            # INCREASED LIMIT TO 6: Give the LLM more chance to see the right data
            cur.execute(
                "SELECT content, embedding <=> %s::vector as distance FROM embeddings WHERE user_id = %s ORDER BY distance LIMIT 6",
                (query_vector, user_id)
            )
            rows = cur.fetchall()
        conn.close()
        
        if not rows:
            return "DATABASE STATUS: No notes found for this user."
        
        print("\n" + "-"*30)
        print(f"SEARCH RESULTS FOR: {query}")
        for i, (content, dist) in enumerate(rows):
            print(f"RANK {i+1} (Distance: {dist:.4f}):\n{content[:150]}...\n")
        print("-"*30 + "\n")

        context_str = "\n---\n".join([r[0] for r in rows])
        return context_str
    except Exception as e:
        logger.error(f"Retrieval Error: {str(e)}")
        return f"ERROR: {str(e)}"

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        context = get_context(request.user_id, request.query)
        
        # OPTIMIZED PROMPT: More helpful, less "robotic"
        system_prompt = (
            "You are MyCelium-AI, a helpful project assistant.\n"
            "Analyze the following context carefully to answer the user's question.\n"
            "Use ONLY the information provided. If the specific fact is missing, "
            "tell the user clearly what you found and why it doesn't quite answer the question.\n\n"
            f"Context:\n{context}"
        )
        
        print("\n" + "="*50)
        print("FINAL PROMPT SENT TO LLM")
        print(system_prompt)
        print(f"\nUSER QUERY: {request.query}")
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

import os
import logging
import httpx
import psycopg2
import re
from fastapi import FastAPI, HTTPException, Request
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
MAIN_DB_URL = os.getenv("MAIN_DB_URL")
LLM_GATEWAY_URL = os.getenv("LLM_GATEWAY_URL", "http://llm-gateway:8001/stream")

BASE_URL = os.getenv("LLM_BASE_URL", "http://host.docker.internal:11434/v1")
OLLAMA_HOST = BASE_URL.replace("/v1", "")
EMBEDDING_MODEL = os.getenv("LLM_EMBEDDING_MODEL", "mxbai-embed-large")

class ChatRequest(BaseModel):
	query: str

def score_chunk(query: str, content: str, vector_dist: float) -> float:
	"""
	Combines vector distance with keyword matching.
	Lower score is better.
	"""
	score = vector_dist
	
	# FIX: Geändert auf {2,} damit Abkürzungen wie H2, DB, IP nicht ignoriert werden.
	keywords = re.findall(r'[a-zA-Z0-9.,]{2,}', query.lower())
	
	# Optional: Häufige Stopwörter ignorieren, die das Ranking verfälschen
	stop_words = {"wie", "pro", "der", "die", "das", "und", "ist", "für"}
	keywords = [kw for kw in keywords if kw not in stop_words]
	
	matches = 0
	for kw in keywords:
		if kw in content.lower():
			matches += 1
			
	# FIX: Deckelung des maximalen Abzugs, damit die Semantik (Vektor) nicht ignoriert wird
	max_deduction = 0.15
	deduction = min(matches * 0.05, max_deduction)
	score -= deduction
	
	return max(score, 0.0)

def get_accessible_note_ids(user_id: str):
	if not MAIN_DB_URL:
		logger.error("MAIN_DB_URL is not set.")
		return []
	
	conn = None
	try:
		conn = psycopg2.connect(MAIN_DB_URL)
		with conn.cursor() as cur:
			cur.execute("SELECT id FROM notes WHERE owner_id = %s", (user_id,))
			owned = [r[0] for r in cur.fetchall()]
			cur.execute("SELECT note_id FROM share WHERE guest_id = %s OR guest_id IS NULL", (user_id,))
			shared = [r[0] for r in cur.fetchall()]
			return list(set(owned + shared))
	except Exception as e:
		logger.error(f"Failed to fetch accessible note IDs: {e}")
		return []
	finally:
		if conn:
			conn.close()

def get_context(user_id: str, query: str):
	try:
		note_ids = get_accessible_note_ids(user_id)
		if not note_ids:
			return "DATABASE STATUS: No notes found."

		note_ids_str = [str(n) for n in note_ids]

		conn = psycopg2.connect(DB_URL)
		register_vector(conn)
		
		with conn.cursor() as cur:
			# Step 1: Check total chunks for these notes
			cur.execute("SELECT COUNT(*) FROM embeddings WHERE note_id = ANY(%s::uuid[])", (note_ids_str,))
			total_chunks = cur.fetchone()[0]
			
			if total_chunks <= 15:
				logger.info(f"FAST PATH: Total chunks {total_chunks} <= 15. Skipping vector search.")
				if total_chunks == 0:
					conn.close()
					return "DATABASE STATUS: No notes found."
				
				cur.execute("SELECT content FROM embeddings WHERE note_id = ANY(%s::uuid[])", (note_ids_str,))
				rows = cur.fetchall()
				conn.close()
				return "\n---\n".join([r[0] for r in rows])

			# STANDARD PATH: Vector Search + Re-ranking
			embeddings = OllamaEmbeddings(base_url=OLLAMA_HOST, model=EMBEDDING_MODEL)
			query_vector = embeddings.embed_query(query)
			
			# Step 2: Fetch more candidates than needed (Top 50)
			cur.execute(
				"SELECT content, embedding <=> %s::vector as distance FROM embeddings WHERE note_id = ANY(%s::uuid[]) ORDER BY distance LIMIT 50",
				(query_vector, note_ids_str)
			)
			rows = cur.fetchall()
		conn.close()
		
		if not rows:
			return "DATABASE STATUS: No notes found."
		
		# Step 3: Re-rank in Python using keyword scoring
		ranked_results = []
		for content, dist in rows:
			final_score = score_chunk(query, content, dist)
			ranked_results.append((content, dist, final_score))
			
		# Sort by final score (ascending)
		ranked_results.sort(key=lambda x: x[2])

		logger.debug("Re-ranked %d candidates, returning top 15", len(ranked_results))

		# Return Top 15 after re-ranking to the LLM
		return "\n---\n".join([r[0] for r in ranked_results[:15]])
	except Exception as e:
		logger.error(f"Retrieval Error: {str(e)}")
		return f"ERROR: {str(e)}"

@app.post("/chat")
async def chat(body: ChatRequest, request: Request):
	user_id = request.headers.get("x-user-id")
	if not user_id:
		raise HTTPException(status_code=401, detail="Missing user identity")
	try:
		context = get_context(user_id, body.query)
		
		system_prompt = (
			"You are MyCelium-AI, a technical project expert.\n"
			"Use the provided context fragments to answer the question accurately.\n"
			"If the user asks for a 'Benchmark' or 'Value', look for specific numbers.\n"
			"Respond in the same language as the user query.\n\n"
			f"Context:\n{context}"
		)
		
		payload = {"prompt": body.query, "system_prompt": system_prompt}

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

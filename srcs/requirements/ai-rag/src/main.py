import os
import logging
import httpx
import psycopg2
import re
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

def get_context(user_id: str, query: str):
	try:
		conn = psycopg2.connect(DB_URL)
		register_vector(conn)
		
		embeddings = OllamaEmbeddings(base_url=OLLAMA_HOST, model=EMBEDDING_MODEL)
		query_vector = embeddings.embed_query(query)
		
		with conn.cursor() as cur:
			# Step 1: Fetch more candidates than needed (Top 50)
			cur.execute(
				"SELECT content, embedding <=> %s::vector as distance FROM embeddings WHERE user_id = %s ORDER BY distance LIMIT 50",
				(query_vector, user_id)
			)
			rows = cur.fetchall()
		conn.close()
		
		if not rows:
			return "DATABASE STATUS: No notes found."
		
		# Step 2: Re-rank in Python using keyword scoring
		ranked_results = []
		for content, dist in rows:
			final_score = score_chunk(query, content, dist)
			ranked_results.append((content, dist, final_score))
			
		# Sort by final score (ascending)
		ranked_results.sort(key=lambda x: x[2])

		# --- AUDIT LOG ---
		print("\n" + "#"*60)
		print(f" RE-RANKED SEARCH AUDIT FOR: {query}")
		print("#"*60)
		for i, (content, v_dist, f_score) in enumerate(ranked_results[:10]):
			preview = content.replace("\n", " ")[:150]
			print(f"RANK {i+1:02d} | Score: {f_score:.4f} (Vec: {v_dist:.4f}) | {preview}...")
		print("#"*60 + "\n")

		# Return Top 15 after re-ranking to the LLM
		return "\n---\n".join([r[0] for r in ranked_results[:15]])
	except Exception as e:
		logger.error(f"Retrieval Error: {str(e)}")
		return f"ERROR: {str(e)}"

@app.post("/chat")
async def chat(request: ChatRequest):
	try:
		context = get_context(request.user_id, request.query)
		
		system_prompt = (
			"You are MyCelium-AI, a technical project expert.\n"
			"Use the provided context fragments to answer the question accurately.\n"
			"If the user asks for a 'Benchmark' or 'Value', look for specific numbers.\n"
			"Respond in the same language as the user query.\n\n"
			f"Context:\n{context}"
		)
		
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

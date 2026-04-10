# AI RAG Service
Orchestrator for factual note retrieval.

## Workflow
1. **Query Embedding:** Converts user query via `mxbai-embed-large`.
2. **Retrieval:** Fetches Top 50 candidates from Vector DB.
3. **Hybrid Re-ranking:** Applies a keyword-matching bonus in Python to prioritize specific facts/numbers.
4. **Context Injection:** Passes the Top 25 fragments to the LLM.

## Tech
- FastAPI, httpx (Async streaming), pgvector.

# AI RAG Service
Orchestrator for factual note retrieval.

## Workflow
1. Receives user query and embeds it via Ollama.
2. **Hybrid Search:** 
   - Retrieves Top 50 candidates from Vector DB.
   - Re-ranks results in Python using keyword matching bonus.
3. **Context Construction:** Injects Top 25 fragments into a specialized technical prompt.
4. **Proxy:** Forwards orchestrated request to LLM Gateway.

## Tech
- FastAPI, httpx (Async streaming), pgvector-python

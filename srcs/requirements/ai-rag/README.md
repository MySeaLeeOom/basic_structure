# AI RAG Service
The orchestrator for Retrieval-Augmented Generation.

## Workflow
1. Receives user query.
2. Embeds query and searches Vector DB for top matches.
3. Injects retrieved notes into a system prompt.
4. Proxies request to the LLM Gateway.
5. Streams response back via SSE.

## Tech
- FastAPI
- httpx
- pgvector-python

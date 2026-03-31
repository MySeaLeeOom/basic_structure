# AI Ingest Service
Python worker for indexing notes.

## Function
1. Receives Base64 CRDT blobs from the Rust editor.
2. Extracts plain text from Yjs/Tiptap structures.
3. Generates vector embeddings via Ollama.
4. Upserts data into the Vector DB.

## Tech
- FastAPI
- y-py
- LangChain

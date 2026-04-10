# AI Ingest Service
Worker for note extraction and vectorization.

## Features
- **Recursive Extraction:** Deep-parses Tiptap/Yjs XML structures to plain text.
- **Smart Ingest:** Uses SHA-256 hashing to skip redundant updates and mutex-locking to prevent race conditions.
- **Precision Chunking:** Segments text into overlapping 400-600 char chunks.
- **Embeddings:** Uses `mxbai-embed-large` (1024d) for high-accuracy German/English support.

## Tech
- FastAPI, y-py, LangChain.

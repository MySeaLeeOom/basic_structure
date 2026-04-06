# AI Ingest Service
Smart worker for note indexing and vectorization.

## Features
- **Recursive Extraction:** Deep-parses Yjs/Tiptap XML structures to plain text.
- **HTML Cleaning:** Prevents word-clumping by replacing block tags with newlines.
- **Smart Ingest:** Uses SHA-256 hashing to skip redundant processing and mutex-locking to prevent parallel conflicts.
- **Recursive Chunking:** Segments long documents into overlapping 400-char chunks for higher search precision.

## Tech
- FastAPI, y-py, LangChain (OllamaEmbeddings)

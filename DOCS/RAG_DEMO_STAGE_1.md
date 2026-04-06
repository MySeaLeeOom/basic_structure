# Implementation Protocol: RAG System (Stage 1)

This document records the development process and architecture of the Retrieval-Augmented Generation (RAG) system for ft_transcendence – from the base project to the functioning local AI demo.

## 1. Objectives
The goal was to integrate an intelligent "Co-Pilot" that answers user questions based on personal notes.
*   **Requirements:** Fully locally runnable (Ollama), decoupled architecture (microservices), real-time streaming (SSE).
*   **Technology Stack:** Python (FastAPI), PostgreSQL (pgvector), LangChain, Yjs (CRDT), Ollama (Llama 3).

---

## 2. Architecture (Decoupled Micro-AI Mesh)

The system was broken down into four specialized services to separate the AI processing load from the main application:

### A. Vector Database (`vector-db`)
*   **Base:** PostgreSQL 16 + `pgvector` extension.
*   **Task:** Stores text snippets and their mathematical representation (vectors).
*   **Optimization:** Uses flat search for high precision with 4096-dimensional vectors (avoiding HNSW dimension limits).

### B. AI Ingest Service (`ai-ingest`) - "Smart Archivist"
*   **Task:** Listens for updates from the Rust editor, extracts text, and stores vectors.
*   **Smart Features:** 
    - **Locking:** Prevents parallel processing of the same note.
    - **Hashing:** Skips re-indexing if content hasn't changed.
    - **Recursive Chunking:** Splits long text into 400-char segments for high-precision retrieval.

### C. AI RAG Service (`ai-rag`) - "Hybrid Librarian"
*   **Task:** Search orchestration and prompt building.
*   **Hybrid Search:** Combines vector similarity (Top 50) with keyword-based re-ranking in Python to prioritize exact matches (e.g. specific numbers or names).

### D. LLM Gateway (`llm-gateway`) - "Stable Speaker"
*   **Task:** Provider-agnostic proxy for LLMs.
*   **Streaming:** Implements SSE with JSON-wrapping to safely preserve newlines and special characters during streaming.

---

## 3. Data Flow (The Journey of a Note)

1.  **Eingabe:** User types in the browser.
2.  **Trigger:** Every 5 seconds, the Rust editor sends the CRDT state as a Base64 blob to `ai-ingest`.
3.  **Processing:** `ai-ingest` cleans HTML, chunks the text, and generates 4096-dimensional vectors via Ollama.
4.  **Retrieval:** When asked, `ai-rag` fetches the Top 20 chunks, re-ranks them, and builds a system prompt.
5.  **Response:** Ollama generates an answer and streams it live to the chat sidebar.

---

## 4. Hurdles Overcome (Lessons Learned)

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **Silent Fail (No Answer)** | Vector dimension mismatch | Corrected DB schema to 4096. |
| **HNSW Index Error** | 2000 dimension limit | Switched to high-precision flat search. |
| **Word Squashing** | Aggressive HTML tag removal | Replaced tags with newlines before extraction. |
| **Duplicate Indexing** | Rapid save triggers | Implemented Smart Ingest (Locking & Hashing). |
| **Lost Info in Long Text** | Semantic dilution | Reduced chunk size to 400 and increased retrieval limit to 25. |

---

## 5. Local Setup (Quick Start)

1.  **Ollama:** `OLLAMA_HOST=0.0.0.0 ollama serve` and `ollama run llama3`.
2.  **Infrastruktur:** `docker compose -f srcs/docker-compose.yml down -v` followed by `make`.
3.  **Firewall:** Ensure Docker can reach the host (Fedora: add source `172.18.0.0/16` to public zone).

---

## 6. Conclusion
The Stage 1 system is now a robust, production-grade RAG implementation. It handles large documents through efficient chunking and ensures data consistency via smart ingestion logic.

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
*   **Key Insight:** Llama 3 requires a dimension of **4096**. The schema was explicitly optimized for this.

### B. AI Ingest Service (`ai-ingest`) - "The Archivist"
*   **Task:** Listens for updates from the Rust editor, extracts text from binary CRDT blobs, and stores vectors.
*   **Challenge:** Tiptap stores text as complex `YXmlFragment` structures. The service uses recursive extraction to capture even nested HTML content (like `<p>` tags).

### C. AI RAG Service (`ai-rag`) - "The Librarian"
*   **Task:** Search orchestration. Receives user questions, searches for relevant context in the DB, and builds the final prompt for the AI.
*   **Special Feature:** Uses explicit SQL type casts (`::vector`) to avoid incompatibilities between Python arrays and Postgres vectors.

### D. LLM Gateway (`llm-gateway`) - "The Speaker"
*   **Task:** A provider-agnostic proxy. It decides whether requests go to OpenAI (Cloud) or Ollama (Local).
*   **Streaming:** Implements a transparent SSE (Server-Sent Events) model that passes tokens to the frontend as they arrive.

---

## 3. Data Flow (The Journey of a Note)

1.  **Input:** User types in the browser ("I love cats").
2.  **Synchronization:** The Rust editor receives the change via WebSocket.
3.  **Trigger:** Every 5 seconds (configurable), the editor sends the current state as a Base64 blob to the `ai-ingest` service.
4.  **Processing:** `ai-ingest` converts the blob to text, generates a 4096-dimensional vector via Ollama, and stores it in `vector-db`.
5.  **Query:** User asks in the chat: "What do I love?".
6.  **Retrieval:** `ai-rag` finds the "cats" note in the vector database.
7.  **Response:** Ollama generates an answer based on this context and streams it live to the chat sidebar.

---

## 4. Hurdles Overcome (Lessons Learned)

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **Silent Fail (No Answer)** | Vector dimension mismatch (1536 vs 4096) | Corrected DB schema to 4096 & performed `down -v` reset. |
| **Operator Error** | Postgres didn't recognize Python arrays as vectors | Added explicit cast `ORDER BY embedding <=> %s::vector` in SQL. |
| **Empty Context** | Tiptap content was "invisible" in `YXmlFragment` | Implemented recursive extraction logic in Python. |
| **Connection Refused** | Ollama was only listening on `localhost` | Set `OLLAMA_HOST=0.0.0.0` and added firewall rules for Docker. |
| **Dark Mode Bug** | CSS specificity in the frontend | Used `!text-white` and Tailwind dark mode classes. |

---

## 5. Local Setup (Quick Start)

To start the system, the following steps are necessary:

1.	**Install Ollama:**
	*	Follow instructions for your specific OS.
2.  **Prepare Ollama:**
    *   `OLLAMA_HOST=0.0.0.0 ollama serve`
    *   `ollama run llama3`
3.  **Start Infrastructure:**
    *   `docker compose -f srcs/docker-compose.yml down -v` (One-time reset for clean DB)
    *   `make`
4.  **Firewall (if necessary on Fedora):**
    *   `sudo firewall-cmd --add-source=172.18.0.0/16 --zone=public --permanent`
    *   `sudo firewall-cmd --reload`

---

## 6. Conclusion
The Stage 1 demo proves the feasibility of a fully decoupled RAG system. The architecture is scalable: the vector DB can be replaced by Qdrant at any time, or the LLM can be swapped for an API-key-based service (OpenAI/Gemini) without touching the business logic.

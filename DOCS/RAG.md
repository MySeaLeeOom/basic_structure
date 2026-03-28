# RAG System Architecture Plan
**Goal:** Integrate a Retrieval-Augmented Generation (RAG) system for intelligent note querying and project documentation assistance.

## Core Philosophy
This architecture is designed around the principles of **Clean Infrastructure**. 
* **Robust & Scalable:** Services are decoupled to prevent heavy AI workloads from degrading the performance of core application features.
* **Simplistic & Best-Practice:** We favor industry standards and clean boundaries over "clever" but brittle hacks.
* **Understandable:** The data flow must be logical and easy for peers (and evaluators) to understand at a glance. Clean code, clean documentation.

---

## Architectural Components

### 1. The Vector Database (Storage)
**Decision:** A dedicated, separate PostgreSQL container running the `pgvector` extension.
* **Why:** Vector math (comparing massive arrays of numbers) is highly CPU-intensive. By putting `pgvector` in its own separate database container, we completely isolate this heavy workload from our core relational database.
* **Benefit:** Core features (loading users, saving notes) remain lightning fast. We gain the benefits of an isolated vector DB without having to learn an entirely new technology (like Qdrant or Pinecone) right before evaluation.

### 2. The AI Microservice (Ingestion & Processing)
**Decision:** A brand new, decoupled microservice (Python) dedicated entirely to AI tasks.
* **Why:** The AI ecosystem (LangChain, LLM SDKs) thrives in Python. Forcing this logic into our existing Rust services would create unnecessary friction and bloat.
* **The Ingestion Flow (Event-Driven):** 1. The existing Rust `editor` service saves a note as a CRDT blob.
  2. The `editor` emits an asynchronous event: `"Note Updated"`.
  3. The AI Microservice listens for this event, fetches the CRDT blob, extracts the plain text from it server-side, and calls the Embedding API.
  4. It saves the resulting vector into the new `pgvector` database.

### 3. The RAG Endpoint (Retrieval & Generation)
**Decision:** A `/api/chat` endpoint hosted exclusively within the new AI Microservice.
* **Why:** Complete separation of concerns. The AI Microservice acts as the orchestrator.
* **The Flow:**
  1. Receive the user's question.
  2. Embed the question using the same model as ingestion.
  3. Query the `pgvector` database for the most relevant plain-text note chunks.
  4. Construct the prompt (System Instructions + Retrieved Notes + User Question).
  5. Call the LLM (e.g., Gemini/OpenAI).

### 4. The Frontend Connection (UI)
**Decision:** Server-Sent Events (SSE) implemented in the existing Nuxt/Vue frontend.
* **Why:** Waiting for a complete LLM response results in a poor user experience (long loading screens). SSE is the industry standard for streaming LLM text chunks down to the client. It is simpler and more appropriate for one-way chat streaming than WebSockets, while still making the text "type out" dynamically.

---

## Phased Implementation Roadmap

To ensure a stable rollout, the project will be implemented in three distinct stages:

### Stage 1: The Core MVP
* Deploy the separate Postgres `pgvector` container.
* Build the AI Microservice shell.
* Implement server-side CRDT plain-text extraction.
* Implement the core RAG loop: Save Note -> Vectorize -> Ask Question -> Retrieve -> Stream Answer via SSE.

### Stage 2: Polish & The "Project Co-Pilot" (Pre-Evaluation)
* **Advanced Memory (Query Reformulation):** Implement a fast pre-LLM call to rewrite user follow-up questions based on chat history, keeping vector searches highly accurate without bloating the prompt.
* **Project Documentation Ingestion:** Feed the system all `DOCS/` markdown files. The AI will not only answer questions about the user's notes but can also serve as an interactive "Co-Pilot" explaining our project's specific architecture, deployment steps, and code decisions to evaluators.

### Stage 3: Future Scale (Post-Evaluation)
* If the user base and data size grow significantly, the decoupled architecture allows us to seamlessly swap the `pgvector` container for a highly specialized, distributed vector database (like Qdrant or Milvus) without touching the core Rust backend or Nuxt frontend.
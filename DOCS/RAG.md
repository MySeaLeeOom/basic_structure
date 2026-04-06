# RAG System Architecture Plan
**Goal:** Integrate a Retrieval-Augmented Generation (RAG) system for intelligent note querying and project documentation assistance.

## Core Philosophy
This architecture is designed around the principles of **Clean Infrastructure**. 
* **Robust & Scalable:** Services are decoupled to prevent heavy AI workloads from degrading the performance of core application features.
* **Simplistic & Best-Practice:** We favor industry standards and clean boundaries over "clever" but brittle hacks.
* **Understandable:** The data flow must be logical and easy for peers (and evaluators) to understand at a glance. Clean code, clean documentation.

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
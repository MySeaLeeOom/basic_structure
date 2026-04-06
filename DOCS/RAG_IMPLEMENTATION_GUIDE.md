# RAG System: Implementation & Setup Guide

This document is the central reference for the Retrieval-Augmented Generation (RAG) system in ft_transcendence. It covers the architecture, the technology stack, and full setup instructions.

## 1. System Objectives
The RAG system acts as an AI Co-Pilot ("MyCelium-AI"), allowing users to query their personal notes using natural language.
*   **Privacy:** 100% locally runnable (no data leaves your machine).
*   **Scalability:** Decoupled microservice architecture.
*   **Precision:** High-density vector retrieval with hybrid re-ranking.

---

## 2. Prerequisites: Installing Ollama

The system relies on **Ollama** to run Large Language Models (LLMs) locally.

### A. Installation
*   **Linux (Fedora/Ubuntu):**
    ```bash
    curl -fsSL https://ollama.com/install.sh | sh
    ```
*   **macOS / Windows:**
    Download the installer from [ollama.com](https://ollama.com/download).

### B. Pulling Required Models
Once Ollama is installed, you must download the specific models used by MyCelium-AI:
```bash
# The 'brain' for chatting
ollama pull llama3

# The 'search expert' for indexing notes
ollama pull nomic-embed-text
```

### C. Network Configuration (Crucial for Docker)
By default, Ollama only listens on `localhost`. To allow our Docker containers to talk to it, you must expose it to all interfaces:

1.  **Stop Ollama** (if running).
2.  **Start with Host Variable:**
    ```bash
    OLLAMA_HOST=0.0.0.0 ollama serve
    ```
    *(Note: On Linux, you might need to use `systemctl edit ollama.service` to set this permanently).*

---

## 3. Architecture (Micro-AI Mesh)

The system is split into four specialized services:

1.  **Vector Database (`vector-db`):** PostgreSQL + `pgvector`. Stores note fragments as 768-dimensional vectors.
2.  **AI Ingest Service (`ai-ingest`):** Extracts text from Tiptap/CRDT blobs, splits them into 400-600 char chunks, and generates embeddings using `nomic-embed-text`.
3.  **AI RAG Service (`ai-rag`):** Orchestrates the search. It fetches the Top 50 candidates and performs a **Keyword-based Re-ranking** to ensure facts like numbers are prioritized.
4.  **LLM Gateway (`llm-gateway`):** A stable proxy that handles streaming communication with the LLM.

---

## 4. Quick Start (Running the System)

Once Ollama is prepared (see Step 2), follow these steps:

1.  **Clean Boot (First time or schema change):**
    ```bash
    docker compose -f srcs/docker-compose.yml down -v
    ```
2.  **Start Services:**
    ```bash
    make
    ```
3.  **Wait for Indexing:**
    Open a note in the browser, add some text, and wait about 10-20 seconds. Check logs with `docker logs -f ai-ingest` to see the "FINISH SUCCESS" message.

---

## 5. Troubleshooting (Fedora/Linux)

If the AI cannot be reached from Docker, check your firewall:
```bash
# Allow Docker bridge network to access the host
sudo firewall-cmd --add-source=172.18.0.0/16 --zone=public --permanent
sudo firewall-cmd --reload
```

---

## 6. Conclusion
The MyCelium-AI system provides production-grade retrieval by separating "Thinking" (Llama 3) from "Searching" (Nomic). This ensures high accuracy even in very large documents.

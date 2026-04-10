# RAG System: Setup & Operation Guide

This guide provides instructions for installing and running the MyCelium-AI system locally.

## 1. Prerequisites: Ollama
The system uses Ollama to run models on your host machine.

### Installation
- **Linux:** `curl -fsSL https://ollama.com/install.sh | sh`
- **macOS / Windows:** Download from [ollama.com](https://ollama.com).

### Required Models
Download the chat and embedding models:
```bash
ollama pull llama3
ollama pull mxbai-embed-large
```

### Network Configuration
To allow Docker access, expose Ollama to all network interfaces:
1. Stop any running Ollama process.
2. Restart with the host variable:
   `OLLAMA_HOST=0.0.0.0 ollama serve`

---

## 2. Infrastructure Setup

### Starting the services
1. Perform a clean boot to ensure correct database dimensions (1024d):
   `docker compose -f srcs/docker-compose.yml down -v`
2. Launch the stack:
   `make`

### Firewall (Linux/Fedora)
If services cannot reach Ollama, allow the Docker bridge network:
```bash
sudo firewall-cmd --add-source=172.18.0.0/16 --zone=public --permanent
sudo firewall-cmd --reload
```

---

## 3. Operational Features

### Smart Ingestion
The system automatically indexes notes as they are saved. 
- **Wait Time:** For large documents, wait for the "FINISH SUCCESS" message in `docker logs ai-ingest`.
- **Throttling:** Parallel indexing of the same note is blocked to prevent data corruption.

### Search Precision
- **Hybrid Search:** The system uses vector similarity combined with keyword boosting to find specific values (e.g., numbers or technical terms).
- **Retrieval Window:** The AI analyzes the top 20-25 text fragments to ensure accurate answers.

---

## 4. Troubleshooting
- **AI only answers "I don't know":** Ensure indexing is finished. Check `ai-ingest` logs.
- **Port Conflicts:** Ensure port 11434 is not blocked on your host.
- **Dark Mode:** If text is unreadable, force-refresh the browser cache (Ctrl+F5).

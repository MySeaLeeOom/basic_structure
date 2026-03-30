# RAG System - Advanced Micro-AI Mesh (Stage 1.5)

Dieses Dokument beschreibt die finale, hoch-skalierbare Architektur des Retrieval-Augmented Generation (RAG) Systems für ft_transcendence.

## Architektur-Übersicht (Decoupled Services)

Um maximale Wartbarkeit und Austauschbarkeit zu gewährleisten, wurde die KI-Logik in vier spezialisierte Microservices zerlegt:

### 1. Vector Database (`vector-db`)
*   **Technologie:** PostgreSQL 16 + `pgvector`.
*   **Aufgabe:** Isolierter Speicher für Note-Embeddings. Trennt rechenintensive Vektor-Operationen von der relationalen Haupt-Datenbank.

### 2. AI Ingest Service (`ai-ingest`) - *The Clerk*
*   **Technologie:** Python + `y-py`.
*   **Aufgabe:** Extrahiert Plain-Text aus binären CRDT-Blobs (Note-Updates).
*   **Vorteil:** CRDT-Logik ist komplex und bibliotheksabhängig. Durch die Isolation bleibt der Rest des Systems stabil, selbst wenn sich das Speicherformat der Noten ändert.

### 3. AI RAG Service (`ai-rag`) - *The Librarian*
*   **Technologie:** Python + LangChain.
*   **Aufgabe:** Der Orchestrator. Er empfängt User-Fragen, sucht den relevanten Kontext in der `vector-db`, baut den Prompt und sendet ihn an das Gateway.
*   **Vorteil:** Die Suchlogik (Query Reformulation, Chunking) kann hier optimiert werden, ohne das LLM-Interface anfassen zu müssen.

### 4. LLM Gateway (`llm-gateway`) - *The Speaker*
*   **Technologie:** Python + OpenAI SDK / Ollama API.
*   **Aufgabe:** Standardisierte API für LLM-Anfragen (Streaming via SSE).
*   **Vorteil:** **Provider-Agnotizismus.** Hier wird entschieden, ob OpenAI (Cloud) oder Ollama (Lokal) genutzt wird. Der Rest der Architektur merkt keinen Unterschied.

---

## LLM Provider: OpenAI vs. Ollama

| Feature | OpenAI (Cloud) | Ollama (Lokal) |
| :--- | :--- | :--- |
| **Kosten** | Pay-per-Token (nicht kostenlos) | Kostenlos (Open Source) |
| **Privacy** | Daten verlassen den Server | Daten bleiben lokal |
| **Setup** | API-Key benötigt | Ollama Installation + Modell-Download |
| **Performance** | Schnell & Hochwertig | Abhängig von lokaler GPU/RAM |

### Lokales Setup mit Ollama
Um Ollama zu nutzen, muss im `llm-gateway` lediglich die Base-URL auf den Host umgebogen werden (`http://host.docker.internal:11434`), sofern Ollama nativ auf dem Betriebssystem läuft (empfohlen für GPU-Support).

---

## Deployment & Integration

### Docker Compose Snippet
```yaml
services:
  vector-db: ... # PGVector
  ai-ingest: ... # Port 8002 (CRDT -> Vector)
  ai-rag:    ... # Port 8000 (Search -> Prompt)
  llm-gateway: ... # Port 8001 (OpenAI/Ollama Wrapper)
```

### Nginx Routing
Anfragen vom Frontend gehen nur an den `ai-rag` Service:
```nginx
location /api/ai/ {
    proxy_pass http://ai-rag:8000/;
    # SSE Streaming Konfiguration...
}
```

### Editor Hook (Rust)
Der Rust-Editor sendet bei jedem Save-Event asynchron einen Webhook an `ai-ingest`, um die Noten im Hintergrund zu indexieren.

---

## Fazit für die Evaluierung
Diese Architektur demonstriert **Professional Engineering Standards**:
1.  **Separation of Concerns:** Jeder Dienst hat genau eine Aufgabe.
2.  **Scalability:** Einzelne Komponenten (z.B. Ingest bei vielen Usern) können unabhängig skaliert werden.
3.  **Future-Proof:** Der Austausch des KI-Modells oder der Vektor-DB ist ohne Code-Änderungen in der Business-Logik möglich.

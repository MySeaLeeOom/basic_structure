# Protokoll: RAG System Implementierung (Stage 1)

Dieses Dokument dokumentiert den Entwicklungsprozess und die Architektur des Retrieval-Augmented Generation (RAG) Systems für ft_transcendence – vom Basis-Projekt bis zur funktionierenden lokalen KI-Demo.

## 1. Zielsetzung
Ziel war die Integration eines intelligenten "Co-Piloten", der Nutzerfragen basierend auf den persönlichen Noten beantwortet.
*   **Anforderung:** Vollständig lokal lauffähig (Ollama), entkoppelte Architektur (Microservices), Echtzeit-Streaming (SSE).
*   **Technologie-Stack:** Python (FastAPI), PostgreSQL (pgvector), LangChain, Yjs (CRDT), Ollama (Llama 3).

---

## 2. Die Architektur (Decoupled Micro-AI Mesh)

Das System wurde in vier spezialisierte Dienste zerlegt, um die Last der KI-Verarbeitung von der Hauptanwendung zu trennen:

### A. Vector Database (`vector-db`)
*   **Basis:** PostgreSQL 16 + `pgvector` Extension.
*   **Aufgabe:** Speichert Text-Snippets und deren mathematische Repräsentation (Vektoren).
*   **Wichtige Erkenntnis:** Llama 3 benötigt eine Dimension von **4096**. Das Schema wurde explizit darauf optimiert.

### B. AI Ingest Service (`ai-ingest`) - "Der Archivar"
*   **Aufgabe:** Horcht auf Updates vom Rust-Editor, extrahiert Text aus binären CRDT-Blobs und speichert Vektoren.
*   **Herausforderung:** Tiptap speichert Texte als komplexe `YXmlFragment`-Strukturen. Der Dienst nutzt eine rekursive Extraktion, um auch verschachtelte HTML-Inhalte (wie `<p>`-Tags) zu erfassen.

### C. AI RAG Service (`ai-rag`) - "Der Bibliothekar"
*   **Aufgabe:** Orchestrierung der Suche. Empfängt Nutzerfragen, sucht relevanten Kontext in der DB und baut den finalen Prompt für die KI.
*   **Besonderheit:** Nutzt explizite SQL-Typ-Casts (`::vector`), um Inkompatibilitäten zwischen Python-Arrays und Postgres-Vektoren zu vermeiden.

### D. LLM Gateway (`llm-gateway`) - "Der Sprecher"
*   **Aufgabe:** Ein Provider-agnostischer Proxy. Er entscheidet, ob Anfragen an OpenAI (Cloud) oder Ollama (Lokal) gehen.
*   **Streaming:** Implementiert ein transparentes SSE (Server-Sent Events) Modell, das Token für Token an das Frontend durchreicht.

---

## 3. Datenfluss (Der Weg einer Note)

1.  **Eingabe:** Nutzer tippt im Browser ("Ich liebe Katzen").
2.  **Synchronisation:** Der Rust-Editor empfängt die Änderung via WebSocket.
3.  **Trigger:** Alle 5 Sekunden (einstellbar) sendet der Editor den aktuellen Stand als Base64-Blob an den `ai-ingest` Dienst.
4.  **Verarbeitung:** `ai-ingest` wandelt den Blob in Text um, generiert via Ollama einen 4096-dimensionalen Vektor und speichert ihn in `vector-db`.
5.  **Abfrage:** Nutzer fragt im Chat: "Was mag ich?".
6.  **Retrieval:** `ai-rag` findet die "Katzen"-Note in der Vektor-Datenbank.
7.  **Antwort:** Ollama generiert basierend auf diesem Kontext die Antwort und streamt sie live in die Chat-Sidebar.

---

## 4. Überwundene Hürden (Lessons Learned)

| Problem | Ursache | Lösung |
| :--- | :--- | :--- |
| **Silent Fail (No Answer)** | Vektor-Dimension mismatch (1536 vs 4096) | DB-Schema auf 4096 korrigiert & `down -v` Reset. |
| **Operator Error** | Postgres erkannte Python-Arrays nicht als Vektoren | Expliziter Cast `ORDER BY embedding <=> %s::vector` im SQL. |
| **Empty Context** | Tiptap-Inhalte waren in `YXmlFragment` "unsichtbar" | Rekursive Extraktions-Logik in Python implementiert. |
| **Connection Refused** | Ollama hörte nur auf `localhost` | `OLLAMA_HOST=0.0.0.0` und Firewall-Regeln für Docker gesetzt. |
| **Dark Mode Bug** | CSS-Spezifität im Frontend | Nutzung von `!text-white` und Tailwind Dark-Mode Klassen. |

---

## 5. Lokales Setup (Quick Start)

Um das System zu starten, sind folgende Schritte notwendig:

1.  **Ollama vorbereiten:**
    *   `OLLAMA_HOST=0.0.0.0 ollama serve`
    *   `ollama run llama3`
2.  **Infrastruktur starten:**
    *   `docker compose -f srcs/docker-compose.yml down -v` (Einmalig für saubere DB)
    *   `make`
3.  **Firewall (falls nötig):**
    *   `sudo firewall-cmd --add-source=172.18.0.0/16 --zone=public --permanent`
    *   `sudo firewall-cmd --reload`

---

## 6. Fazit
Die Stage 1 Demo beweist die Machbarkeit eines vollständig entkoppelten RAG-Systems. Die Architektur ist skalierbar: Die Vektor-DB kann jederzeit durch Qdrant ersetzt oder das LLM durch einen API-Key-basierten Dienst (OpenAI/Gemini) getauscht werden, ohne die Business-Logik anzupassen.

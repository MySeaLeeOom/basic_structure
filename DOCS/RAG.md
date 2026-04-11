# Retrieval-Augmented Generation (RAG) System

This document provides a conceptual overview of the AI architecture implemented in ft_transcendence.

## Overview
The RAG system allows the AI to answer questions based on the user's personal notes. It combines the reasoning capabilities of a Large Language Model (LLM) with a specialized vector database for factual retrieval.

## Core Benefits
- **Privacy:** 100% local execution. No data is sent to external APIs.
- **Accuracy:** The AI uses specific document fragments as evidence instead of relying on its internal training data.
- **Scalability:** The system is built as a micro-AI mesh, separating data processing from inference.

## Architecture
The system consists of four decoupled services:

1. **Vector Database (`vector-db`):** 
   A PostgreSQL instance with the `pgvector` extension. It stores note fragments as high-dimensional vectors (embeddings) for semantic search.

2. **AI Ingest Service (`ai-ingest`):** 
   The data processor. It extracts text from CRDT blobs, cleans HTML structures, and segments text into optimized chunks. It uses a specialized embedding model to convert text into vectors.

3. **AI RAG Service (`ai-rag`):** 
   The search orchestrator. It performs hybrid searches (vector similarity + keyword re-ranking) to find the most relevant context for a user's query.

4. **LLM Gateway (`llm-gateway`):** 
   A provider-agnostic proxy that manages communication with the LLM (Ollama). It handles request standardization and streaming responses.

## Model Strategy
The system utilizes a dual-model approach for optimal performance:
- **Inference (Chat):** `llama3` (or similar) for reasoning and text generation.
- **Embeddings (Search):** `mxbai-embed-large` for high-precision semantic retrieval.

## Data Flow
1. **Indexing:** As a note is saved, `ai-ingest` segments the text and stores its mathematical representation in the vector database.
2. **Querying:** When a user asks a question, `ai-rag` retrieves the most relevant fragments from the database.
3. **Generation:** The retrieved fragments are injected into a prompt and sent to the LLM via the gateway.
4. **Output:** The LLM generates an answer based strictly on the provided context and streams it back to the UI.

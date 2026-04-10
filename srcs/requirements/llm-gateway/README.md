# LLM Gateway
Proxy for LLM communication.

## Features
- **Stability:** Wraps token stream in JSON to safely handle special characters and newlines.
- **Diagnostics:** Connectivity check to Ollama/Host on startup.
- **Agnostic:** Standardized interface for swapping between local and cloud providers.

## Tech
- FastAPI, OpenAI SDK (Async), pinned httpx.

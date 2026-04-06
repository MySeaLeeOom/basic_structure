# LLM Gateway
High-stability proxy for LLM communication.

## Features
- **Provider Agnostic:** Easy switching between local (Ollama) and cloud (OpenAI).
- **Format Stability:** Wraps token stream in JSON to preserve special characters (newlines, quotes).
- **Diagnostics:** On-startup connectivity check to target host.
- **Pinned Dependencies:** Fixed versions for `openai` and `httpx` to avoid common library conflicts.

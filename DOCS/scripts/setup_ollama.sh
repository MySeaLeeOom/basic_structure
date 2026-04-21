#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# setup_ollama.sh  —  Pull required Ollama models and start the server
#                     so Docker containers can reach it via host-gateway.
# ---------------------------------------------------------------------------

CHAT_MODEL="llama3"
EMBED_MODEL="mxbai-embed-large"

# 1. Check ollama is installed
if ! command -v ollama &>/dev/null; then
    echo "Error: ollama is not installed or not in PATH. Please install it first."
    exit 1
fi

# 2. Pull required models (safe to re-run, skips if already downloaded)
echo "Pulling chat model: $CHAT_MODEL"
ollama pull "$CHAT_MODEL"

echo "Pulling embedding model: $EMBED_MODEL"
ollama pull "$EMBED_MODEL"

# 3. Kill any existing ollama process so we can restart with 0.0.0.0 binding
#    (required so Docker containers can reach it via host-gateway)
if pgrep -x ollama &>/dev/null; then
    echo "Stopping existing Ollama process..."
    pkill -x ollama
    sleep 1
fi

# 4. Start Ollama bound to all interfaces
echo "Starting Ollama on 0.0.0.0:11434..."
OLLAMA_HOST=0.0.0.0 ollama serve &

# Give it a moment to be ready
sleep 2
echo ""
echo "Done. Ollama is running at http://0.0.0.0:11434"
echo "You can now run: make"

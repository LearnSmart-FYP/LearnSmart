#!/usr/bin/env bash
set -euo pipefail

OLLAMA_MODEL=${OLLAMA_MODEL:-sd-1.5-small}
OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://ollama:11434}

echo "Waiting for Ollama server at ${OLLAMA_BASE_URL}..."
until curl -sSf "${OLLAMA_BASE_URL}/api/tags" >/dev/null 2>&1; do
  sleep 1
done

echo "Pulling model ${OLLAMA_MODEL} into shared volume..."
ollama pull ${OLLAMA_MODEL}

echo "Model ${OLLAMA_MODEL} pulled."

#!/usr/bin/env bash
set -euo pipefail

OLLAMA_HOST=${OLLAMA_HOST:-ollama}
OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://${OLLAMA_HOST}:11434}
OLLAMA_MODEL=${OLLAMA_MODEL:-sd-1.5-small}

echo "Waiting for Ollama at ${OLLAMA_BASE_URL} ..."

# Wait for server
until curl -sSf "${OLLAMA_BASE_URL}/api/tags" >/dev/null 2>&1; do
  echo "Waiting for Ollama server..."
  sleep 1
done

# If model exists, exit; otherwise wait for model endpoint
if curl -sSf "${OLLAMA_BASE_URL}/api/models/${OLLAMA_MODEL}" >/dev/null 2>&1; then
  echo "Model ${OLLAMA_MODEL} available."
  exit 0
fi

# Fallback: check /api/models list or tags
while true; do
  if curl -sSf "${OLLAMA_BASE_URL}/api/models" >/dev/null 2>&1; then
    if curl -s "${OLLAMA_BASE_URL}/api/models" | grep -q "${OLLAMA_MODEL}"; then
      echo "Model ${OLLAMA_MODEL} found in models list."
      exit 0
    fi
  fi
  if curl -s "${OLLAMA_BASE_URL}/api/tags" | grep -q "${OLLAMA_MODEL}"; then
    echo "Model ${OLLAMA_MODEL} found in tags."
    exit 0
  fi
  echo "Waiting for model ${OLLAMA_MODEL} to be available..."
  sleep 2
done

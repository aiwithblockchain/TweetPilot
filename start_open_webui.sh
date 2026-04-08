#!/bin/zsh

set -euo pipefail

LOG_DIR="${HOME}/Library/Logs"
LOG_FILE="${LOG_DIR}/open-webui-manual.log"

mkdir -p "${LOG_DIR}"

if pgrep -f '/Users/wesley/.venvs/open-webui/bin/open-webui serve --host 127.0.0.1 --port 8080' >/dev/null 2>&1; then
  echo "Open WebUI is already running."
  exit 0
fi

export DATA_DIR="${HOME}/.open-webui"
export UVICORN_WORKERS=1
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export RAG_EMBEDDING_ENGINE="ollama"
export RAG_EMBEDDING_MODEL="nomic-embed-text"

nohup /Users/wesley/.venvs/open-webui/bin/open-webui serve --host 127.0.0.1 --port 8080 >"${LOG_FILE}" 2>&1 &

for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "Open WebUI started: http://127.0.0.1:8080"
    echo "Log: ${LOG_FILE}"
    exit 0
  fi
  sleep 1
done

echo "Open WebUI did not become ready within 30 seconds."
echo "Check log: ${LOG_FILE}"
exit 1

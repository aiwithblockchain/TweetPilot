#!/bin/zsh

set -euo pipefail

LOG_DIR="${HOME}/Library/Logs"
LOG_FILE="${LOG_DIR}/ollama-manual.log"

mkdir -p "${LOG_DIR}"

if pgrep -f '^/opt/homebrew/opt/ollama/bin/ollama serve$' >/dev/null 2>&1; then
  echo "Ollama is already running."
  exit 0
fi

nohup /opt/homebrew/opt/ollama/bin/ollama serve >"${LOG_FILE}" 2>&1 &

for _ in {1..15}; do
  if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    echo "Ollama started: http://127.0.0.1:11434"
    echo "Log: ${LOG_FILE}"
    exit 0
  fi
  sleep 1
done

echo "Ollama did not become ready within 15 seconds."
echo "Check log: ${LOG_FILE}"
exit 1

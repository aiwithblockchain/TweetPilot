#!/bin/zsh

set -euo pipefail

pkill -f '^/opt/homebrew/opt/ollama/bin/ollama serve$' || true
pkill -f '/Users/wesley/.venvs/open-webui/bin/open-webui serve --host 127.0.0.1 --port 8080' || true

sleep 2

OLLAMA_RUNNING=0
WEBUI_RUNNING=0

if pgrep -f '^/opt/homebrew/opt/ollama/bin/ollama serve$' >/dev/null 2>&1; then
  OLLAMA_RUNNING=1
fi

if pgrep -f '/Users/wesley/.venvs/open-webui/bin/open-webui serve --host 127.0.0.1 --port 8080' >/dev/null 2>&1; then
  WEBUI_RUNNING=1
fi

if [[ "${OLLAMA_RUNNING}" -eq 0 && "${WEBUI_RUNNING}" -eq 0 ]]; then
  echo "Ollama and Open WebUI are stopped."
  exit 0
fi

echo "Some processes are still running."
[[ "${OLLAMA_RUNNING}" -eq 1 ]] && echo "Ollama is still running."
[[ "${WEBUI_RUNNING}" -eq 1 ]] && echo "Open WebUI is still running."
exit 1

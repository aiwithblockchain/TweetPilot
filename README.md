# Local Gemma 4 Runtime

This directory contains manual start and stop scripts for local `Ollama` and `Open WebUI`.

Auto-start has been disabled. Nothing will start at login.

## Files

- `start_ollama.sh`: start the local Ollama API server
- `start_open_webui.sh`: start Open WebUI
- `stop_local_ai.sh`: stop both services
- `package.json`: TweetPilot desktop app package manifest
- `electron/`: Electron main-process and preload code
- `src/`: TweetPilot renderer UI

## TweetPilot Desktop App

Project name:

- `TweetPilot`

Install dependencies:

```bash
cd /Users/wesley/aiwithblockchain/TweetPilot
npm install
```

Run the desktop app in development:

```bash
cd /Users/wesley/aiwithblockchain/TweetPilot
npm run dev
```

Build the desktop app:

```bash
cd /Users/wesley/aiwithblockchain/TweetPilot
npm run build
```

Start the built desktop app:

```bash
cd /Users/wesley/aiwithblockchain/TweetPilot
npm start
```

Current UI scope:

- desktop shell
- left navigation
- model status cards
- extension registry cards
- placeholder command examples

The current app is only a scaffold. It does not yet call Ollama or browser extensions from the UI.

## Start

Start Ollama first:

```bash
cd /Users/wesley/aiwithblockchain/TweetPilot
./start_ollama.sh
```

Then start Open WebUI:

```bash
cd /Users/wesley/aiwithblockchain/TweetPilot
./start_open_webui.sh
```

## Stop

```bash
cd /Users/wesley/aiwithblockchain/TweetPilot
./stop_local_ai.sh
```

## How To Confirm Ollama Is Available

Check that the API is up:

```bash
curl http://127.0.0.1:11434/api/tags
```

Expected result:

- The response is JSON
- It contains `gemma4:e2b`

Example check:

```bash
curl -s http://127.0.0.1:11434/api/tags | rg 'gemma4:e2b'
```

Test that the model can actually answer:

```bash
curl -s http://127.0.0.1:11434/api/chat -d '{
  "model": "gemma4:e2b",
  "messages": [
    {"role": "user", "content": "Reply with exactly: OLLAMA OK"}
  ],
  "stream": false
}'
```

Expected result:

- The response is JSON
- `message.content` contains `OLLAMA OK`

## How To Confirm Open WebUI Is Available

Health check:

```bash
curl http://127.0.0.1:8080/health
```

Expected result:

- The response is JSON
- It returns `{"status":true}`

Open the UI in a browser:

```text
http://127.0.0.1:8080
```

Expected result:

- The page loads normally
- You can select `gemma4:e2b` inside the UI

## Logs

- Ollama log: `~/Library/Logs/ollama-manual.log`
- Open WebUI log: `~/Library/Logs/open-webui-manual.log`

## Notes

- Installed model: `gemma4:e2b`
- Ollama model storage: `~/.ollama/models`
- Open WebUI depends on Ollama if you want to chat with the local model
- If you start Open WebUI before Ollama, the web page can still come up, but model chat will not work until Ollama is running

## Test Status

These scripts were tested end-to-end:

- `start_ollama.sh`: passed
- `start_open_webui.sh`: passed
- `stop_local_ai.sh`: passed
- Ollama API chat test: passed
- Open WebUI health check: passed

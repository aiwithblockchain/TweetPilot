#!/bin/bash

# TweetPilot 开发日志脚本
# 用途：启动 Tauri 开发环境，并把关键调试信息统一汇总到日志文件

set -u

# 设置日志目录和文件
LOG_DIR="logs"
LATEST_LOG="$LOG_DIR/dev.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/dev_${TIMESTAMP}.log"
APP_STATE_DIR="$HOME/.tweetpilot"
CONFIG_FILE="$APP_STATE_DIR/config.json"
RECENT_FILE="$APP_STATE_DIR/recent-workspaces.json"
ROOT_DIR=$(pwd)
SERVICE_MODE="${VITE_SERVICE_MODE:-tauri}"
REDACTED_ENV_KEYS=(
  "ANTHROPIC_AUTH_TOKEN"
  "ANTHROPIC_BASE_URL"
  "OPENAI_API_KEY"
  "GEMINI_API_KEY"
  "DEEPSEEK_API_KEY"
  "GOOGLE_API_KEY"
  "AWS_SECRET_ACCESS_KEY"
  "AWS_ACCESS_KEY_ID"
)

# 创建日志目录
mkdir -p "$LOG_DIR"

# 每次启动清空所有日志文件
: > "$LATEST_LOG"
rm -f "$LOG_DIR"/dev_*.log

log_both() {
  local message="$1"
  printf '%s\n' "$message" | tee -a "$LOG_FILE" | tee -a "$LATEST_LOG"
}

write_log_header() {
  local target_file="$1"
  echo "========================================" | tee -a "$target_file"
  echo "TweetPilot 开发日志" | tee -a "$target_file"
  echo "启动时间: $(date)" | tee -a "$target_file"
  echo "日志文件: $target_file" | tee -a "$target_file"
  echo "========================================" | tee -a "$target_file"
  echo "" | tee -a "$target_file"
}

write_log_footer() {
  local target_file="$1"
  echo "" | tee -a "$target_file"
  echo "========================================" | tee -a "$target_file"
  echo "停止时间: $(date)" | tee -a "$target_file"
  echo "日志已保存到: $target_file" | tee -a "$target_file"
  echo "========================================" | tee -a "$target_file"
}

append_command_output() {
  local title="$1"
  shift
  local tmp_file
  tmp_file=$(mktemp)

  log_both "[$title]"
  if "$@" > "$tmp_file" 2>&1; then
    :
  else
    :
  fi

  tee -a "$LOG_FILE" < "$tmp_file" > /dev/null
  tee -a "$LATEST_LOG" < "$tmp_file" > /dev/null
  rm -f "$tmp_file"
  log_both ""
}

append_file_or_missing() {
  local title="$1"
  local file_path="$2"
  log_both "[$title]"
  if [ -f "$file_path" ]; then
    tee -a "$LOG_FILE" < "$file_path" > /dev/null
    tee -a "$LATEST_LOG" < "$file_path" > /dev/null
  else
    log_both "(missing) $file_path"
  fi
  log_both ""
}

append_redacted_environment() {
  local tmp_file
  tmp_file=$(mktemp)

  env | sort > "$tmp_file"
  for key in "${REDACTED_ENV_KEYS[@]}"; do
    python3 - "$tmp_file" "$key" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
text = path.read_text(encoding='utf-8')
pattern = re.compile(rf'^{re.escape(key)}=.*$', re.MULTILINE)
text = pattern.sub(f'{key}=(redacted)', text)
path.write_text(text, encoding='utf-8')
PY
  done

  log_both "[environment]"
  tee -a "$LOG_FILE" < "$tmp_file" > /dev/null
  tee -a "$LATEST_LOG" < "$tmp_file" > /dev/null
  rm -f "$tmp_file"
  log_both ""
}

write_log_header "$LOG_FILE"
write_log_header "$LATEST_LOG"

trap 'write_log_footer "$LOG_FILE"; write_log_footer "$LATEST_LOG"; exit 0' INT TERM

log_both "[summary] 历史日志: $LOG_FILE"
log_both "[summary] 当前日志: $LATEST_LOG"
log_both "[summary] 项目目录: $ROOT_DIR"
log_both "[summary] VITE_SERVICE_MODE: $SERVICE_MODE"
log_both ""

append_redacted_environment
append_command_output "node-version" node -v
append_command_output "npm-version" npm -v
append_command_output "rust-version" rustc --version
append_command_output "cargo-version" cargo --version
append_command_output "tauri-config" python3 - <<'PY'
import json
from pathlib import Path
path = Path('src-tauri/tauri.conf.json')
if not path.exists():
    print('(missing) src-tauri/tauri.conf.json')
else:
    data = json.loads(path.read_text(encoding='utf-8'))
    print(json.dumps(data, ensure_ascii=False, indent=2))
PY
append_command_output "port-5173" bash -lc 'lsof -nP -iTCP:5173 -sTCP:LISTEN || true'
append_file_or_missing "tweetpilot-config" "$CONFIG_FILE"
append_file_or_missing "tweetpilot-recent-workspaces" "$RECENT_FILE"

log_both "[run] 开始执行 VITE_SERVICE_MODE=$SERVICE_MODE npm run tauri:dev"

# 强制使用 Tauri 服务模式，避免误回退到 mock
VITE_SERVICE_MODE="$SERVICE_MODE" npm run tauri:dev 2>&1 | tee -a "$LOG_FILE" | tee -a "$LATEST_LOG"

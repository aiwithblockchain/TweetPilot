#!/bin/bash

# TweetPilot 开发日志脚本
# 用途：捕获所有运行时错误和日志到文件

# 设置日志目录和文件
LOG_DIR="logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/dev_${TIMESTAMP}.log"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 输出日志文件路径
echo "========================================" | tee "$LOG_FILE"
echo "TweetPilot 开发日志" | tee -a "$LOG_FILE"
echo "启动时间: $(date)" | tee -a "$LOG_FILE"
echo "日志文件: $LOG_FILE" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 捕获 Ctrl+C 信号，优雅退出
trap 'echo ""; echo "========================================" | tee -a "$LOG_FILE"; echo "停止时间: $(date)" | tee -a "$LOG_FILE"; echo "日志已保存到: $LOG_FILE" | tee -a "$LOG_FILE"; echo "========================================"; exit 0' INT

# 运行 Tauri 开发模式，同时输出到终端和日志文件
npm run tauri:dev 2>&1 | tee -a "$LOG_FILE"

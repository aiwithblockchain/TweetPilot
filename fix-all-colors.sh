#!/bin/bash

# 完整的颜色替换脚本 - 修复所有硬编码颜色

# 深色背景色 -> CSS 变量
find src/components src/pages -type f -name "*.tsx" -exec sed -i '' \
  -e 's/bg-\[#1E1E1E\]/bg-[var(--color-bg)]/g' \
  -e 's/bg-\[#252526\]/bg-[var(--color-surface)]/g' \
  -e 's/bg-\[#2D2D30\]/bg-[var(--color-surface)]/g' \
  -e 's/bg-\[#333333\]/bg-[var(--vscode-bg-activity-bar)]/g' \
  -e 's/bg-\[#323233\]/bg-[var(--vscode-bg-title-bar)]/g' \
  -e 's/bg-\[#2A2A2A\]/bg-[var(--vscode-hover-bg)]/g' \
  -e 's/bg-\[#3C3C3C\]/bg-[var(--vscode-hover-bg)]/g' \
  -e 's/bg-\[#4B4B4B\]/bg-[var(--color-border)]/g' \
  {} +

# 浅色背景色 -> CSS 变量
find src/components src/pages -type f -name "*.tsx" -exec sed -i '' \
  -e 's/bg-\[#FFFFFF\]/bg-[var(--color-bg)]/g' \
  -e 's/bg-\[#F3F3F3\]/bg-[var(--vscode-bg-sidebar)]/g' \
  -e 's/bg-\[#F9FAFB\]/bg-[var(--color-surface)]/g' \
  -e 's/bg-\[#E8E8E8\]/bg-[var(--vscode-hover-bg)]/g' \
  {} +

# 边框颜色 -> CSS 变量
find src/components src/pages -type f -name "*.tsx" -exec sed -i '' \
  -e 's/border-\[#2A2A2A\]/border-[var(--color-border)]/g' \
  -e 's/border-\[#3C3C3C\]/border-[var(--color-border)]/g' \
  -e 's/border-\[#4B4B4B\]/border-[var(--color-border)]/g' \
  -e 's/border-\[#E5E7EB\]/border-[var(--color-border)]/g' \
  {} +

# 文本颜色 -> CSS 变量
find src/components src/pages -type f -name "*.tsx" -exec sed -i '' \
  -e 's/text-\[#CCCCCC\]/text-[var(--color-text)]/g' \
  -e 's/text-\[#858585\]/text-[var(--color-text-secondary)]/g' \
  -e 's/text-\[#64748B\]/text-[var(--color-text-secondary)]/g' \
  -e 's/text-\[#0F172A\]/text-[var(--color-text)]/g' \
  -e 's/text-\[#999999\]/text-[var(--color-text-secondary)]/g' \
  -e 's/text-\[#666666\]/text-[var(--color-text-secondary)]/g' \
  {} +

# 分隔线颜色 -> CSS 变量
find src/components src/pages -type f -name "*.tsx" -exec sed -i '' \
  -e 's/h-px bg-\[#4B4B4B\]/h-px bg-[var(--color-border)]/g' \
  {} +

echo "✅ 所有颜色已替换为 CSS 变量"

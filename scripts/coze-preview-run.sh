#!/usr/bin/env bash
set -euo pipefail

# 显式声明关键环境变量
export PORT=5000

# 清理 5000 端口残留进程（幂等性）
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

exec node server.js

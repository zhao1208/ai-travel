#!/usr/bin/env bash
set -euo pipefail

# 显式声明关键环境变量
export PORT=5000

exec node server.js

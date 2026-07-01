#!/usr/bin/env bash
set -euo pipefail

# 零依赖项目，无需安装依赖
# dev.build 只做环境校验
node --version > /dev/null
echo "Node.js environment OK"

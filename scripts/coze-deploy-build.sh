#!/usr/bin/env bash
set -euo pipefail

# 零依赖项目，无需安装，构建只做环境校验
node --version > /dev/null
echo "Build environment OK"

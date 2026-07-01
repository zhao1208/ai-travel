#!/bin/bash
# ============================================================
# AI Travel Assistant - 更新部署脚本
# 用于后续代码更新后重新部署
# 用法: sudo bash update.sh
# ============================================================

set -e

APP_DIR="/opt/ai-travel-assistant"
GREEN='\033[0;32m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }

echo "🔄 正在更新 AI Travel Assistant..."

# 检查应用目录
if [ ! -d "$APP_DIR" ]; then
  echo "❌ 应用目录 $APP_DIR 不存在，请先运行 deploy.sh"
  exit 1
fi

# 复制新文件
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp -r "${SCRIPT_DIR}/css" "$APP_DIR/"
cp -r "${SCRIPT_DIR}/js" "$APP_DIR/"
cp -r "${SCRIPT_DIR}/images" "$APP_DIR/" 2>/dev/null || true
cp "${SCRIPT_DIR}/index.html" "$APP_DIR/"
cp "${SCRIPT_DIR}/server.js" "$APP_DIR/"

# 重启应用
cd "$APP_DIR"
pm2 restart travel-ai

log "更新完成！应用已重启"
echo ""
echo "📊 进程状态:"
pm2 status travel-ai
echo ""
echo "📝 查看日志: pm2 logs travel-ai"

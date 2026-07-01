#!/bin/bash
# ============================================================
# AI Travel Assistant - Baidu Cloud Ubuntu Deployment Script
# 用法: sudo bash deploy.sh your-domain.com
# ============================================================

set -e

# --- 颜色输出 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# --- 参数检查 ---
DOMAIN=${1:-""}
APP_DIR="/opt/ai-travel-assistant"
APP_PORT=3000
NODE_VERSION="22"

if [ -z "$DOMAIN" ]; then
  err "请提供域名参数: sudo bash deploy.sh your-domain.com"
fi

# --- Root 检查 ---
if [ "$EUID" -ne 0 ]; then
  err "请使用 root 权限运行: sudo bash deploy.sh $DOMAIN"
fi

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║   AI Travel Assistant - 自动部署脚本     ║"
echo "║   域名: $DOMAIN"
echo "║   目录: $APP_DIR"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================
step "1/7  系统更新"
# ============================================================
log "更新软件包列表..."
apt-get update -qq
apt-get install -y -qq curl wget git ufw > /dev/null 2>&1
log "系统依赖安装完成"

# ============================================================
step "2/7  安装 Node.js $NODE_VERSION"
# ============================================================
if command -v node &> /dev/null; then
  CURRENT_NODE=$(node -v | grep -oP '\d+' | head -1)
  if [ "$CURRENT_NODE" -ge "$NODE_VERSION" ]; then
    log "Node.js $(node -v) 已安装，跳过"
  else
    warn "Node.js 版本过低，正在升级..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
    log "Node.js 升级到 $(node -v)"
  fi
else
  log "安装 Node.js $NODE_VERSION..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
  log "Node.js $(node -v) 安装完成"
fi

# ============================================================
step "3/7  安装 PM2 进程管理器"
# ============================================================
if command -v pm2 &> /dev/null; then
  log "PM2 已安装"
else
  npm install -g pm2 > /dev/null 2>&1
  log "PM2 安装完成"
fi

# ============================================================
step "4/7  部署应用"
# ============================================================
if [ -d "$APP_DIR" ]; then
  warn "应用目录已存在，正在更新..."
  # 备份旧版本
  BACKUP_DIR="${APP_DIR}.bak.$(date +%Y%m%d%H%M%S)"
  cp -r "$APP_DIR" "$BACKUP_DIR"
  log "旧版本已备份到 $BACKUP_DIR"
fi

mkdir -p "$APP_DIR"

# 复制应用文件（脚本所在目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/server.js" ]; then
  cp -r "${SCRIPT_DIR}/css" "$APP_DIR/"
  cp -r "${SCRIPT_DIR}/js" "$APP_DIR/"
  cp -r "${SCRIPT_DIR}/images" "$APP_DIR/" 2>/dev/null || true
  cp "${SCRIPT_DIR}/index.html" "$APP_DIR/"
  cp "${SCRIPT_DIR}/server.js" "$APP_DIR/"
  cp "${SCRIPT_DIR}/package.json" "$APP_DIR/"
  log "应用文件复制完成"
else
  # 如果脚本独立运行，创建文件
  warn "未检测到源文件，请确保应用文件已在 $APP_DIR"
fi

cd "$APP_DIR"

# 停止旧进程
pm2 delete travel-ai 2>/dev/null || true

# 启动应用
export PORT=$APP_PORT
pm2 start server.js --name "travel-ai" \
  --max-memory-restart 300M \
  --log /var/log/travel-ai.log \
  --time

pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true

log "应用已启动 (端口 $APP_PORT)"

# ============================================================
step "5/7  安装并配置 Nginx"
# ============================================================
if command -v nginx &> /dev/null; then
  log "Nginx 已安装"
else
  apt-get install -y -qq nginx > /dev/null 2>&1
  log "Nginx 安装完成"
fi

# 创建 Nginx 配置
cat > "/etc/nginx/sites-available/${DOMAIN}" << NGINX_CONF
# ============================================================
# $DOMAIN - AI Travel Assistant
# Generated: $(date '+%Y-%m-%d %H:%M:%S')
# ============================================================

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        image/svg+xml;

    # Static files - long cache
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host \$host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Main proxy
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support (future)
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:${APP_PORT}/;
        access_log off;
    }

    # Block hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
NGINX_CONF

# 启用站点
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"

# 移除默认站点
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t || err "Nginx 配置测试失败，请检查"

# 重启 Nginx
systemctl restart nginx
systemctl enable nginx > /dev/null 2>&1

log "Nginx 反向代理配置完成"

# ============================================================
step "6/7  配置防火墙"
# ============================================================
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1

log "防火墙已配置 (SSH/HTTP/HTTPS)"

# ============================================================
step "7/7  配置 SSL 证书 (Let's Encrypt)"
# ============================================================
if command -v certbot &> /dev/null; then
  log "Certbot 已安装"
else
  apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1
  log "Certbot 安装完成"
fi

# 申请证书
warn "正在申请 SSL 证书，请确保域名 $DOMAIN 已解析到本服务器 IP"
echo ""

certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect \
  2>/dev/null && log "SSL 证书配置成功 ✓" || {
    warn "SSL 证书自动申请失败，请手动执行:"
    echo -e "  ${YELLOW}certbot --nginx -d $DOMAIN -d www.${DOMAIN}${NC}"
    echo ""
    warn "或者检查域名 DNS 是否已指向本服务器公网 IP"
  }

# 设置自动续期
systemctl enable certbot.timer > /dev/null 2>&1 || true
log "SSL 证书自动续期已启用"

# ============================================================
# 完成
# ============================================================
SERVER_IP=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || echo "未知")

echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║           🎉 部署完成！                          ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  🌐 访问地址:                                    ║"
echo "║     https://$DOMAIN"
echo "║     https://www.${DOMAIN}"
echo "║                                                  ║"
echo "║  📡 服务器 IP: $SERVER_IP"
echo "║                                                  ║"
echo "║  📋 常用命令:                                    ║"
echo "║     pm2 status          查看进程状态             ║"
echo "║     pm2 logs travel-ai  查看应用日志             ║"
echo "║     pm2 restart travel-ai 重启应用               ║"
echo "║     nginx -t            测试 Nginx 配置          ║"
echo "║     systemctl reload nginx  重载 Nginx           ║"
echo "║                                                  ║"
echo "║  🔧 应用目录: $APP_DIR"
echo "║  📝 应用日志: /var/log/travel-ai.log             ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# DNS 提示
echo -e "${YELLOW}📌 DNS 配置提示:${NC}"
echo "   请在百度云 DNS 解析中添加以下记录:"
echo "   A    $DOMAIN    →    $SERVER_IP"
echo "   A    www.${DOMAIN}    →    $SERVER_IP"
echo ""

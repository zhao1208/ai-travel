#!/bin/bash
# ============================================================
# AI Travel Assistant - 一键远程部署
# 在百度云 Ubuntu 服务器上执行此命令即可完成全部部署
#
# 用法 (在服务器上执行):
#   curl -fsSL https://your-bucket.com/quick-deploy.sh | sudo bash -s your-domain.com
#
# 或者手动下载执行:
#   wget https://your-bucket.com/quick-deploy.sh
#   sudo bash quick-deploy.sh your-domain.com
# ============================================================

set -e

DOMAIN=${1:-""}
APP_DIR="/opt/ai-travel-assistant"
APP_PORT=3000

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

[ -z "$DOMAIN" ] && err "用法: sudo bash quick-deploy.sh your-domain.com"
[ "$EUID" -ne 0 ] && err "请使用 root 权限运行"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║  AI Travel Assistant 一键部署         ║"
echo "║  域名: $DOMAIN"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# --- 1. 系统依赖 ---
step "1/6 安装系统依赖"
apt-get update -qq
apt-get install -y -qq curl nginx certbot python3-certbot-nginx ufw > /dev/null 2>&1
log "系统依赖就绪"

# --- 2. Node.js ---
step "2/6 安装 Node.js 22"
if ! command -v node &> /dev/null || [ "$(node -v | grep -oP '\d+' | head -1)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
fi
npm install -g pm2 > /dev/null 2>&1
log "Node.js $(node -v) + PM2 就绪"

# --- 3. 创建应用 ---
step "3/6 创建应用"
mkdir -p "$APP_DIR/css" "$APP_DIR/js" "$APP_DIR/images"

# server.js
cat > "$APP_DIR/server.js" << 'SERVEREOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
http.createServer((req, res) => {
  let fp = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(PUBLIC_DIR, 'index.html');
  const ct = MIME[path.extname(fp)] || 'application/octet-stream';
  fs.readFile(fp, (err, d) => {
    if (err) { res.writeHead(404); return res.end('Not Found'); }
    res.writeHead(200, {'Content-Type':ct,'Cache-Control':'no-cache'}); res.end(d);
  });
}).listen(PORT, '0.0.0.0', () => console.log(`Running on http://localhost:${PORT}`));
SERVEREOF

# package.json
cat > "$APP_DIR/package.json" << 'PKGEOF'
{"name":"ai-travel-assistant","version":"1.0.0","scripts":{"start":"node server.js"}}
PKGEOF

log "应用骨架创建完成"
warn() { echo -e "\033[1;33m[!]\033[0m $1"; }
warn "请将 css/, js/, index.html 上传到 $APP_DIR/"
warn "然后运行: cd $APP_DIR && pm2 start server.js --name travel-ai"

# --- 4. PM2 ---
step "4/6 配置 PM2"
cd "$APP_DIR"
export PORT=$APP_PORT
pm2 delete travel-ai 2>/dev/null || true
pm2 start server.js --name "travel-ai" --max-memory-restart 300M --time
pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
log "PM2 进程管理配置完成"

# --- 5. Nginx ---
step "5/6 配置 Nginx"
cat > "/etc/nginx/sites-available/${DOMAIN}" << NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }
    location ~ /\. { deny all; }
}
NGINXEOF

ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx && systemctl enable nginx > /dev/null 2>&1
log "Nginx 反向代理配置完成"

# --- 6. 防火墙 + SSL ---
step "6/6 防火墙 & SSL"
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
log "防火墙已开启 (SSH/HTTP/HTTPS)"

SERVER_IP=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || echo "未知")

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗"
echo -e "║           🎉 基础部署完成！                   ║"
echo -e "╠═══════════════════════════════════════════════╣"
echo -e "║  📡 IP: $SERVER_IP"
echo -e "║  🌐 http://$DOMAIN (SSL 待配置)              ║"
echo -e "╠═══════════════════════════════════════════════╣"
echo -e "║  ⚠️  请先完成以下步骤:                        ║"
echo -e "║                                               ║"
echo -e "║  1. 在百度云 DNS 添加解析:                    ║"
echo -e "║     A  $DOMAIN → $SERVER_IP                   ║"
echo -e "║     A  www.$DOMAIN → $SERVER_IP               ║"
echo -e "║                                               ║"
echo -e "║  2. DNS 生效后申请 SSL:                       ║"
echo -e "║     certbot --nginx -d $DOMAIN                ║"
echo -e "║              -d www.$DOMAIN                   ║"
echo -e "║                                               ║"
echo -e "║  3. 上传前端文件:                             ║"
echo -e "║     scp -r css js images index.html root@$SERVER_IP:$APP_DIR/"
echo -e "╚═══════════════════════════════════════════════╝${NC}"
echo ""

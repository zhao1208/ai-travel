#!/usr/bin/env python3
"""Deploy AI Travel Assistant to Baidu Cloud server via SSH."""
import paramiko
import os
import sys
import time

HOST = "120.48.113.23"
USER = "root"
PASSWORD = sys.argv[1] if len(sys.argv) > 1 else ""
LOCAL_DIR = "/root/.openclaw/workspace/ai-travel-assistant"
REMOTE_DIR = "/opt/ai-travel-assistant"
DOMAIN = sys.argv[2] if len(sys.argv) > 2 else ""

if not PASSWORD:
    print("Usage: python3 deploy-remote.py PASSWORD [DOMAIN]")
    sys.exit(1)

def ssh_exec(ssh, cmd, print_output=True):
    """Execute command on remote server."""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode()
    err = stderr.read().decode()
    if print_output and out.strip():
        print(out.strip())
    if exit_code != 0 and err.strip():
        print(f"⚠️  {err.strip()}")
    return exit_code, out, err

def upload_dir(sftp, local_dir, remote_dir):
    """Recursively upload directory."""
    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}"
        if os.path.isdir(local_path):
            try:
                sftp.mkdir(remote_path)
            except IOError:
                pass
            upload_dir(sftp, local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)
            print(f"  ↑ {item}")

print(f"🔗 连接到 {HOST}...")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=10)
print("✅ SSH 连接成功")

sftp = ssh.open_sftp()

# Step 1: Install Node.js & PM2 & Nginx
print("\n📦 安装系统依赖...")
cmds = [
    "apt-get update -qq 2>/dev/null; echo 'apt updated'",
    """
    if ! command -v node &> /dev/null || [ "$(node -v | grep -oP '\\d+' | head -1)" -lt 22 ]; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
      apt-get install -y -qq nodejs > /dev/null 2>&1
      echo "Node.js $(node -v) installed"
    else
      echo "Node.js $(node -v) already installed"
    fi
    """,
    "npm install -g pm2 > /dev/null 2>&1; echo 'PM2 ready'",
    "apt-get install -y -qq nginx certbot python3-certbot-nginx ufw > /dev/null 2>&1; echo 'Nginx + Certbot ready'",
]

for cmd in cmds:
    code, out, err = ssh_exec(ssh, cmd.strip())
    if out.strip():
        print(f"  ✓ {out.strip().split(chr(10))[-1]}")

# Step 2: Upload files
print("\n📁 上传应用文件...")
ssh.exec_command(f"mkdir -p {REMOTE_DIR}/css {REMOTE_DIR}/js {REMOTE_DIR}/images")
upload_dir(sftp, LOCAL_DIR, REMOTE_DIR)
sftp.close()
print("✅ 文件上传完成")

# Step 3: PM2 process
print("\n🚀 启动应用...")
ssh_exec(ssh, f"""
cd {REMOTE_DIR}
pm2 delete travel-ai 2>/dev/null || true
PORT=3000 pm2 start server.js --name travel-ai --max-memory-restart 300M --time
pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
echo "PM2 process started"
""")

# Step 4: Nginx config
if DOMAIN:
    print(f"\n🌐 配置 Nginx ({DOMAIN})...")
    nginx_conf = f"""server {{
    listen 80;
    listen [::]:80;
    server_name {DOMAIN} www.{DOMAIN};

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location / {{
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }}

    location ~ \\. {{ deny all; }}
}}"""

    # Write nginx config
    ssh_exec(ssh, f"cat > /etc/nginx/sites-available/{DOMAIN} << 'NGINXEOF'\n{nginx_conf}\nNGINXEOF")
    ssh_exec(ssh, f"ln -sf /etc/nginx/sites-available/{DOMAIN} /etc/nginx/sites-enabled/{DOMAIN}")
    ssh_exec(ssh, "rm -f /etc/nginx/sites-enabled/default")
    ssh_exec(ssh, "nginx -t && systemctl restart nginx && systemctl enable nginx > /dev/null 2>&1")
    print("  ✓ Nginx 配置完成")

# Step 5: Firewall
print("\n🔒 配置防火墙...")
ssh_exec(ssh, """
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
echo "Firewall: SSH/HTTP/HTTPS allowed"
""")

# Step 6: SSL (if domain provided)
if DOMAIN:
    print(f"\n🔐 配置 SSL 证书...")
    code, out, err = ssh_exec(ssh, f"""
    certbot --nginx -d {DOMAIN} -d www.{DOMAIN} \
      --non-interactive --agree-tos --register-unsafely-without-email --redirect \
      2>&1 || echo "SSL_FAILED"
    """)
    if "SSL_FAILED" in out:
        print(f"  ⚠️  SSL 自动申请失败，请确认域名 DNS 已解析到 {HOST}")
        print(f"  📌 手动执行: certbot --nginx -d {DOMAIN} -d www.{DOMAIN}")
    else:
        print("  ✓ SSL 证书配置成功")
    
    ssh_exec(ssh, "systemctl enable certbot.timer > /dev/null 2>&1 || true")

# Get process status
print("\n📊 应用状态:")
ssh_exec(ssh, "pm2 status travel-ai")

ssh.close()

print(f"""
{'='*50}
🎉 部署完成！

📡 服务器: {HOST}
🌐 访问: {'https://' + DOMAIN if DOMAIN else 'http://' + HOST + ':3000'}
📁 目录: {REMOTE_DIR}

📋 常用命令:
  pm2 status          查看进程
  pm2 logs travel-ai  查看日志
  pm2 restart travel-ai  重启

🔒 安全建议:
  1. 修改 root 密码: passwd
  2. 配置 SSH 密钥认证
  3. 禁用密码登录: 编辑 /etc/ssh/sshd_config
{'='*50}
""")

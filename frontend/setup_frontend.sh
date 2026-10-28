#!/usr/bin/env bash
set -euo pipefail

# Run this script from the cloned repository's frontend directory.
if [[ ! -f package.json || ! -f vite.config.js || ! -d src ]]; then
  echo "ERROR: Run this script from the MIRROR/frontend directory."
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Please run: sudo bash setup_frontend.sh BACKEND_PRIVATE_IP"
  exit 1
fi
BACKEND_IP="${1:-}"
if [[ -z "$BACKEND_IP" ]]; then
  echo "Usage: sudo bash setup_frontend.sh BACKEND_PRIVATE_IP"
  echo "Example: sudo bash setup_frontend.sh 172.31.40.140"
  exit 1
fi

if command -v dnf >/dev/null 2>&1; then
  dnf install -y git nginx nodejs npm
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y git nginx nodejs npm
else
  echo "Unsupported Linux distribution. Install Node.js, npm, and Nginx first."
  exit 1
fi

npm install
npm run build
WEB_DIR=/usr/share/nginx/html
mkdir -p "$WEB_DIR"
# Remove old static files, but leave Nginx config outside this directory.
find "$WEB_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -r dist/. "$WEB_DIR/"

# Remove the packaged default server to avoid duplicate default_server declarations.
rm -f /etc/nginx/conf.d/default.conf

cat > /etc/nginx/conf.d/mirror.conf <<NGINX
server {
    listen 80 default_server;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://${BACKEND_IP}:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

nginx -t
systemctl enable --now nginx
systemctl restart nginx

echo
echo "Frontend deployed. Open this instance's public IPv4 address in a browser."
echo "Ensure the backend Security Group allows TCP 3001 from this frontend Security Group."

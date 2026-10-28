#!/usr/bin/env bash
set -euo pipefail

# Run this script from the cloned repository's backend directory.
if [[ ! -f package.json || ! -f server/index.js ]]; then
  echo "ERROR: Run this script from the MIRROR/backend directory."
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Please run: sudo bash setup_backend.sh"
  exit 1
fi

if command -v dnf >/dev/null 2>&1; then
  dnf install -y nodejs npm rsync
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nodejs npm rsync
else
  echo "Unsupported Linux distribution. Install Node.js and npm first."
  exit 1
fi

APP_DIR=/opt/mirror-backend
mkdir -p "$APP_DIR"
# Preserve the live database during redeployment.
rsync -a --exclude='node_modules/' --exclude='data/' ./ "$APP_DIR/"
mkdir -p "$APP_DIR/data"
cd "$APP_DIR"
npm install --omit=dev

cat > /etc/systemd/system/mirror-backend.service <<'SERVICE'
[Unit]
Description=MIRROR Personal Dashboard API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/mirror-backend
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/node /opt/mirror-backend/server/index.js
Restart=on-failure
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now mirror-backend
systemctl restart mirror-backend
sleep 2
systemctl --no-pager --full status mirror-backend || true

echo
echo "Backend service installed. Test locally: curl http://127.0.0.1:3001/api/health"
echo "SQLite database: /opt/mirror-backend/data/mirror.db"
echo "Do not open port 3001 to the public internet; allow it only from the frontend security group."

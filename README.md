# MIRROR — GitHub + two EC2 instances

MIRROR is organized like the Saffron & Smoke deployment: a separate `frontend/` and `backend/` directory. The frontend is React + Vite served by Nginx. The backend is Node.js + Express with a SQLite database.

## Repository structure

```text
MIRROR/
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── setup_frontend.sh
├── backend/
│   ├── server/index.js
│   ├── package.json
│   └── setup_backend.sh
└── README.md
```

## 1. Push to GitHub from your computer

Extract this ZIP, open a terminal in the outer `MIRROR` folder, then run:

```bash
git init
git add .
git commit -m "Initial MIRROR frontend and backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/MIRROR.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. If you already initialized Git, don't repeat `git init` or add a second remote; use `git add .`, `git commit`, and `git push` instead.

## 2. Backend EC2 (`mirror-backend`)

Launch Amazon Linux 2023, `t3.micro`, public IP enabled. Keep it in the same VPC as the frontend. In its Security Group, allow SSH 22 from your IP and TCP 3001 **from the frontend Security Group**. Do not allow port 3001 from everyone.

Connect with EC2 Instance Connect and run:

```bash
sudo dnf update -y
sudo dnf install -y git rsync
 git clone https://github.com/YOUR_USERNAME/MIRROR.git
cd MIRROR/backend
chmod +x setup_backend.sh
sudo bash setup_backend.sh
curl http://127.0.0.1:3001/api/health
```

Replace `YOUR_USERNAME` with your GitHub username. The health check should return `{"status":"ok","service":"mirror-api"}`. Database: `/opt/mirror-backend/data/mirror.db`.

## 3. Frontend EC2 (`mirror-frontend`)

Launch another Amazon Linux 2023 `t3.micro` in the same VPC. Allow HTTP 80 from anywhere and SSH 22 from your IP.

Connect and run:

```bash
sudo dnf update -y
sudo dnf install -y git
 git clone https://github.com/YOUR_USERNAME/MIRROR.git
cd MIRROR/frontend
chmod +x setup_frontend.sh
sudo bash setup_frontend.sh BACKEND_PRIVATE_IP
```

Replace `BACKEND_PRIVATE_IP` with the backend instance's **Private IPv4 address** (for example, `172.31.40.140`) and replace `YOUR_USERNAME`. The script installs Node.js, Nginx and builds the frontend, then configures Nginx to forward `/api/` to the backend.

Open `http://FRONTEND_PUBLIC_IP` in your browser.

## 4. Updating the app later

Push code changes to GitHub. On the backend instance, enter `MIRROR/backend`, run `git pull`, then `sudo bash setup_backend.sh`. On the frontend instance, enter `MIRROR/frontend`, run `git pull`, then `sudo bash setup_frontend.sh BACKEND_PRIVATE_IP` again. The backend setup preserves the database at `/opt/mirror-backend/data/`.

GitHub stores application code; it does not store live SQLite records. Back up the database separately if the data matters.

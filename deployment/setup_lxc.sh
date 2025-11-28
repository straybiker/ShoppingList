#!/bin/bash

# Shopping List App - LXC Setup Script
# Run this script inside your Proxmox LXC container (Debian/Ubuntu)

set -e

APP_DIR="/opt/shopping-list"
# Determine the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "--- Starting Deployment ---"

# 1. Install Node.js (LTS)
echo "Installing Node.js..."
apt-get update
apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs build-essential

# 2. Prepare Application Directory
echo "Creating application directory at $APP_DIR..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/data

# 3. Copy Files
echo "Copying application files..."
if [ -f "$PROJECT_ROOT/server.js" ]; then
    cp "$PROJECT_ROOT/package.json" "$APP_DIR/"
    cp "$PROJECT_ROOT/package-lock.json" "$APP_DIR/" 2>/dev/null || :
    cp "$PROJECT_ROOT/server.js" "$APP_DIR/"
    cp -r "$PROJECT_ROOT/public" "$APP_DIR/"
else
    echo "Error: Could not find application files in $PROJECT_ROOT"
    exit 1
fi

# 4. Install Dependencies
echo "Installing dependencies..."
cd $APP_DIR
npm install --production

# 5. Create Systemd Service
echo "Configuring Systemd service..."
cat > /etc/systemd/system/shopping-list.service <<EOF
[Unit]
Description=Shopping List App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 6. Start Service
echo "Starting service..."
systemctl daemon-reload
systemctl enable shopping-list
systemctl restart shopping-list

echo "--- Deployment Complete ---"
echo "You can access the Shopping List at http://<LXC_IP_ADDRESS>:3000/"

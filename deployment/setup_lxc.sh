#!/bin/bash

# Shopping List App - LXC Setup Script
# Run this script inside your Proxmox LXC container (Debian/Ubuntu)

set -e

APP_DIR="/var/www/html/shopping-list"
SOURCE_DIR=$(pwd)

echo "Updating package list..."
apt-get update

echo "Installing Nginx..."
apt-get install -y nginx

echo "Creating application directory at $APP_DIR..."
mkdir -p $APP_DIR

echo "Copying application files..."
# Assuming the script is run from the root of the repo or deployment dir
# We try to find the files relative to the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/index.html" ]; then
    cp "$PROJECT_ROOT/index.html" "$PROJECT_ROOT/style.css" "$PROJECT_ROOT/app.js" $APP_DIR/
else
    echo "Error: Could not find application files in $PROJECT_ROOT"
    exit 1
fi

echo "Setting permissions..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

echo "Configuring Nginx..."
# Create a simple Nginx config for the app
cat > /etc/nginx/sites-available/shopping-list <<EOF
server {
    listen 80;
    server_name _;

    root $APP_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/shopping-list /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "Restarting Nginx..."
systemctl restart nginx

echo "Deployment complete!"
echo "You can access the Shopping List at http://<LXC_IP_ADDRESS>/"

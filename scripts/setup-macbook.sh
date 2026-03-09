#!/bin/bash
# CtxDesk MacBook Setup Script
# Run this ONCE on the MacBook to install and configure CtxDesk
# Usage: bash setup-macbook.sh
set -e

CTXDESK_DIR="$HOME/Desktop/Claude Code/ctxdesk"
MACSTUDIO_IP="${MACSTUDIO_IP:-}"  # Set your Mac Studio LAN IP (e.g. export MACSTUDIO_IP=192.0.2.10)
MACSTUDIO_PORT="3002"
LOCAL_PORT="3003"  # MacBook runs on 3003 to avoid conflict if connected via LAN

echo "╔══════════════════════════════════════════╗"
echo "║   CtxDesk — MacBook Setup                ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Check prerequisites
echo "→ Checking Node.js..."
if ! command -v node &>/dev/null; then
    echo "  ✗ Node.js not found. Installing via Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    brew install node
fi
echo "  ✓ Node.js $(node -v)"

echo "→ Checking npm..."
npm -v > /dev/null 2>&1 && echo "  ✓ npm $(npm -v)"

echo "→ Checking PM2..."
if ! command -v pm2 &>/dev/null; then
    echo "  Installing PM2..."
    npm install -g pm2
fi
echo "  ✓ PM2 $(pm2 -v)"

# 2. Clone or update repo
echo ""
echo "→ Setting up CtxDesk..."
PARENT_DIR="$HOME/Desktop/Claude Code"
mkdir -p "$PARENT_DIR"

if [ -d "$CTXDESK_DIR/.git" ]; then
    echo "  → Updating existing installation..."
    cd "$CTXDESK_DIR"
    git pull origin main
else
    echo "  → Cloning from GitHub..."
    cd "$PARENT_DIR"
    git clone https://github.com/renefichtmueller/ctxdesk.git ctxdesk
    cd "$CTXDESK_DIR"
fi

# 3. Install dependencies
echo ""
echo "→ Installing dependencies..."
npm install --silent

# 4. Set up MacBook-specific ecosystem config
echo ""
echo "→ Creating MacBook PM2 config..."
cat > "$CTXDESK_DIR/ecosystem.macbook.js" << PMEOF
// CtxDesk PM2 Config — MacBook (Port 3003)
const path = require("path");
const CTXDESK_DIR = __dirname;
module.exports = {
  apps: [
    {
      name: "ctxdesk-macbook",
      script: "node_modules/.bin/next",
      args: "start --port 3003",
      cwd: CTXDESK_DIR,
      env: {
        PORT: 3003,
        HOSTNAME: "0.0.0.0",
        NODE_ENV: "production",
        DATABASE_URL: \`file:\${CTXDESK_DIR}/dev.db\`,
        APP_ROOT: CTXDESK_DIR,
        DEVICE: "macbook",
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
PMEOF

# 5. Run Prisma setup
echo ""
echo "→ Setting up database..."
npx prisma generate
npx prisma db push --accept-data-loss

# 6. Build for production
echo ""
echo "→ Building CtxDesk (this takes 1-2 minutes)..."
npm run build

# 7. Initial DB sync from Mac Studio (if on same network)
echo ""
echo "→ Trying initial data sync from Mac Studio..."
if ping -c 1 -W 2 "$MACSTUDIO_IP" &>/dev/null; then
    echo "  ✓ Mac Studio reachable — syncing database..."
    rsync -avz --progress \
        "${MACSTUDIO_USER:-$(whoami)}@$MACSTUDIO_IP:$CTXDESK_DIR/dev.db" \
        "$CTXDESK_DIR/dev.db" 2>/dev/null && echo "  ✓ Database synced!" || echo "  ⚠ Sync failed (SSH not configured?) — using fresh DB"
else
    echo "  ⚠ Mac Studio not reachable — starting with empty DB"
    echo "    Run sync manually when on the same network: bash scripts/sync-db.sh"
fi

# 8. Set up auto-sync launchd job
echo ""
echo "→ Setting up auto-sync (every 5 minutes)..."
PLIST_PATH="$HOME/Library/LaunchAgents/com.ctxdesk.dbsync.plist"
cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ctxdesk.dbsync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$CTXDESK_DIR/scripts/sync-db.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$CTXDESK_DIR/logs/sync.log</string>
    <key>StandardErrorPath</key>
    <string>$CTXDESK_DIR/logs/sync-error.log</string>
</dict>
</plist>
PLIST

launchctl load "$PLIST_PATH" 2>/dev/null && echo "  ✓ Auto-sync activated" || echo "  ⚠ Could not load launchd job (run manually)"

# 9. Start CtxDesk
echo ""
echo "→ Starting CtxDesk..."
pm2 start ecosystem.macbook.js
pm2 save

# 10. Set PM2 to start on login
echo ""
echo "→ Setting up PM2 startup..."
pm2 startup | tail -2

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅ CtxDesk MacBook Setup Complete!             ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  MacBook:  http://localhost:3003                 ║"
echo "║  Mac Studio: http://$MACSTUDIO_IP:$MACSTUDIO_PORT           ║"
echo "║                                                  ║"
echo "║  DB Sync:  alle 5 Minuten automatisch            ║"
echo "║  Manuell:  bash scripts/sync-db.sh               ║"
echo "║                                                  ║"
echo "║  Code Update:  git pull && npm run build         ║"
echo "║               pm2 restart ctxdesk-macbook       ║"
echo "╚══════════════════════════════════════════════════╝"

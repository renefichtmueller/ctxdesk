#!/bin/bash
# CtxDesk Update Script — Runs on both Mac Studio and MacBook
# Pulls latest code, rebuilds, restarts PM2
# Usage: bash scripts/update.sh

CTXDESK_DIR="/Users/user/Desktop/Claude Code/ctxdesk"
DEVICE="${1:-$(hostname)}"

echo "╔══════════════════════════════════════╗"
echo "║   CtxDesk Update — $DEVICE"
echo "╚══════════════════════════════════════╝"

cd "$CTXDESK_DIR"

echo "→ Pulling latest code..."
git pull origin main

echo "→ Installing dependencies..."
npm install --silent

echo "→ Regenerating Prisma client..."
npx prisma generate

echo "→ Updating database schema..."
npx prisma db push --accept-data-loss

echo "→ Building..."
npm run build

echo "→ Restarting PM2..."
if pm2 list | grep -q "ctxdesk-macbook"; then
    pm2 restart ctxdesk-macbook
elif pm2 list | grep -q "ctxdesk"; then
    pm2 restart ctxdesk
else
    echo "  ⚠ No PM2 process found — start manually"
fi

echo ""
echo "✅ Update complete!"
pm2 list | grep -E "ctxdesk|online"

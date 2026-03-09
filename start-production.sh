#!/bin/bash
# CtxDesk Production Start Script
# Runs the standalone Next.js build on port 3002

# Resolve script directory (works regardless of where it's installed)
CTXDESK_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$CTXDESK_DIR"

# Ensure static files are up-to-date after build
cp -r .next/static .next/standalone/.next/static 2>/dev/null

export PORT=3002
export HOSTNAME=0.0.0.0
export NODE_ENV=production
export DATABASE_URL="file:${CTXDESK_DIR}/dev.db"
export APP_ROOT="$CTXDESK_DIR"

exec /opt/homebrew/bin/node .next/standalone/server.js

#!/bin/bash
# CtxDesk Production Start Script
# Runs the standalone Next.js build on port 3002

cd "/Users/user/Desktop/Claude Code/ctxdesk"

# Ensure static files are up-to-date after build
cp -r .next/static .next/standalone/.next/static 2>/dev/null

export PORT=3002
export HOSTNAME=0.0.0.0
export NODE_ENV=production
export DATABASE_URL="file:/Users/user/Desktop/Claude Code/ctxdesk/dev.db"

exec /opt/homebrew/bin/node .next/standalone/server.js

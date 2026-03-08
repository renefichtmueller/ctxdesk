#!/bin/bash
# CtxDesk Sync — MacStudio → MacBook
# Probiert erst VPN (10.10.0.3), fällt zurück auf LAN (192.0.2.10)

SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes"
REMOTE_PATH="/Users/user/Desktop/Claude Code/ctxdesk"
LOCAL="/Users/user/Desktop/Claude Code/ctxdesk"

QUEUE_FILE="${LOCAL}/CLAUDE_QUEUE.md"
PREV_HASH_FILE="/tmp/ctxdesk-queue.md5"
TRIGGER_LOCK="/tmp/ctxdesk-claude-trigger.lock"

# Erreichbares MacBook-Host bestimmen (VPN first, LAN fallback)
MACBOOK_HOST=""
if ssh ${SSH_OPTS} -o ConnectTimeout=3 renefichtmueller@10.10.0.3 "exit" 2>/dev/null; then
  MACBOOK_HOST="10.10.0.3"
elif ssh ${SSH_OPTS} -o ConnectTimeout=3 renefichtmueller@192.0.2.10 "exit" 2>/dev/null; then
  MACBOOK_HOST="192.0.2.10"
fi

if [ -z "$MACBOOK_HOST" ]; then
  echo "$(date): MacBook nicht erreichbar (VPN + LAN)" >> /tmp/ctxdesk-sync.log
  exit 0
fi

REMOTE="${MACBOOK_HOST}"

# CLAUDE_QUEUE.md vom MacBook holen
rsync -az --timeout=8 -e "ssh ${SSH_OPTS}" \
  "renefichtmueller@${REMOTE}:${REMOTE_PATH}/CLAUDE_QUEUE.md" "${QUEUE_FILE}" 2>/dev/null

# inbox/*.md zum MacBook pushen
rsync -az --timeout=8 -e "ssh ${SSH_OPTS}" \
  --include="*.md" --exclude="processed/" --exclude="*" \
  "${LOCAL}/inbox/" "renefichtmueller@${REMOTE}:${REMOTE_PATH}/inbox/" 2>/dev/null

# Änderung erkennen + Claude triggern
if [ -f "${QUEUE_FILE}" ]; then
  CURRENT_HASH=$(md5 -q "${QUEUE_FILE}" 2>/dev/null)
  PREV_HASH=$(cat "${PREV_HASH_FILE}" 2>/dev/null)

  if [ "${CURRENT_HASH}" != "${PREV_HASH}" ]; then
    echo "${CURRENT_HASH}" > "${PREV_HASH_FILE}"
    VIA="LAN"
    [ "$MACBOOK_HOST" = "10.10.0.3" ] && VIA="VPN"
    echo "$(date): Queue geändert via ${VIA} (${MACBOOK_HOST})" >> /tmp/ctxdesk-sync.log

    if grep -q "^\- \[ \]" "${QUEUE_FILE}"; then
      osascript -e "display notification \"Queue geändert — offene Tickets vorhanden\" with title \"CtxDesk Sync\" subtitle \"via ${VIA}\"" 2>/dev/null

      if [ ! -f "${TRIGGER_LOCK}" ]; then
        touch "${TRIGGER_LOCK}"
        osascript << 'APPLESCRIPT'
tell application "Terminal"
  activate
  set newTab to do script "cd '/Users/user/Desktop/Claude Code/ctxdesk' && echo '=== CtxDesk Queue ===' && cat CLAUDE_QUEUE.md && echo '' && claude"
end tell
APPLESCRIPT
        (sleep 60 && rm -f "${TRIGGER_LOCK}") &
      fi
    fi
  fi
fi

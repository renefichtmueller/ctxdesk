#!/bin/bash
# CtxDesk Sync — MacStudio → MacBook
# Tries VPN first, falls back to LAN. Set env vars before running:
#   export MACBOOK_IP_VPN=10.x.x.x   (WireGuard/VPN IP of MacBook)
#   export MACBOOK_IP_LAN=192.168.x.x (LAN IP of MacBook)
#   export SYNC_USER=$(whoami)         (SSH username, default: current user)

SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes"
REMOTE_PATH="${HOME}/Desktop/Claude Code/ctxdesk"
LOCAL="${HOME}/Desktop/Claude Code/ctxdesk"
SYNC_USER="${SYNC_USER:-$(whoami)}"
MACBOOK_IP_VPN="${MACBOOK_IP_VPN:-}"   # Set via env: export MACBOOK_IP_VPN=10.x.x.x
MACBOOK_IP_LAN="${MACBOOK_IP_LAN:-}"   # Set via env: export MACBOOK_IP_LAN=192.168.x.x

QUEUE_FILE="${LOCAL}/CLAUDE_QUEUE.md"
PREV_HASH_FILE="/tmp/ctxdesk-queue.md5"
TRIGGER_LOCK="/tmp/ctxdesk-claude-trigger.lock"

# Erreichbares MacBook-Host bestimmen (VPN first, LAN fallback)
MACBOOK_HOST=""
if [ -n "$MACBOOK_IP_VPN" ] && ssh ${SSH_OPTS} -o ConnectTimeout=3 "${SYNC_USER}@${MACBOOK_IP_VPN}" "exit" 2>/dev/null; then
  MACBOOK_HOST="$MACBOOK_IP_VPN"
elif [ -n "$MACBOOK_IP_LAN" ] && ssh ${SSH_OPTS} -o ConnectTimeout=3 "${SYNC_USER}@${MACBOOK_IP_LAN}" "exit" 2>/dev/null; then
  MACBOOK_HOST="$MACBOOK_IP_LAN"
fi

if [ -z "$MACBOOK_HOST" ]; then
  echo "$(date): MacBook nicht erreichbar (VPN + LAN)" >> /tmp/ctxdesk-sync.log
  exit 0
fi

REMOTE="${MACBOOK_HOST}"

# CLAUDE_QUEUE.md vom MacBook holen
rsync -az --timeout=8 -e "ssh ${SSH_OPTS}" \
  "${SYNC_USER}@${REMOTE}:${REMOTE_PATH}/CLAUDE_QUEUE.md" "${QUEUE_FILE}" 2>/dev/null

# inbox/*.md zum MacBook pushen
rsync -az --timeout=8 -e "ssh ${SSH_OPTS}" \
  --include="*.md" --exclude="processed/" --exclude="*" \
  "${LOCAL}/inbox/" "${SYNC_USER}@${REMOTE}:${REMOTE_PATH}/inbox/" 2>/dev/null

# Änderung erkennen + Claude triggern
if [ -f "${QUEUE_FILE}" ]; then
  CURRENT_HASH=$(md5 -q "${QUEUE_FILE}" 2>/dev/null)
  PREV_HASH=$(cat "${PREV_HASH_FILE}" 2>/dev/null)

  if [ "${CURRENT_HASH}" != "${PREV_HASH}" ]; then
    echo "${CURRENT_HASH}" > "${PREV_HASH_FILE}"
    VIA="LAN"
    [ "$MACBOOK_HOST" = "$MACBOOK_IP_VPN" ] && VIA="VPN"
    echo "$(date): Queue geändert via ${VIA} (${MACBOOK_HOST})" >> /tmp/ctxdesk-sync.log

    if grep -q "^\- \[ \]" "${QUEUE_FILE}"; then
      osascript -e "display notification \"Queue geändert — offene Tickets vorhanden\" with title \"CtxDesk Sync\" subtitle \"via ${VIA}\"" 2>/dev/null

      if [ ! -f "${TRIGGER_LOCK}" ]; then
        touch "${TRIGGER_LOCK}"
        CTXDESK_PATH="${LOCAL}"
        osascript -e "tell application \"Terminal\" to activate" \
          -e "tell application \"Terminal\" to do script \"cd '${CTXDESK_PATH}' && echo '=== CtxDesk Queue ===' && cat CLAUDE_QUEUE.md && echo '' && claude\"" 2>/dev/null
        (sleep 60 && rm -f "${TRIGGER_LOCK}") &
      fi
    fi
  fi
fi

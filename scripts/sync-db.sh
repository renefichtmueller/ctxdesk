#!/bin/bash
# CtxDesk DB Sync Script
# Syncs SQLite database between Mac Studio (primary) and MacBook (secondary)
# - When Mac Studio is reachable: Sync in both directions (newer wins)
# - When offline: Continue working with local DB
# Run automatically via launchd every 5 minutes, or manually

MACSTUDIO_IP="${MACSTUDIO_IP:-}"              # Set via env: export MACSTUDIO_IP=192.168.x.x
MACSTUDIO_USER="${MACSTUDIO_USER:-$(whoami)}" # Set via env: export MACSTUDIO_USER=yourusername
MACSTUDIO_DB_PATH="${HOME}/Desktop/Claude Code/ctxdesk/dev.db"
LOCAL_DB_PATH="${HOME}/Desktop/Claude Code/ctxdesk/dev.db"
BACKUP_DIR="${HOME}/Desktop/Claude Code/ctxdesk/db-backups"
LOG_FILE="${HOME}/Desktop/Claude Code/ctxdesk/logs/sync.log"
DEVICE="${DEVICE:-macbook}"  # Set DEVICE=macstudio on Mac Studio

mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if Mac Studio is reachable
if ! ping -c 1 -W 2 "$MACSTUDIO_IP" &>/dev/null; then
    log "⚡ Offline — Mac Studio nicht erreichbar, arbeite lokal"
    exit 0
fi

# Check SSH connectivity
if ! ssh -o ConnectTimeout=3 -o BatchMode=yes "$MACSTUDIO_USER@$MACSTUDIO_IP" "echo ok" &>/dev/null; then
    log "⚠ Mac Studio ping OK aber SSH nicht verfügbar"
    exit 0
fi

log "✅ Mac Studio erreichbar — starte DB-Sync"

# Get timestamps of both DBs
REMOTE_MTIME=$(ssh "$MACSTUDIO_USER@$MACSTUDIO_IP" "stat -f %m '$MACSTUDIO_DB_PATH' 2>/dev/null || echo 0")
LOCAL_MTIME=$(stat -f %m "$LOCAL_DB_PATH" 2>/dev/null || echo 0)

log "Local DB: $(date -r $LOCAL_MTIME '+%d.%m %H:%M') | Remote DB: $(date -r $REMOTE_MTIME '+%d.%m %H:%M')"

if [ "$DEVICE" = "macstudio" ]; then
    # On Mac Studio: Push to MacBook (if MacBook is reachable)
    MACBOOK_IP="${MACBOOK_IP:-}"  # Set via env: export MACBOOK_IP=192.168.x.x
    if ping -c 1 -W 2 "$MACBOOK_IP" &>/dev/null; then
        log "→ Pushing DB to MacBook (.${MACBOOK_IP##*.})..."
        # Backup MacBook DB first
        ssh "$MACSTUDIO_USER@$MACBOOK_IP" "cp '$LOCAL_DB_PATH' '${LOCAL_DB_PATH}.backup-$(date +%Y%m%d-%H%M)' 2>/dev/null || true"
        rsync -az --checksum \
            "$LOCAL_DB_PATH" \
            "$MACSTUDIO_USER@$MACBOOK_IP:$LOCAL_DB_PATH"
        log "✓ DB pushed to MacBook"
    fi
else
    # On MacBook: Merge with Mac Studio
    # Simple strategy: Newer DB wins
    # But we also keep a backup so nothing is lost

    # Backup local DB
    BACKUP_FILE="$BACKUP_DIR/dev.db.$(date +%Y%m%d-%H%M)"
    cp "$LOCAL_DB_PATH" "$BACKUP_FILE" 2>/dev/null || true

    # Keep only last 20 backups
    ls -t "$BACKUP_DIR"/*.db.* 2>/dev/null | tail -n +21 | xargs rm -f 2>/dev/null || true

    if [ "$REMOTE_MTIME" -gt "$LOCAL_MTIME" ]; then
        # Mac Studio is newer — pull
        log "→ Mac Studio ist neuer — ziehe Änderungen..."
        rsync -az --checksum \
            "$MACSTUDIO_USER@$MACSTUDIO_IP:$MACSTUDIO_DB_PATH" \
            "${LOCAL_DB_PATH}.tmp"

        # Only replace if valid SQLite file
        if sqlite3 "${LOCAL_DB_PATH}.tmp" "SELECT count(*) FROM sqlite_master;" &>/dev/null; then
            mv "${LOCAL_DB_PATH}.tmp" "$LOCAL_DB_PATH"
            log "✓ DB aktualisiert von Mac Studio"
        else
            rm -f "${LOCAL_DB_PATH}.tmp"
            log "✗ Remote DB ungültig — behalte lokale DB"
        fi
    elif [ "$LOCAL_MTIME" -gt "$REMOTE_MTIME" ]; then
        # MacBook is newer — push to Mac Studio
        log "→ MacBook ist neuer — sende Änderungen zu Mac Studio..."
        rsync -az --checksum \
            "$LOCAL_DB_PATH" \
            "$MACSTUDIO_USER@$MACSTUDIO_IP:$MACSTUDIO_DB_PATH"
        log "✓ DB gesendet an Mac Studio"
    else
        log "✓ Beide DBs synchron — nichts zu tun"
    fi
fi

# Also sync queue files (read-only from Mac Studio)
if [ "$DEVICE" != "macstudio" ]; then
    for qfile in "CLAUDE_QUEUE.md" "CHATGPT_QUEUE.md" "COPILOT_QUEUE.md"; do
        rsync -az --checksum \
            "$MACSTUDIO_USER@$MACSTUDIO_IP:$MACSTUDIO_DB_PATH/../$qfile" \
            "$LOCAL_DB_PATH/../$qfile" 2>/dev/null || true
    done
    log "✓ Queue-Dateien synchronisiert"
fi

log "Sync abgeschlossen."

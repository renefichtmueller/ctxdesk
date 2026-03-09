# Changelog

All notable changes to CtxDesk are documented here.

## [Unreleased]

## [0.6.0] – 2026-03-09

### Fixed
- **Progress API: `status` field was silently ignored** — `POST /api/tickets/progress` now correctly
  handles the `status` body field that the Claude Code scheduled task sends. Sending
  `status: "done"` marks the ticket as completed (`status=done`, `isActivated=false`,
  `completedAt` set) and returns `{ completed: true, deactivated: true }`. Previously the field
  was destructured but never applied, causing processed tickets to remain in the AI queue forever.

### Changed
- **Auto-status on ticket activation** — Activating a ticket (`isActivated: true`) now
  automatically promotes its status from `todo` → `in_progress`. Deactivating it reverts
  `in_progress` → `todo`. Status is not changed if it is already `in_progress` or `done`.
- **LiveLog level for completed tickets** — Progress entries with `status: "done"` are logged
  at level `success` instead of `info` and include a ✅ suffix in the message.

## [0.5.0] – 2026-03-08

### Added
- Time tracking per ticket (start/stop timer, notes, total time display)
- Ticket dependencies (blocks / is blocked by)
- Daily Digest page with LLM-generated morning briefing
- MCP server for Claude Desktop integration (`npx @modelcontextprotocol/server-ctxdesk`)
- Globalping.io network diagnostics page

### Changed
- Public GitHub release: removed all hardcoded IPs, usernames, and absolute paths
- Added `.env.example` with all required environment variables documented
- Rewrote README for public audience

## [0.4.0] – 2026-03-05

### Added
- AI Queue integration: `CLAUDE_QUEUE.md` auto-generated from activated tickets
- Claude Code scheduled task support via `POST /api/tickets/progress`
- Live Log page with real-time progress stream
- Inbox watcher for markdown file drop-in ticket creation

### Changed
- Ticket activation flow: `isActivated` flag + `activatedAt` timestamp

## [0.3.0] – 2026-02-28

### Added
- Agenda-based ticket grouping within projects
- Priority levels (Critical / High / Normal / Low) with visual indicators
- Ticket types (task, bug, feature, research)
- Changelog page aggregating completed tickets per agenda

## [0.2.0] – 2026-02-20

### Added
- Project management with color + icon picker
- Ticket CRUD with drag-and-drop ordering
- Dark theme UI (slate-900 base)
- SQLite database via Prisma + better-sqlite3 adapter

## [0.1.0] – 2026-02-10

### Added
- Initial project scaffold (Next.js 16, TypeScript, Prisma 7, SQLite)
- Basic ticket board

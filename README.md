# CtxDesk — AI-Native Ticket & Project Management

> Personal project & ops dashboard built for the [Example Org](https://example.com) ecosystem. Dark-theme, local-AI-first, SQLite-powered.

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-teal?logo=prisma)](https://prisma.io)
[![SQLite](https://img.shields.io/badge/SQLite-3-green?logo=sqlite)](https://sqlite.org)
[![Ollama](https://img.shields.io/badge/Ollama-local_AI-orange)](https://ollama.ai)

---

## What is CtxDesk?

CtxDesk is an AI-assisted ticket and project management system built for personal/team ops workflows. It integrates with local LLMs (Ollama, LM Studio) for task analysis, prioritization, and AI-driven queue management. Designed for the Example Org NOG community platform ecosystem.

**Key philosophy:**
- 🔒 **Local-first** — All LLM inference runs locally via Ollama or LM Studio. No cloud AI calls.
- 🗂️ **SQLite** — Single-file database. No PostgreSQL needed. Runs anywhere.
- 🌑 **Dark-theme native** — `#060b14` base, `#a855f7` primary accent.
- ⚡ **Claude Code integration** — Designed to be operated by Claude Code agents via `CLAUDE_QUEUE.md`.

---

## Features

### 🎫 Ticket System
- Full CRUD for tickets with **5 statuses**: `backlog → todo → in_progress → in_review → done`
- Priority levels: P0 (Critical) · P1 (High) · P2 (Normal) · P3 (Low)
- Ticket types: Feature · Bug · Task · Improvement · Research
- **Kanban board** with drag-and-drop ordering and mouseover preview cards
- **Ticket detail view** with edit form, AI analysis panel, attachments

### 🤖 AI Integration (Local LLM)
- **Ollama** support (llama3, nomic-embed-text, etc.) — local inference on Mac Studio
- **LM Studio** support — alternative local AI backend (MacBook-friendly)
- **Remote Ollama** via Cloudflare Tunnel — access Mac Studio models from anywhere
- **Auto-fallback**: local Ollama → remote Ollama tunnel
- **KI-Analyse**: AI analysis of ticket content on task start
- **KI-Assistent chat**: In-ticket LLM chat panel with streaming responses
- **Model recommendations**: suggests best model per ticket type (research, coding, etc.)
- **Multi-language translation** of ticket content

### 🚀 Publish / Deploy Button
- Tickets in `in_review` status show a **"Bestätigen & Live"** button
- **Example Org Website** tickets → triggers `npx wrangler pages deploy` to Cloudflare Pages
- **CtxPost** tickets → marks LinkedIn posts as published
- Deploy output streamed live in the ticket detail view
- Auto-moves ticket to `done` + creates changelog entry on success

### 📋 CLAUDE_QUEUE.md
- Auto-generated markdown file listing all active tickets
- Consumed by Claude Code agents for autonomous task execution
- Regenerated on every status/activation change
- Contains ticket context, claude-specific hints, priority order

### 📁 Projects & Agendas
- Hierarchical: **Projects** → **Agendas** → **Tickets**
- Projects: Example Org Website · CtxDesk · CtxEvent · CtxPOst · (+ any custom)
- Per-project Kanban board with drag-and-drop
- Agenda-level status tracking

### 📥 Inbox (Agenda Sync)
- Watches a configured directory for new `.md` files
- AI-parses incoming files to extract title, project hint, priority
- Creates tickets automatically from parsed inbox items
- Shows unread count in sidebar

### 📊 Live Log
- Real-time activity stream: ticket activations, AI analysis runs, publish events, errors
- Filterable by level (info/warn/error) and category
- Persisted in DB for audit trail

### 📈 Changelog
- Auto-generated changelog entries when tickets move to `done`
- Timeline view with project/agenda context
- Markdown-rendered content
- Feeds into example.com public changelog (via Cloudflare Pages deploy)

### 📎 Attachments
- Per-ticket file uploads: images, PDFs, documents
- **Screenshot paste** via Ctrl+V directly into ticket view
- Drag & drop upload zone
- Files stored as Base64 in SQLite

### ⚙️ Settings
- LLM provider configuration (Ollama URL, LM Studio port, API keys)
- Remote Ollama tunnel setup (for away-from-desk access)
- Model preferences per use case

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| ORM | Prisma 6 + SQLite adapter |
| Database | SQLite 3 (single `dev.db` file) |
| UI | Tailwind CSS + Radix UI primitives |
| Icons | Lucide React |
| Toasts | Sonner |
| AI | Ollama (local) + LM Studio (local) |
| Deploy | Self-hosted (PM2 + Node.js) or Cloudflare Tunnel |

---

## Getting Started

### Prerequisites
- Node.js 20+
- [Ollama](https://ollama.ai) installed and running (optional but recommended)

### Installation

```bash
git clone https://github.com/renefichtmueller/ctxdesk.git
cd ctxdesk
npm install
```

### Database Setup

```bash
npx prisma db push
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

Or with PM2:
```bash
pm2 start npm --name ctxdesk -- start
```

---

## Project Structure

```
ctxdesk/
├── app/
│   ├── (dashboard)/           # Main UI routes
│   │   ├── changelog/         # Changelog timeline
│   │   ├── inbox/             # Agenda sync inbox
│   │   ├── live-log/          # Activity stream
│   │   ├── projects/          # Project + Agenda views
│   │   │   └── [id]/agendas/[agendaId]/  # Kanban board
│   │   ├── queue/             # CLAUDE_QUEUE.md viewer
│   │   ├── settings/          # LLM configuration
│   │   └── tickets/[id]/      # Ticket detail view
│   └── api/
│       ├── agenda-sync/       # Inbox parsing endpoint
│       ├── llm/               # LLM proxy (chat, models, recommend, translate)
│       ├── tickets/
│       │   ├── [id]/          # Ticket CRUD
│       │   ├── [id]/attachments/  # File management
│       │   ├── [id]/publish/  # Deploy/publish action
│       │   └── progress/      # Claude Code progress updates
│       ├── context/           # Claude context save
│       └── live-log/          # Activity log endpoint
├── actions/                   # Next.js Server Actions
├── components/                # Reusable UI components
├── lib/
│   ├── prisma.ts              # Prisma client
│   ├── llm-client.ts          # LLM provider abstraction
│   ├── queue-generator.ts     # CLAUDE_QUEUE.md generator
│   └── constants.ts           # Status labels, colors, types
└── prisma/
    └── schema.prisma          # DB schema
```

---

## Claude Code Integration

CtxDesk is designed to work hand-in-hand with Claude Code. The `CLAUDE_QUEUE.md` file is auto-generated and contains all active tickets in priority order:

```markdown
# Claude Queue — CtxDesk
> 3 active tickets · Last updated: 2026-03-09 10:30

## [P1] MCP Server — Claude Desktop & Cursor Integration
Status: todo | Agenda: CtxDesk > Features
...
```

Claude Code agents can:
1. Read `CLAUDE_QUEUE.md` to understand what to work on
2. POST to `/api/tickets/progress` to log progress
3. POST to `/api/tickets/[id]` to update status
4. POST to `/api/tickets/[id]/publish` to trigger deployments

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+V` | Paste screenshot as ticket attachment |
| `Enter` | Send message in AI chat panel |

---

## Part of Example Org

CtxDesk is part of the [Example Org](https://example.com) ecosystem — an open-source platform for Network Operator Groups (NOGs) built by the community.

**Related projects:**
- [CtxEvent](https://github.com/renefichtmueller/ctxevent) — Event management for NOGs
- [example.com](https://example.com) — Product website

---

## License

MIT — Built by [@renefichtmueller](https://github.com/renefichtmueller) for the NOG community.

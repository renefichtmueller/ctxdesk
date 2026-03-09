<div align="center">

# CtxDesk

**AI-native project & ops management — built to be operated by Claude Code agents**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Ollama](https://img.shields.io/badge/Ollama-local_AI-FF6B35)](https://ollama.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-a855f7.svg)](LICENSE)

*No Jira. No Notion. No cloud AI. Just a dark-themed Kanban board that your AI agent can actually drive.*

</div>

---

## What is this?

CtxDesk is a self-hosted ticket and project management system with one unusual design goal: **it's built to be operated by AI agents, not just humans.**

When you activate a ticket, CtxDesk regenerates a `CLAUDE_QUEUE.md` file. Claude Code picks it up, works through the tasks, and posts progress back via a REST API — while you're grabbing coffee or sleeping.

Everything runs locally. One SQLite file. No external services. No subscription.

---

## The AI Queue — How It Works

```
You activate tickets in CtxDesk
        ↓
CLAUDE_QUEUE.md is auto-regenerated
        ↓
Claude Code agent reads the queue (scheduled every 10 min)
        ↓
Agent works through tasks, posts progress to /api/tickets/progress
        ↓
You see results in the Live Log
```

The queue file contains all activated tickets with priority order, context hints, and project metadata — exactly what an AI agent needs to work autonomously.

```markdown
## ⚡ ACTIVATED — Work on these now

- [ ] **[ABC123]** Add rate limiting to nginx proxy
  - Agenda: Security Hardening · Project: Infrastructure
  - Last update [14:32]: Implemented limit_req_zone 10r/min...
```

---

## Features

### Kanban Board
Drag-and-drop board with 5 stages: `backlog → todo → in_progress → in_review → done`. Mouseover cards show full ticket context without opening the detail view.

### AI Integration (100% Local)
- **Ollama** — runs your local models (Llama 3, Qwen, Mistral, custom fine-tunes)
- **LM Studio** — MacBook-friendly alternative backend
- **Remote Ollama** via Cloudflare Tunnel — access your home GPU from anywhere
- In-ticket AI chat with streaming responses
- Auto-analysis when a ticket moves to `in_progress`
- Model recommendations per task type (coding vs. research vs. translation)

### Deploy Button
Tickets in `in_review` can trigger real deployments:
- **Cloudflare Pages** — runs `wrangler pages deploy` and streams the output live
- **Custom webhooks** — hook into any CI/CD system

### Live Log
Real-time activity stream of everything happening: ticket activations, AI analysis runs, deploy events, agent progress updates. Filterable, persisted, searchable.

### Inbox
Drop a `.md` file into a watched folder. CtxDesk parses it with local AI, extracts title/priority/project hints, and creates a ticket automatically.

### Attachments
Per-ticket file uploads. Paste a screenshot with `Ctrl+V` directly into the ticket view. Stored as Base64 in SQLite — no S3 bucket needed.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 App Router | Server Actions, streaming, edge-ready |
| Language | TypeScript 5 | Strict mode throughout |
| ORM | Prisma 6 + SQLite adapter | Single-file DB, zero config |
| UI | Tailwind CSS + Radix UI | Accessible primitives, dark theme |
| AI | Ollama / LM Studio | Local inference, no API keys required |
| Deploy | PM2 + Node.js | Self-hosted, ~50 MB RAM idle |

---

## Getting Started

```bash
git clone https://github.com/renefichtmueller/ctxdesk.git
cd ctxdesk
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — that's it. No Docker, no Postgres, no env file required to start.

### With AI (recommended)

Install [Ollama](https://ollama.ai) and pull a model:

```bash
ollama pull qwen2.5:7b
```

Then set the Ollama URL in CtxDesk Settings → AI → `http://localhost:11434`.

### Claude Code Integration

Add a scheduled task in Claude Code that reads `CLAUDE_QUEUE.md` and processes activated tickets:

```
Every 10 minutes:
  Read CLAUDE_QUEUE.md
  For each activated ticket:
    Check if already implemented → mark done
    Otherwise → implement, post progress to /api/tickets/progress
```

Progress API:
```bash
curl -X POST http://localhost:3000/api/tickets/progress \
  -H "Content-Type: application/json" \
  -d '{"ticketId": "abc123", "message": "Implemented rate limiting", "status": "done"}'
```

---

## Project Structure

```
ctxdesk/
├── app/
│   ├── (dashboard)/
│   │   ├── projects/[id]/agendas/[agendaId]/  # Kanban board
│   │   ├── tickets/[id]/                       # Ticket detail + AI chat
│   │   ├── live-log/                           # Activity stream
│   │   ├── queue/                              # CLAUDE_QUEUE.md viewer
│   │   └── settings/                           # LLM config
│   └── api/
│       ├── tickets/progress/                   # Agent progress endpoint
│       ├── tickets/[id]/publish/               # Deploy trigger
│       └── llm/                                # Local LLM proxy
├── lib/
│   ├── queue-generator.ts                      # CLAUDE_QUEUE.md generation
│   └── llm-client.ts                           # Ollama/LM Studio abstraction
└── prisma/schema.prisma                        # SQLite schema
```

---

## Design

Dark theme native. `#060b14` background, `#a855f7` accent. Built for people who live in terminals and don't want a blinding white project board at 2am.

No light mode. This is intentional.

---

## Why Not Jira / Linear / Notion?

Those tools are designed for humans clicking through a browser. CtxDesk is designed for humans **and** AI agents working together. The `CLAUDE_QUEUE.md` contract, the progress API, the deploy button — all of it exists to make AI-driven development loops possible without duct tape.

If you're running Claude Code agents that do real work on your projects, you want a ticket system that speaks their language.

---

## Part of Example Org

CtxDesk is part of the [Example Org](https://example.com) ecosystem — open-source tooling for Network Operator Groups (NOGs).

**Related:**
- [example.com](https://example.com) — the platform
- Built by [@renefichtmueller](https://github.com/renefichtmueller)

---

## License

MIT

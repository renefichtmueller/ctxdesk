import { writeFileSync } from "fs";
import { join } from "path";
import { PRIORITY_EMOJIS, PRIORITY_LABELS, QUEUE_FILE } from "./constants";

interface TicketWithRelations {
  id: string;
  title: string;
  priority: number;
  status: string;
  claudeContext: string | null;
  isActivated?: boolean;
  aiAssignee?: string | null;
  progressLog?: string | null;
  agenda: {
    name: string;
    project: {
      name: string;
    };
  };
}

function formatTicketBlock(ticket: TicketWithRelations, ai: string): string {
  const shortId = ticket.id.slice(-6).toUpperCase();
  let block = `- [ ] **[${shortId}]** ${ticket.title}\n`;

  if (ticket.claudeContext) {
    const lines = ticket.claudeContext.trim().split("\n");
    for (const line of lines) {
      if (line.trim()) block += `  - ${line.trim()}\n`;
    }
  }

  block += `  - Projekt: ${ticket.agenda.project.name} → ${ticket.agenda.name}\n`;

  // Add progress log if available
  if (ticket.progressLog) {
    try {
      const entries: { ts: string; msg: string }[] = JSON.parse(ticket.progressLog);
      if (entries.length > 0) {
        const last = entries[entries.length - 1];
        block += `  - Letzter Stand [${last.ts}]: ${last.msg}\n`;
      }
    } catch {}
  }

  return block;
}

export async function generateQueue(tickets?: TicketWithRelations[]): Promise<void> {
  // If tickets not provided, load from DB
  if (!tickets) {
    try {
      const { prisma } = await import("./prisma");
      tickets = await prisma.ticket.findMany({
        where: { agenda: { status: "active" }, status: { not: "done" } },
        include: { agenda: { include: { project: true } } },
        orderBy: [{ priority: "asc" }, { order: "asc" }],
      }) as TicketWithRelations[];
    } catch {
      tickets = [];
    }
  }

  const openTickets = tickets.filter(t => t.status !== "done");

  // Activated tickets go first
  const activatedTickets = openTickets.filter(t => t.isActivated);
  const regularTickets = openTickets.filter(t => !t.isActivated);

  // Group regular by priority
  const byPriority: Record<number, TicketWithRelations[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const ticket of regularTickets) {
    const p = ticket.priority ?? 2;
    if (byPriority[p]) byPriority[p].push(ticket);
  }

  const now = new Date().toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const totalOpen = openTickets.length;
  const projectCount = new Set(openTickets.map(t => t.agenda.project.name)).size;

  // ==========================================
  // 1. CLAUDE_QUEUE.md (Full context version)
  // ==========================================
  let claudeMd = `# CtxDesk — Claude Code Queue\n`;
  claudeMd += `> Generiert: ${now} | ${totalOpen} offene Tickets in ${projectCount} Projekt${projectCount !== 1 ? "en" : ""}\n`;
  claudeMd += `> Status-Update API: POST http://localhost:3002/api/tickets/progress\n`;
  claudeMd += `> Body: { "ticketId": "ID", "message": "Was du gerade machst", "aiAssignee": "claude" }\n\n`;

  if (activatedTickets.length > 0) {
    claudeMd += `## ⚡ AKTIVIERT — Sofort bearbeiten\n`;
    claudeMd += `> Diese Tickets wurden vom Nutzer explizit aktiviert. JETZT bearbeiten!\n\n`;
    for (const ticket of activatedTickets) {
      claudeMd += formatTicketBlock(ticket, "claude");
    }
    claudeMd += "\n";
  }

  const focus = activatedTickets[0] || openTickets.sort((a, b) => a.priority - b.priority)[0];
  if (focus) {
    claudeMd += `## 🎯 Aktiver Fokus\n`;
    claudeMd += `**Projekt:** ${focus.agenda.project.name} · **Agenda:** ${focus.agenda.name} (${PRIORITY_LABELS[focus.priority]})\n`;
    claudeMd += `**Ticket-ID:** ${focus.id}\n\n`;
  }

  for (const [pStr, items] of Object.entries(byPriority)) {
    const p = parseInt(pStr);
    if (items.length === 0) continue;
    claudeMd += `## ${PRIORITY_EMOJIS[p]} ${PRIORITY_LABELS[p]}\n`;
    for (const ticket of items) {
      claudeMd += formatTicketBlock(ticket, "claude");
    }
    claudeMd += "\n";
  }

  claudeMd += `---\n*CtxDesk · http://localhost:3002 · http://192.0.2.10:3002*\n`;

  // ==========================================
  // 2. CHATGPT_QUEUE.md (ChatGPT Desktop)
  // ==========================================
  let chatgptMd = `# Aufgaben-Queue für ChatGPT\n`;
  chatgptMd += `> Stand: ${now} | ${totalOpen} offene Tasks\n`;
  chatgptMd += `> Wenn du einen Task bearbeitest, schreibe eine .md Datei in: ctxdesk/inbox/\n`;
  chatgptMd += `> Format: ---\\nproject: PROJEKTNAME\\nagenda: AGENDANAME\\n---\\n# Status Update\\n[dein Update]\n\n`;

  if (activatedTickets.length > 0) {
    chatgptMd += `## 🔴 PRIORISIERT (vom Nutzer aktiviert)\n\n`;
    for (const t of activatedTickets) {
      chatgptMd += `### ${t.title}\n`;
      chatgptMd += `- **Projekt:** ${t.agenda.project.name}\n`;
      chatgptMd += `- **Gruppe:** ${t.agenda.name}\n`;
      chatgptMd += `- **Priorität:** ${PRIORITY_LABELS[t.priority]}\n`;
      if (t.claudeContext) chatgptMd += `- **Kontext:** ${t.claudeContext.slice(0, 200)}\n`;
      chatgptMd += "\n";
    }
  }

  for (const [pStr, items] of Object.entries(byPriority)) {
    const p = parseInt(pStr);
    if (items.length === 0) continue;
    chatgptMd += `## ${PRIORITY_LABELS[p]}\n\n`;
    for (const t of items) {
      chatgptMd += `- **${t.title}** (${t.agenda.project.name})\n`;
    }
    chatgptMd += "\n";
  }

  chatgptMd += `---\n*Generiert von CtxDesk · http://192.0.2.10:3002*\n`;

  // ==========================================
  // 3. COPILOT_QUEUE.md (Microsoft Copilot)
  // ==========================================
  let copilotMd = `# Aufgaben für Microsoft Copilot\n`;
  copilotMd += `> Stand: ${now} | ${totalOpen} Tasks\n\n`;

  if (activatedTickets.length > 0) {
    copilotMd += `## SOFORT BEARBEITEN\n\n`;
    for (const t of activatedTickets) {
      copilotMd += `**Task:** ${t.title}\n`;
      copilotMd += `**Wo:** ${t.agenda.project.name} > ${t.agenda.name}\n`;
      if (t.claudeContext) copilotMd += `**Kontext:** ${t.claudeContext.slice(0, 300)}\n`;
      copilotMd += "\n";
    }
  }

  copilotMd += `## Alle offenen Tasks\n\n`;
  for (const t of openTickets.slice(0, 20)) {
    copilotMd += `- [ ] ${t.title} (${t.agenda.project.name}, ${PRIORITY_LABELS[t.priority]})\n`;
  }
  if (openTickets.length > 20) {
    copilotMd += `\n*... und ${openTickets.length - 20} weitere Tasks*\n`;
  }

  copilotMd += `\n---\n*CtxDesk · Status-Updates an: http://192.0.2.10:3002/api/tickets/progress*\n`;

  // Write all queue files
  try {
    const appRoot = process.env.APP_ROOT ?? process.cwd();
    writeFileSync(join(appRoot, QUEUE_FILE), claudeMd, "utf-8");
    writeFileSync(join(appRoot, "CHATGPT_QUEUE.md"), chatgptMd, "utf-8");
    writeFileSync(join(appRoot, "COPILOT_QUEUE.md"), copilotMd, "utf-8");
  } catch (err) {
    console.error("[queue-generator] Failed to write queue files:", err);
  }
}

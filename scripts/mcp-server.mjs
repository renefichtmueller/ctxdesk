#!/usr/bin/env node
/**
 * CtxDesk MCP Server
 * Model Context Protocol server for Claude Desktop / Cursor / AI clients
 *
 * Exposes:
 *   - list_tickets       — alle aktiven Tickets (optional: status, project filter)
 *   - get_ticket         — Ticket-Detail mit Progress-Log
 *   - create_ticket      — neues Ticket anlegen
 *   - update_ticket      — Ticket bearbeiten (title, description, status, priority)
 *   - get_agenda         — Projekte und Agendas mit Ticket-Counts
 *   - search_tickets     — Volltextsuche
 *
 * Setup (Claude Desktop):
 *   ~/.claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "ctxdesk": {
 *         "command": "node",
 *         "args": ["/path/to/ctxdesk/scripts/mcp-server.mjs"]
 *       }
 *     }
 *   }
 *
 * Transport: stdio (stdin/stdout JSON-RPC 2.0)
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// ─── Database access via better-sqlite3 (direct, no Prisma runtime needed) ──
const Database = require("better-sqlite3");
const dbPath = join(__dirname, "..", "dev.db");

let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (err) {
  process.stderr.write(`[CtxDesk MCP] DB not found: ${err.message}\n`);
  process.exit(1);
}

// For writes, open a writable connection
let dbWrite;
try {
  dbWrite = new Database(dbPath);
} catch (err) {
  process.stderr.write(`[CtxDesk MCP] Write DB open failed: ${err.message}\n`);
}

// ─── MCP Protocol (stdio JSON-RPC 2.0) ───────────────────────────────────────

const SERVER_INFO = {
  name: "ctxdesk",
  version: "1.0.0",
  description: "CtxDesk Project & Ticket Management",
};

const TOOLS = [
  {
    name: "list_tickets",
    description: "Liste alle Tickets. Optional nach Status, Projekt oder Agenda filtern.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter: todo|in_progress|in_review|done|backlog (oder leer für alle aktiven)" },
        project: { type: "string", description: "Projektname oder ID (optional)" },
        limit: { type: "number", description: "Max. Ergebnisse (default: 30)" },
      },
    },
  },
  {
    name: "get_ticket",
    description: "Ticket-Details mit Beschreibung, Claude Context, Progress-Log und Abhängigkeiten.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Ticket-ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_ticket",
    description: "Neues Ticket in einer Agenda anlegen.",
    inputSchema: {
      type: "object",
      properties: {
        agendaId: { type: "string", description: "ID der Agenda (aus get_agenda holen)" },
        title: { type: "string", description: "Ticket-Titel" },
        description: { type: "string", description: "Beschreibung (Markdown)" },
        claudeContext: { type: "string", description: "Claude Context (Dateipfade, relevante Infos)" },
        priority: { type: "number", description: "0=kritisch, 1=hoch, 2=normal, 3=low (default: 2)" },
        type: { type: "string", description: "feature|bug|task|improvement|research (default: task)" },
      },
      required: ["agendaId", "title"],
    },
  },
  {
    name: "update_ticket",
    description: "Ticket-Felder aktualisieren (title, description, status, priority, claudeContext).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Ticket-ID" },
        title: { type: "string" },
        description: { type: "string" },
        claudeContext: { type: "string" },
        status: { type: "string", description: "todo|in_progress|in_review|done|backlog" },
        priority: { type: "number", description: "0-3" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_agenda",
    description: "Alle Projekte und Agendas mit Ticket-Counts und IDs. Nützlich um agendaId für create_ticket zu finden.",
    inputSchema: {
      type: "object",
      properties: {
        includeInactive: { type: "boolean", description: "Auch inaktive Projekte/Agendas einbeziehen" },
      },
    },
  },
  {
    name: "search_tickets",
    description: "Volltextsuche in Ticket-Titeln und Beschreibungen.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Suchbegriff" },
        limit: { type: "number", description: "Max. Ergebnisse (default: 10)" },
      },
      required: ["query"],
    },
  },
];

// ─── Tool Implementations ─────────────────────────────────────────────────────

function listTickets({ status, project, limit = 30 } = {}) {
  let where = "";
  const params = [];

  if (status && status !== "all") {
    where += " AND t.status = ?";
    params.push(status);
  } else if (!status) {
    where += " AND t.status != 'done'";
  }

  if (project) {
    where += " AND (p.name LIKE ? OR p.id = ?)";
    params.push(`%${project}%`, project);
  }

  const tickets = db.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.type, t.createdAt, t.updatedAt,
           a.name as agendaName, p.name as projectName, p.id as projectId
    FROM Ticket t
    JOIN Agenda a ON t.agendaId = a.id
    JOIN Project p ON t.projectId = p.id
    WHERE 1=1 ${where}
    ORDER BY t.priority ASC, t.updatedAt DESC
    LIMIT ?
  `).all(...params, limit);

  return tickets.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: ["🔴 P0-Kritisch", "🟠 P1-Hoch", "🟡 P2-Normal", "🔵 P3-Low"][t.priority] ?? t.priority,
    type: t.type,
    project: t.projectName,
    agenda: t.agendaName,
    updatedAt: t.updatedAt,
  }));
}

function getTicket({ id }) {
  const ticket = db.prepare(`
    SELECT t.*, a.name as agendaName, a.id as agendaId,
           p.name as projectName, p.id as projectId
    FROM Ticket t
    JOIN Agenda a ON t.agendaId = a.id
    JOIN Project p ON t.projectId = p.id
    WHERE t.id = ?
  `).get(id);

  if (!ticket) return { error: `Ticket ${id} nicht gefunden` };

  // Time tracking
  const timeEntries = db.prepare(`
    SELECT startedAt, endedAt, note FROM TimeEntry WHERE ticketId = ? ORDER BY startedAt DESC LIMIT 10
  `).all(id);

  const totalSeconds = timeEntries
    .filter(e => e.endedAt)
    .reduce((s, e) => s + Math.floor((new Date(e.endedAt) - new Date(e.startedAt)) / 1000), 0);

  // Dependencies
  const blockers = db.prepare(`
    SELECT t2.id, t2.title, t2.status FROM TicketDependency d
    JOIN Ticket t2 ON d.dependsOnId = t2.id WHERE d.ticketId = ?
  `).all(id);

  // Parse progress log
  let progressLog = null;
  if (ticket.progressLog) {
    try {
      const entries = JSON.parse(ticket.progressLog);
      progressLog = entries.slice(-3).map(e => `[${e.ts}] ${e.msg}`).join("\n");
    } catch {}
  }

  return {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    type: ticket.type,
    project: ticket.projectName,
    agenda: ticket.agendaName,
    description: ticket.description,
    claudeContext: ticket.claudeContext,
    isActivated: Boolean(ticket.isActivated),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    totalTimeHours: (totalSeconds / 3600).toFixed(1),
    timeEntries: timeEntries.slice(0, 3),
    blockers: blockers.length > 0 ? blockers : undefined,
    recentProgress: progressLog,
  };
}

function createTicket({ agendaId, title, description, claudeContext, priority = 2, type = "task" }) {
  if (!dbWrite) return { error: "DB write not available" };

  const agenda = db.prepare(`SELECT id, projectId FROM Agenda WHERE id = ?`).get(agendaId);
  if (!agenda) return { error: `Agenda ${agendaId} nicht gefunden` };

  const maxOrder = db.prepare(`SELECT MAX("order") as m FROM "Ticket" WHERE agendaId = ?`).get(agendaId);
  const order = (maxOrder?.m ?? -1) + 1;

  const id = `ctxmcp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  dbWrite.prepare(`
    INSERT INTO Ticket (id, agendaId, projectId, title, description, claudeContext, status, priority, type, "order", isActivated, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?, 0, ?, ?)
  `).run(id, agendaId, agenda.projectId, title, description ?? null, claudeContext ?? null, priority, type, order, now, now);

  return { id, title, status: "todo", priority, type, agendaId, message: "Ticket erstellt" };
}

function updateTicket({ id, title, description, claudeContext, status, priority }) {
  if (!dbWrite) return { error: "DB write not available" };

  const ticket = db.prepare(`SELECT id FROM Ticket WHERE id = ?`).get(id);
  if (!ticket) return { error: `Ticket ${id} nicht gefunden` };

  const now = new Date().toISOString();
  const fields = [];
  const vals = [];

  if (title !== undefined) { fields.push(`title = ?`); vals.push(title); }
  if (description !== undefined) { fields.push(`description = ?`); vals.push(description); }
  if (claudeContext !== undefined) { fields.push(`claudeContext = ?`); vals.push(claudeContext); }
  if (status !== undefined) { fields.push(`status = ?`); vals.push(status); }
  if (priority !== undefined) { fields.push(`priority = ?`); vals.push(priority); }

  if (fields.length === 0) return { message: "Keine Änderungen" };

  fields.push(`updatedAt = ?`);
  vals.push(now, id);

  dbWrite.prepare(`UPDATE Ticket SET ${fields.join(", ")} WHERE id = ?`).run(...vals);

  return { id, message: "Ticket aktualisiert", updatedFields: Object.keys({ title, description, claudeContext, status, priority }).filter(k => eval(k) !== undefined) };
}

function getAgenda({ includeInactive = false } = {}) {
  const projects = db.prepare(`
    SELECT p.id, p.name, p.color, p.status FROM Project p
    ${!includeInactive ? "WHERE p.status = 'active'" : ""}
    ORDER BY p."order" ASC
  `).all();

  return projects.map(p => {
    const agendas = db.prepare(`
      SELECT a.id, a.name, a.status,
             COUNT(t.id) as ticketCount,
             SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressCount,
             SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todoCount
      FROM Agenda a
      LEFT JOIN Ticket t ON t.agendaId = a.id AND t.status != 'done'
      WHERE a.projectId = ? ${!includeInactive ? "AND a.status = 'active'" : ""}
      GROUP BY a.id
      ORDER BY a."order" ASC
    `).all(p.id);

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      agendas: agendas.map(a => ({
        id: a.id,
        name: a.name,
        tickets: a.ticketCount,
        inProgress: a.inProgressCount,
        todo: a.todoCount,
      })),
    };
  });
}

function searchTickets({ query, limit = 10 }) {
  const q = `%${query}%`;
  const tickets = db.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.type,
           a.name as agendaName, p.name as projectName
    FROM Ticket t
    JOIN Agenda a ON t.agendaId = a.id
    JOIN Project p ON t.projectId = p.id
    WHERE (t.title LIKE ? OR t.description LIKE ?)
      AND t.status != 'done'
    ORDER BY t.priority ASC, t.updatedAt DESC
    LIMIT ?
  `).all(q, q, limit);

  return tickets;
}

// ─── JSON-RPC Handler ─────────────────────────────────────────────────────────

function handleRequest(req) {
  const { id, method, params } = req;

  function ok(result) {
    return { jsonrpc: "2.0", id, result };
  }
  function err(code, message, data) {
    return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } };
  }

  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: "2024-11-05",
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      });

    case "tools/list":
      return ok({ tools: TOOLS });

    case "tools/call": {
      const { name, arguments: args = {} } = params;
      let result;
      try {
        switch (name) {
          case "list_tickets":   result = listTickets(args); break;
          case "get_ticket":     result = getTicket(args); break;
          case "create_ticket":  result = createTicket(args); break;
          case "update_ticket":  result = updateTicket(args); break;
          case "get_agenda":     result = getAgenda(args); break;
          case "search_tickets": result = searchTickets(args); break;
          default: return err(-32601, `Unknown tool: ${name}`);
        }
      } catch (e) {
        return err(-32000, e.message);
      }

      return ok({
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      });
    }

    case "ping":
      return ok({});

    default:
      return err(-32601, `Method not found: ${method}`);
  }
}

// ─── stdio Transport ───────────────────────────────────────────────────────────

let buffer = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const req = JSON.parse(trimmed);
      const res = handleRequest(req);
      process.stdout.write(JSON.stringify(res) + "\n");
    } catch (err) {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error", data: err.message },
      }) + "\n");
    }
  }
});

process.stdin.on("end", () => {
  db.close();
  if (dbWrite) dbWrite.close();
  process.exit(0);
});

process.stderr.write(`[CtxDesk MCP] Server started · DB: ${dbPath}\n`);

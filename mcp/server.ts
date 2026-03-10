#!/usr/bin/env node
/**
 * CtxDesk MCP Server
 * Exposes CtxDesk ticket management via Model Context Protocol
 * Compatible with Claude Desktop, Cursor, and any MCP client
 *
 * Usage:
 *   npx tsx mcp/server.ts
 *   or: node mcp/server.js (after tsc build)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import http from "http";
import https from "https";

const CTXDESK_BASE_URL = process.env.CTXDESK_URL ?? "http://localhost:3002";

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function request(
  method: string,
  url: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;

    const bodyStr = body ? JSON.stringify(body) : undefined;

    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: raw });
        }
      });
    });

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "list_projects",
    description:
      "List all CtxDesk projects with their id, name, description, and agenda count.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "list_agendas",
    description: "List all agendas for a specific project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project ID to list agendas for.",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_tickets",
    description:
      "List tickets, optionally filtered by status and/or agendaId.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done"],
          description: "Filter by ticket status.",
        },
        agendaId: {
          type: "string",
          description: "Filter by agenda ID.",
        },
        projectId: {
          type: "string",
          description: "Filter by project ID.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_ticket",
    description: "Get full details for a specific ticket by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ticket ID.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_ticket",
    description:
      "Create a new ticket in CtxDesk. Returns the created ticket with its ID.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Ticket title.",
        },
        description: {
          type: "string",
          description: "Detailed description of the ticket.",
        },
        projectId: {
          type: "string",
          description: "Project ID to assign the ticket to.",
        },
        agendaId: {
          type: "string",
          description: "Agenda ID within the project.",
        },
        priority: {
          type: "number",
          description: "Priority (1=low, 2=medium, 3=high). Default: 2.",
        },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done"],
          description: "Initial status. Default: todo.",
        },
        type: {
          type: "string",
          enum: ["task", "bug", "feature", "improvement"],
          description: "Ticket type. Default: task.",
        },
      },
      required: ["title", "agendaId", "projectId"],
    },
  },
  {
    name: "update_ticket_status",
    description:
      "Update a ticket's status (todo → in_progress → done) and optionally log progress.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "The ticket ID to update.",
        },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done"],
          description: "New status for the ticket.",
        },
        message: {
          type: "string",
          description: "Progress message to log (shown in ticket timeline).",
        },
        aiAssignee: {
          type: "string",
          description:
            "AI agent name to assign (e.g. 'claude', 'cursor'). Optional.",
        },
      },
      required: ["ticketId", "status", "message"],
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleListProjects() {
  const url = `${CTXDESK_BASE_URL}/api/projects`;
  const { data } = await request("GET", url);
  const projects = Array.isArray(data) ? data : [];
  return projects.map((p: Record<string, unknown>) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    agendaCount: (p._count as Record<string, number>)?.agendas ?? 0,
    ticketCount: (p._count as Record<string, number>)?.tickets ?? 0,
    status: p.status,
    color: p.color,
  }));
}

async function handleListAgendas(args: Record<string, string>) {
  const { projectId } = args;
  const url = `${CTXDESK_BASE_URL}/api/agendas?projectId=${encodeURIComponent(projectId)}`;
  const { data } = await request("GET", url);
  const agendas = Array.isArray(data) ? data : [];
  return agendas.map((a: Record<string, unknown>) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    priority: a.priority,
    status: a.status,
    ticketCount: (a._count as Record<string, number>)?.tickets ?? 0,
  }));
}

async function handleListTickets(args: Record<string, string>) {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.agendaId) params.set("agendaId", args.agendaId);
  if (args.projectId) params.set("projectId", args.projectId);

  const url = `${CTXDESK_BASE_URL}/api/tickets?${params.toString()}`;
  const { data } = await request("GET", url);
  const tickets = Array.isArray(data) ? data : [];
  return tickets.map((t: Record<string, unknown>) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    type: t.type,
    description: t.description,
    agendaId: t.agendaId,
    projectId: t.projectId,
    isActivated: t.isActivated,
    aiAssignee: t.aiAssignee,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

async function handleGetTicket(args: Record<string, string>) {
  const url = `${CTXDESK_BASE_URL}/api/tickets/${encodeURIComponent(args.id)}`;
  const { status, data } = await request("GET", url);
  if (status === 404) throw new Error(`Ticket not found: ${args.id}`);
  return data;
}

async function handleCreateTicket(args: Record<string, unknown>) {
  const url = `${CTXDESK_BASE_URL}/api/tickets`;
  const { status, data } = await request("POST", url, {
    title: args.title,
    description: args.description ?? "",
    projectId: args.projectId,
    agendaId: args.agendaId,
    priority: args.priority ?? 2,
    status: args.status ?? "todo",
    type: args.type ?? "task",
  });
  if (status >= 400) throw new Error(`Failed to create ticket: ${JSON.stringify(data)}`);
  return data;
}

async function handleUpdateTicketStatus(args: Record<string, unknown>) {
  const url = `${CTXDESK_BASE_URL}/api/tickets/progress`;
  const { status, data } = await request("POST", url, {
    ticketId: args.ticketId,
    message: args.message,
    status: args.status,
    aiAssignee: args.aiAssignee ?? "claude",
  });
  if (status >= 400) throw new Error(`Failed to update ticket: ${JSON.stringify(data)}`);
  return data;
}

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "ctxdesk",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    let result: unknown;

    switch (name) {
      case "list_projects":
        result = await handleListProjects();
        break;
      case "list_agendas":
        result = await handleListAgendas(args as Record<string, string>);
        break;
      case "list_tickets":
        result = await handleListTickets(args as Record<string, string>);
        break;
      case "get_ticket":
        result = await handleGetTicket(args as Record<string, string>);
        break;
      case "create_ticket":
        result = await handleCreateTicket(args as Record<string, unknown>);
        break;
      case "update_ticket_status":
        result = await handleUpdateTicketStatus(args as Record<string, unknown>);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("CtxDesk MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});

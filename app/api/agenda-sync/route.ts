import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAgendaMd } from "@/lib/agenda-parser";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Default colors per project
const PROJECT_COLORS: Record<string, string> = {
  "CtxEvent": "#6366f1",
  "Infrastruktur": "#f97316",
  "Example Org Website": "#06b6d4",
  "AI & LLM": "#a855f7",
  "Security": "#ef4444",
  "CtxPost": "#10b981",
  "Persönlich": "#f59e0b",
};

const PROJECT_ICONS: Record<string, string> = {
  "CtxEvent": "calendar",
  "Infrastruktur": "server",
  "Example Org Website": "globe",
  "AI & LLM": "brain",
  "Security": "shield",
  "CtxPost": "send",
  "Persönlich": "user",
};

export async function GET() {
  // Return last sync run info
  const lastRun = await prisma.agendaSyncRun.findFirst({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ lastRun });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;

  // Find agenda.md — checks env var first, then common paths
  const home = process.env.HOME || os.homedir();
  const agendaPaths = [
    process.env.AGENDA_MD_PATH || "",
    path.join(process.env.APP_ROOT || process.cwd(), "../memory/agenda.md"),
    path.join(home, ".claude/projects", process.env.CLAUDE_PROJECT_HASH || "", "memory/agenda.md"),
  ].filter(Boolean);

  let agendaContent = "";
  let agendaPath = "";

  for (const p of agendaPaths) {
    try {
      agendaContent = await fs.readFile(p, "utf-8");
      agendaPath = p;
      break;
    } catch {}
  }

  if (!agendaContent) {
    return NextResponse.json({
      error: "agenda.md nicht gefunden. Versucht: " + agendaPaths.join(", "),
    }, { status: 404 });
  }

  // Parse
  const parsed = parseAgendaMd(agendaContent);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      agendaPath,
      items: parsed.items,
      projects: parsed.projects,
      errors: parsed.errors,
    });
  }

  // Start sync run
  const syncRun = await prisma.agendaSyncRun.create({
    data: { status: "running", itemsFound: parsed.items.length },
  });

  let created = 0;
  let updated = 0;
  const logLines: string[] = [`[SYNC] Gestartet — ${parsed.items.length} Items gefunden`];

  try {
    // 1. Ensure all required projects exist
    const projectMap: Record<string, string> = {}; // name → id

    for (const projName of parsed.projects) {
      let project = await prisma.project.findFirst({
        where: { name: projName },
      });

      if (!project) {
        project = await prisma.project.create({
          data: {
            name: projName,
            description: `Auto-erstellt aus Agenda Sync`,
            color: PROJECT_COLORS[projName] || "#6366f1",
            icon: PROJECT_ICONS[projName] || "folder",
            status: "active",
          },
        });
        logLines.push(`[+] Projekt erstellt: "${projName}"`);
        created++;
      }

      projectMap[projName] = project.id;

      // Log to LiveLog
      await prisma.liveLog.create({
        data: {
          level: "info",
          category: "agenda_sync",
          message: `Projekt sichergestellt: "${projName}"`,
          projectId: project.id,
        },
      });
    }

    // 2. Ensure agendas exist per project/agenda-group
    const agendaMap: Record<string, string> = {}; // `projectId:agendaName` → agendaId

    for (const item of parsed.items) {
      const projectId = projectMap[item.project];
      if (!projectId) continue;

      const agendaKey = `${projectId}:${item.agenda}`;
      if (!agendaMap[agendaKey]) {
        let agenda = await prisma.agenda.findFirst({
          where: { projectId, name: item.agenda },
        });

        if (!agenda) {
          agenda = await prisma.agenda.create({
            data: {
              projectId,
              name: item.agenda,
              description: `Aus Agenda Sync: ${item.agenda}`,
              priority: item.priority,
              status: "active",
            },
          });
          logLines.push(`[+] Agenda erstellt: "${item.agenda}" in Projekt "${item.project}"`);
        }

        agendaMap[agendaKey] = agenda.id;
      }
    }

    // 3. Upsert tickets
    for (const item of parsed.items) {
      const projectId = projectMap[item.project];
      if (!projectId) continue;

      const agendaKey = `${projectId}:${item.agenda}`;
      const agendaId = agendaMap[agendaKey];
      if (!agendaId) continue;

      // Check for existing ticket by title in this project
      const existing = await prisma.ticket.findFirst({
        where: {
          projectId,
          title: item.title,
        },
      });

      const ticketStatus =
        item.status === "done" ? "done"
        : item.status === "blocked" ? "todo"
        : item.status === "partial" ? "in_progress"
        : "todo";

      if (!existing) {
        await prisma.ticket.create({
          data: {
            title: item.title,
            description: item.description || null,
            agendaId,
            projectId,
            priority: item.priority,
            type: item.type,
            status: ticketStatus,
            claudeContext: item.rawNumber
              ? `Agenda-ID: ${item.rawNumber}\nProjekt: ${item.project}\nGruppe: ${item.agenda}`
              : null,
          },
        });
        logLines.push(`[+] Ticket erstellt: "${item.title.slice(0, 50)}"`);
        created++;

        await prisma.liveLog.create({
          data: {
            level: "success",
            category: "agenda_sync",
            message: `Ticket erstellt: "${item.title.slice(0, 60)}"`,
            projectId,
          },
        });
      } else {
        // Update priority and status if changed
        const needsUpdate =
          existing.priority !== item.priority ||
          (existing.status === "todo" && ticketStatus === "done");

        if (needsUpdate) {
          await prisma.ticket.update({
            where: { id: existing.id },
            data: {
              priority: item.priority,
              status: ticketStatus,
              agendaId, // ensure correct agenda
            },
          });
          logLines.push(`[~] Ticket aktualisiert: "${item.title.slice(0, 50)}"`);
          updated++;
        }
      }
    }

    // Finish sync run
    await prisma.agendaSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "done",
        itemsFound: parsed.items.length,
        itemsCreated: created,
        itemsUpdated: updated,
        log: logLines.join("\n"),
        finishedAt: new Date(),
      },
    });

    await prisma.liveLog.create({
      data: {
        level: "success",
        category: "agenda_sync",
        message: `✅ Sync abgeschlossen — ${created} erstellt, ${updated} aktualisiert, ${parsed.errors.length} Fehler`,
        metadata: JSON.stringify({ created, updated, errors: parsed.errors.length }),
      },
    });

    return NextResponse.json({
      ok: true,
      created,
      updated,
      itemsFound: parsed.items.length,
      projects: parsed.projects,
      errors: parsed.errors,
      log: logLines,
    });

  } catch (e) {
    const msg = String(e);
    await prisma.agendaSyncRun.update({
      where: { id: syncRun.id },
      data: { status: "error", log: logLines.join("\n") + "\n[ERROR] " + msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

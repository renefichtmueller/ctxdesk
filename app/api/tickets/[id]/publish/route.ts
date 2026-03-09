import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";

// Determine publish action based on project name
function getPublishAction(projectName: string): {
  type: "cloudflare_pages" | "linkedin" | "generic";
  label: string;
  command?: string;
} {
  const name = projectName.toLowerCase();
  if (name.includes("example") || name.includes("website")) {
    return {
      type: "cloudflare_pages",
      label: "Cloudflare Pages Deploy",
      command: `cd "/Users/user/Desktop/Webseite Example Org" && npx wrangler pages deploy . --project-name example-website 2>&1`,
    };
  }
  if (name.includes("ctxpost") || name.includes("linkedin") || name.includes("post")) {
    return {
      type: "linkedin",
      label: "LinkedIn Posts freigeben",
    };
  }
  return {
    type: "generic",
    label: "Als erledigt markieren",
  };
}

function runCmd(command: string, timeoutMs = 120_000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve({ stdout: "", stderr: "Timeout nach 120s", code: 1 }), timeoutMs + 500);
    exec(command, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      clearTimeout(t);
      resolve({ stdout: stdout || "", stderr: stderr || "", code: err?.code ?? 0 });
    });
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Load ticket with project info
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { agenda: { include: { project: true } } },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
  }

  if (ticket.status !== "in_review") {
    return NextResponse.json({ error: "Ticket muss im Status 'in_review' sein" }, { status: 400 });
  }

  const projectName = ticket.agenda?.project?.name ?? "";
  const action = getPublishAction(projectName);

  const logs: string[] = [];
  let success = false;

  try {
    // Log start
    await prisma.liveLog.create({
      data: {
        level: "info",
        category: "publish",
        message: `🚀 Publish gestartet: "${ticket.title}" → ${action.label}`,
        ticketId: id,
        projectId: ticket.projectId,
        metadata: JSON.stringify({ action: action.type }),
      },
    });

    if (action.type === "cloudflare_pages" && action.command) {
      logs.push(`▶ ${action.label}`);
      logs.push(`$ ${action.command}`);

      const result = await runCmd(action.command);

      if (result.stdout) logs.push(result.stdout);
      if (result.stderr) logs.push(result.stderr);

      if (result.code === 0 || result.stdout.includes("✨") || result.stdout.includes("Success") || result.stderr.includes("Success")) {
        success = true;
        logs.push("✅ Deploy erfolgreich!");
      } else {
        logs.push(`❌ Deploy fehlgeschlagen (exit ${result.code})`);
      }

    } else if (action.type === "linkedin") {
      // Mark LinkedIn posts as published (future: CtxPost API)
      logs.push("▶ LinkedIn Posts als veröffentlicht markiert");
      logs.push("✅ Posts freigegeben!");
      success = true;

    } else {
      // Generic: just mark done
      logs.push("▶ Ticket als erledigt markiert");
      success = true;
    }

    if (success) {
      // Move ticket to done + create changelog entry
      await prisma.ticket.update({
        where: { id },
        data: {
          status: "done",
          completedAt: new Date(),
        },
      });

      // Create changelog entry if not exists
      const existing = await prisma.changelogEntry.findUnique({ where: { ticketId: id } });
      if (!existing) {
        await prisma.changelogEntry.create({
          data: {
            agendaId: ticket.agendaId,
            ticketId: id,
            content: `## ✅ ${ticket.title}\n\n**Veröffentlicht via:** ${action.label}\n**Typ:** ${ticket.type} · **Priorität:** P${ticket.priority}\n\n${ticket.description ? ticket.description + "\n\n" : ""}*Abgeschlossen in: ${ticket.agenda.name} (${projectName})*`,
            type: "ticket_completed",
          },
        });
      }

      // Live log success
      await prisma.liveLog.create({
        data: {
          level: "info",
          category: "publish",
          message: `✅ Erfolgreich deployed: "${ticket.title}" via ${action.label}`,
          ticketId: id,
          projectId: ticket.projectId,
          metadata: JSON.stringify({ action: action.type, logs: logs.slice(-3) }),
        },
      });
    } else {
      await prisma.liveLog.create({
        data: {
          level: "error",
          category: "publish",
          message: `❌ Publish fehlgeschlagen: "${ticket.title}"`,
          ticketId: id,
          projectId: ticket.projectId,
          metadata: JSON.stringify({ action: action.type, logs: logs.slice(-5) }),
        },
      });
    }

  } catch (err) {
    logs.push(`❌ Fehler: ${String(err)}`);
    success = false;
  }

  return NextResponse.json({
    success,
    action: action.type,
    label: action.label,
    logs,
    newStatus: success ? "done" : ticket.status,
  });
}

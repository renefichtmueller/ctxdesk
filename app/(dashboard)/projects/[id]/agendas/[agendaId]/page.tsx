import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABELS, PRIORITY_COLORS, KANBAN_COLUMNS } from "@/lib/constants";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { AddTicketDialog } from "@/components/dialogs/add-ticket-dialog";

interface Props {
  params: Promise<{ id: string; agendaId: string }>;
}

export default async function AgendaPage({ params }: Props) {
  const { id: projectId, agendaId } = await params;

  const agenda = await prisma.agenda.findUnique({
    where: { id: agendaId },
    include: {
      project: true,
      tickets: {
        orderBy: [{ priority: "asc" }, { order: "asc" }],
      },
    },
  });

  if (!agenda || agenda.projectId !== projectId) notFound();

  const ticketsByStatus: Record<string, typeof agenda.tickets> = {};
  for (const col of KANBAN_COLUMNS) {
    ticketsByStatus[col.id] = agenda.tickets.filter(t => t.status === col.id);
  }

  return (
    <div className="space-y-5 max-w-full">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: agenda.project.color }} />
            <span className="text-xs text-slate-400">{agenda.project.name}</span>
            <span className="text-slate-600">→</span>
            <h1 className="text-xl font-bold text-white truncate">{agenda.name}</h1>
            <Badge
              className="text-[9px] shrink-0"
              style={{
                background: `${PRIORITY_COLORS[agenda.priority]}15`,
                color: PRIORITY_COLORS[agenda.priority],
                border: `1px solid ${PRIORITY_COLORS[agenda.priority]}30`,
              }}
            >
              {PRIORITY_LABELS[agenda.priority]}
            </Badge>
          </div>
          {agenda.description && (
            <p className="text-sm text-slate-400 mt-0.5">{agenda.description}</p>
          )}
        </div>
        <AddTicketDialog agendaId={agendaId} />
      </div>

      <KanbanBoard
        tickets={agenda.tickets.map(t => ({
          ...t,
          activatedAt: t.activatedAt ? t.activatedAt.toISOString() : null,
        }))}
        agendaId={agendaId}
        projectId={projectId}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/constants";
import { Plus, ArrowLeft, CheckCircle2, Clock, LayoutGrid } from "lucide-react";
import { AddAgendaDialog } from "@/components/dialogs/add-agenda-dialog";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      agendas: {
        orderBy: [{ priority: "asc" }, { order: "asc" }],
        include: {
          _count: { select: { tickets: true } },
          tickets: {
            select: { status: true, priority: true },
          },
        },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: project.color }} />
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          </div>
          {project.description && (
            <p className="text-sm text-slate-400 mt-0.5">{project.description}</p>
          )}
        </div>
        <AddAgendaDialog projectId={project.id} />
      </div>

      {/* Color bar */}
      <div
        className="h-[2px] w-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${project.color}, ${project.color}40, transparent)` }}
      />

      {/* Agendas */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Agenden ({project.agendas.filter(a => a.status === "active").length} aktiv)
        </h2>

        {project.agendas.filter(a => a.status === "active").map((agenda) => {
          const total = agenda.tickets.length;
          const done = agenda.tickets.filter(t => t.status === "done").length;
          const inProgress = agenda.tickets.filter(t => t.status === "in_progress").length;
          const progress = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <Link key={agenda.id} href={`/projects/${project.id}/agendas/${agenda.id}`}>
              <div
                className="p-4 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] group"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${PRIORITY_COLORS[agenda.priority]}20`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white group-hover:text-white truncate">{agenda.name}</span>
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
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{agenda.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
                    {inProgress > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" style={{ color: "#f97316" }} />
                        {inProgress}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" style={{ color: "#10b981" }} />
                      {done}/{total}
                    </span>
                    <LayoutGrid className="w-4 h-4" style={{ color: "#6366f1" }} />
                  </div>
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="mt-3">
                    <div className="h-1 rounded-full w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-1 rounded-full transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                          background: progress === 100
                            ? "linear-gradient(90deg, #10b981, #34d399)"
                            : `linear-gradient(90deg, ${project.color}, ${project.color}80)`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{progress}% abgeschlossen</p>
                  </div>
                )}
              </div>
            </Link>
          );
        })}

        {project.agendas.filter(a => a.status === "active").length === 0 && (
          <div
            className="p-8 rounded-xl text-center"
            style={{ background: "rgba(99,102,241,0.04)", border: "1px dashed rgba(99,102,241,0.2)" }}
          >
            <LayoutGrid className="w-10 h-10 mx-auto mb-3" style={{ color: "#6366f1" }} />
            <p className="text-sm text-slate-300 font-medium">Noch keine Agenden</p>
            <p className="text-xs text-slate-500 mt-1">Erstelle deine erste Agenda um Tickets zu organisieren.</p>
          </div>
        )}
      </div>
    </div>
  );
}

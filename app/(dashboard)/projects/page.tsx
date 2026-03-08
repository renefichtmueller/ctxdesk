import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderOpen, Archive } from "lucide-react";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    where: { status: "active" },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { agendas: true, tickets: true } },
      agendas: {
        where: { status: "active" },
        orderBy: { order: "asc" },
        take: 3,
      },
    },
  });

  const archived = await prisma.project.count({ where: { status: "archived" } });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projekte</h1>
          <p className="text-sm text-slate-400 mt-0.5">{projects.length} aktiv · {archived} archiviert</p>
        </div>
        <Link href="/projects/new">
          <Button
            size="sm"
            className="gap-1.5 text-xs font-semibold text-white border-0"
            style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)", boxShadow: "0 0 12px rgba(79,70,229,0.4)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Neues Projekt
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <div
              className="p-5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] group"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${project.color}25`,
              }}
            >
              {/* Color bar */}
              <div
                className="h-[2px] w-full rounded-full mb-4"
                style={{ background: `linear-gradient(90deg, ${project.color}, transparent)` }}
              />
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${project.color}20`, border: `1px solid ${project.color}30` }}
                >
                  <FolderOpen className="w-5 h-5" style={{ color: project.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm group-hover:text-white truncate">{project.name}</h3>
                  {project.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{project.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px]" style={{ background: `${project.color}15`, color: project.color, border: `1px solid ${project.color}30` }}>
                  {project._count.agendas} Agenden
                </Badge>
                <Badge className="text-[10px]" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                  {project._count.tickets} Tickets
                </Badge>
              </div>

              {project.agendas.length > 0 && (
                <div className="mt-3 space-y-1">
                  {project.agendas.map((agenda) => (
                    <div key={agenda.id} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full" style={{ background: project.color }} />
                      <span className="text-[11px] text-slate-400 truncate">{agenda.name}</span>
                      <span className="text-[10px] text-slate-600 ml-auto shrink-0">P{agenda.priority}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}

        {/* New project card */}
        <Link href="/projects/new">
          <div
            className="p-5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] flex flex-col items-center justify-center min-h-[160px] group"
            style={{
              background: "rgba(99,102,241,0.04)",
              border: "1px dashed rgba(99,102,241,0.2)",
            }}
          >
            <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" style={{ color: "#6366f1" }} />
            <span className="text-sm font-medium" style={{ color: "#6366f1" }}>Neues Projekt</span>
          </div>
        </Link>
      </div>

      {archived > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Archive className="w-3.5 h-3.5" />
          {archived} archivierte Projekte
        </div>
      )}
    </div>
  );
}

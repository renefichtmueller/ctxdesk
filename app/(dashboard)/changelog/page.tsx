import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ScrollText, CheckCircle2, LayoutGrid, PenLine } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const TYPE_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ticket_completed: { icon: CheckCircle2, color: "#10b981", label: "Ticket abgeschlossen" },
  agenda_completed: { icon: LayoutGrid, color: "#6366f1", label: "Agenda abgeschlossen" },
  manual: { icon: PenLine, color: "#22d3ee", label: "Manuell" },
};

export default async function ChangelogPage() {
  const entries = await prisma.changelogEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      agenda: { include: { project: true } },
      ticket: true,
    },
    take: 50,
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <ScrollText className="w-5 h-5" style={{ color: "#6366f1" }} />
        <h1 className="text-2xl font-bold text-white">Changelog</h1>
        <Badge className="text-[10px] ml-1" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
          {entries.length} Einträge
        </Badge>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Noch keine Changelog-Einträge.</p>
          <p className="text-xs mt-1">Schließe dein erstes Ticket ab!</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div
            className="absolute left-5 top-0 bottom-0 w-[1px]"
            style={{ background: "linear-gradient(180deg, #6366f1, #22d3ee, rgba(34,211,238,0))" }}
          />

          <div className="space-y-4 pl-12">
            {entries.map((entry) => {
              const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.manual;
              const Icon = config.icon;

              return (
                <div key={entry.id} className="relative">
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-[35px] top-4 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: `${config.color}20`, border: `1px solid ${config.color}` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
                  </div>

                  <div
                    className="p-4 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${config.color}15` }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: config.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium" style={{ color: config.color }}>{config.label}</span>
                          <span className="text-[10px] text-slate-500">·</span>
                          <span className="text-[10px] text-slate-500">
                            {formatDistanceToNow(entry.createdAt, { locale: de, addSuffix: true })}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-auto">
                            {entry.agenda.project.name} → {entry.agenda.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {entry.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

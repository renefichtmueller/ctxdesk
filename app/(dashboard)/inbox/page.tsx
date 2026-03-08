import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { InboxItemCard } from "@/components/inbox/inbox-item-card";
import { Inbox, CheckCircle2 } from "lucide-react";

export default async function InboxPage() {
  const [unread, imported, dismissed] = await Promise.all([
    prisma.inboxItem.findMany({ where: { status: "unread" }, orderBy: { createdAt: "desc" } }),
    prisma.inboxItem.findMany({ where: { status: "imported" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.inboxItem.findMany({ where: { status: "dismissed" }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const agendas = await prisma.agenda.findMany({
    where: { status: "active" },
    include: { project: true },
    orderBy: { priority: "asc" },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Inbox className="w-5 h-5" style={{ color: unread.length > 0 ? "#ef4444" : "#6366f1" }} />
        <h1 className="text-2xl font-bold text-white">Inbox</h1>
        {unread.length > 0 && (
          <Badge className="text-[10px]" style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444430" }}>
            {unread.length} neu
          </Badge>
        )}
      </div>

      {/* Drop info */}
      <div
        className="p-4 rounded-xl"
        style={{ background: "rgba(99,102,241,0.05)", border: "1px dashed rgba(99,102,241,0.2)" }}
      >
        <p className="text-xs text-slate-300 font-mono">
          <span style={{ color: "#6366f1" }}>📂 inbox/</span> — Lege <span className="text-white">.md</span> Dateien hier ab und sie erscheinen automatisch.
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          Frontmatter: <code className="text-slate-400">project:</code>, <code className="text-slate-400">agenda:</code>, <code className="text-slate-400">priority:</code> (optional)
        </p>
      </div>

      {/* Unread */}
      {unread.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Neu ({unread.length})</h2>
          {unread.map((item) => (
            <InboxItemCard key={item.id} item={item} agendas={agendas} />
          ))}
        </div>
      )}

      {unread.length === 0 && (
        <div
          className="p-10 rounded-xl text-center"
          style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}
        >
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "#10b981" }} />
          <p className="text-sm font-medium" style={{ color: "#10b981" }}>Inbox ist leer</p>
          <p className="text-xs text-slate-400 mt-1">Lege .md Dateien in den inbox/ Ordner</p>
        </div>
      )}

      {/* Recently imported */}
      {imported.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Zuletzt importiert</h2>
          {imported.map((item) => (
            <div key={item.id} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#10b981" }} />
                <span className="text-xs text-slate-400 truncate">{item.parsedTitle || item.filename}</span>
                <span className="text-[10px] text-slate-600 ml-auto shrink-0">importiert</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

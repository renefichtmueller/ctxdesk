"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateTicket, updateTicketStatus, deleteTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS, TICKET_TYPES } from "@/lib/constants";

// We use "use client" but fetch via useEffect since this page needs interactivity
export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [pending, setPending] = useState(false);
  const [priority, setPriority] = useState("2");
  const [type, setType] = useState("task");
  const [status, setStatus] = useState("todo");

  useEffect(() => {
    params.then(p => setTicketId(p.id));
  }, [params]);

  useEffect(() => {
    if (!ticketId) return;
    fetch(`/api/tickets/${ticketId}`)
      .then(r => r.json())
      .then(data => {
        setTicket(data);
        setPriority(String(data.priority ?? 2));
        setType(data.type || "task");
        setStatus(data.status || "todo");
      });
  }, [ticketId]);

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("priority", priority);
    formData.set("type", type);
    const result = await updateTicket(ticket.id, formData);
    setPending(false);
    if (result.error) toast.error(result.error);
    else toast.success("Gespeichert!");
  }

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    const result = await updateTicketStatus(ticket.id, newStatus);
    if ('error' in result) { toast.error(result.error); setStatus(ticket.status); }
    else if (newStatus === "done") toast.success("✅ Changelog-Eintrag erstellt!");
  }

  async function handleDelete() {
    if (!confirm("Ticket wirklich löschen?")) return;
    const result = await deleteTicket(ticket.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Gelöscht"); router.push(`/projects/${ticket.agenda.projectId}/agendas/${ticket.agendaId}`); }
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${ticket.agenda?.projectId}/agendas/${ticket.agendaId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">{ticket.agenda?.project?.name}</span>
            <span className="text-slate-600">→</span>
            <span className="text-xs text-slate-400">{ticket.agenda?.name}</span>
          </div>
          <p className="text-xs text-slate-600 font-mono mt-0.5">{ticket.id.slice(-8)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Status selector */}
      <div
        className="p-4 rounded-xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(99,102,241,0.1)" }}
      >
        <Label className="text-slate-400 text-xs uppercase tracking-wider mb-3 block">Status</Label>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABELS).map(([s, label]) => {
            const colors: Record<string, string> = {
              backlog: "#94a3b8", todo: "#6366f1", in_progress: "#f97316", in_review: "#f472b6", done: "#10b981"
            };
            const c = colors[s];
            return (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: status === s ? `${c}20` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${status === s ? c : "rgba(255,255,255,0.08)"}`,
                  color: status === s ? c : "#94a3b8",
                  boxShadow: status === s ? `0 0 8px ${c}30` : "none",
                }}
              >
                {status === s && s === "done" && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="p-5 rounded-xl space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(99,102,241,0.1)" }}>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs uppercase tracking-wider">Titel *</Label>
            <Input name="title" defaultValue={ticket.title} required
              className="text-white text-base font-medium"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs uppercase tracking-wider">Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)", color: "#f8fafc" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0e1528", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <SelectItem value="0">🔴 P0 — Kritisch</SelectItem>
                  <SelectItem value="1">🟠 P1 — Hoch</SelectItem>
                  <SelectItem value="2">🟡 P2 — Normal</SelectItem>
                  <SelectItem value="3">🔵 P3 — Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs uppercase tracking-wider">Typ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)", color: "#f8fafc" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0e1528", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <SelectItem value="feature">✨ Feature</SelectItem>
                  <SelectItem value="bug">🐛 Bug</SelectItem>
                  <SelectItem value="task">✅ Task</SelectItem>
                  <SelectItem value="improvement">⚡ Improvement</SelectItem>
                  <SelectItem value="research">🔬 Research</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs uppercase tracking-wider">Beschreibung (Markdown)</Label>
            <Textarea name="description" defaultValue={ticket.description || ""} rows={6}
              className="text-white placeholder:text-slate-500 resize-none font-mono text-sm"
              placeholder="Beschreibung, Schritte, Links..."
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span style={{ color: "#22d3ee" }}>⚡</span>
              Claude Context
            </Label>
            <Textarea name="claudeContext" defaultValue={ticket.claudeContext || ""} rows={3}
              placeholder="Dateipfade, relevante Infos für Claude Code..."
              className="text-white placeholder:text-slate-500 resize-none font-mono text-xs"
              style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.2)" }} />
            <p className="text-[10px] text-slate-500">Dieser Inhalt erscheint in CLAUDE_QUEUE.md</p>
          </div>
        </div>

        <Button type="submit" disabled={pending} className="w-full gap-2 text-white border-0"
          style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Speichern
        </Button>
      </form>
    </div>
  );
}

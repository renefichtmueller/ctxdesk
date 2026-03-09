"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateTicket, updateTicketStatus, deleteTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Trash2, Loader2, CheckCircle2,
  Play, Pause, Brain, Paperclip, X, FileText,
  Image as ImageIcon, File, Bot, ChevronDown, ChevronUp,
  Send, Sparkles, Globe, Rocket, Terminal,
  Timer, StopCircle, Link2, Unlink, Search, Clock,
  AlertOctagon, ArrowRight,
} from "lucide-react";
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS, TICKET_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface ProgressEntry {
  ts: string;
  msg: string;
  ai?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-blue-400" />;
  if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType.includes("word")) return <FileText className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-slate-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────
function AIChatPanel({ ticket }: { ticket: any }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<string>("");
  const [provider, setProvider] = useState<"ollama" | "lmstudio">("ollama");
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; provider: string; name: string }>>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load models
    fetch("/api/llm/models").then(r => r.json()).then(data => {
      if (data.all?.length > 0) {
        setAvailableModels(data.all);
        setModel(data.all[0].id);
        setProvider(data.all[0].provider);
      }
      setModelsLoaded(true);
    }).catch(() => setModelsLoaded(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedModel = availableModels.find(m => m.id === model);

  async function sendMessage() {
    if (!input.trim() || loading || !model) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages(prev => [...prev, assistantMsg]);

    const systemPrompt = `Du bist ein KI-Assistent für das Ticket-Management-System CtxDesk.
Du hilfst bei folgendem Ticket:
Titel: "${ticket.title}"
Typ: ${ticket.type}
Status: ${ticket.status}
${ticket.description ? `Beschreibung: ${ticket.description}` : ""}
${ticket.claudeContext ? `Kontext: ${ticket.claudeContext}` : ""}
Antworte präzise und hilfreich.`;

    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          systemPrompt,
          temperature: 0.7,
          maxTokens: 1024,
          stream: true,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + data.content,
                };
                return updated;
              });
            }
            if (data.done) break;
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Fehler: ${String(err)}` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  if (!modelsLoaded) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (availableModels.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-[12px] text-[#64748b]">Kein LLM verfügbar</p>
        <p className="text-[11px] text-[#475569] mt-1">Ollama oder LM Studio starten, dann <Link href="/settings" className="text-indigo-400 hover:underline">Einstellungen</Link> öffnen</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "360px" }}>
      {/* Model selector */}
      <div className="flex items-center gap-2 pb-2 mb-2" style={{ borderBottom: "1px solid #1e293b" }}>
        <Bot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <select
          value={model}
          onChange={e => {
            const m = availableModels.find(x => x.id === e.target.value);
            setModel(e.target.value);
            if (m) setProvider(m.provider as "ollama" | "lmstudio");
          }}
          className="flex-1 text-[11px] bg-transparent text-[#94a3b8] outline-none cursor-pointer"
        >
          {availableModels.map(m => (
            <option key={m.id} value={m.id} style={{ background: "#1e293b" }}>
              {m.provider === "ollama" ? "🟢" : "🟣"} {m.id}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-6 h-6 text-indigo-400/40 mx-auto mb-2" />
            <p className="text-[12px] text-[#475569]">Frag die KI zu diesem Ticket...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("rounded-lg px-3 py-2 text-[12px] leading-relaxed", msg.role === "user" ? "ml-4" : "mr-4")} style={{
            background: msg.role === "user" ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${msg.role === "user" ? "rgba(99,102,241,0.2)" : "#1e293b"}`,
            color: msg.role === "user" ? "#c7d2fe" : "#94a3b8",
          }}>
            {msg.content || (loading && i === messages.length - 1 && <span className="animate-pulse">▋</span>)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 mt-2" style={{ borderTop: "1px solid #1e293b" }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Nachricht... (Enter senden)"
          rows={2}
          className="flex-1 px-2.5 py-2 rounded-lg text-[12px] text-[#f1f5f9] outline-none resize-none"
          style={{ background: "#0f172a", border: "1px solid #334155" }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Attachments Panel ────────────────────────────────────────────────────────
function AttachmentsPanel({ ticketId }: { ticketId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const loadAttachments = useCallback(async () => {
    const res = await fetch(`/api/tickets/${ticketId}/attachments`);
    const data = await res.json();
    setAttachments(data);
  }, [ticketId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  // Paste handler for screenshots
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await uploadFile(file, "screenshot.png");
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [ticketId]);

  async function uploadFile(file: File, overrideName?: string) {
    setUploading(true);
    try {
      const formData = new FormData();
      const nameToUse = overrideName || file.name;
      formData.append("file", file, nameToUse);

      const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`📎 ${overrideName || file.name} angehängt`);
      await loadAttachments();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await uploadFile(file);
    }
    e.target.value = "";
  }

  async function deleteAttachment(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    await fetch(`/api/tickets/${ticketId}/attachments/${id}`, { method: "DELETE" });
    toast.success("Anhang gelöscht");
    await loadAttachments();
  }

  // Drag & Drop
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) await uploadFile(file);
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center gap-2 py-5 rounded-lg cursor-pointer transition-all hover:border-indigo-500/40"
        style={{ border: "2px dashed #334155", background: "#0f172a" }}
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        ) : (
          <>
            <Paperclip className="w-5 h-5 text-[#475569]" />
            <p className="text-[12px] text-[#64748b] text-center">
              Dateien hier ablegen oder klicken zum Auswählen<br />
              <span className="text-[11px] text-[#475569]">Screenshots per Strg+V · PNG, JPG, PDF, DOC, TXT · max. 10MB</span>
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.md"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg group" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
              <FileIcon mimeType={att.mimeType} />
              <a
                href={`/api/tickets/${ticketId}/attachments/${att.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-[12px] text-[#94a3b8] hover:text-[#f1f5f9] transition-colors truncate"
              >
                {att.originalName}
              </a>
              <span className="text-[10px] text-[#475569] shrink-0">{formatBytes(att.size)}</span>
              <button
                onClick={() => deleteAttachment(att.id, att.originalName)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[#475569] hover:text-red-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Time Tracker Panel ───────────────────────────────────────────────────────
function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function TimeTrackerPanel({ ticketId }: { ticketId: string }) {
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [activeEntry, setActiveEntry] = useState<{ id: string; startedAt: string } | null>(null);
  const [entries, setEntries] = useState<Array<{ id: string; startedAt: string; endedAt: string | null; note: string | null }>>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadTime = useCallback(async () => {
    const res = await fetch(`/api/tickets/${ticketId}/time`);
    const data = await res.json();
    setTotalSeconds(data.totalSeconds ?? 0);
    setActiveEntry(data.active ?? null);
    setEntries(data.entries ?? []);
  }, [ticketId]);

  useEffect(() => { loadTime(); }, [loadTime]);

  // Live-update elapsed time
  useEffect(() => {
    if (!activeEntry) { setElapsed(0); return; }
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [activeEntry]);

  async function toggleTimer() {
    setLoading(true);
    try {
      await fetch(`/api/tickets/${ticketId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: activeEntry ? "stop" : "start" }),
      });
      await loadTime();
      toast.success(activeEntry ? "Timer gestoppt" : "Timer gestartet");
    } catch { toast.error("Timer-Fehler"); }
    finally { setLoading(false); }
  }

  async function deleteEntry(entryId: string) {
    await fetch(`/api/tickets/${ticketId}/time?entryId=${entryId}`, { method: "DELETE" });
    await loadTime();
  }

  const displaySeconds = activeEntry ? totalSeconds - elapsed + elapsed : totalSeconds;

  return (
    <div className="space-y-3">
      {/* Timer display */}
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: "#0f172a", border: `1px solid ${activeEntry ? "rgba(249,115,22,0.4)" : "#1e293b"}` }}>
          <Clock className={`w-4 h-4 ${activeEntry ? "text-orange-400 animate-pulse" : "text-[#475569]"}`} />
          <div>
            <p className="text-[20px] font-mono font-bold tracking-wider" style={{ color: activeEntry ? "#fb923c" : "#94a3b8" }}>
              {formatDuration(activeEntry ? elapsed : totalSeconds)}
            </p>
            <p className="text-[10px] text-[#475569]">
              {activeEntry ? "läuft..." : `Gesamt: ${formatDuration(displaySeconds)}`}
            </p>
          </div>
        </div>
        <button
          onClick={toggleTimer}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-[13px] font-semibold transition-all"
          style={{
            background: activeEntry ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)",
            border: `1px solid ${activeEntry ? "rgba(239,68,68,0.4)" : "rgba(249,115,22,0.4)"}`,
            color: activeEntry ? "#f87171" : "#fb923c",
          }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : activeEntry ? <StopCircle className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
          {activeEntry ? "Stop" : "Start"}
        </button>
      </div>

      {/* Entry history (last 5) */}
      {entries.slice(0, 5).map((e) => {
        const dur = e.endedAt
          ? Math.floor((new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 1000)
          : null;
        return (
          <div key={e.id} className="flex items-center gap-2 px-3 py-2 rounded-lg group" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
            <Clock className="w-3 h-3 text-[#475569] shrink-0" />
            <span className="text-[11px] text-[#64748b] flex-1">
              {new Date(e.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
              {e.endedAt && ` → ${new Date(e.endedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
            {dur !== null && (
              <span className="text-[11px] font-mono text-[#94a3b8]">{formatDuration(dur)}</span>
            )}
            {!e.endedAt && <span className="text-[10px] text-orange-400 animate-pulse">läuft</span>}
            <button onClick={() => deleteEntry(e.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#475569] hover:text-red-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {/* CSV Export Link */}
      {entries.length > 0 && (
        <a
          href={`/api/reports/time?format=csv`}
          className="flex items-center gap-1.5 text-[11px] text-[#475569] hover:text-[#94a3b8] transition-colors"
          target="_blank"
        >
          <ArrowRight className="w-3 h-3" />
          CSV-Report exportieren
        </a>
      )}
    </div>
  );
}

// ─── Dependencies Panel ───────────────────────────────────────────────────────
interface DepTicket {
  depId: string;
  id: string;
  title: string;
  status: string;
  priority: number;
  agenda: { name: string; project: { name: string } } | null;
}

function DependenciesPanel({ ticketId }: { ticketId: string }) {
  const [blockers, setBlockers] = useState<DepTicket[]>([]);
  const [blocking, setBlocking] = useState<DepTicket[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadDeps = useCallback(async () => {
    const res = await fetch(`/api/tickets/${ticketId}/dependencies`);
    const data = await res.json();
    setBlockers(data.blockers ?? []);
    setBlocking(data.blocking ?? []);
  }, [ticketId]);

  useEffect(() => { loadDeps(); }, [loadDeps]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/tickets/search?q=${encodeURIComponent(searchQuery)}&exclude=${ticketId}`);
        const data = await res.json();
        setSearchResults(data.tickets ?? []);
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, ticketId]);

  async function addBlocker(dependsOnId: string) {
    setAdding(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSearchQuery("");
      setSearchResults([]);
      await loadDeps();
      toast.success("Abhängigkeit hinzugefügt");
    } catch (err) { toast.error(String(err)); }
    finally { setAdding(false); }
  }

  async function removeBlocker(depId: string) {
    await fetch(`/api/tickets/${ticketId}/dependencies?depId=${depId}`, { method: "DELETE" });
    await loadDeps();
    toast.success("Abhängigkeit entfernt");
  }

  const statusColors: Record<string, string> = {
    todo: "#6366f1", in_progress: "#f97316", in_review: "#a855f7", done: "#22c55e", backlog: "#64748b",
  };

  function DepRow({ dep, onRemove }: { dep: DepTicket; onRemove: () => void }) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg group" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColors[dep.status] ?? "#64748b" }} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#94a3b8] truncate">{dep.title}</p>
          <p className="text-[10px] text-[#475569]">
            {dep.agenda?.project?.name} · {dep.agenda?.name}
          </p>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${statusColors[dep.status]}20`, color: statusColors[dep.status] ?? "#64748b" }}>
          {dep.status.replace("_", " ")}
        </span>
        <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#475569] hover:text-red-400">
          <Unlink className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Blocked by */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] flex items-center gap-1.5">
          <AlertOctagon className="w-3 h-3 text-red-400" />
          Blockiert durch
        </p>
        {blockers.length === 0 ? (
          <p className="text-[12px] text-[#475569] pl-1">Keine Blocker</p>
        ) : (
          blockers.map((dep) => (
            <DepRow key={dep.depId} dep={dep} onRemove={() => removeBlocker(dep.depId)} />
          ))
        )}
      </div>

      {/* Blocks */}
      {blocking.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] flex items-center gap-1.5">
            <Link2 className="w-3 h-3 text-amber-400" />
            Blockiert folgende Tickets
          </p>
          {blocking.map((dep) => (
            <DepRow key={dep.depId} dep={dep} onRemove={() => removeBlocker(dep.depId)} />
          ))}
        </div>
      )}

      {/* Search to add */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Blocker hinzufügen</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ticket suchen..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-[12px] text-[#f1f5f9] placeholder:text-[#475569] outline-none focus:border-indigo-500"
            style={{ background: "#0f172a", border: "1px solid #334155" }}
          />
          {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-[#475569]" />}
        </div>
        {searchResults.length > 0 && (
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #334155" }}>
            {searchResults.slice(0, 6).map((t) => (
              <button
                key={t.id}
                onClick={() => addBlocker(t.id)}
                disabled={adding}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1e293b] transition-colors"
                style={{ borderBottom: "1px solid #1e293b" }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColors[t.status] ?? "#64748b" }} />
                <span className="text-[12px] text-[#94a3b8] flex-1 truncate">{t.title}</span>
                <Link2 className="w-3 h-3 text-[#475569] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [pending, setPending] = useState(false);
  const [priority, setPriority] = useState("2");
  const [type, setType] = useState("task");
  const [status, setStatus] = useState("todo");
  const [startingTask, setStartingTask] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showTimeTracker, setShowTimeTracker] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const [recommendation, setRecommendation] = useState<{ model: string; reason: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [publishDone, setPublishDone] = useState(false);

  useEffect(() => {
    params.then(p => setTicketId(p.id));
  }, [params]);

  useEffect(() => {
    if (!ticketId) return;
    loadTicket();
  }, [ticketId]);

  async function loadTicket() {
    if (!ticketId) return;
    const res = await fetch(`/api/tickets/${ticketId}`);
    const data = await res.json();
    setTicket(data);
    setPriority(String(data.priority ?? 2));
    setType(data.type || "task");
    setStatus(data.status || "todo");

    // Show existing AI analysis if any
    if (data.progressLog) {
      try {
        const entries: ProgressEntry[] = JSON.parse(data.progressLog);
        if (entries.length > 0) setAiAnalysis(entries[entries.length - 1].msg);
      } catch {}
    }

    // Load recommendation (non-blocking)
    fetch("/api/llm/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketType: data.type, title: data.title }),
    }).then(r => r.json()).then(rec => {
      if (rec.recommended) {
        setRecommendation({ model: rec.recommended.model.id, reason: rec.reason || rec.recommended.reason });
      }
    }).catch(() => {});
  }

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
    if ("error" in result) { toast.error(result.error); setStatus(ticket.status); }
    else if (newStatus === "done") toast.success("✅ Changelog-Eintrag erstellt!");
  }

  async function handleDelete() {
    if (!confirm("Ticket wirklich löschen?")) return;
    const result = await deleteTicket(ticket.id);
    if (result.error) toast.error(result.error);
    else { toast.success("Gelöscht"); router.push(`/projects/${ticket.agenda.projectId}/agendas/${ticket.agendaId}`); }
  }

  async function handleStartTask() {
    setStartingTask(true);
    try {
      const res = await fetch("/api/llm/start-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStatus("in_progress");
      setTicket((prev: any) => ({ ...prev, status: "in_progress", isActivated: true }));
      if (data.aiAnalysis) setAiAnalysis(data.aiAnalysis);
      toast.success(`🚀 Task gestartet! ${data.modelUsed ? `· ${data.modelUsed}` : ""}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setStartingTask(false);
    }
  }

  const isNotStarted = status === "todo" || status === "backlog";
  const isInProgress = status === "in_progress";
  const isInReview = status === "in_review";

  async function handlePublish() {
    if (!confirm("Jetzt veröffentlichen / deployen?")) return;
    setPublishing(true);
    setPublishLogs(["⏳ Starte Publish-Prozess..."]);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/publish`, { method: "POST" });
      const data = await res.json();
      setPublishLogs(data.logs || []);
      if (data.success) {
        setStatus("done");
        setPublishDone(true);
        toast.success(`🚀 ${data.label} — erfolgreich deployed!`);
      } else {
        toast.error("Publish fehlgeschlagen — Details in den Logs");
      }
    } catch (err) {
      setPublishLogs([`❌ Fehler: ${String(err)}`]);
      toast.error("Publish-Fehler");
    } finally {
      setPublishing(false);
    }
  }

  // Determine publish label based on project name
  function getPublishLabel() {
    const projectName = (ticket.agenda?.project?.name ?? "").toLowerCase();
    if (projectName.includes("example") || projectName.includes("website")) return "🌐 Cloudflare Pages deployen";
    if (projectName.includes("post") || projectName.includes("linkedin")) return "📱 LinkedIn Posts freigeben";
    return "✅ Als erledigt bestätigen";
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/projects/${ticket.agenda?.projectId}/agendas/${ticket.agendaId}`}>
          <button className="flex items-center justify-center w-8 h-8 rounded-md text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e293b] transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#64748b]">{ticket.agenda?.project?.name}</span>
            <span className="text-[#334155]">→</span>
            <span className="text-[11px] text-[#64748b]">{ticket.agenda?.name}</span>
          </div>
          <p className="text-[10px] text-[#475569] font-mono mt-0.5">{ticket.id.slice(-8)}</p>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center justify-center w-8 h-8 rounded-md text-red-500/60 hover:text-red-400 hover:bg-red-950/30 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* START BUTTON — Only when todo or backlog */}
      {isNotStarted && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid rgba(99,102,241,0.25)" }}>
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
              <Play className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[#f1f5f9]">Bereit zum Starten</p>
              <p className="text-[11px] text-[#64748b] mt-0.5">Ticket in Bearbeitung verschieben + KI-Analyse starten</p>
              {recommendation && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Brain className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] text-[#6366f1]">Empfohlen: <strong className="text-[#a5b4fc]">{recommendation.model}</strong></span>
                </div>
              )}
            </div>
            <button
              onClick={handleStartTask}
              disabled={startingTask}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150"
              style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }}
            >
              {startingTask
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starte...</>
                : <><Play className="w-3.5 h-3.5" /> Starten</>}
            </button>
          </div>
        </div>
      )}

      {/* PUBLISH BUTTON — Only when in_review */}
      {isInReview && !publishDone && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid rgba(168,85,247,0.4)" }}>
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)" }}>
              <Rocket className="w-4 h-4" style={{ color: "#a855f7" }} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-[#f1f5f9]">Bereit zur Veröffentlichung</p>
              <p className="text-[11px] text-[#64748b] mt-0.5">Ticket ist in Review — jetzt live deployen und als erledigt markieren</p>
              <p className="text-[11px] mt-1" style={{ color: "#a855f7" }}>
                {getPublishLabel()}
              </p>
            </div>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150"
              style={{ background: "rgba(168,85,247,0.2)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.5)" }}
            >
              {publishing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deploying...</>
                : <><Rocket className="w-3.5 h-3.5" /> Bestätigen & Live</>}
            </button>
          </div>

          {/* Publish Logs */}
          {publishLogs.length > 0 && (
            <div className="px-4 pb-4">
              <div className="rounded-lg p-3 font-mono text-[11px] space-y-0.5" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                <div className="flex items-center gap-1.5 mb-2 pb-2" style={{ borderBottom: "1px solid #1e293b" }}>
                  <Terminal className="w-3 h-3 text-[#64748b]" />
                  <span className="text-[10px] text-[#64748b] font-sans">Deploy Output</span>
                </div>
                {publishLogs.map((line, i) => (
                  <div key={i} className="text-[#94a3b8] leading-relaxed whitespace-pre-wrap break-all">
                    {line}
                  </div>
                ))}
                {publishing && <div className="text-indigo-400 animate-pulse">▋</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis (shown after start or if existing progress) */}
      {aiAnalysis && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid rgba(99,102,241,0.2)" }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(99,102,241,0.12)", background: "rgba(99,102,241,0.06)" }}>
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-300">KI-Analyse</span>
            {isInProgress && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-pulse" />
                In Bearbeitung
              </span>
            )}
          </div>
          <div className="px-4 py-3 text-[12px] text-[#94a3b8] leading-relaxed whitespace-pre-wrap">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* Status selector */}
      <div className="p-4 rounded-xl" style={{ background: "#1e293b", border: "1px solid #334155" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] mb-3">Status</p>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABELS).map(([s, label]) => {
            const colors: Record<string, string> = {
              backlog: "#64748b", todo: "#6366f1", in_progress: "#f97316", in_review: "#a855f7", done: "#22c55e"
            };
            const c = colors[s];
            return (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150"
                style={{
                  background: status === s ? `${c}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${status === s ? c + "50" : "#334155"}`,
                  color: status === s ? c : "#64748b",
                }}
              >
                {s === "done" && status === s && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="p-5 rounded-xl space-y-4" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Titel *</Label>
            <Input name="title" defaultValue={ticket.title} required
              className="text-[#f1f5f9] text-[14px] font-medium"
              style={{ background: "#0f172a", border: "1px solid #334155" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger style={{ background: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0f172a", border: "1px solid #334155" }}>
                  <SelectItem value="0">🔴 P0 — Kritisch</SelectItem>
                  <SelectItem value="1">🟠 P1 — Hoch</SelectItem>
                  <SelectItem value="2">🟡 P2 — Normal</SelectItem>
                  <SelectItem value="3">🔵 P3 — Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Typ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger style={{ background: "#0f172a", border: "1px solid #334155", color: "#f1f5f9" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0f172a", border: "1px solid #334155" }}>
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
            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Beschreibung (Markdown)</Label>
            <Textarea name="description" defaultValue={ticket.description || ""} rows={5}
              className="text-[#f1f5f9] placeholder:text-[#475569] resize-none font-mono text-[13px]"
              placeholder="Beschreibung, Schritte, Links..."
              style={{ background: "#0f172a", border: "1px solid #334155" }} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] flex items-center gap-1.5">
              <span style={{ color: "#22d3ee" }}>⚡</span>
              Claude Context
            </Label>
            <Textarea name="claudeContext" defaultValue={ticket.claudeContext || ""} rows={3}
              placeholder="Dateipfade, relevante Infos für Claude Code..."
              className="text-[#f1f5f9] placeholder:text-[#475569] resize-none font-mono text-[12px]"
              style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.2)" }} />
            <p className="text-[10px] text-[#475569]">Dieser Inhalt erscheint in CLAUDE_QUEUE.md</p>
          </div>
        </div>

        <button type="submit" disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all"
          style={{ background: pending ? "#1e293b" : "linear-gradient(135deg, #4f46e5, #6366f1)" }}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Speichern
        </button>
      </form>

      {/* Time Tracker Panel */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid #334155" }}>
        <button
          onClick={() => setShowTimeTracker(!showTimeTracker)}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-all hover:bg-[#243044]"
        >
          <Timer className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[12px] font-semibold text-orange-300 flex-1">Zeiterfassung</span>
          <span className="text-[10px] text-[#475569]">Start/Stop-Timer · Stundenprotokoll</span>
          {showTimeTracker ? <ChevronUp className="w-3.5 h-3.5 text-[#475569]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />}
        </button>
        {showTimeTracker && (
          <div className="px-4 pb-4">
            <TimeTrackerPanel ticketId={ticket.id} />
          </div>
        )}
      </div>

      {/* Dependencies Panel */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid #334155" }}>
        <button
          onClick={() => setShowDependencies(!showDependencies)}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-all hover:bg-[#243044]"
        >
          <Link2 className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[12px] font-semibold text-amber-300 flex-1">Abhängigkeiten</span>
          <span className="text-[10px] text-[#475569]">Blockiert durch / blockiert</span>
          {showDependencies ? <ChevronUp className="w-3.5 h-3.5 text-[#475569]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />}
        </button>
        {showDependencies && (
          <div className="px-4 pb-4">
            <DependenciesPanel ticketId={ticket.id} />
          </div>
        )}
      </div>

      {/* Attachments Panel */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid #334155" }}>
        <button
          onClick={() => setShowAttachments(!showAttachments)}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-all hover:bg-[#243044]"
        >
          <Paperclip className="w-3.5 h-3.5 text-[#64748b]" />
          <span className="text-[12px] font-semibold text-[#94a3b8] flex-1">Anhänge</span>
          <span className="text-[10px] text-[#475569]">Screenshot per Strg+V · PDF, Bilder, Dokumente</span>
          {showAttachments ? <ChevronUp className="w-3.5 h-3.5 text-[#475569]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />}
        </button>
        {showAttachments && (
          <div className="px-4 pb-4">
            <AttachmentsPanel ticketId={ticket.id} />
          </div>
        )}
      </div>

      {/* AI Chat Panel */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid rgba(99,102,241,0.2)" }}>
        <button
          onClick={() => setShowAiChat(!showAiChat)}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-all hover:bg-[#243044]"
        >
          <Brain className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[12px] font-semibold text-indigo-300 flex-1">KI-Assistent</span>
          <span className="text-[10px] text-[#64748b]">Lokales LLM · Ollama + LM Studio</span>
          {showAiChat ? <ChevronUp className="w-3.5 h-3.5 text-[#475569]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />}
        </button>
        {showAiChat && (
          <div className="px-4 pb-4">
            <AIChatPanel ticket={ticket} />
          </div>
        )}
      </div>
    </div>
  );
}

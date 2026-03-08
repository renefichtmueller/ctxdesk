import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { Brain, FileText, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContextEditor } from "@/components/context/context-editor";

const FILES = [
  {
    key: "queue",
    label: "CLAUDE_QUEUE.md",
    path: "./CLAUDE_QUEUE.md",
    description: "Auto-generierte Queue für Claude Code",
    color: "#6366f1",
    readOnly: true,
  },
  {
    key: "global-memory",
    label: "Globale Memory",
    path: `${process.env.HOME}/.claude/projects/-Users-renefichtmueller-Desktop-Claude-Code/memory/MEMORY.md`,
    description: "~/.claude/projects/.../MEMORY.md — Claude-übergreifende Erinnerungen",
    color: "#22d3ee",
    readOnly: false,
  },
  {
    key: "global-claude",
    label: "Globale CLAUDE.md",
    path: `${process.env.HOME}/.claude/CLAUDE.md`,
    description: "~/.claude/CLAUDE.md — Globale Claude-Anweisungen",
    color: "#f472b6",
    readOnly: false,
  },
  {
    key: "ctxpost-claude",
    label: "CtxPost CLAUDE.md",
    path: `${process.env.HOME}/Desktop/Claude Code/ctxpost/CLAUDE.md`,
    description: "CtxPost projektspezifische Anweisungen",
    color: "#a78bfa",
    readOnly: false,
  },
  {
    key: "ctxevent-claude",
    label: "CtxEvent CLAUDE.md",
    path: `${process.env.HOME}/Desktop/Claude Code/ctxevent/CLAUDE.md`,
    description: "CtxEvent projektspezifische Anweisungen",
    color: "#fb923c",
    readOnly: false,
  },
];

export default function ContextPage() {
  const fileContents = FILES.map((f) => {
    const absPath = resolve(f.path);
    let content = "";
    let exists = false;
    try {
      if (existsSync(absPath)) {
        content = readFileSync(absPath, "utf-8");
        exists = true;
      }
    } catch {}
    return { ...f, absPath, content, exists };
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5" style={{ color: "#6366f1" }} />
        <h1 className="text-2xl font-bold text-white">Claude Context</h1>
      </div>

      <div
        className="p-4 rounded-xl"
        style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)" }}
      >
        <p className="text-xs text-slate-300">
          Hier siehst du alle Claude-relevanten Dateien zentral. Die Queue wird automatisch generiert.
          MEMORY.md und CLAUDE.md Dateien können direkt bearbeitet werden.
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          MacBook: localhost:3002 · MacStudio: 192.0.2.10:3002
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {fileContents.map((file) => (
          <div
            key={file.key}
            className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${file.color}20` }}
          >
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ background: `${file.color}08`, borderBottom: `1px solid ${file.color}15` }}
            >
              <FileText className="w-4 h-4 shrink-0" style={{ color: file.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{file.label}</span>
                  {file.readOnly && (
                    <Badge className="text-[8px] px-1" style={{ background: `${file.color}15`, color: file.color, border: `1px solid ${file.color}30` }}>
                      Auto
                    </Badge>
                  )}
                  {!file.exists && (
                    <Badge className="text-[8px] px-1" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                      Nicht gefunden
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 truncate">{file.description}</p>
              </div>
            </div>
            <ContextEditor
              fileKey={file.key}
              content={file.content}
              absPath={file.absPath}
              readOnly={file.readOnly}
              exists={file.exists}
              color={file.color}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

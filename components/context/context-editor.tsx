"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Loader2, RefreshCw } from "lucide-react";

interface ContextEditorProps {
  fileKey: string;
  content: string;
  absPath: string;
  readOnly: boolean;
  exists: boolean;
  color: string;
}

export function ContextEditor({
  fileKey,
  content: initialContent,
  absPath,
  readOnly,
  exists,
  color,
}: ContextEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(true);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/context/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ absPath, content }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Fehler beim Speichern");
        } else {
          toast.success("Gespeichert ✓");
          setSaved(true);
        }
      } catch {
        toast.error("Netzwerkfehler");
      }
    });
  };

  const handleChange = (val: string) => {
    setContent(val);
    setSaved(false);
  };

  const handleReset = () => {
    setContent(initialContent);
    setSaved(true);
  };

  if (!exists) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-slate-500">Datei nicht gefunden</p>
        <p className="text-[10px] text-slate-600 mt-1 font-mono break-all">{absPath}</p>
      </div>
    );
  }

  if (readOnly) {
    return (
      <pre
        className="text-[11px] text-slate-300 font-mono p-4 overflow-auto leading-relaxed"
        style={{ maxHeight: "400px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      >
        {content || <span className="text-slate-600 italic">— leer —</span>}
      </pre>
    );
  }

  return (
    <div className="flex flex-col">
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        className="text-[11px] text-slate-200 font-mono p-4 bg-transparent resize-none focus:outline-none leading-relaxed"
        style={{ minHeight: "300px", maxHeight: "500px" }}
        placeholder="— leer —"
        spellCheck={false}
      />
      <div
        className="px-4 py-2 flex items-center justify-between gap-2"
        style={{ borderTop: `1px solid ${color}15`, background: `${color}05` }}
      >
        <span className="text-[10px] text-slate-600 font-mono truncate flex-1">{absPath}</span>
        <div className="flex items-center gap-2 shrink-0">
          {!saved && (
            <button
              onClick={handleReset}
              className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Zurücksetzen
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isPending || saved}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-40"
            style={{
              background: saved ? `${color}15` : `${color}25`,
              color: saved ? `${color}80` : color,
              border: `1px solid ${color}30`,
            }}
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saved ? "Gespeichert" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

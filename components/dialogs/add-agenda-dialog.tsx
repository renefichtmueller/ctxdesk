"use client";

import { useState } from "react";
import { createAgenda } from "@/actions/agendas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

interface AddAgendaDialogProps {
  projectId: string;
}

export function AddAgendaDialog({ projectId }: AddAgendaDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [priority, setPriority] = useState("2");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("priority", priority);
    const result = await createAgenda(projectId, formData);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Agenda erstellt!");
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 text-xs font-semibold text-white border-0"
          style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)", boxShadow: "0 0 12px rgba(79,70,229,0.4)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Neue Agenda
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        style={{ background: "#0e1528", border: "1px solid rgba(99,102,241,0.2)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-white">Neue Agenda erstellen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="agenda-name" className="text-slate-400 text-xs uppercase tracking-wider">Name *</Label>
            <Input
              id="agenda-name"
              name="name"
              placeholder="z.B. OAuth Fix"
              required
              className="text-white placeholder:text-slate-500"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-desc" className="text-slate-400 text-xs uppercase tracking-wider">Beschreibung</Label>
            <Textarea
              id="agenda-desc"
              name="description"
              rows={2}
              className="text-white placeholder:text-slate-500 resize-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }}
            />
          </div>
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
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 text-slate-400" style={{ borderColor: "rgba(99,102,241,0.2)" }}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending} className="flex-1 gap-2 text-white border-0" style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}>
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Erstellen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PROJECT_COLORS } from "@/lib/constants";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("color", selectedColor);
    const result = await createProject(formData);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Projekt erstellt!");
      router.push(`/projects/${result.projectId}`);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Neues Projekt</h1>
          <p className="text-sm text-slate-400">Erstelle ein neues Projekt</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div
          className="p-6 rounded-xl space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.15)" }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Name *
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="z.B. CtxPost v2"
              required
              className="h-10 text-white placeholder:text-slate-500"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: "0.625rem",
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Beschreibung
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Kurze Beschreibung des Projekts..."
              rows={3}
              className="text-white placeholder:text-slate-500 resize-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: "0.625rem",
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs font-medium uppercase tracking-wider">Farbe</Label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className="w-7 h-7 rounded-full transition-all duration-150 hover:scale-110"
                  style={{
                    background: color,
                    boxShadow: selectedColor === color ? `0 0 10px ${color}` : "none",
                    outline: selectedColor === color ? `2px solid ${color}` : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/projects" className="flex-1">
            <Button variant="outline" className="w-full" style={{ borderColor: "rgba(99,102,241,0.2)", color: "#94a3b8" }}>
              Abbrechen
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={pending}
            className="flex-1 gap-2 text-white border-0"
            style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Erstellen
          </Button>
        </div>
      </form>
    </div>
  );
}

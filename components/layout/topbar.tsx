"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Cpu, Wifi } from "lucide-react";
import { useState, useEffect } from "react";

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="font-mono text-[12px] text-[#475569]">--:--:--</span>;
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
  return (
    <span className="font-mono text-[12px] text-[#64748b]">
      {dateStr} <span className="text-[#334155] mx-1">·</span> <span className="text-[#94a3b8]">{timeStr}</span>
    </span>
  );
}

export function Topbar() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center gap-3 px-5 py-2.5"
      style={{
        background: "rgba(15, 23, 42, 0.95)",
        borderBottom: "1px solid #1e293b",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        minHeight: "48px",
      }}
    >
      {/* Left: system info */}
      <div className="hidden md:flex items-center gap-2 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-pulse" />
          <span className="text-[11px] font-medium text-[#64748b]">Online</span>
        </div>

        <div className="w-px h-3 bg-[#1e293b]" />

        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-[#475569]" />
          <span className="text-[11px] text-[#475569] font-mono">Mac Studio</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-[#475569]" />
          <span className="text-[11px] text-[#475569] font-mono">:3002</span>
        </div>

        <div className="w-px h-3 bg-[#1e293b]" />

        <LiveClock />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 ml-auto">
        <Link href="/agenda-sync">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-[12px] font-medium text-[#64748b] hover:text-[#cbd5e1] hover:bg-[#1e293b] border border-transparent hover:border-[#334155]"
          >
            Agenda Sync
          </Button>
        </Link>
        <Link href="/projects/new">
          <Button
            size="sm"
            className="h-8 gap-1.5 text-[12px] font-semibold text-white border-0 rounded-md"
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Neues Projekt
          </Button>
        </Link>
      </div>
    </header>
  );
}

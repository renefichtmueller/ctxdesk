"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  FolderOpen,
  Inbox,
  ScrollText,
  Terminal,
  ChevronRight,
  ChevronLeft,
  Zap,
  Brain,
  RefreshCw,
  Activity,
  Settings,
  Globe,
  Sparkles,
  BarChart2,
} from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

interface SidebarProps {
  inboxCount?: number;
}

export function Sidebar({ inboxCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [lmStudioOnline, setLmStudioOnline] = useState<boolean | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("ctxdesk-sidebar-expanded");
      if (stored === "true") setExpanded(true);
    } catch {}
    checkLLMStatus();
    const interval = setInterval(checkLLMStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkLLMStatus() {
    try {
      let cfg: Record<string, string> = {};
      try { cfg = JSON.parse(localStorage.getItem("ctxdesk-llm-config") || "{}"); } catch {}
      const params = new URLSearchParams({
        ollamaUrl: cfg.ollamaUrl || "http://localhost:11434",
        lmStudioUrl: cfg.lmStudioUrl || "http://localhost:1234",
        remoteOllamaUrl: cfg.remoteOllamaUrl || "https://ollama.example.com",
        ...(cfg.ollamaApiKey ? { ollamaApiKey: cfg.ollamaApiKey } : {}),
      });
      const res = await fetch(`/api/llm/models?${params}`);
      const data = await res.json();
      setOllamaOnline(data.ollamaOnline);
      setLmStudioOnline(data.lmStudioOnline);
    } catch {
      setOllamaOnline(false);
      setLmStudioOnline(false);
    }
  }

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("ctxdesk-sidebar-expanded", String(next)); } catch {}
  };

  const navGroups = [
    {
      groupLabel: t("overviewGroup"),
      items: [
        { href: "/", icon: LayoutDashboard, label: t("dashboard") },
        { href: "/projects", icon: FolderOpen, label: t("projects") },
        { href: "/live-log", icon: Activity, label: t("liveLog") },
      ],
    },
    {
      groupLabel: t("workflowGroup"),
      items: [
        { href: "/inbox", icon: Inbox, label: t("inbox"), badge: inboxCount > 0 ? inboxCount : undefined },
        { href: "/changelog", icon: ScrollText, label: t("changelog") },
        { href: "/queue", icon: Terminal, label: t("queue") },
        { href: "/context", icon: Brain, label: t("context") },
        { href: "/agenda-sync", icon: RefreshCw, label: t("agendaSync") },
        { href: "/network", icon: Globe, label: "Network" },
        { href: "/digest", icon: Sparkles, label: "Daily Digest" },
        { href: "/reports", icon: BarChart2, label: "Reports" },
      ],
    },
    {
      groupLabel: t("general"),
      items: [
        { href: "/settings", icon: Settings, label: t("settings") },
      ],
    },
  ];

  const isExpanded = mounted && expanded;
  const sidebarWidth = isExpanded ? "220px" : "60px";
  const anyLLMOnline = ollamaOnline || lmStudioOnline;

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className="hidden md:flex flex-col h-screen sticky top-0 overflow-hidden shrink-0"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          background: "#0b1221",
          borderRight: "1px solid #1e293b",
          transition: "width 250ms ease, min-width 250ms ease",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center py-[14px] shrink-0"
          style={{
            padding: isExpanded ? "14px 16px" : "14px 0",
            justifyContent: isExpanded ? "flex-start" : "center",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/" className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
                  <Zap className="w-4 h-4 text-white" />
                </div>
                {isExpanded && (
                  <div className="min-w-0">
                    <span className="font-bold text-[#f1f5f9] text-[13px] tracking-tight block leading-none">CtxDesk</span>
                    <span className="text-[10px] text-[#64748b] leading-none mt-0.5 block">{t("missionControl")}</span>
                  </div>
                )}
              </Link>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right">
                <p className="font-semibold">CtxDesk</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col py-3 overflow-y-auto overflow-x-hidden">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="mb-1">
              {isExpanded && (
                <div className="px-4 mb-1.5 mt-2">
                  <span className="ctx-section-title">{group.groupLabel}</span>
                </div>
              )}
              {!isExpanded && groupIdx > 0 && <div className="my-2 mx-4 h-px bg-[#1e293b]" />}
              <div className={cn("flex flex-col gap-0.5", isExpanded ? "px-2" : "items-center px-2")}>
                {group.items.map((item) => {
                  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const itemEl = (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md transition-all duration-150",
                        isExpanded ? "px-3 py-2 w-full" : "w-9 h-9 justify-center",
                        isActive ? "bg-[#1e293b] text-[#f1f5f9]" : "text-[#64748b] hover:bg-[#1a2540] hover:text-[#cbd5e1]"
                      )}
                    >
                      {isActive && isExpanded && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: "#6366f1" }} />
                      )}
                      <div className="relative shrink-0">
                        <item.icon className="h-[16px] w-[16px]" style={{ color: isActive ? "#6366f1" : undefined }} />
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full bg-red-500 text-white">
                            {item.badge > 9 ? "9+" : item.badge}
                          </span>
                        )}
                      </div>
                      {isExpanded && <span className="text-[13px] font-medium truncate flex-1 leading-none">{item.label}</span>}
                      {isExpanded && item.badge !== undefined && item.badge > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">{item.badge}</span>
                      )}
                    </Link>
                  );
                  if (!isExpanded) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{itemEl}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          <p>{item.label}{item.badge ? ` (${item.badge})` : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return itemEl;
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: LLM status + toggle */}
        <div className="flex flex-col pb-4 pt-3 gap-2 shrink-0" style={{ borderTop: "1px solid #1e293b" }}>
          {isExpanded && (
            <div className="flex flex-col gap-1 px-4">
              {ollamaOnline !== null && (
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", ollamaOnline ? "bg-emerald-400 live-pulse" : "bg-red-500")} />
                  <span className={cn("text-[10px]", ollamaOnline ? "text-[#64748b]" : "text-red-500/60")}>Ollama {ollamaOnline ? "online" : "offline"}</span>
                </div>
              )}
              {lmStudioOnline !== null && (
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", lmStudioOnline ? "bg-purple-400 live-pulse" : "bg-red-500")} />
                  <span className={cn("text-[10px]", lmStudioOnline ? "text-[#64748b]" : "text-red-500/60")}>LM Studio {lmStudioOnline ? "online" : "offline"}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-pulse" />
                <span className="text-[10px] text-[#64748b]">Mac Studio · :3002</span>
              </div>
            </div>
          )}
          {!isExpanded && ollamaOnline !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center cursor-default">
                  <div className={cn("w-2 h-2 rounded-full", anyLLMOnline ? "bg-emerald-400 live-pulse" : "bg-red-500")} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p>Ollama: {ollamaOnline ? "✅" : "❌"} · LM Studio: {lmStudioOnline ? "✅" : "❌"}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <div className={cn("flex", isExpanded ? "px-2" : "justify-center px-2")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleExpanded}
                  className="flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 text-[#64748b] hover:text-[#cbd5e1] hover:bg-[#1e293b]"
                >
                  {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p>{isExpanded ? "Einklappen" : "Ausklappen"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

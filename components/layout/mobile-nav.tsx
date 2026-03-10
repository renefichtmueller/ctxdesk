"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  LayoutDashboard,
  Terminal,
  Activity,
  Server,
  Settings,
  Menu,
  X,
  Zap,
  FolderOpen,
  Inbox,
  ScrollText,
  Brain,
  RefreshCw,
  Globe,
  Sparkles,
  BarChart2,
} from "lucide-react";

// Page title lookup
const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/queue": "Queue",
  "/inbox": "Inbox",
  "/live-log": "Live Log",
  "/infrastructure": "Infrastructure",
  "/context": "Context",
  "/settings": "Settings",
  "/network": "Network",
  "/digest": "Daily Digest",
  "/reports": "Reports",
  "/changelog": "Changelog",
  "/agenda-sync": "Agenda Sync",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/tickets/")) return "Ticket";
  if (pathname.startsWith("/projects/") && pathname.includes("/agendas/")) return "Agenda";
  if (pathname.startsWith("/projects/new")) return "Neues Projekt";
  if (pathname.startsWith("/projects/")) return "Projekt";
  return "CtxDesk";
}

function getParentPath(pathname: string): string | null {
  if (pathname === "/") return null;
  if (pathname.startsWith("/tickets/")) return "/queue";
  if (pathname.startsWith("/projects/") && pathname.includes("/agendas/")) {
    return pathname.split("/agendas/")[0];
  }
  if (pathname.startsWith("/projects/") && pathname !== "/projects") return "/projects";
  return "/";
}

// Bottom tab items
const TAB_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/queue", icon: Terminal, label: "Queue" },
  { href: "/live-log", icon: Activity, label: "Live" },
  { href: "/infrastructure", icon: Server, label: "Infra" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

// Full nav items (mirroring sidebar)
const NAV_GROUPS = [
  {
    groupLabel: "Übersicht",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/projects", icon: FolderOpen, label: "Projekte" },
      { href: "/live-log", icon: Activity, label: "Live Log" },
    ],
  },
  {
    groupLabel: "Workflow",
    items: [
      { href: "/inbox", icon: Inbox, label: "Inbox" },
      { href: "/changelog", icon: ScrollText, label: "Changelog" },
      { href: "/queue", icon: Terminal, label: "Queue" },
      { href: "/context", icon: Brain, label: "Context" },
      { href: "/agenda-sync", icon: RefreshCw, label: "Agenda Sync" },
      { href: "/network", icon: Globe, label: "Network" },
      { href: "/infrastructure", icon: Server, label: "Infrastructure" },
      { href: "/digest", icon: Sparkles, label: "Daily Digest" },
      { href: "/reports", icon: BarChart2, label: "Reports" },
    ],
  },
  {
    groupLabel: "Allgemein",
    items: [
      { href: "/settings", icon: Settings, label: "Einstellungen" },
    ],
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isHome = pathname === "/";
  const title = getPageTitle(pathname);
  const parentPath = getParentPath(pathname);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      {/* ── Mobile Top Header ────────────────────────────────── */}
      <header
        className="md:hidden sticky top-0 z-50 flex items-center gap-3 px-4"
        style={{
          background: "rgba(11, 18, 33, 0.97)",
          borderBottom: "1px solid #1e293b",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          minHeight: "52px",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* Back button or logo */}
        {!isHome && parentPath ? (
          <button
            onClick={() => router.push(parentPath)}
            className="flex items-center justify-center w-8 h-8 rounded-lg -ml-1 transition-colors active:bg-white/10"
            style={{ color: "#6366f1" }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
        ) : (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
          >
            <span className="text-white text-xs font-black">C</span>
          </div>
        )}

        {/* Title */}
        <span className="text-[15px] font-bold text-white tracking-tight flex-1 truncate">
          {isHome ? "CtxDesk" : title}
        </span>

        {/* Hamburger button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors active:bg-white/10"
          style={{ color: "#94a3b8" }}
          aria-label="Navigation öffnen"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── Backdrop ─────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60]"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Drawer ────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 bottom-0 z-[70] flex flex-col overflow-y-auto"
        style={{
          width: "280px",
          background: "#0b1221",
          borderRight: "1px solid #1e293b",
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 280ms cubic-bezier(0.4,0,0.2,1)",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-hidden={!drawerOpen}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid #1e293b" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm block leading-none">CtxDesk</span>
              <span className="text-[10px] text-slate-500 leading-none mt-0.5 block">Mission Control</span>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors active:bg-white/10"
            style={{ color: "#64748b" }}
            aria-label="Menü schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="mb-2">
              <div className="px-4 mb-1.5 mt-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "#475569" }}
                >
                  {group.groupLabel}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-2">
                {group.items.map((item) => {
                  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors active:bg-white/5"
                      style={{
                        background: isActive ? "#1e293b" : "transparent",
                        color: isActive ? "#f1f5f9" : "#94a3b8",
                      }}
                    >
                      {isActive && (
                        <div
                          className="absolute left-0 w-0.5 h-5 rounded-r-full"
                          style={{ background: "#6366f1" }}
                        />
                      )}
                      <item.icon
                        className="w-4 h-4 shrink-0"
                        style={{ color: isActive ? "#6366f1" : undefined }}
                      />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Drawer footer */}
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderTop: "1px solid #1e293b" }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: "pulse 2s infinite" }} />
            <span className="text-[10px] text-slate-500">Mac Studio · :3002</span>
          </div>
        </div>
      </div>

      {/* ── Bottom Tab Bar ───────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center"
        style={{
          background: "rgba(11, 18, 33, 0.97)",
          borderTop: "1px solid #1e293b",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {TAB_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors active:bg-white/5"
            >
              <item.icon
                className="w-[22px] h-[22px] transition-colors"
                style={{ color: isActive ? "#6366f1" : "#475569" }}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className="text-[10px] font-medium transition-colors"
                style={{ color: isActive ? "#6366f1" : "#475569" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

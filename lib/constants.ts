export const PRIORITY_LABELS: Record<number, string> = {
  0: "P0 — Kritisch",
  1: "P1 — Hoch",
  2: "P2 — Normal",
  3: "P3 — Low",
};

export const PRIORITY_COLORS: Record<number, string> = {
  0: "#ef4444",
  1: "#f97316",
  2: "#eab308",
  3: "#6366f1",
};

export const PRIORITY_EMOJIS: Record<number, string> = {
  0: "🔴",
  1: "🟠",
  2: "🟡",
  3: "🔵",
};

export const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const TICKET_TYPES: Record<string, { label: string; color: string }> = {
  feature: { label: "Feature", color: "#6366f1" },
  bug: { label: "Bug", color: "#ef4444" },
  task: { label: "Task", color: "#22d3ee" },
  improvement: { label: "Improvement", color: "#f472b6" },
  research: { label: "Research", color: "#a78bfa" },
};

export const KANBAN_COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "Review" },
  { id: "done", label: "Done" },
];

export const INBOX_DIR = process.env.INBOX_DIR || "./inbox";
export const QUEUE_FILE = process.env.QUEUE_FILE || "./CLAUDE_QUEUE.md";

export const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
  "#eab308", "#22d3ee", "#10b981", "#3b82f6",
];

export const PROJECT_ICONS = [
  "folder", "zap", "code-2", "globe", "layers", "box",
  "database", "server", "cpu", "brain", "rocket", "star",
];

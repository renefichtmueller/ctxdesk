/**
 * Agenda Parser — Parses the Example Org agenda.md format
 * Extracts open items and maps them to CtxDesk projects/tickets
 */

export interface ParsedAgendaItem {
  id: string;          // e.g. "INFRA-3", "CtxEvent-6", "#18", "W7"
  title: string;
  description?: string;
  status: "open" | "blocked" | "done" | "partial";
  priority: 0 | 1 | 2 | 3;
  type: string;
  project: string;    // e.g. "CtxEvent", "Infrastruktur", "Website"
  agenda: string;     // sub-grouping, e.g. "Tier 1", "Security Härtung"
  rawNumber?: string;
}

export interface ParseResult {
  items: ParsedAgendaItem[];
  projects: string[];
  errors: string[];
}

// Section → Project mapping
const SECTION_PROJECT_MAP: Record<string, string> = {
  "webseite": "Example Org Website",
  "website": "Example Org Website",
  "example.com": "Example Org Website",
  "ctxevent backlog": "CtxEvent",
  "weltführende features": "CtxEvent",
  "weltfuehrende features": "CtxEvent",
  "infrastruktur": "Infrastruktur",
  "infrastructure": "Infrastruktur",
  "data": "Infrastruktur",
  "ai / llm": "AI & LLM",
  "ai/llm": "AI & LLM",
  "persönlich": "Persönlich",
  "personal": "Persönlich",
  "ctxpost": "CtxPost",
  "ctxspeakerdb": "CtxEvent",
  "speakers": "CtxEvent",
  "grafana": "Infrastruktur",
  "monitoring": "Infrastruktur",
  "network": "Infrastruktur",
  "netzwerk": "Infrastruktur",
  "security": "Security",
  "opnsense": "Infrastruktur",
  "offen": "CtxEvent", // fallback
};

const STATUS_MAP: Record<string, ParsedAgendaItem["status"]> = {
  "erledigt": "done",
  "done": "done",
  "completed": "done",
  "blockiert": "blocked",
  "blocked": "blocked",
  "offen": "open",
  "open": "open",
  "teilweise": "partial",
  "in progress": "partial",
  "wip": "partial",
};

function detectStatus(text: string): ParsedAgendaItem["status"] {
  const lower = text.toLowerCase();
  if (lower.includes("erledigt") || lower.includes("done") || lower.includes("completed")) return "done";
  if (lower.includes("blockiert") || lower.includes("blocked")) return "blocked";
  if (lower.includes("teilweise") || lower.includes("in progress") || lower.includes("wip")) return "partial";
  return "open";
}

function detectPriority(text: string, agendaGroup: string): 0 | 1 | 2 | 3 {
  const lower = (text + " " + agendaGroup).toLowerCase();
  if (lower.includes("tier 1") || lower.includes("kritisch") || lower.includes("critical") || lower.includes("sec-1") || lower.includes("p0")) return 0;
  if (lower.includes("tier 2") || lower.includes("hoch") || lower.includes("high") || lower.includes("p1")) return 1;
  if (lower.includes("tier 3") || lower.includes("p2")) return 2;
  if (lower.includes("tier 4") || lower.includes("niedrig") || lower.includes("low") || lower.includes("p3")) return 3;
  return 2; // default Normal
}

function detectType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("fix") || lower.includes("fehler") || lower.includes("bug") || lower.includes("repair")) return "bug";
  if (lower.includes("crawler") || lower.includes("scraper") || lower.includes("research") || lower.includes("analyse")) return "research";
  if (lower.includes("dashboard") || lower.includes("monitoring") || lower.includes("grafana")) return "feature";
  if (lower.includes("migration") || lower.includes("refactor") || lower.includes("cleanup")) return "improvement";
  if (lower.includes("security") || lower.includes("oauth") || lower.includes("auth") || lower.includes("sec-")) return "task";
  return "feature";
}

function detectProject(sectionTitle: string, itemText: string): string {
  const lower = (sectionTitle + " " + itemText).toLowerCase();

  // Check each keyword
  for (const [keyword, project] of Object.entries(SECTION_PROJECT_MAP)) {
    if (lower.includes(keyword)) return project;
  }

  // Detect by item prefix
  if (/^W\d+/.test(itemText.trim())) return "Example Org Website";
  if (/^CP-/.test(itemText.trim())) return "CtxPost";
  if (/^INFRA-/.test(itemText.trim())) return "Infrastruktur";
  if (/^SEC-/.test(itemText.trim())) return "Security";
  if (/^ML-/.test(itemText.trim())) return "AI & LLM";

  return "CtxEvent"; // fallback
}

export function parseAgendaMd(content: string): ParseResult {
  const items: ParsedAgendaItem[] = [];
  const errors: string[] = [];
  const projectSet = new Set<string>();

  const lines = content.split("\n");
  let currentSection = "";
  let currentProject = "CtxEvent";
  let currentAgenda = "";
  let insideTable = false;
  let tableHeader: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Section headers (## level)
    if (trimmed.startsWith("## ")) {
      const header = trimmed.replace(/^#+\s*/, "").toLowerCase();
      currentSection = header;
      currentProject = detectProject(header, "");
      insideTable = false;
      tableHeader = [];

      // Skip ERLEDIGT section
      if (header.includes("erledigt") && !header.includes("offen")) {
        continue;
      }
      continue;
    }

    // Skip ERLEDIGT section content
    if (currentSection.toLowerCase() === "erledigt" || currentSection.toLowerCase().includes("erledigt")) {
      // Only process items in OFFEN / TEILWEISE sections
      if (!currentSection.includes("offen") && !currentSection.includes("teilweise") && !currentSection.includes("in progress")) {
        continue;
      }
    }

    // Sub-section headers (### level)
    if (trimmed.startsWith("### ")) {
      currentAgenda = trimmed.replace(/^#+\s*/, "");
      // Update project based on sub-section
      const subProject = detectProject(currentSection + " " + currentAgenda, "");
      if (subProject !== "CtxEvent" || currentAgenda.toLowerCase().includes("ctxevent")) {
        // Keep current project unless sub-section is more specific
      }
      insideTable = false;
      tableHeader = [];
      continue;
    }

    // Table rows
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .map(c => c.trim())
        .filter(c => c.length > 0);

      // Header row
      if (cells.some(c => c.toLowerCase().includes("item") || c.toLowerCase().includes("task") || c === "#")) {
        tableHeader = cells.map(c => c.toLowerCase());
        insideTable = true;
        continue;
      }

      // Separator row
      if (cells.every(c => /^[-:]+$/.test(c))) continue;

      // Data row
      if (insideTable && cells.length >= 2) {
        try {
          const numIdx = tableHeader.indexOf("#");
          const itemIdx = tableHeader.findIndex(h => h.includes("item") || h.includes("task") || h.includes("feature"));
          const statusIdx = tableHeader.findIndex(h => h.includes("status") || h.includes("stand"));
          const detailIdx = tableHeader.findIndex(h => h.includes("detail") || h.includes("was fehlt") || h.includes("description"));

          const rawNum = numIdx >= 0 ? cells[numIdx] : "";
          const rawItem = itemIdx >= 0 ? cells[itemIdx] : (cells[1] || cells[0]);
          const rawStatus = statusIdx >= 0 ? cells[statusIdx] : "";
          const rawDetail = detailIdx >= 0 ? cells[detailIdx] : "";

          // Clean title
          const title = rawItem
            .replace(/\*\*/g, "")
            .replace(/`/g, "")
            .replace(/\[.*?\]/g, "")
            .trim();

          if (!title || title.length < 2) continue;

          const status = detectStatus(rawStatus || rawItem);
          // Skip already done items
          if (status === "done") continue;

          const proj = detectProject(currentSection, rawItem);
          projectSet.add(proj);

          const priority = detectPriority(rawItem + " " + rawStatus + " " + currentAgenda, currentAgenda);

          items.push({
            id: `${rawNum || String(items.length)}-${Date.now()}`,
            rawNumber: rawNum,
            title,
            description: rawDetail ? rawDetail.replace(/\*\*/g, "").replace(/`/g, "").slice(0, 500) : undefined,
            status,
            priority,
            type: detectType(rawItem),
            project: proj,
            agenda: currentAgenda || currentSection.replace("offen — ", "").replace("offen -", "").trim(),
          });
        } catch (e) {
          errors.push(`Row parse error line ${i}: ${String(e)}`);
        }
      }
      continue;
    }

    // Reset table on empty or non-table lines
    if (!trimmed.startsWith("|") && insideTable) {
      insideTable = false;
      tableHeader = [];
    }

    // Bullet/dash items (e.g. - Item Text)
    if (trimmed.match(/^[-*]\s+\S/) && !trimmed.startsWith("---")) {
      const rawItem = trimmed.replace(/^[-*]\s+/, "").trim();
      if (!rawItem || rawItem.length < 3) continue;

      const status = detectStatus(rawItem);
      if (status === "done") continue; // Skip done items

      // Extract number prefix if any (e.g. "W7", "CP-1")
      const numMatch = rawItem.match(/^([A-Z]{1,4}[\d-]+)\s*/);
      const rawNum = numMatch ? numMatch[1] : "";
      const cleanTitle = rawItem
        .replace(/^[A-Z]{1,4}[\d-]+[:.]\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .replace(/\[.*?\]/g, "")
        .slice(0, 200)
        .trim();

      if (!cleanTitle || cleanTitle.length < 3) continue;

      const proj = detectProject(currentSection, rawItem);
      projectSet.add(proj);

      items.push({
        id: `${rawNum || String(items.length)}-${Date.now()}`,
        rawNumber: rawNum,
        title: cleanTitle,
        status,
        priority: detectPriority(rawItem, currentAgenda),
        type: detectType(rawItem),
        project: proj,
        agenda: currentAgenda || currentSection.replace("offen — ", "").trim(),
      });
    }

    // Numbered/bold topic headers that aren't table items
    // e.g. "### 41. Grafana Dashboards"
    if (trimmed.match(/^###\s+\d+\./)) {
      currentAgenda = trimmed.replace(/^#+\s*\d+\.\s*/, "");
    }

    // Detect personal items W7, W8, CP-1 style from agenda
    if (trimmed.match(/^\*\*W\d+/) || trimmed.match(/^\*\*CP-\d+/)) {
      const match = trimmed.match(/^\*\*([A-Z]+[\d-]+)\*\*[:\s]+(.*)/);
      if (match) {
        const rawNum = match[1];
        const title = match[2].replace(/\*\*/g, "").trim().slice(0, 200);
        const proj = rawNum.startsWith("CP") ? "CtxPost" : "Persönlich";
        projectSet.add(proj);
        items.push({
          id: `${rawNum}-${Date.now()}`,
          rawNumber: rawNum,
          title,
          status: "open",
          priority: 2,
          type: detectType(title),
          project: proj,
          agenda: "Persönlich",
        });
      }
    }
  }

  return {
    items,
    projects: Array.from(projectSet),
    errors,
  };
}

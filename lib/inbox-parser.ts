import matter from "gray-matter";

export interface ParsedInboxFile {
  title: string;
  description: string;
  projectHint?: string;
  agendaHint?: string;
  priority?: number;
  type?: string;
}

const PRIORITY_MAP: Record<string, number> = {
  p0: 0, "0": 0, critical: 0,
  p1: 1, "1": 1, high: 1,
  p2: 2, "2": 2, normal: 2, medium: 2,
  p3: 3, "3": 3, low: 3,
};

export function parseInboxFile(rawContent: string, filename: string): ParsedInboxFile {
  const parsed = matter(rawContent);
  const data = parsed.data || {};
  const body = parsed.content.trim();

  // Extract title: from frontmatter, first H1, or filename
  let title: string =
    data.title ||
    body.match(/^#\s+(.+)/m)?.[1]?.trim() ||
    filename.replace(/\.md$/i, "").replace(/[-_]/g, " ");

  // Description: body without the first H1
  const description = body.replace(/^#\s+.+\n?/, "").trim();

  // Priority
  let priority: number | undefined;
  if (data.priority !== undefined) {
    const raw = String(data.priority).toLowerCase().trim();
    priority = PRIORITY_MAP[raw] ?? 2;
  }

  return {
    title,
    description,
    projectHint: data.project || data.proj || undefined,
    agendaHint: data.agenda || undefined,
    priority,
    type: data.type || undefined,
  };
}

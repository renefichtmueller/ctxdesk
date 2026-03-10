import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// ─── Paths ────────────────────────────────────────────────────────────────────

const APP_ROOT = process.env.APP_ROOT ?? process.cwd();
const PENDING_PATH = path.join(APP_ROOT, "CHANGELOG_PENDING.md");
const CHANGELOG_PATH = path.join(APP_ROOT, "CHANGELOG.md");

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangelogEntry {
  d: string; // date YYYY-MM-DD
  t: "FEAT" | "UI" | "FIX" | "DATA" | "AI" | "INT";
  m: string; // message
  source?: "pending" | "main";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readPending(): Promise<ChangelogEntry[]> {
  try {
    const content = await fs.readFile(PENDING_PATH, "utf8");
    const entries: ChangelogEntry[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const entry = JSON.parse(trimmed) as ChangelogEntry;
        if (entry.d && entry.t && entry.m) {
          entries.push({ ...entry, source: "pending" });
        }
      } catch { /* skip malformed lines */ }
    }
    return entries;
  } catch {
    return [];
  }
}

async function readMain(): Promise<ChangelogEntry[]> {
  try {
    const content = await fs.readFile(CHANGELOG_PATH, "utf8");
    const entries: ChangelogEntry[] = [];

    // Parse JSON lines embedded in CHANGELOG.md (lines starting with {)
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const entry = JSON.parse(trimmed) as ChangelogEntry;
        if (entry.d && entry.t && entry.m) {
          entries.push({ ...entry, source: "main" });
        }
      } catch { /* skip malformed lines */ }
    }

    // Also parse markdown-style entries like "## [0.6.0] – 2026-03-09"
    const versionRegex = /## \[([^\]]+)\] [–-] (\d{4}-\d{2}-\d{2})/;
    const matches = content.matchAll(new RegExp(versionRegex.source, "g"));
    for (const match of matches) {
      const version = match[1];
      const date = match[2];
      // Find section content
      const sectionStart = content.indexOf(match[0]) + match[0].length;
      const nextSection = content.indexOf("\n## [", sectionStart);
      const sectionContent = content.substring(
        sectionStart,
        nextSection > 0 ? nextSection : content.length
      );

      // Extract Added/Fixed/Changed items
      const itemRegex = /^[-*]\s+\*\*([^*]+)\*\*/gm;
      const items = sectionContent.matchAll(itemRegex);
      for (const item of items) {
        const title = item[1].replace(/[*_]/g, "").trim();
        // Determine type from surrounding section header
        const itemPos = sectionContent.indexOf(item[0]);
        const prevText = sectionContent.substring(0, itemPos);
        const lastHeader = [...prevText.matchAll(/### (Added|Fixed|Changed|Breaking)/g)].pop();
        const section = lastHeader?.[1] ?? "Added";

        let t: ChangelogEntry["t"] = "FEAT";
        if (section === "Fixed") t = "FIX";
        else if (section === "Changed") t = "UI";

        entries.push({
          d: date,
          t,
          m: `[v${version}] ${title}`,
          source: "main",
        });
      }
    }

    return entries;
  } catch {
    return [];
  }
}

// ─── GET — return all changelog entries ──────────────────────────────────────

export async function GET() {
  const [pending, main] = await Promise.all([readPending(), readMain()]);

  const all = [...pending, ...main].sort((a, b) => {
    // Sort by date descending; pending entries first within same date
    if (a.d !== b.d) return b.d.localeCompare(a.d);
    if (a.source === "pending" && b.source !== "pending") return -1;
    if (b.source === "pending" && a.source !== "pending") return 1;
    return 0;
  });

  return NextResponse.json({
    entries: all,
    pendingCount: pending.length,
    mainCount: main.length,
  });
}

// ─── POST — append new entry to CHANGELOG_PENDING.md ────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { d, t, m } = body;

  if (!d || !t || !m) {
    return NextResponse.json({ error: "d, t, m are required" }, { status: 400 });
  }

  const validTypes = ["FEAT", "UI", "FIX", "DATA", "AI", "INT"];
  if (!validTypes.includes(t)) {
    return NextResponse.json({ error: `t must be one of: ${validTypes.join(", ")}` }, { status: 400 });
  }

  const entry: ChangelogEntry = { d, t, m };
  const line = JSON.stringify(entry) + "\n";

  try {
    await fs.appendFile(PENDING_PATH, line, "utf8");
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json({ error: `Failed to write: ${(err as Error).message}` }, { status: 500 });
  }
}

// ─── DELETE ?flush=true — move pending to CHANGELOG.md ──────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("flush") !== "true") {
    return NextResponse.json({ error: "Pass ?flush=true to confirm flush" }, { status: 400 });
  }

  const pending = await readPending();
  if (pending.length === 0) {
    return NextResponse.json({ ok: true, flushed: 0, message: "Nothing to flush" });
  }

  // Format entries as markdown block
  const today = new Date().toISOString().split("T")[0];
  const lines = pending
    .map((e) => `{"d":"${e.d}","t":"${e.t}","m":${JSON.stringify(e.m)}}`)
    .join("\n");

  const block = `\n\n## [Flushed] – ${today}\n\n${lines}\n`;

  try {
    // Append to CHANGELOG.md
    await fs.appendFile(CHANGELOG_PATH, block, "utf8");

    // Clear CHANGELOG_PENDING.md
    await fs.writeFile(PENDING_PATH, `# Changelog Pending\n`, "utf8");

    return NextResponse.json({ ok: true, flushed: pending.length });
  } catch (err) {
    return NextResponse.json({ error: `Flush failed: ${(err as Error).message}` }, { status: 500 });
  }
}

import { readFileSync, mkdirSync, renameSync, existsSync } from "fs";
import { join, basename } from "path";
import { parseInboxFile } from "./inbox-parser";

const APP_ROOT = process.env.APP_ROOT ?? process.cwd();
const INBOX_PATH = join(APP_ROOT, "inbox");
const PROCESSED_PATH = join(APP_ROOT, "inbox", "processed");

export async function processInboxFile(filePath: string): Promise<void> {
  // Dynamic import to avoid issues during build
  const { prisma } = await import("./prisma");

  const filename = basename(filePath);
  if (!filename.endsWith(".md")) return;

  // Skip if already in DB
  const existing = await prisma.inboxItem.findFirst({
    where: { filename },
  });
  if (existing) return;

  let rawContent: string;
  try {
    rawContent = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`[inbox-watcher] Cannot read ${filePath}`);
    return;
  }

  const parsed = parseInboxFile(rawContent, filename);

  await prisma.inboxItem.create({
    data: {
      filename,
      rawContent,
      parsedTitle: parsed.title,
      parsedDescription: parsed.description,
      parsedProjectHint: parsed.projectHint || null,
      parsedAgendaHint: parsed.agendaHint || null,
      parsedPriority: parsed.priority ?? null,
      status: "unread",
    },
  });

  console.log(`[inbox-watcher] Imported: ${filename}`);
}

export async function startInboxWatcher(): Promise<void> {
  // Ensure inbox directories exist
  mkdirSync(INBOX_PATH, { recursive: true });
  mkdirSync(PROCESSED_PATH, { recursive: true });

  // Create .gitkeep files
  const gitkeepInbox = join(INBOX_PATH, ".gitkeep");
  const gitkeepProcessed = join(PROCESSED_PATH, ".gitkeep");
  if (!existsSync(gitkeepInbox)) {
    try { require("fs").writeFileSync(gitkeepInbox, ""); } catch {}
  }
  if (!existsSync(gitkeepProcessed)) {
    try { require("fs").writeFileSync(gitkeepProcessed, ""); } catch {}
  }

  try {
    const chokidar = await import("chokidar");
    const watcher = chokidar.watch(INBOX_PATH, {
      ignored: [/(^|[\/\\])\../, PROCESSED_PATH], // ignore dotfiles + processed/
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    watcher.on("add", async (filePath: string) => {
      if (filePath.endsWith(".md")) {
        await processInboxFile(filePath);
      }
    });

    console.log(`[inbox-watcher] Watching ${INBOX_PATH}`);
  } catch (err) {
    console.error("[inbox-watcher] Failed to start:", err);
  }
}

export async function moveToProcessed(filename: string): Promise<void> {
  const src = join(INBOX_PATH, filename);
  const dest = join(PROCESSED_PATH, filename);
  try {
    if (existsSync(src)) renameSync(src, dest);
  } catch (err) {
    console.error(`[inbox-watcher] Failed to move ${filename}:`, err);
  }
}

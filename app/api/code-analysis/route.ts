import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  summary: string;
  techStack: string[];
  features: string[];
  suggestions: string[];
  fileCount: number;
  analyzedAt: string;
  repoPath: string;
  modelId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function runCmd(cmd: string, cwd: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { cwd, timeout: timeoutMs }, (err, stdout) => {
      resolve(err ? "" : stdout.trim());
    });
  });
}

const SKIP_DIRS = ["node_modules", ".next", ".git", "prisma/generated", "dist", "build", ".cache"];
const CODE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".cs",
  ".php", ".rb", ".swift", ".kt", ".vue", ".svelte", ".css", ".scss",
  ".json", ".yaml", ".yml", ".toml", ".md", ".env.example",
]);

function shouldSkip(filePath: string): boolean {
  return SKIP_DIRS.some((d) => filePath.startsWith(d + "/") || filePath.includes("/" + d + "/"));
}

async function readFileSafe(fullPath: string, maxBytes = 8192): Promise<string | null> {
  try {
    const stat = await fs.stat(fullPath);
    if (stat.size > maxBytes * 10) return null; // skip very large files
    const buf = await fs.readFile(fullPath);
    const text = buf.toString("utf8", 0, Math.min(buf.length, maxBytes));
    // skip binary files
    if (text.includes("\0")) return null;
    return text;
  } catch {
    return null;
  }
}

async function callOllama(
  ollamaUrl: string,
  modelId: string,
  prompt: string,
  timeoutMs = 60_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 1024 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    return (data.response as string) || "";
  } catch (err) {
    if ((err as Error).name === "AbortError") return "[Ollama timeout]";
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function extractSection(text: string, header: string): string[] {
  const lines = text.split("\n");
  const results: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().includes(header.toLowerCase()) && trimmed.startsWith("#")) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (trimmed.startsWith("#")) break; // next section
      const clean = trimmed.replace(/^[-*•]\s*/, "").trim();
      if (clean.length > 3) results.push(clean);
    }
  }

  return results.slice(0, 8);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { repoPath, modelId = "qwen2.5:7b" } = body;

  if (!repoPath) {
    return NextResponse.json({ error: "repoPath is required" }, { status: 400 });
  }

  // Validate path exists and is a directory
  try {
    const stat = await fs.stat(repoPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "repoPath must be a directory" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: `Directory not found: ${repoPath}` }, { status: 400 });
  }

  // Get list of files tracked by git
  let fileList: string[] = [];
  const gitFiles = await runCmd("git ls-files", repoPath);
  if (gitFiles) {
    fileList = gitFiles.split("\n").filter(Boolean);
  } else {
    // Fallback: use find for non-git repos
    const found = await runCmd(
      `find . -type f -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*"`,
      repoPath,
      15_000
    );
    fileList = found.split("\n").filter(Boolean).map((f) => f.replace(/^\.\//, ""));
  }

  // Filter to code files only, skip large dirs
  const codeFiles = fileList
    .filter((f) => !shouldSkip(f))
    .filter((f) => CODE_EXTS.has(path.extname(f).toLowerCase()))
    .slice(0, 50); // max 50 files

  // Read file contents
  const fileContents: Array<{ path: string; content: string }> = [];
  for (const f of codeFiles) {
    const fullPath = path.join(repoPath, f);
    const content = await readFileSafe(fullPath);
    if (content !== null) {
      fileContents.push({ path: f, content });
    }
  }

  // Build analysis prompt
  const filesSummary = fileContents
    .map((f) => {
      const preview = f.content.substring(0, 1500);
      return `### ${f.path}\n\`\`\`\n${preview}${f.content.length > 1500 ? "\n... (truncated)" : ""}\n\`\`\``;
    })
    .join("\n\n");

  const prompt = `You are a senior software architect. Analyze the following codebase and respond ONLY in the exact format below.

# Codebase Files (${fileContents.length} files from: ${repoPath})

${filesSummary}

---

Respond EXACTLY in this format (use English, be concise):

# Project Purpose
One paragraph (2-4 sentences) describing what this project does.

# Key Technologies
- Technology 1
- Technology 2
- Technology 3
(list 5-10 core technologies/frameworks/tools)

# Main Modules / Features
- Feature or module 1
- Feature or module 2
- Feature or module 3
(list 5-8 key features or architectural modules)

# Suggested Improvements
- Improvement 1
- Improvement 2
- Improvement 3
(list 3-6 concrete improvement suggestions)
`;

  // Determine Ollama URL
  const ollamaUrl = process.env.OLLAMA_URL || "http://192.0.2.10:11434";

  let rawResponse = "";
  try {
    rawResponse = await callOllama(ollamaUrl, modelId, prompt, 90_000);
  } catch (err) {
    return NextResponse.json(
      { error: `Ollama call failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  // Parse the structured response
  const techStack = extractSection(rawResponse, "Key Technologies");
  const features = extractSection(rawResponse, "Main Modules");
  const suggestions = extractSection(rawResponse, "Suggested Improvements");

  // Extract summary (text after "# Project Purpose" until next #)
  let summary = "";
  const purposeMatch = rawResponse.match(/# Project Purpose\s*\n([\s\S]*?)(?=\n#|$)/i);
  if (purposeMatch) {
    summary = purposeMatch[1].trim().replace(/\n+/g, " ").substring(0, 500);
  }
  if (!summary) summary = rawResponse.substring(0, 300);

  const result: AnalysisResult = {
    summary,
    techStack: techStack.length > 0 ? techStack : ["Could not parse tech stack"],
    features: features.length > 0 ? features : ["Could not parse features"],
    suggestions: suggestions.length > 0 ? suggestions : ["Could not parse suggestions"],
    fileCount: fileContents.length,
    analyzedAt: new Date().toISOString(),
    repoPath,
    modelId,
  };

  return NextResponse.json(result);
}

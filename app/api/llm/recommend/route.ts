import { NextRequest, NextResponse } from "next/server";
import { getAllModels, DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL, LLMModel } from "@/lib/llm-client";

/**
 * LLM Recommendation Engine
 * Recommends the best available local model for a given task type
 */

type TaskType = "security" | "code" | "research" | "task" | "bug" | "feature" | "improvement" | "analysis" | "translation" | "summary";

interface ModelProfile {
  strengths: TaskType[];
  priority: number;       // Higher = prefer this model when multiple match
  minVRAMGB?: number;     // Minimum VRAM requirement
  description: string;
}

// Known model profiles: model ID → capabilities
const MODEL_PROFILES: Record<string, ModelProfile> = {
  // CtxDesk custom models
  "ctxsec-hardened": { strengths: ["security", "analysis"], priority: 10, description: "Spezialisiert für Security-Analyse & Hardening" },
  "ctxhealer": { strengths: ["bug", "code"], priority: 9, description: "Selbstheilungs-Modell für Bug-Fixes" },
  "ctxmatch": { strengths: ["research", "analysis"], priority: 9, description: "Matching & Analyse Engine" },
  "ctxchat": { strengths: ["task", "summary", "translation"], priority: 8, description: "Allgemeiner Chat-Assistent" },

  // Reasoning models
  "qwen/qwq-32b": { strengths: ["research", "analysis", "code", "feature"], priority: 9, minVRAMGB: 20, description: "QwQ 32B — Starkes Reasoning" },
  "deepseek/deepseek-r1-0528-qwen3-8b": { strengths: ["research", "code", "analysis"], priority: 8, description: "DeepSeek R1 — Reasoning" },

  // Code models
  "qwen2.5:7b-instruct": { strengths: ["code", "task", "feature", "improvement"], priority: 7, description: "Qwen 2.5 7B Instruct — Code & Tasks" },
  "qwen2.5:7b": { strengths: ["code", "task", "feature", "improvement"], priority: 6, description: "Qwen 2.5 7B" },
  "mistral:7b": { strengths: ["code", "task", "feature"], priority: 6, description: "Mistral 7B" },
  "llama3.2:latest": { strengths: ["task", "summary", "translation", "research"], priority: 6, description: "Llama 3.2 — Meta" },

  // Vision
  "llava:7b": { strengths: ["analysis"], priority: 5, description: "LLaVA — Vision+Text" },

  // Google
  "google/gemma-3-4b": { strengths: ["translation", "summary", "task"], priority: 6, description: "Gemma 3 4B — Google" },
};

function getProfileForModel(model: LLMModel): ModelProfile | null {
  // Exact match first
  if (MODEL_PROFILES[model.id]) return MODEL_PROFILES[model.id];
  // Partial match (e.g., "qwen2.5:7b" matches "qwen2.5:7b-instruct")
  for (const [key, profile] of Object.entries(MODEL_PROFILES)) {
    if (model.id.includes(key) || key.includes(model.id.split(":")[0])) {
      return profile;
    }
  }
  return null;
}

function mapTicketTypeToTask(ticketType: string, title = ""): TaskType {
  const titleLower = title.toLowerCase();

  if (titleLower.includes("secur") || titleLower.includes("vuln") || titleLower.includes("auth") || titleLower.includes("hack") || titleLower.includes("pentest")) return "security";
  if (ticketType === "bug") return "bug";
  if (ticketType === "feature") return "feature";
  if (ticketType === "improvement") return "improvement";
  if (ticketType === "research") return "research";
  if (titleLower.includes("code") || titleLower.includes("develop") || titleLower.includes("implement") || titleLower.includes("refactor")) return "code";
  if (titleLower.includes("analys") || titleLower.includes("review") || titleLower.includes("audit")) return "analysis";
  if (titleLower.includes("translat") || titleLower.includes("übersetz") || titleLower.includes("lang")) return "translation";
  if (titleLower.includes("summar") || titleLower.includes("report") || titleLower.includes("zusammenfas")) return "summary";

  return "task";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticketType = "task", title = "", ollamaUrl, lmStudioUrl } = body;

  const taskType = mapTicketTypeToTask(ticketType, title);

  const models = await getAllModels(
    ollamaUrl || DEFAULT_OLLAMA_URL,
    lmStudioUrl || DEFAULT_LM_STUDIO_URL
  );

  // Score all available models
  const scored: Array<{
    model: LLMModel;
    score: number;
    profile: ModelProfile | null;
    reason: string;
  }> = [];

  for (const model of models.all) {
    const profile = getProfileForModel(model);
    if (!profile) {
      scored.push({ model, score: 1, profile: null, reason: "Universalmodell" });
      continue;
    }

    let score = profile.priority;
    const isMatch = profile.strengths.includes(taskType);
    if (isMatch) score += 10;

    scored.push({
      model,
      score,
      profile,
      reason: isMatch
        ? `Spezialisiert für "${taskType}" Aufgaben`
        : "Universell einsetzbar",
    });
  }

  scored.sort((a, b) => b.score - a.score);

  const top = scored[0] || null;
  const alternatives = scored.slice(1, 4).map(s => ({
    model: s.model,
    reason: s.reason,
  }));

  const taskDescriptions: Record<TaskType, string> = {
    security: "Sicherheitsanalyse & Härtung",
    code: "Code-Entwicklung & Review",
    research: "Recherche & Analyse",
    task: "Allgemeine Aufgabe",
    bug: "Bug-Fix & Debugging",
    feature: "Feature-Entwicklung",
    improvement: "Verbesserung & Optimierung",
    analysis: "Analyse & Audit",
    translation: "Übersetzung",
    summary: "Zusammenfassung & Report",
  };

  return NextResponse.json({
    taskType,
    taskDescription: taskDescriptions[taskType],
    recommended: top ? {
      model: top.model,
      score: top.score,
      reason: top.reason,
      profile: top.profile,
    } : null,
    alternatives,
    allModels: models.all.length,
    ollamaOnline: models.ollama.length > 0,
    lmStudioOnline: models.lmstudio.length > 0,
  });
}

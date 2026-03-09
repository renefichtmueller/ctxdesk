/**
 * CtxDesk LLM Client
 * Unified abstraction for Ollama + LM Studio (OpenAI-compatible)
 */

export type LLMProvider = "ollama" | "lmstudio";

export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProvider;
  size?: string;
  description?: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMChatOptions {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  ollamaUrl?: string;
  lmStudioUrl?: string;
  ollamaApiKey?: string;  // API key for remote Ollama (Bearer token)
  systemPrompt?: string;  // Optional system prompt (prepended to messages)
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  tokensUsed?: number;
}

// Default endpoints
export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const DEFAULT_LM_STUDIO_URL = "http://localhost:1234";
export const DEFAULT_REMOTE_OLLAMA_URL = "https://ollama.example.com";

// Model descriptions (for known models)
const MODEL_DESCRIPTIONS: Record<string, string> = {
  "ctxhealer": "CtxDesk Self-Healing Modell",
  "ctxmatch": "CtxDesk Matching Engine",
  "ctxsec-hardened": "Security Analysis & Hardening",
  "ctxchat": "CtxDesk Chat Assistent",
  "qwen2.5:7b": "Qwen 2.5 7B — Allgemein",
  "qwen2.5:7b-instruct": "Qwen 2.5 7B Instruct",
  "llama3.2:latest": "Llama 3.2 — Meta",
  "mistral:7b": "Mistral 7B",
  "llava:7b": "LLaVA 7B (Vision)",
  "qwen/qwq-32b": "QwQ 32B — Reasoning",
  "deepseek/deepseek-r1-0528-qwen3-8b": "DeepSeek R1 — Reasoning",
  "google/gemma-3-4b": "Gemma 3 4B — Google",
};

/**
 * Build Ollama auth headers (empty if no key)
 */
function ollamaHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

/**
 * Fetch available models from Ollama (with optional API key)
 */
export async function getOllamaModels(baseUrl = DEFAULT_OLLAMA_URL, apiKey?: string): Promise<LLMModel[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
      headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : undefined,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: { name: string; size?: number }) => ({
      id: m.name,
      name: m.name.replace(":latest", ""),
      provider: "ollama" as LLMProvider,
      size: m.size ? formatBytes(m.size) : undefined,
      description: MODEL_DESCRIPTIONS[m.name] || MODEL_DESCRIPTIONS[m.name.split(":")[0]],
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch available models from LM Studio
 */
export async function getLMStudioModels(baseUrl = DEFAULT_LM_STUDIO_URL): Promise<LLMModel[]> {
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((m: { id: string }) => ({
      id: m.id,
      name: m.id.split("/").pop() || m.id,
      provider: "lmstudio" as LLMProvider,
      description: MODEL_DESCRIPTIONS[m.id],
    }));
  } catch {
    return [];
  }
}

/**
 * Get all available models from both providers.
 * For Ollama: tries local URL first, falls back to remote URL if local fails.
 */
export async function getAllModels(
  ollamaUrl = DEFAULT_OLLAMA_URL,
  lmStudioUrl = DEFAULT_LM_STUDIO_URL,
  ollamaApiKey?: string,
  remoteOllamaUrl?: string,
): Promise<{ ollama: LLMModel[]; lmstudio: LLMModel[]; all: LLMModel[]; ollamaSource: "local" | "remote" | "none" }> {
  // Try local Ollama first (no key needed on LAN)
  let ollama = await getOllamaModels(ollamaUrl);
  let ollamaSource: "local" | "remote" | "none" = ollama.length > 0 ? "local" : "none";

  // Fall back to remote tunnel if local is unavailable and remote is configured
  if (ollama.length === 0 && remoteOllamaUrl && ollamaApiKey) {
    ollama = await getOllamaModels(remoteOllamaUrl, ollamaApiKey);
    ollamaSource = ollama.length > 0 ? "remote" : "none";
  }

  const lmstudio = await getLMStudioModels(lmStudioUrl);
  return { ollama, lmstudio, all: [...ollama, ...lmstudio], ollamaSource };
}

/**
 * Chat with Ollama (streaming via AsyncGenerator)
 */
async function* streamOllama(opts: LLMChatOptions): AsyncGenerator<string> {
  const baseUrl = opts.ollamaUrl || DEFAULT_OLLAMA_URL;

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: ollamaHeaders(opts.ollamaApiKey),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.maxTokens ?? 2048,
      },
    }),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield data.message.content;
        }
        if (data.done) return;
      } catch {}
    }
  }
}

/**
 * Chat with LM Studio (OpenAI-compatible streaming)
 */
async function* streamLMStudio(opts: LLMChatOptions): AsyncGenerator<string> {
  const baseUrl = opts.lmStudioUrl || DEFAULT_LM_STUDIO_URL;

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) throw new Error(`LM Studio error: ${res.status} ${await res.text()}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {}
    }
  }
}

/**
 * Prepend system prompt to messages if provided
 */
function withSystemPrompt(opts: LLMChatOptions): LLMChatOptions {
  if (!opts.systemPrompt) return opts;
  return {
    ...opts,
    messages: [{ role: "system", content: opts.systemPrompt }, ...opts.messages],
    systemPrompt: undefined,
  };
}

/**
 * Unified streaming chat function
 * Returns a ReadableStream for use in API routes
 */
export function streamChat(opts: LLMChatOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const resolvedOpts = withSystemPrompt(opts);

  return new ReadableStream({
    async start(controller) {
      try {
        const generator = resolvedOpts.provider === "ollama"
          ? streamOllama(resolvedOpts)
          : streamLMStudio(resolvedOpts);

        for await (const chunk of generator) {
          // SSE format: "data: {json}\n\n"
          const payload = JSON.stringify({ content: chunk, done: false });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }

        // Send done signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "", done: true })}\n\n`));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg, done: true })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Non-streaming chat (returns full response)
 */
export async function chat(opts: LLMChatOptions): Promise<LLMResponse> {
  const resolvedOpts = withSystemPrompt(opts);
  opts = resolvedOpts;
  const baseUrl = opts.provider === "ollama"
    ? (opts.ollamaUrl || DEFAULT_OLLAMA_URL)
    : (opts.lmStudioUrl || DEFAULT_LM_STUDIO_URL);

  if (opts.provider === "ollama") {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: ollamaHeaders(opts.ollamaApiKey),
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        stream: false,
        options: { temperature: opts.temperature ?? 0.7, num_predict: opts.maxTokens ?? 2048 },
      }),
    });
    const data = await res.json();
    return {
      content: data.message?.content || "",
      model: opts.model,
      provider: "ollama",
      tokensUsed: data.eval_count,
    };
  } else {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        stream: false,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 2048,
      }),
    });
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      model: opts.model,
      provider: "lmstudio",
      tokensUsed: data.usage?.total_tokens,
    };
  }
}

// System prompts for different task types
export const SYSTEM_PROMPTS = {
  taskAnalysis: `Du bist ein KI-Assistent für Projektmanagement in CtxDesk.
Analysiere den gegebenen Task und hilf bei der Umsetzung.
Antworte präzise auf Deutsch. Halte dich kurz und praxisorientiert.
Wenn du Schritte vorschlägst, nummeriere sie. Maximal 5-7 Sätze.`,

  taskBreakdown: `Du bist ein Projektmanagement-KI in CtxDesk.
Zerlege den gegebenen Task in konkrete Unteraufgaben (max. 5).
Format: Nummerierte Liste, jede Aufgabe max. 1 Satz. Kein Overhead.`,

  progressUpdate: `Du bist ein KI-Assistent der gerade an einem Task arbeitet.
Beschreibe kurz (1-2 Sätze) was du gerade machst und wie weit du bist.
Keine Formatierung, reiner Text.`,

  codeReview: `Du bist ein erfahrener Softwareentwickler.
Reviewe den Code und gib präzises Feedback auf Deutsch.
Fokus: Bugs, Sicherheit, Performance, Lesbarkeit.`,

  securityCheck: `Du bist ein Security-Experte (ctxsec-hardened Modell).
Analysiere den Task auf Sicherheitsaspekte.
Identifiziere Risiken und gib konkrete Empfehlungen auf Deutsch.`,
};

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

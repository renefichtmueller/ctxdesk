import { NextRequest, NextResponse } from "next/server";
import { chat, getAllModels, DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL, LLMModel } from "@/lib/llm-client";

const SUPPORTED_LANGUAGES = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ru: "Русский",
  zh: "中文",
  ja: "日本語",
  ar: "العربية",
  tr: "Türkçe",
  sv: "Svenska",
  da: "Dansk",
  no: "Norsk",
  fi: "Suomi",
  cs: "Čeština",
  hu: "Magyar",
  ro: "Română",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    text,
    targetLang,
    sourceLang = "auto",
    ollamaUrl = DEFAULT_OLLAMA_URL,
    lmStudioUrl = DEFAULT_LM_STUDIO_URL,
  } = body;

  if (!text || !targetLang) {
    return NextResponse.json({ error: "text and targetLang required" }, { status: 400 });
  }

  const langName = SUPPORTED_LANGUAGES[targetLang as keyof typeof SUPPORTED_LANGUAGES] || targetLang;

  // Get available models, prefer translation-capable ones
  const models = await getAllModels(ollamaUrl, lmStudioUrl);
  let selectedModel: LLMModel | null = null;
  let selectedProvider: "ollama" | "lmstudio" = "ollama";

  // Prefer ctxchat, then llama3.2, then qwen2.5, then any available
  const preferredIds = ["ctxchat", "llama3.2:latest", "qwen2.5:7b-instruct", "qwen2.5:7b", "mistral:7b"];
  for (const id of preferredIds) {
    const found = models.all.find(m => m.id === id || m.id.startsWith(id.split(":")[0]));
    if (found) {
      selectedModel = found;
      selectedProvider = found.provider;
      break;
    }
  }

  if (!selectedModel && models.all.length > 0) {
    selectedModel = models.all[0];
    selectedProvider = selectedModel.provider;
  }

  if (!selectedModel) {
    return NextResponse.json({ error: "Kein LLM verfügbar (Ollama/LM Studio offline?)" }, { status: 503 });
  }

  const sourceHint = sourceLang !== "auto" ? ` from ${sourceLang}` : "";
  const systemPrompt = `Du bist ein professioneller Übersetzer. Übersetze den folgenden Text${sourceHint} ins ${langName}. Gib NUR die Übersetzung zurück, ohne Erklärungen, Kommentare oder Anmerkungen.`;

  try {
    const response = await chat({
      provider: selectedProvider,
      model: selectedModel.id,
      messages: [{ role: "user", content: text }],
      temperature: 0.3,
      maxTokens: 2048,
      ollamaUrl,
      lmStudioUrl,
      systemPrompt,
    } as Parameters<typeof chat>[0] & { systemPrompt?: string });

    return NextResponse.json({
      translated: response.content,
      sourceLang,
      targetLang,
      langName,
      model: selectedModel.id,
      provider: selectedProvider,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ languages: SUPPORTED_LANGUAGES });
}

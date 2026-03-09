import { NextRequest, NextResponse } from "next/server";
import { getAllModels, DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL, DEFAULT_REMOTE_OLLAMA_URL } from "@/lib/llm-client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ollamaUrl = searchParams.get("ollamaUrl") || DEFAULT_OLLAMA_URL;
  const lmStudioUrl = searchParams.get("lmStudioUrl") || DEFAULT_LM_STUDIO_URL;
  const ollamaApiKey = searchParams.get("ollamaApiKey") || undefined;
  const remoteOllamaUrl = searchParams.get("remoteOllamaUrl") || DEFAULT_REMOTE_OLLAMA_URL;

  try {
    const models = await getAllModels(ollamaUrl, lmStudioUrl, ollamaApiKey, remoteOllamaUrl);
    return NextResponse.json({
      ...models,
      ollamaOnline: models.ollama.length > 0,
      lmStudioOnline: models.lmstudio.length > 0,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), ollama: [], lmstudio: [], all: [], ollamaSource: "none" }, { status: 500 });
  }
}

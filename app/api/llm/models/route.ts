import { NextRequest, NextResponse } from "next/server";
import { getAllModels, DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL } from "@/lib/llm-client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ollamaUrl = searchParams.get("ollamaUrl") || DEFAULT_OLLAMA_URL;
  const lmStudioUrl = searchParams.get("lmStudioUrl") || DEFAULT_LM_STUDIO_URL;

  try {
    const models = await getAllModels(ollamaUrl, lmStudioUrl);
    return NextResponse.json({
      ...models,
      ollamaOnline: models.ollama.length > 0,
      lmStudioOnline: models.lmstudio.length > 0,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), ollama: [], lmstudio: [], all: [] }, { status: 500 });
  }
}

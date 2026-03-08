import { NextRequest, NextResponse } from "next/server";
import { streamChat, chat, DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL } from "@/lib/llm-client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    provider = "ollama",
    model,
    messages,
    temperature,
    maxTokens,
    stream = true,
    ollamaUrl = DEFAULT_OLLAMA_URL,
    lmStudioUrl = DEFAULT_LM_STUDIO_URL,
    systemPrompt,
  } = body;

  if (!model || !messages?.length) {
    return NextResponse.json({ error: "model and messages required" }, { status: 400 });
  }

  // Prepend system prompt if provided
  const fullMessages = systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...messages]
    : messages;

  const opts = { provider, model, messages: fullMessages, temperature, maxTokens, ollamaUrl, lmStudioUrl };

  if (stream) {
    const readable = streamChat(opts);
    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } else {
    const response = await chat(opts);
    return NextResponse.json(response);
  }
}

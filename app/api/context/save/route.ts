import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

export async function POST(req: NextRequest) {
  try {
    const { absPath, content } = await req.json();

    if (!absPath || typeof absPath !== "string") {
      return NextResponse.json({ error: "absPath fehlt" }, { status: 400 });
    }
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content fehlt" }, { status: 400 });
    }

    // Sicherheitscheck: nur .md-Dateien erlaubt
    if (!absPath.endsWith(".md")) {
      return NextResponse.json({ error: "Nur .md-Dateien erlaubt" }, { status: 403 });
    }

    // Verzeichnis erstellen falls nötig
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[context/save]", err);
    return NextResponse.json(
      { error: "Fehler beim Schreiben der Datei" },
      { status: 500 }
    );
  }
}

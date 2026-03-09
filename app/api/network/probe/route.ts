import { NextRequest, NextResponse } from "next/server";

const GLOBALPING_API = "https://api.globalping.io/v1";

// POST: Create a new measurement
export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const res = await fetch(`${GLOBALPING_API}/measurements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        // No auth needed for free tier (500 req/hour)
      },
      body: JSON.stringify({
        type: body.type || "ping",
        target: body.target,
        limit: body.limit || 5,
        locations: body.locations || [{ magic: "world" }],
        measurementOptions: body.measurementOptions || {},
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Globalping API error" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: Fetch measurement result by ID
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const res = await fetch(`${GLOBALPING_API}/measurements/${id}`, {
      headers: { "Accept": "application/json" },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Not found" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

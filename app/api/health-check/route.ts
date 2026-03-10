import { NextResponse } from "next/server";
import http from "http";
import https from "https";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  url: string;
  status: "up" | "down" | "degraded";
  latencyMs: number | null;
  checkedAt: string;
  detail?: string;
}

// ─── Services to check ────────────────────────────────────────────────────────

const SERVICES = [
  { name: "ctxevent", url: "http://192.0.2.10:3001", fallback: "https://ctxevent.example.com" },
  { name: "ctxdesk", url: "http://localhost:3002" },
  { name: "example-website", url: "https://example.com" },
  { name: "ollama", url: "http://192.0.2.10:11434/api/tags" },
  { name: "gitea", url: "http://192.0.2.10:3000" },
];

// ─── Cache in globalThis ──────────────────────────────────────────────────────

type G = typeof globalThis & {
  __healthCache?: { data: ServiceStatus[]; ts: number };
};
const g = globalThis as G;
const CACHE_TTL = 60_000; // 60 seconds

// ─── HTTP probe ───────────────────────────────────────────────────────────────

function probe(url: string, timeoutMs = 5000): Promise<{ ok: boolean; latencyMs: number; status?: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    const timer = setTimeout(() => {
      resolve({ ok: false, latencyMs: timeoutMs });
    }, timeoutMs);

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname || "/",
        method: "GET",
        headers: { "User-Agent": "CtxDesk-HealthCheck/1.0" },
      },
      (res) => {
        clearTimeout(timer);
        res.resume(); // Drain response
        const latencyMs = Date.now() - start;
        resolve({ ok: (res.statusCode ?? 0) < 500, latencyMs, status: res.statusCode });
      }
    );

    req.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, latencyMs: Date.now() - start });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      clearTimeout(timer);
      resolve({ ok: false, latencyMs: timeoutMs });
    });

    req.end();
  });
}

// ─── Check a service (with optional fallback) ─────────────────────────────────

async function checkService(svc: { name: string; url: string; fallback?: string }): Promise<ServiceStatus> {
  const checkedAt = new Date().toISOString();

  const primary = await probe(svc.url);
  if (primary.ok) {
    return {
      name: svc.name,
      url: svc.url,
      status: primary.latencyMs > 2000 ? "degraded" : "up",
      latencyMs: primary.latencyMs,
      checkedAt,
    };
  }

  // Try fallback URL if available
  if (svc.fallback) {
    const fallbackResult = await probe(svc.fallback);
    if (fallbackResult.ok) {
      return {
        name: svc.name,
        url: svc.fallback,
        status: fallbackResult.latencyMs > 2000 ? "degraded" : "up",
        latencyMs: fallbackResult.latencyMs,
        checkedAt,
        detail: `primary (${svc.url}) down, using fallback`,
      };
    }
  }

  return {
    name: svc.name,
    url: svc.url,
    status: "down",
    latencyMs: null,
    checkedAt,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  // Return cache if fresh
  if (g.__healthCache && Date.now() - g.__healthCache.ts < CACHE_TTL) {
    return NextResponse.json({
      services: g.__healthCache.data,
      cached: true,
      cacheAge: Math.round((Date.now() - g.__healthCache.ts) / 1000),
    });
  }

  // Run all probes in parallel
  const results = await Promise.all(SERVICES.map(checkService));

  // Store in cache
  g.__healthCache = { data: results, ts: Date.now() };

  return NextResponse.json({
    services: results,
    cached: false,
    checkedAt: new Date().toISOString(),
  });
}

// Force re-check (bypass cache)
export async function POST() {
  g.__healthCache = undefined;

  const results = await Promise.all(SERVICES.map(checkService));
  g.__healthCache = { data: results, ts: Date.now() };

  return NextResponse.json({
    services: results,
    cached: false,
    checkedAt: new Date().toISOString(),
  });
}

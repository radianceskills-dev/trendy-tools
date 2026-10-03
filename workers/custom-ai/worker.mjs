export const UPSTREAM = "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";
export const ORIGIN = "https://trendytools.netlify.app";
export default {
  async fetch(request) {
    const headers = { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin", "Cache-Control": "no-store" };
    const reply = (message, status) => new Response(JSON.stringify({ error: { message } }), { status, headers: { ...headers, "Content-Type": "application/json" } });
    if (request.headers.get("Origin") !== ORIGIN) return new Response("Origin not allowed", { status: 403 });
    const url = new URL(request.url);
    if (url.pathname !== "/v1/chat/completions" || url.search) return reply("Unknown route", 404);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400" } });
    if (request.method !== "POST") return reply("POST required", 405);
    const authorization = request.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply("Supply your provider API key", 401);
    if (!request.headers.get("Content-Type")?.includes("application/json")) return reply("JSON required", 415);
    if (Number(request.headers.get("Content-Length")) > 1048576) return reply("Request too large", 413);
    let body;
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply("JSON body required", 400);
      const chunks = []; let size = 0;
      while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1048576) { await reader.cancel(); return reply("Request too large", 413); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = new TextDecoder().decode(bytes);
      const data = JSON.parse(body);
      if (!data || typeof data.model !== "string" || !Array.isArray(data.messages)) return reply("model and messages required", 400);
    } catch { return reply("Invalid JSON body", 400); }
    try {
      const upstream = await fetch(UPSTREAM, { method: "POST", headers: { "Authorization": authorization, "Content-Type": "application/json", "Accept": "text/event-stream, application/json" }, body, redirect: "manual", signal: request.signal });
      if (upstream.status >= 300 && upstream.status < 400) { await upstream.body?.cancel(); return reply("Upstream redirect refused", 502); }
      const responseHeaders = new Headers(headers);
      responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
      const retry = upstream.headers.get("Retry-After");
      if (retry) { responseHeaders.set("Retry-After", retry); responseHeaders.set("Access-Control-Expose-Headers", "Retry-After"); }
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch { return reply("Unable to reach AI provider", 502); }
  }
};

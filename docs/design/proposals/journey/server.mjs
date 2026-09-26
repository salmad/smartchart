/* Journey prototype server: serves docs/design/proposals and proxies the two model APIs.
   The keys stay here; the browser never sees them (spec section 7).
   Run from the repo root:  node docs/design/proposals/journey/server.mjs
   Then open http://localhost:8787/journey/                                      */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = normalize(join(HERE, ".."));            // docs/design/proposals
const ENV = normalize(join(HERE, "../../../../.env")); // repo root
const PORT = Number(process.env.PORT) || 8787;

// Keys come from the environment or the repo's .env file.
if (existsSync(ENV)) for (const line of readFileSync(ENV, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
for (const k of ["GLM_API_KEY", "OPENROUTER_API_KEY"]) if (!process.env[k]) console.warn(`warning: ${k} is not set`);

/* Routing is enforced here with an allowlist: GLM models go to the GLM subscription endpoint,
   OpenRouter only ever receives the Jev decision model. */
const GLM_URL = "https://api.z.ai/api/coding/paas/v4/chat/completions";
const GLM_MODELS = new Set(["glm-5.3-flash", "glm-5.3"]);
const JEV_URL = "https://openrouter.ai/api/alpha/decisions";
const JEV_MODEL = "~typesafe/jev-latest";
const CALL_CAP = Number(process.env.CALL_CAP) || 2000; // spend guard per server run
let calls = 0;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".md": "text/plain" };

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function forward(url, key, payload) {
  const t0 = performance.now();
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await r.text();
  return { status: r.status, text, ms: Math.round(performance.now() - t0) };
}

async function api(req, res, kind) {
  if (++calls > CALL_CAP) return send(res, 429, { error: `call cap of ${CALL_CAP} reached; restart the server` });
  const p = await body(req);
  let out;
  if (kind === "glm") {
    if (!GLM_MODELS.has(p.model)) return send(res, 400, { error: `model ${p.model} is not allowed` });
    const { model, messages, thinking = false, temperature = 0.3, max_tokens = 4000, response_format, tools, tool_choice } = p;
    out = await forward(GLM_URL, process.env.GLM_API_KEY, {
      model, messages, temperature, max_tokens, thinking: { type: thinking ? "enabled" : "disabled" },
      ...(response_format ? { response_format } : {}), ...(tools ? { tools, tool_choice } : {}),
    });
  } else {
    out = await forward(JEV_URL, process.env.OPENROUTER_API_KEY, { model: JEV_MODEL, state: p.state, questions: p.questions });
  }
  console.log(`${kind} ${out.status} ${out.ms}ms`);
  res.writeHead(out.status, { "Content-Type": "application/json", "X-Upstream-Ms": String(out.ms) });
  res.end(out.text);
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/health") return send(res, 200, { ok: true, live: !!(process.env.GLM_API_KEY && process.env.OPENROUTER_API_KEY) });
    if (req.method === "POST" && url.pathname === "/api/glm") return await api(req, res, "glm");
    if (req.method === "POST" && url.pathname === "/api/jev") return await api(req, res, "jev");
    if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });
    let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT)) return send(res, 403, { error: "forbidden" });
    if (url.pathname.endsWith("/")) path = join(path, "index.html");
    const data = await readFile(path);
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch (e) {
    send(res, e.code === "ENOENT" ? 404 : 500, { error: String(e.message || e) });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`journey prototype: http://localhost:${PORT}/journey/`));

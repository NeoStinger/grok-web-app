import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(__dirname, "docs");
const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";

const CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const SCOPE = "openid profile email offline_access grok-cli:access api:access";
const DEVICE_URL = "https://auth.x.ai/oauth2/device/code";
const TOKEN_URL = "https://auth.x.ai/oauth2/token";
const USERINFO_URL = "https://auth.x.ai/oauth2/userinfo";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers,
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function json(res, status, obj) {
  send(res, status, obj, { "Content-Type": "application/json; charset=utf-8" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function xaiForm(url, params) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text || "invalid_response" }; }
  return { status: res.status, data };
}

async function handleOauth(req, res, url) {
  if (url.pathname === "/oauth/device" && req.method === "POST") {
    const out = await xaiForm(DEVICE_URL, { client_id: CLIENT_ID, scope: SCOPE });
    json(res, out.status, out.data);
    return;
  }
  if (url.pathname === "/oauth/token" && req.method === "POST") {
    const raw = await readBody(req);
    let payload = {};
    try { payload = JSON.parse(raw || "{}"); } catch { json(res, 400, { error: "invalid_json" }); return; }
    const params = { client_id: CLIENT_ID };
    if (payload.refresh_token) {
      params.grant_type = "refresh_token";
      params.refresh_token = payload.refresh_token;
    } else {
      params.grant_type = "urn:ietf:params:oauth:grant-type:device_code";
      params.device_code = payload.device_code || "";
    }
    const out = await xaiForm(TOKEN_URL, params);
    json(res, out.status, out.data);
    return;
  }
  if (url.pathname === "/oauth/userinfo" && req.method === "GET") {
    const auth = req.headers.authorization || "";
    const r = await fetch(USERINFO_URL, { headers: { Authorization: auth, Accept: "application/json" } });
    const text = await r.text();
    send(res, r.status, text, { "Content-Type": "application/json; charset=utf-8" });
    return;
  }
  json(res, 404, { error: "not_found" });
}

function serveStatic(req, res, url) {
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === "/") filePath = "/index.html";
  const abs = path.normalize(path.join(DOCS, filePath));
  if (!abs.startsWith(DOCS)) { send(res, 403, "forbidden"); return; }
  fs.readFile(abs, (err, data) => {
    if (err) { send(res, 404, "not found", { "Content-Type": "text/plain; charset=utf-8" }); return; }
    send(res, 200, data, { "Content-Type": TYPES[path.extname(abs)] || "application/octet-stream" });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/oauth/")) { await handleOauth(req, res, url); return; }
    serveStatic(req, res, url);
  } catch (err) {
    json(res, 500, { error: "proxy_failed", message: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Grok Web listening on ${HOST}:${PORT}`);
});

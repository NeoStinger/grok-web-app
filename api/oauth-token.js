const CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const params = { client_id: CLIENT_ID };
  if (payload.refresh_token) {
    params.grant_type = "refresh_token";
    params.refresh_token = payload.refresh_token;
  } else {
    params.grant_type = "urn:ietf:params:oauth:grant-type:device_code";
    params.device_code = payload.device_code || "";
  }
  const r = await fetch("https://auth.x.ai/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  res.status(r.status).json(await r.json());
}

const CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const SCOPE = "openid profile email offline_access grok-cli:access api:access";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const body = new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE });
  const r = await fetch("https://auth.x.ai/oauth2/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  res.status(r.status).json(await r.json());
}

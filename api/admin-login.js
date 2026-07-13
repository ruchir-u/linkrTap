import crypto from "crypto";

function expectedToken() {
  const password = process.env.ADMIN_PASSWORD || "";
  return crypto.createHash("sha256").update(`linkrtap-admin:${password}`).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredPassword) {
    res.status(500).json({ error: "ADMIN_PASSWORD isn't set on the server yet." });
    return;
  }

  const { password } = req.body || {};

  if (!password || password !== configuredPassword) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  const token = expectedToken();
  const maxAge = 60 * 60 * 24 * 30; // 30 days

  res.setHeader(
    "Set-Cookie",
    `linkrtap_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
  res.status(200).json({ ok: true });
}

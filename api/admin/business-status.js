import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv();
const STATUSES = new Set(["active", "disabled", "archived"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const slug = String(req.body?.slug || "").trim();
  const status = String(req.body?.status || "").trim();
  if (!slug || !STATUSES.has(status)) return res.status(400).json({ error: "Invalid business status" });

  const record = await kv.get(`business:${slug}`);
  if (!record) return res.status(404).json({ error: "Business not found" });

  const now = new Date().toISOString();
  await kv.set(`business:${slug}`, { ...record, status, updatedAt: now });
  if (record.qrId) {
    const qr = await kv.get(`qr:${record.qrId}`);
    if (qr) await kv.set(`qr:${record.qrId}`, { ...qr, status, updatedAt: now });
  }
  res.status(200).json({ ok: true, status });
}

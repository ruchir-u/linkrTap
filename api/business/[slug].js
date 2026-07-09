import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const { slug } = req.query;
  const record = await kv.get(`business:${slug}`);

  if (!record) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.status(200).json(record);
}

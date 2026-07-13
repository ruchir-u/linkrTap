import { Redis } from "@upstash/redis";
import { ACTIONS } from "../_lib/tracking.js";

const kv = Redis.fromEnv();

export default async function handler(req, res) {
  const slugs = (await kv.smembers("businesses:index")) || [];

  if (slugs.length === 0) {
    res.status(200).json({ businesses: [] });
    return;
  }

  const [records, visitTotals] = await Promise.all([
    Promise.all(slugs.map((slug) => kv.get(`business:${slug}`))),
    Promise.all(slugs.map((slug) => kv.get(`stats:${slug}:visits:total`))),
  ]);

  const clickTotals = await Promise.all(
    slugs.map(async (slug) => {
      const counts = await Promise.all(ACTIONS.map((a) => kv.get(`stats:${slug}:clicks:${a}:total`)));
      return counts.reduce((sum, n) => sum + (Number(n) || 0), 0);
    })
  );
  const qrRecords = await Promise.all(records.map((record) => (record?.qrId ? kv.get(`qr:${record.qrId}`) : null)));
  const qrScanTotals = await Promise.all(records.map((record) => (record?.qrId ? kv.get(`qr:${record.qrId}:scans:total`) : null)));

  const businesses = slugs
    .map((slug, i) =>
      records[i]
        ? {
            slug,
            name: records[i].name || slug,
            city: records[i].city || "",
            updatedAt: records[i].updatedAt || null,
            status: records[i].status || "active",
            qrId: records[i].qrId || null,
            stickerNumber: qrRecords[i]?.stickerNumber || null,
            lastScannedAt: qrRecords[i]?.lastScannedAt || null,
            qrScansTotal: Number(qrScanTotals[i]) || 0,
            visitsTotal: Number(visitTotals[i]) || 0,
            clicksTotal: clickTotals[i],
          }
        : null
    )
    .filter(Boolean);

  businesses.sort((a, b) => a.name.localeCompare(b.name));

  res.status(200).json({ businesses });
}

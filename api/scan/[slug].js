import { Redis } from "@upstash/redis";
import {
  getClientIp,
  hashIp,
  classifySource,
  classifyDevice,
  todayKey,
  checkRateLimit,
} from "../_lib/tracking.js";

const kv = Redis.fromEnv();

export default async function handler(req, res) {
  const { slug: scannedId, src } = req.query;
  const qr = await kv.get(`qr:${scannedId}`);
  const slug = qr?.slug || scannedId;
  const record = await kv.get(`business:${slug}`);

  if (!record || record.status === "archived" || record.status === "disabled" || (qr && qr.status !== "active")) {
    res.status(404).send("This LinkrTap page doesn't exist (yet).");
    return;
  }

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const device = classifyDevice(req.headers["user-agent"]);
  const explicitSource = ["instagram", "whatsapp", "facebook", "google", "twitter", "other", "direct"].includes(String(src))
    ? String(src)
    : null;
  const source = explicitSource || classifySource(req.headers["referer"] || req.headers["referrer"]);
  const date = todayKey();

  if (device !== "bot") {
    const allowed = await checkRateLimit(kv, `ratelimit:visit:${slug}:${ipHash}`, 5);

    if (allowed) {
      await Promise.all([
        kv.incr(`stats:${slug}:visits:total`),
        kv.incr(`stats:${slug}:visits:daily:${date}`),
        kv.incr(`stats:${slug}:visits:bySource:${source}`),
        kv.incr(`stats:${slug}:devices:${device}`),
        kv.sadd(`stats:${slug}:uniques:${date}`, ipHash),
        kv.set(`stats:${slug}:lastVisit`, new Date().toISOString()),
        qr ? kv.incr(`qr:${qr.qrId}:scans:total`) : Promise.resolve(),
        qr ? kv.set(`qr:${qr.qrId}:lastScannedAt`, new Date().toISOString()) : Promise.resolve(),
        kv.expire(`stats:${slug}:visits:daily:${date}`, 60 * 60 * 24 * 90),
        kv.expire(`stats:${slug}:uniques:${date}`, 60 * 60 * 24 * 90),
      ]);
    }
  }

  res.writeHead(302, { Location: `/${slug}` });
  res.end();
}

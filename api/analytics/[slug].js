import { Redis } from "@upstash/redis";
import { ACTIONS, SOURCES, DEVICES, lastNDates } from "../_lib/tracking.js";

const kv = Redis.fromEnv();

export default async function handler(req, res) {
  const { slug } = req.query;
  const record = await kv.get(`business:${slug}`);

  if (!record) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const dates = lastNDates(14);
  const uniqueKeys = dates.map((d) => `stats:${slug}:uniques:${d}`);

  const [
    visitsTotal,
    lastVisit,
    dailyVisitCounts,
    dailyUniqueCounts,
    clickCounts,
    sourceCounts,
    deviceCounts,
  ] = await Promise.all([
    kv.get(`stats:${slug}:visits:total`),
    kv.get(`stats:${slug}:lastVisit`),
    Promise.all(dates.map((d) => kv.get(`stats:${slug}:visits:daily:${d}`))),
    Promise.all(uniqueKeys.map((k) => kv.scard(k))),
    Promise.all(ACTIONS.map((a) => kv.get(`stats:${slug}:clicks:${a}:total`))),
    Promise.all(SOURCES.map((s) => kv.get(`stats:${slug}:visits:bySource:${s}`))),
    Promise.all(DEVICES.map((d) => kv.get(`stats:${slug}:devices:${d}`))),
  ]);

  const dailyVisits = dates.map((date, i) => ({
    date,
    count: Number(dailyVisitCounts[i]) || 0,
    uniques: Number(dailyUniqueCounts[i]) || 0,
  }));

  const clicksByAction = {};
  ACTIONS.forEach((a, i) => {
    clicksByAction[a] = Number(clickCounts[i]) || 0;
  });

  const visitsBySource = {};
  SOURCES.forEach((s, i) => {
    visitsBySource[s] = Number(sourceCounts[i]) || 0;
  });

  const visitsByDevice = {};
  DEVICES.forEach((d, i) => {
    visitsByDevice[d] = Number(deviceCounts[i]) || 0;
  });

  const totalClicks = Object.values(clicksByAction).reduce((sum, n) => sum + n, 0);

  // Merge the last 14 days of unique-visitor sets to get a true period
  // unique count (not just a sum of daily counts, which would double-count
  // a same-day-different-day repeat visitor... actually sums repeats across
  // days by design, this gives the deduped total across the whole window).
  let uniqueVisitors14d = dailyUniqueCounts.reduce((sum, n) => sum + (Number(n) || 0), 0);
  try {
    const tempKey = `stats:${slug}:tmp:union:${Date.now()}`;
    await kv.sunionstore(tempKey, ...uniqueKeys);
    uniqueVisitors14d = await kv.scard(tempKey);
    await kv.del(tempKey);
  } catch {
    // Fall back to the (less accurate) sum computed above if sunionstore
    // isn't available for some reason.
  }

  res.status(200).json({
    slug,
    name: record.name,
    visitsTotal: Number(visitsTotal) || 0,
    lastVisit: lastVisit || null,
    dailyVisits,
    uniqueVisitors14d,
    visitsBySource,
    visitsByDevice,
    clicksByAction,
    totalClicks,
  });
}

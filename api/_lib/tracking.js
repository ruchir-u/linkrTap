import crypto from "crypto";

const KNOWN_SOURCES = [
  { match: /instagram\.com|l\.instagram\.com/, label: "instagram" },
  { match: /wa\.me|whatsapp\.com/, label: "whatsapp" },
  { match: /facebook\.com|fb\.com|lm\.facebook\.com/, label: "facebook" },
  { match: /google\.[a-z.]+|goo\.gl/, label: "google" },
  { match: /t\.co|twitter\.com|x\.com/, label: "twitter" },
];

const BOT_PATTERN = /bot|spider|crawl|curl|wget|python-requests|go-http-client|axios|headlesschrome|scrapy|facebookexternalhit|slurp/i;

export const ACTIONS = ["review", "instagram", "whatsapp", "menu", "website", "directions", "phone"];
export const SOURCES = ["direct", "instagram", "whatsapp", "facebook", "google", "twitter", "other"];
export const DEVICES = ["mobile", "tablet", "desktop", "unknown", "bot"];

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function hashIp(ip) {
  return crypto.createHash("sha256").update(`linkrtap:${ip}`).digest("hex").slice(0, 20);
}

export function classifySource(referer) {
  if (!referer) return "direct";
  try {
    const hostname = new URL(referer).hostname;
    const found = KNOWN_SOURCES.find((s) => s.match.test(hostname));
    return found ? found.label : "other";
  } catch {
    return "other";
  }
}

export function classifyDevice(userAgent) {
  const ua = String(userAgent || "");
  if (!ua) return "unknown";
  if (BOT_PATTERN.test(ua)) return "bot";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function lastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d)
    );
  }
  return dates;
}

// Returns true if this hit is allowed to be counted (i.e. not within the
// cooldown window for this key). Uses SET NX so the check + lock is atomic.
export async function checkRateLimit(kv, key, windowSeconds) {
  const result = await kv.set(key, "1", { nx: true, ex: windowSeconds });
  return result !== null;
}

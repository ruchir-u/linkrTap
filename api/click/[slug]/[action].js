import { Redis } from "@upstash/redis";
import { getClientIp, hashIp, classifyDevice, todayKey, checkRateLimit } from "../../_lib/tracking.js";

const kv = Redis.fromEnv();

const ACTION_FIELDS = {
  review: "review",
  instagram: "instagram",
  whatsapp: "whatsapp",
  menu: "menu",
  website: "website",
  directions: "directions",
  phone: "phone",
};

function phoneHref(value) {
  const digits = String(value || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export default async function handler(req, res) {
  const { slug, action } = req.query;
  const field = ACTION_FIELDS[action];

  if (!field) {
    res.status(404).send("Unknown action");
    return;
  }

  const record = await kv.get(`business:${slug}`);

  if (!record || !record[field]) {
    res.status(404).send("This link isn't set up for this business.");
    return;
  }

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const device = classifyDevice(req.headers["user-agent"]);
  const date = todayKey();

  if (device !== "bot") {
    const allowed = await checkRateLimit(kv, `ratelimit:click:${slug}:${field}:${ipHash}`, 10);

    if (allowed) {
      await Promise.all([
        kv.incr(`stats:${slug}:clicks:${field}:total`),
        kv.incr(`stats:${slug}:clicks:daily:${date}`),
      ]);
    }
  }

  const destination = field === "phone" ? phoneHref(record.phone) : record[field];
  res.writeHead(302, { Location: destination });
  res.end();
}

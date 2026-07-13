import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv();

function slugify(value) {
  return (
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business"
  );
}

function qrIdify(value) {
  return slugify(value).replace(/^business$/, "qr");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();

    if (!name) {
      res.status(400).json({ error: "Business name is required" });
      return;
    }

    const prior = body.id ? await kv.get(`business:${slugify(body.id)}`) : null;
    let slug = slugify(body.slug || prior?.slug || name);

    // If the slug already belongs to a different business, disambiguate it
    // rather than silently overwriting someone else's page.
    const existing = await kv.get(`business:${slug}`);
    if (existing && existing.id && existing.id !== (prior?.id || body.id || slug)) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const qrId = qrIdify(body.qrId || prior?.qrId || `qr-${slug}`);
    const previousQr = prior?.qrId && prior.qrId !== qrId ? await kv.get(`qr:${prior.qrId}`) : null;
    const assignedQr = await kv.get(`qr:${qrId}`);
    const now = new Date().toISOString();

    const record = {
      id: prior?.id || slug,
      slug,
      qrId,
      stickerNumber: String(body.stickerNumber || prior?.stickerNumber || qrId.replace(/^qr-/, "")),
      status: "active",
      name,
      description: String(body.description || ""),
      rating: String(body.rating || ""),
      city: String(body.city || ""),
      initials: String(body.initials || ""),
      logoUrl: String(body.logoUrl || ""),
      review: String(body.review || ""),
      instagram: String(body.instagram || ""),
      whatsapp: String(body.whatsapp || ""),
      menu: String(body.menu || ""),
      website: String(body.website || ""),
      directions: String(body.directions || ""),
      phone: String(body.phone || ""),
      createdAt: prior?.createdAt || now,
      updatedAt: now,
    };

    if (previousQr) {
      await kv.set(`qr:${prior.qrId}`, { ...previousQr, status: "unassigned", slug: null, owner: null, updatedAt: now });
    }

    // Reassigning a physical QR intentionally archives its former business;
    // the new business receives its own fresh per-slug analytics.
    if (assignedQr?.slug && assignedQr.slug !== slug) {
      const former = await kv.get(`business:${assignedQr.slug}`);
      if (former) await kv.set(`business:${assignedQr.slug}`, { ...former, status: "archived", updatedAt: now });
    }

    await kv.set(`business:${slug}`, record);
    await kv.sadd("businesses:index", slug);
    await kv.set(`qr:${qrId}`, {
      ...(assignedQr || {}),
      qrId,
      stickerNumber: record.stickerNumber,
      slug,
      owner: name,
      status: "active",
      createdAt: assignedQr?.createdAt || now,
      activatedAt: now,
      updatedAt: now,
    });

    res.status(200).json({ ok: true, slug, qrId, record });
  } catch (error) {
    console.error("save error", error);
    res.status(500).json({ error: "Failed to save business" });
  }
}

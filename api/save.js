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

    // Reassigning a physical QR to this business would archive whoever it's
    // currently assigned to. That's a real, semi-destructive action (their
    // page goes dark), so it needs an explicit, informed confirmation rather
    // than happening silently as a side effect of hitting Publish. Bail out
    // BEFORE any writes happen if this hasn't been confirmed yet, and hand
    // back enough detail for the client to ask the person directly.
    const reassignTarget = assignedQr?.slug && assignedQr.slug !== slug ? assignedQr.slug : null;

    if (reassignTarget && body.confirmReassign !== true) {
      const former = await kv.get(`business:${reassignTarget}`);
      res.status(409).json({
        error: "qr_reassign_confirmation_required",
        conflict: {
          qrId,
          formerSlug: reassignTarget,
          formerName: former?.name || reassignTarget,
        },
      });
      return;
    }

    const record = {
      id: prior?.id || slug,
      slug,
      qrId,
      stickerNumber: String(body.stickerNumber || prior?.stickerNumber || qrId.replace(/^qr-/, "")),
      // Editing and republishing a business (e.g. fixing a typo) shouldn't
      // silently undo a disable/archive done separately via the dashboard.
      // Status only changes here through the reassignment-archive path
      // below, or explicitly via /api/admin/business-status.
      status: prior?.status || "active",
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

    // Defense in depth: this save is an update to a known prior record, but
    // the resolved slug doesn't match where that record actually lives. If
    // we just write to the new slug here, the old business:{prior.slug} key
    // never gets touched — it lingers in Redis and in businesses:index as an
    // orphaned duplicate. Since this genuinely is the same business (we have
    // its prior record), migrate it: delete the stale key/index entry rather
    // than leaving it behind.
    if (prior?.slug && prior.slug !== slug) {
      await kv.del(`business:${prior.slug}`);
      await kv.srem("businesses:index", prior.slug);
    }

    // Reassigning a physical QR intentionally archives its former business
    // (now confirmed, above); the new business receives its own fresh
    // per-slug analytics.
    if (reassignTarget) {
      const former = await kv.get(`business:${reassignTarget}`);
      if (former) await kv.set(`business:${reassignTarget}`, { ...former, status: "archived", updatedAt: now });
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

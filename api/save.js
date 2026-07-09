import { kv } from "@vercel/kv";

function slugify(value) {
  return (
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business"
  );
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

    let slug = slugify(body.slug || name);

    // If the slug already belongs to a different business, disambiguate it
    // rather than silently overwriting someone else's page.
    const existing = await kv.get(`business:${slug}`);
    if (existing && existing.id && body.id && existing.id !== body.id) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const record = {
      id: body.id || slug,
      slug,
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
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`business:${slug}`, record);
    await kv.sadd("businesses:index", slug);

    res.status(200).json({ ok: true, slug, record });
  } catch (error) {
    console.error("save error", error);
    res.status(500).json({ error: "Failed to save business" });
  }
}

import { put } from "@vercel/blob";

// Vercel serverless functions cap the request body around 4.5MB, and base64
// inflates payload size by ~33% — so we reject decoded images above this
// well before hitting that ceiling. The editor also compresses/resizes
// client-side before sending, so this should rarely be the limiting factor.
const MAX_DECODED_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);

function extensionFor(contentType) {
  return contentType === "image/png" ? "png" : "jpg";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(500).json({ error: "Blob storage isn't connected on the server yet." });
    return;
  }

  try {
    const { slug, contentType, dataBase64 } = req.body || {};

    const cleanSlug = String(slug || "logo")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "logo";

    if (!ALLOWED_TYPES.has(contentType)) {
      res.status(400).json({ error: "Only PNG or JPEG logos are supported." });
      return;
    }

    if (!dataBase64 || typeof dataBase64 !== "string") {
      res.status(400).json({ error: "Missing image data." });
      return;
    }

    const buffer = Buffer.from(dataBase64, "base64");

    if (buffer.length === 0) {
      res.status(400).json({ error: "Image data was empty." });
      return;
    }

    if (buffer.length > MAX_DECODED_BYTES) {
      res.status(413).json({ error: "Logo is too large (max 3MB). Try a smaller image." });
      return;
    }

    const filename = `logos/${cleanSlug}-${Date.now()}.${extensionFor(contentType)}`;

    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });

    res.status(200).json({ ok: true, url: blob.url });
  } catch (error) {
    console.error("upload-logo error", error);
    res.status(500).json({ error: "Failed to upload logo" });
  }
}

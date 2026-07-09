import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv();

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

function actionButton(href, label, extraClass = "") {
  if (!href) return "";
  return `<a class="action-button ${extraClass}" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function phoneHref(value) {
  const digits = String(value || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export default async function handler(req, res) {
  const { slug } = req.query;
  const record = await kv.get(`business:${slug}`);

  if (!record) {
    res.status(404).send("<!doctype html><h1>This LinkrTap page doesn't exist (yet).</h1>");
    return;
  }

  const logoMarkup = record.logoUrl
    ? `<div class="business-logo has-image" style="background-image:url('${escapeHtml(record.logoUrl)}')"></div>`
    : `<div class="business-logo">${escapeHtml((record.initials || record.name.slice(0, 2)).toUpperCase())}</div>`;

  const phoneButton = record.phone
    ? `<a class="action-button" href="${phoneHref(record.phone)}">Call</a>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(record.name)} · LinkrTap</title>
  <link rel="stylesheet" href="/styles.css" />
  <style>
    .public-shell { display: grid; place-items: center; min-height: 100vh; }
  </style>
</head>
<body>
  <main class="app-shell public-shell">
    <div class="phone-frame">
      <div class="phone-screen">
        <div class="business-header">
          ${logoMarkup}
          <p class="business-city">${escapeHtml(record.city || "")}</p>
          <h2>${escapeHtml(record.name)}</h2>
          <p class="rating">${escapeHtml(record.rating || "")} rating</p>
          <p class="description">${escapeHtml(record.description || "")}</p>
        </div>
        <div class="action-list">
          ${actionButton(record.review, "Leave Review", "primary")}
          ${actionButton(record.instagram, "Instagram")}
          ${actionButton(record.whatsapp, "WhatsApp")}
          ${actionButton(record.menu, "Menu")}
          ${actionButton(record.website, "Website")}
          ${actionButton(record.directions, "Directions")}
          ${phoneButton}
        </div>
        <p class="powered">Powered by LinkrTap</p>
      </div>
    </div>
  </main>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

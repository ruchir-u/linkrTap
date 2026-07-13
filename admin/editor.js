const fields = {
  name: document.querySelector("#nameInput"),
  description: document.querySelector("#descriptionInput"),
  rating: document.querySelector("#ratingInput"),
  city: document.querySelector("#cityInput"),
  initials: document.querySelector("#initialsInput"),
  qrId: document.querySelector("#qrIdInput"),
  stickerNumber: document.querySelector("#stickerNumberInput"),
  logo: document.querySelector("#logoInput"),
  review: document.querySelector("#reviewInput"),
  instagram: document.querySelector("#instagramInput"),
  whatsapp: document.querySelector("#whatsappInput"),
  menu: document.querySelector("#menuInput"),
  website: document.querySelector("#websiteInput"),
  directions: document.querySelector("#directionsInput"),
  phone: document.querySelector("#phoneInput"),
};

const preview = {
  name: document.querySelector("#previewName"),
  description: document.querySelector("#previewDescription"),
  rating: document.querySelector("#previewRating"),
  city: document.querySelector("#previewCity"),
  logo: document.querySelector("#previewLogo"),
  review: document.querySelector("#reviewLink"),
  instagram: document.querySelector("#instagramLink"),
  whatsapp: document.querySelector("#whatsappLink"),
  menu: document.querySelector("#menuLink"),
  website: document.querySelector("#websiteLink"),
  directions: document.querySelector("#directionsLink"),
  phone: document.querySelector("#phoneLink"),
  qr: document.querySelector("#qrImage"),
  downloadQr: document.querySelector("#downloadQr"),
  downloadStatus: document.querySelector("#downloadStatus"),
  shareUrl: document.querySelector("#shareUrl"),
  copyShareLink: document.querySelector("#copyShareLink"),
  previewLink: document.querySelector("#previewLink"),
  publishButton: document.querySelector("#publishButton"),
  publishStatus: document.querySelector("#publishStatus"),
  analyticsPanel: document.querySelector("#analyticsPanel"),
  statVisits: document.querySelector("#statVisits"),
  statUniques: document.querySelector("#statUniques"),
  clicksBreakdown: document.querySelector("#clicksBreakdown"),
};

let uploadedLogoUrl = "";
let currentQrUrl = "";
let currentQrFileName = "linkrtap-qr.png";
let currentSlug = "";
let currentQrId = "";
let publishedShareUrl = "";
let publishedPreviewUrl = "";

const ACTION_LABELS = {
  review: "Review",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  menu: "Menu",
  website: "Website",
  directions: "Directions",
  phone: "Call",
};

function slugify(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business"
  );
}

function phoneHref(value) {
  const digits = value.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

function setLink(element, value) {
  element.href = value || "#";
  element.style.display = value ? "grid" : "none";
}

function updatePreview() {
  const businessName = fields.name.value.trim() || "Business Name";

  preview.name.textContent = businessName;
  preview.description.textContent = fields.description.value.trim() || "Add a short welcome message for customers.";
  preview.rating.textContent = `${fields.rating.value.trim() || "4.8"} rating`;
  preview.city.textContent = fields.city.value.trim() || "Your city";
  preview.logo.textContent = uploadedLogoUrl ? "" : (fields.initials.value.trim() || businessName.slice(0, 2)).toUpperCase();
  preview.logo.style.backgroundImage = uploadedLogoUrl ? `url("${uploadedLogoUrl}")` : "";
  preview.logo.classList.toggle("has-image", Boolean(uploadedLogoUrl));

  setLink(preview.review, fields.review.value.trim());
  setLink(preview.instagram, fields.instagram.value.trim());
  setLink(preview.whatsapp, fields.whatsapp.value.trim());
  setLink(preview.menu, fields.menu.value.trim());
  setLink(preview.website, fields.website.value.trim());
  setLink(preview.directions, fields.directions.value.trim());
  preview.phone.href = phoneHref(fields.phone.value);

  const slug = slugify(businessName);
  const slugChanged = slug !== currentSlug && !publishedShareUrl.endsWith(`/${slug}`);

  if (publishedShareUrl && slugChanged) {
    // Fields changed since the last publish — the live page is stale until
    // republished, so don't imply the QR/share link still matches.
    preview.publishStatus.textContent = "Unpublished changes. Publish again to update the live page.";
  }

  const qrId = fields.qrId.value.trim() || currentQrId || `qr-${slug}`;
  const qrTargetUrl = publishedShareUrl || `${window.location.origin}/api/scan/${qrId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&format=png&data=${encodeURIComponent(qrTargetUrl)}`;
  currentQrUrl = qrUrl;
  currentQrFileName = `${slug}-linkrtap-qr.png`;
  preview.qr.src = qrUrl;
}

function renderAnalytics(data) {
  preview.analyticsPanel.style.display = "block";
  preview.statVisits.textContent = data.visitsTotal ?? 0;
  preview.statUniques.textContent = data.uniqueVisitors14d ?? 0;

  const rows = Object.entries(data.clicksByAction || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([action, count]) => `
        <div class="analytics-breakdown-row">
          <span>${ACTION_LABELS[action] || action}</span>
          <span>${count}</span>
        </div>`
    )
    .join("");

  preview.clicksBreakdown.innerHTML = rows || `<p style="color:var(--muted);font-size:13px;">No clicks yet.</p>`;
}

async function loadAnalytics(slug) {
  try {
    const response = await fetch(`/api/analytics/${encodeURIComponent(slug)}`);
    if (!response.ok) return;
    const data = await response.json();
    renderAnalytics(data);
  } catch {
    // Analytics are a nice-to-have on this page; fail quietly.
  }
}

function applyPublishedState(slug, qrId) {
  currentSlug = slug;
  currentQrId = qrId || `qr-${slug}`;
  fields.qrId.value = currentQrId;
  publishedShareUrl = `${window.location.origin}/api/scan/${currentQrId}`;
  publishedPreviewUrl = `${window.location.origin}/${slug}`;

  preview.shareUrl.textContent = publishedShareUrl.replace(/^https?:\/\//, "");
  preview.copyShareLink.style.display = "inline-block";
  preview.previewLink.href = publishedPreviewUrl;
  preview.previewLink.textContent = publishedPreviewUrl.replace(/^https?:\/\//, "");
  preview.previewLink.style.display = "block";
  updatePreview();
  loadAnalytics(slug);
}

async function loadExistingBusiness(slug) {
  try {
    const response = await fetch(`/api/business/${encodeURIComponent(slug)}`);
    if (!response.ok) return;
    const record = await response.json();

    fields.name.value = record.name || "";
    fields.description.value = record.description || "";
    fields.rating.value = record.rating || "";
    fields.city.value = record.city || "";
    fields.initials.value = record.initials || "";
    fields.qrId.value = record.qrId || "";
    fields.stickerNumber.value = record.stickerNumber || "";
    fields.review.value = record.review || "";
    fields.instagram.value = record.instagram || "";
    fields.whatsapp.value = record.whatsapp || "";
    fields.menu.value = record.menu || "";
    fields.website.value = record.website || "";
    fields.directions.value = record.directions || "";
    fields.phone.value = record.phone || "";
    uploadedLogoUrl = record.logoUrl || "";

    applyPublishedState(record.slug, record.qrId);
  } catch {
    // If loading fails, the form just stays on its defaults.
  }
}

Object.values(fields).forEach((field) => {
  if (field.type !== "file") {
    field.addEventListener("input", updatePreview);
  }
});

fields.logo.addEventListener("change", () => {
  const file = fields.logo.files[0];

  if (!file) {
    uploadedLogoUrl = "";
    updatePreview();
    return;
  }

  uploadedLogoUrl = URL.createObjectURL(file);
  updatePreview();
});

preview.downloadQr.addEventListener("click", async () => {
  preview.downloadStatus.textContent = "Preparing QR...";

  try {
    const response = await fetch(currentQrUrl);
    if (!response.ok) throw new Error("QR download failed");

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const temporaryLink = document.createElement("a");

    temporaryLink.href = objectUrl;
    temporaryLink.download = currentQrFileName;
    document.body.appendChild(temporaryLink);
    temporaryLink.click();
    temporaryLink.remove();
    URL.revokeObjectURL(objectUrl);
    preview.downloadStatus.textContent = "Downloaded.";
  } catch (error) {
    preview.downloadStatus.textContent = "Could not auto-download. Opening QR instead.";
    window.open(currentQrUrl, "_blank", "noopener");
  }
});

preview.copyShareLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(publishedShareUrl);
    preview.copyShareLink.textContent = "Copied!";
    setTimeout(() => {
      preview.copyShareLink.textContent = "Copy link";
    }, 1500);
  } catch {
    // Clipboard access can fail (permissions, non-HTTPS); the link text is
    // already visible for manual copy in that case.
  }
});

preview.publishButton.addEventListener("click", async () => {
  preview.publishStatus.textContent = "Publishing...";
  preview.publishButton.disabled = true;

  const payload = {
    id: currentSlug,
    slug: currentSlug || slugify(fields.name.value.trim() || "business"),
    qrId: fields.qrId.value.trim(),
    stickerNumber: fields.stickerNumber.value.trim(),
    name: fields.name.value.trim(),
    description: fields.description.value.trim(),
    rating: fields.rating.value.trim(),
    city: fields.city.value.trim(),
    initials: fields.initials.value.trim(),
    // Uploaded logo previews are local blob: URLs and can't be sent to the
    // server yet — real image hosting (e.g. Vercel Blob) is a follow-up.
    logoUrl: uploadedLogoUrl.startsWith("blob:") ? "" : uploadedLogoUrl,
    review: fields.review.value.trim(),
    instagram: fields.instagram.value.trim(),
    whatsapp: fields.whatsapp.value.trim(),
    menu: fields.menu.value.trim(),
    website: fields.website.value.trim(),
    directions: fields.directions.value.trim(),
    phone: fields.phone.value.trim(),
  };

  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Publish failed");

    preview.publishStatus.textContent = "Published.";
    applyPublishedState(data.slug, data.qrId);

    // Reflect the (possibly disambiguated) slug in the URL without reloading.
    const newUrl = `${window.location.pathname}?slug=${encodeURIComponent(data.slug)}`;
    window.history.replaceState(null, "", newUrl);
  } catch (error) {
    preview.publishStatus.textContent = "Could not publish. Check your connection and try again.";
  } finally {
    preview.publishButton.disabled = false;
  }
});

const params = new URLSearchParams(window.location.search);
const existingSlug = params.get("slug");

if (existingSlug) {
  loadExistingBusiness(existingSlug);
} else {
  updatePreview();
}

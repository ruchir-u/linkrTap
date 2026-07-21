const businessForm = document.querySelector("#businessForm");

// Every field lives inside this <form>, but there's no submit button in
// it — Publish lives outside, in the QR panel. Without this, hitting Enter
// in any single-line input (name, rating, city, ...) triggers the browser's
// default form submission: a full-page navigation that throws away
// whatever was being typed.
businessForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

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
  logoStatus: document.querySelector("#logoStatus"),
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
  statClicks: document.querySelector("#statClicks"),
  statLastVisit: document.querySelector("#statLastVisit"),
  dailyTrend: document.querySelector("#dailyTrend"),
  clicksBreakdown: document.querySelector("#clicksBreakdown"),
  sourceBreakdown: document.querySelector("#sourceBreakdown"),
  deviceBreakdown: document.querySelector("#deviceBreakdown"),
};

let uploadedLogoUrl = "";
let localLogoPreviewUrl = "";
let logoUploadInFlight = false;
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

const SOURCE_LABELS = {
  direct: "Direct / QR",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  google: "Google",
  twitter: "Twitter / X",
  other: "Other links",
};

const DEVICE_LABELS = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
  unknown: "Unknown",
  bot: "Bot (filtered)",
};

function relativeTime(isoString) {
  if (!isoString) return "Never";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business"
  );
}

// Downscales/recompresses the chosen file client-side before it's sent to
// the server, so a phone-camera photo doesn't blow past the upload limit.
// Resolves to { blob, contentType } with dimensions capped at maxDim.
function compressLogoImage(file, maxDim = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);

      // PNGs with transparency (logos on a clear background) need to stay
      // PNG; everything else gets recompressed as JPEG to shrink further.
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not process image"));
            return;
          }
          resolve({ blob, contentType: outputType });
        },
        outputType,
        outputType === "image/jpeg" ? quality : undefined
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };

    img.src = objectUrl;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not encode image"));
    reader.readAsDataURL(blob);
  });
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

function breakdownRows(counts, labels) {
  const rows = Object.entries(counts || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([key, count]) => `
        <div class="analytics-breakdown-row">
          <span>${labels[key] || key}</span>
          <span>${count}</span>
        </div>`
    )
    .join("");

  return rows || `<p style="color:var(--muted);font-size:13px;">No data yet.</p>`;
}

function renderDailyTrend(dailyVisits) {
  const max = Math.max(1, ...dailyVisits.map((d) => d.count));

  preview.dailyTrend.innerHTML = dailyVisits
    .map((d) => {
      const heightPct = Math.max(4, Math.round((d.count / max) * 100));
      const dateLabel = new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      return `<div class="analytics-trend-bar${d.count === 0 ? " zero" : ""}" style="height:${heightPct}%" title="${dateLabel}: ${d.count} visit${d.count === 1 ? "" : "s"}, ${d.uniques} unique, ${d.clicks} click${d.clicks === 1 ? "" : "s"}"></div>`;
    })
    .join("");
}

function renderAnalytics(data) {
  preview.analyticsPanel.style.display = "block";
  preview.statVisits.textContent = data.visitsTotal ?? 0;
  preview.statUniques.textContent = data.uniqueVisitors14d ?? 0;
  preview.statClicks.textContent = data.totalClicks ?? 0;
  preview.statLastVisit.textContent = relativeTime(data.lastVisit);

  renderDailyTrend(data.dailyVisits || []);
  preview.clicksBreakdown.innerHTML = breakdownRows(data.clicksByAction, ACTION_LABELS);
  preview.sourceBreakdown.innerHTML = breakdownRows(data.visitsBySource, SOURCE_LABELS);
  preview.deviceBreakdown.innerHTML = breakdownRows(data.visitsByDevice, DEVICE_LABELS);
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

// If loading an existing business fails, currentSlug must NOT silently stay
// empty — that would make the form look like a fresh "create" screen, and
// publishing from it would create a brand-new duplicate record instead of
// updating the one the user thinks they're editing (leaving the original
// orphaned in Redis and on the dashboard). So on failure we lock the form
// instead of letting it masquerade as blank/new.
function lockFormWithLoadError(message) {
  preview.publishButton.disabled = true;
  preview.publishStatus.textContent = message;
  preview.publishStatus.style.color = "#c0392b";
}

async function loadExistingBusiness(slug) {
  try {
    const response = await fetch(`/api/business/${encodeURIComponent(slug)}`);

    if (!response.ok) {
      lockFormWithLoadError(
        response.status === 404
          ? "Could not find this business (it may have been deleted or renamed). Reload the dashboard rather than publishing from here."
          : "Could not load this business (server error). Reload the page before publishing."
      );
      return;
    }

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
    // Network error, JSON parse failure, etc. — same reasoning as above:
    // fail loudly and block publishing rather than defaulting to blank/new.
    lockFormWithLoadError("Could not load this business (connection issue). Reload the page before publishing.");
  }
}

Object.values(fields).forEach((field) => {
  if (field.type !== "file") {
    field.addEventListener("input", updatePreview);
  }
});

fields.logo.addEventListener("change", async () => {
  const file = fields.logo.files[0];

  if (!file) {
    if (localLogoPreviewUrl) URL.revokeObjectURL(localLogoPreviewUrl);
    localLogoPreviewUrl = "";
    uploadedLogoUrl = "";
    preview.logoStatus.textContent = "";
    updatePreview();
    return;
  }

  if (!["image/png", "image/jpeg"].includes(file.type)) {
    preview.logoStatus.textContent = "Only PNG or JPEG images are supported.";
    preview.logoStatus.style.color = "#c0392b";
    fields.logo.value = "";
    return;
  }

  // Show an instant local preview while the real upload happens in the
  // background, so the UI doesn't feel like it's stalled.
  if (localLogoPreviewUrl) URL.revokeObjectURL(localLogoPreviewUrl);
  localLogoPreviewUrl = URL.createObjectURL(file);
  uploadedLogoUrl = localLogoPreviewUrl;
  updatePreview();

  preview.logoStatus.textContent = "Uploading logo...";
  preview.logoStatus.style.color = "";
  logoUploadInFlight = true;
  preview.publishButton.disabled = true;

  try {
    const { blob, contentType } = await compressLogoImage(file);

    if (blob.size > 3 * 1024 * 1024) {
      throw new Error("Logo is too large even after compression (max 3MB).");
    }

    const dataBase64 = await blobToBase64(blob);
    const slugForUpload = currentSlug || slugify(fields.name.value.trim() || "business");

    const response = await fetch("/api/admin/upload-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slugForUpload, contentType, dataBase64 }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed");

    // Swap the local blob: preview for the real hosted URL now that it's live.
    if (localLogoPreviewUrl) URL.revokeObjectURL(localLogoPreviewUrl);
    localLogoPreviewUrl = "";
    uploadedLogoUrl = data.url;
    preview.logoStatus.textContent = "Logo uploaded.";
    preview.logoStatus.style.color = "";
  } catch (error) {
    // Keep the local preview so the user can still see what they picked,
    // but don't pretend it's saved — publishing won't include a broken
    // blob: URL (see the publish handler), so the page would just fall
    // back to initials until the upload is retried.
    preview.logoStatus.textContent = `${error.message || "Logo upload failed"}. The page will use initials instead until this is retried.`;
    preview.logoStatus.style.color = "#c0392b";
  } finally {
    logoUploadInFlight = false;
    preview.publishButton.disabled = false;
    updatePreview();
  }
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

async function submitPublish(confirmReassign = false) {
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
    // uploadedLogoUrl is only ever a real hosted URL once the upload above
    // succeeds; a lingering blob: URL means the upload failed, so it's
    // stripped here as a last-resort safety net (the page falls back to
    // initials rather than publishing a dead local reference).
    logoUrl: uploadedLogoUrl.startsWith("blob:") ? "" : uploadedLogoUrl,
    review: fields.review.value.trim(),
    instagram: fields.instagram.value.trim(),
    whatsapp: fields.whatsapp.value.trim(),
    menu: fields.menu.value.trim(),
    website: fields.website.value.trim(),
    directions: fields.directions.value.trim(),
    phone: fields.phone.value.trim(),
  };

  if (confirmReassign) payload.confirmReassign = true;

  const response = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return { response, data: await response.json() };
}

preview.publishButton.addEventListener("click", async () => {
  if (logoUploadInFlight) {
    preview.publishStatus.textContent = "Still uploading the logo — try publishing again in a moment.";
    return;
  }

  preview.publishStatus.textContent = "Publishing...";
  preview.publishButton.disabled = true;

  try {
    let { response, data } = await submitPublish();

    // The QR ID being entered is currently assigned to a different,
    // published business. Publishing here would silently archive that
    // business's live page — so instead of doing that as a side effect,
    // the server refused and told us who'd be affected. Ask before we
    // resubmit with explicit confirmation.
    if (response.status === 409 && data.error === "qr_reassign_confirmation_required") {
      const { qrId, formerName } = data.conflict;
      const confirmed = window.confirm(
        `QR "${qrId}" is currently assigned to "${formerName}". Reassigning it here will archive that business's page (it'll stop being publicly reachable). Continue?`
      );

      if (!confirmed) {
        preview.publishStatus.textContent = "Publish cancelled — QR ID was not reassigned.";
        preview.publishButton.disabled = false;
        return;
      }

      ({ response, data } = await submitPublish(true));
    }

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

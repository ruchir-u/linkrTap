const fields = {
  name: document.querySelector("#nameInput"),
  description: document.querySelector("#descriptionInput"),
  rating: document.querySelector("#ratingInput"),
  city: document.querySelector("#cityInput"),
  initials: document.querySelector("#initialsInput"),
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
  shortUrl: document.querySelector("#shortUrl"),
  publishButton: document.querySelector("#publishButton"),
  publishStatus: document.querySelector("#publishStatus"),
  liveLink: document.querySelector("#liveLink"),
};

let uploadedLogoUrl = "";
let currentQrUrl = "";
let currentQrFileName = "linkrtap-qr.png";
let currentSlug = "";
let publishedUrl = "";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "business";
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
  const slug = slugify(businessName);
  const shortUrl = `linkrtap.local/${slug}`;

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

  const slugChanged = slug !== currentSlug;
  currentSlug = slug;

  if (slugChanged && publishedUrl) {
    // Fields changed since the last publish, so the live link is stale
    // until the business is republished.
    publishedUrl = "";
    preview.liveLink.style.display = "none";
    preview.publishStatus.textContent = "Unpublished changes. Publish again to update the live page.";
  }

  if (publishedUrl) {
    preview.shortUrl.textContent = publishedUrl.replace(/^https?:\/\//, "");
  } else {
    preview.shortUrl.textContent = `${shortUrl} (not published yet)`;
  }

  const qrTargetUrl = publishedUrl || `https://${shortUrl}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&format=png&data=${encodeURIComponent(qrTargetUrl)}`;
  currentQrUrl = qrUrl;
  currentQrFileName = `${slug}-linkrtap-qr.png`;
  preview.qr.src = qrUrl;
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

    if (!response.ok) {
      throw new Error("QR download failed");
    }

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

preview.publishButton.addEventListener("click", async () => {
  preview.publishStatus.textContent = "Publishing...";
  preview.publishButton.disabled = true;

  const payload = {
    id: currentSlug,
    slug: slugify(fields.name.value.trim() || "business"),
    name: fields.name.value.trim(),
    description: fields.description.value.trim(),
    rating: fields.rating.value.trim(),
    city: fields.city.value.trim(),
    initials: fields.initials.value.trim(),
    // Uploaded logo previews are local blob: URLs and can't be sent to the
    // server yet — hosted logo images will need real file storage (e.g.
    // Vercel Blob) in a follow-up. Public pages fall back to initials.
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

    if (!response.ok) {
      throw new Error(data.error || "Publish failed");
    }

    publishedUrl = `${window.location.origin}/${data.slug}`;
    currentSlug = data.slug;
    preview.publishStatus.textContent = "Published.";
    preview.liveLink.href = publishedUrl;
    preview.liveLink.textContent = publishedUrl.replace(/^https?:\/\//, "");
    preview.liveLink.style.display = "block";
    updatePreview();
  } catch (error) {
    preview.publishStatus.textContent = "Could not publish. Check your connection and try again.";
  } finally {
    preview.publishButton.disabled = false;
  }
});

updatePreview();

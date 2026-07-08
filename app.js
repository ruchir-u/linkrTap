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
};

let uploadedLogoUrl = "";
let currentQrUrl = "";
let currentQrFileName = "linkrtap-qr.png";

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

  preview.shortUrl.textContent = shortUrl;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&format=png&data=${encodeURIComponent(`https://${shortUrl}`)}`;
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

updatePreview();

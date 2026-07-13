function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

function healthLabel(lastScannedAt, status) {
  if (status !== "active") return status;
  if (!lastScannedAt) return "never scanned";
  const days = Math.floor((Date.now() - new Date(lastScannedAt).getTime()) / 86400000);
  return days >= 30 ? `inactive for ${days} days` : days >= 14 ? `quiet for ${days} days` : "healthy";
}

async function loadBusinesses() {
  const container = document.querySelector("#businessList");

  try {
    const response = await fetch("/api/admin/businesses");

    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }

    const data = await response.json();

    if (!data.businesses || data.businesses.length === 0) {
      container.innerHTML = "<p>No businesses published yet. Add your first one.</p>";
      return;
    }

    container.innerHTML = data.businesses
      .map(
        (b) => `
        <div class="business-card">
          <div>
            <h3>${escapeHtml(b.name)}</h3>
            <p class="business-card-meta">${escapeHtml(b.city || "")} · /${escapeHtml(b.slug)}</p>
            <p class="business-card-stats">${b.visitsTotal} scans · ${b.clicksTotal} clicks</p>
            <p class="business-card-health">${escapeHtml(b.qrId || "Legacy QR")} · ${b.qrScansTotal} QR scans · ${escapeHtml(healthLabel(b.lastScannedAt, b.status))}</p>
          </div>
          <div class="business-card-actions">
            <a href="/admin/editor?slug=${encodeURIComponent(b.slug)}">Edit</a>
            <a href="/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Preview</a>
            <button class="status-button" data-slug="${escapeHtml(b.slug)}" data-status="${b.status === "active" ? "disabled" : "active"}">${b.status === "active" ? "Disable" : "Activate"}</button>
            <button class="status-button archive" data-slug="${escapeHtml(b.slug)}" data-status="archived">Archive</button>
          </div>
        </div>
      `
      )
      .join("");
  } catch (error) {
    container.innerHTML = "<p>Could not load businesses. Try refreshing.</p>";
  }
}

document.querySelector("#businessList").addEventListener("click", async (event) => {
  const button = event.target.closest(".status-button");
  if (!button) return;
  button.disabled = true;
  const response = await fetch("/api/admin/business-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: button.dataset.slug, status: button.dataset.status }),
  });
  if (response.ok) loadBusinesses();
  else button.disabled = false;
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/admin-logout", { method: "POST" });
  window.location.href = "/admin/login";
});

loadBusinesses();

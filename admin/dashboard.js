function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
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
          </div>
          <div class="business-card-actions">
            <a href="/admin/editor?slug=${encodeURIComponent(b.slug)}">Edit</a>
            <a href="/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Preview</a>
          </div>
        </div>
      `
      )
      .join("");
  } catch (error) {
    container.innerHTML = "<p>Could not load businesses. Try refreshing.</p>";
  }
}

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/admin-logout", { method: "POST" });
  window.location.href = "/admin/login";
});

loadBusinesses();

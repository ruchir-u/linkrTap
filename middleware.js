import crypto from "crypto";
import { next } from "@vercel/functions";

export const config = {
  runtime: "nodejs",
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/save",
    "/api/analytics/:path*",
    "/api/business/:path*",
    "/api/admin/:path*",
  ],
};

function expectedToken() {
  const password = process.env.ADMIN_PASSWORD || "";
  return crypto.createHash("sha256").update(`linkrtap-admin:${password}`).digest("hex");
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  const parts = cookieHeader.split(";").map((p) => p.trim());

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }

  return null;
}

export default function middleware(request) {
  const url = new URL(request.url);
  const { pathname } = url;

  // The login page (and whatever it posts to) has to stay reachable, or
  // nobody could ever get past this gate in the first place.
  if (pathname === "/admin/login" || pathname === "/admin/login.html") {
    return next();
  }

  const cookieToken = getCookie(request, "linkrtap_admin");
  const authenticated = Boolean(cookieToken) && cookieToken === expectedToken();

  if (authenticated) {
    return next();
  }

  if (pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return Response.redirect(new URL("/admin/login", request.url), 302);
}

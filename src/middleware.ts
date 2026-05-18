import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  // Public request subdomain should bypass estimator login
  if (host === "request.gigpower.com" && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/request-estimate";
    return NextResponse.redirect(url);
  }

  const { response, user } = await updateSession(request);

  const isProtected =
    pathname === "/" ||
    pathname === "/estimator" ||
    pathname.startsWith("/estimator/") ||
    pathname === "/admin";

  const isLogin = pathname === "/login";

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/estimator/:path*", "/admin"],
};
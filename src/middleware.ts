import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  const hasSession =
    response.cookies.getAll().some((c) => c.name.startsWith("sb-")) ||
    request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  const isProtected =
  pathname === "/" ||
  pathname === "/estimator" ||
  pathname.startsWith("/estimator/") ||
  pathname === "/admin";

  const isLogin = pathname === "/login";

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

 if (isLogin && hasSession) {
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
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const url = request.nextUrl.clone();

  if (host === "request.gigpower.com" && url.pathname === "/") {
    url.pathname = "/request-estimate";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
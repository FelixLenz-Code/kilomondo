import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "carlog_session";
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Optimistic check only — real validation happens in server components/actions.
  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect everything except Next internals, static files and PWA assets.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|tesseract|.*\\.png$).*)",
  ],
};

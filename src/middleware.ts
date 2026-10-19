import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const rolePrefixes: Record<string, string[]> = {
  PUBLISHER: ["/publisher"],
  INSTRUCTOR: ["/instructor"],
  STUDENT: ["/student"],
  ORG_ADMIN: ["/org"],
};

const publicPaths = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/files")
  ) {
    return NextResponse.next();
  }

  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  if (!token && !isPublic && (pathname.startsWith("/publisher") ||
    pathname.startsWith("/instructor") ||
    pathname.startsWith("/student") ||
    pathname.startsWith("/org") ||
    pathname.startsWith("/reader"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in users stay in the authenticated app — no landing / auth pages.
  if (
    token &&
    (pathname === "/" || pathname === "/login" || pathname === "/register")
  ) {
    const role = String(token.role);
    const home =
      role === "PUBLISHER"
        ? "/publisher"
        : role === "INSTRUCTOR"
          ? "/instructor"
          : role === "ORG_ADMIN"
            ? "/org"
            : "/student";
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (token) {
    const role = String(token.role);
    for (const [r, prefixes] of Object.entries(rolePrefixes)) {
      if (prefixes.some((p) => pathname.startsWith(p)) && role !== r) {
        const home =
          role === "PUBLISHER"
            ? "/publisher"
            : role === "INSTRUCTOR"
              ? "/instructor"
              : role === "ORG_ADMIN"
                ? "/org"
                : "/student";
        return NextResponse.redirect(new URL(home, req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};

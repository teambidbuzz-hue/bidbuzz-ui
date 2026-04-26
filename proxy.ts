import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for route protection.
 *
 * Note: We can't check localStorage/auth state here since middleware runs on the edge.
 * Client-side auth checks handle the actual redirect logic in each page component.
 * This middleware could be extended for cookie-based auth in the future.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root to auth page
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/auth/:path*"],
};

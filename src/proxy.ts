import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthMode } from "@/server/auth/config";

function isProtectedRoute(request: NextRequest) {
  const { pathname } = request.nextUrl;

  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/") ||
    pathname === "/knowledge" ||
    pathname.startsWith("/knowledge/") ||
    pathname === "/api/knowledge-bases" ||
    pathname.startsWith("/api/knowledge-bases/")
  );
}
const authProxy = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (getAuthMode() !== "clerk") {
    return NextResponse.next();
  }

  return authProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

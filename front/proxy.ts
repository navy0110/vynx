import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Sponsorships use signed wallet challenges, independently of Supabase Auth cookies.
  if (request.nextUrl.pathname === '/api/sponsorships' || request.nextUrl.pathname.startsWith('/creators/') || request.nextUrl.pathname === '/dashboard/sponsorships') {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

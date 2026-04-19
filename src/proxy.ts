import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Landing page lives at `/` now; no redirect. Keep /project reachable directly
  // for back-compat (existing bookmarks, legacy desktop flow).
  const response = NextResponse.next();
  if (request.nextUrl.pathname === '/project') {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export const config = {
  matcher: ['/project'],
};
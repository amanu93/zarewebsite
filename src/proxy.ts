// Next.js 16 picks this file up as middleware (formerly `middleware.ts`).
// Kept minimal: gate `/admin/*` on the presence of an `access_token` cookie
// and bounce to /admin/login otherwise. Any token refresh happens
// client-side via RTK Query's baseQuery — this middleware does not proxy or
// call the backend directly.

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ADMIN_ROUTES = new Set([
  '/admin/login',
  '/admin/forgot-password',
]);

const PUBLIC_FILE = /\.(.*)$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const isAdminRoute = pathname.startsWith('/admin');
  if (!isAdminRoute) return NextResponse.next();

  if (PUBLIC_ADMIN_ROUTES.has(pathname)) return NextResponse.next();

  const accessToken = request.cookies.get('access_token');
  if (accessToken) return NextResponse.next();

  const loginUrl = new URL('/admin/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*'],
};

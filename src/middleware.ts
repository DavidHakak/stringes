import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Static and public assets should bypass authentication
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api/youtube') || // YouTube search can be protected by user state in API, but let's allow middleware bypass for assets/APIs
    path.includes('.') ||
    path === '/favicon.ico' ||
    path === '/manifest.json' ||
    path === '/sw.js'
  ) {
    return supabaseResponse;
  }

  // Redirect to login if user is not authenticated and not on login page
  if (!user && path !== '/login') {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect to home if user is logged in and tries to access login page
  if (user && path === '/login') {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Admin routing protection will be securely performed in the server component page.tsx directly from the database to ensure real-time accuracy and bypass client token latency.

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

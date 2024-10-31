import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  try {
    const supabase = createMiddlewareClient({ req, res });
    await supabase.auth.getSession();
    return res;
  } catch (e) {
    return res;
  }
}

export const config = {
  matcher: ['/((?!public-attendance|_next/static|_next/image|favicon.ico).*)'],
};
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Required by Supabase's SSR auth pattern: session tokens expire and need
// refreshing, and that refresh has to happen somewhere that runs on every
// request and can write cookies - middleware is that place. Without this,
// signed-in users get silently logged out whenever their token expires
// mid-session.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  // A deploy with missing env vars should render a degraded site, not a
  // wall of 500s from middleware.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch (err) {
    console.error("middleware: session refresh failed", err);
  }
  return response;
}

export const config = {
  // Skip static assets, and the webhook (server-to-server, no session).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|api/webhooks).*)"],
};

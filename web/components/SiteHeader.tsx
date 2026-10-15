import Link from "next/link";
import { getActiveSubscription } from "@/lib/subscription";
import { SITE_NAME } from "@/lib/site";
import { SignOutButton } from "./SignOutButton";

export async function SiteHeader() {
  const { user, isActive } = await getActiveSubscription();

  return (
    <header className="border-b border-pitch-700">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-display text-lg tracking-wide text-chalk">
            {SITE_NAME}
          </Link>
          <nav className="hidden gap-4 text-sm text-sage sm:flex">
            <Link href="/" className="hover:text-chalk">Picks</Link>
            <Link href="/track-record" className="hover:text-chalk">Track record</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {!user ? (
            <Link href="/login" className="text-amber underline underline-offset-2">
              Sign in
            </Link>
          ) : (
            <>
              {isActive ? (
                <span className="rounded border border-amber px-2 py-0.5 text-xs text-amber">Member</span>
              ) : (
                <Link href="/upgrade" className="rounded bg-amber px-2.5 py-1 text-xs font-medium text-pitch-950">
                  Upgrade
                </Link>
              )}
              <SignOutButton />
            </>
          )}
        </div>
      </div>

      <nav className="mx-auto flex max-w-2xl gap-4 px-5 pb-3 text-sm text-sage sm:hidden">
        <Link href="/" className="hover:text-chalk">Picks</Link>
        <Link href="/track-record" className="hover:text-chalk">Track record</Link>
      </nav>
    </header>
  );
}

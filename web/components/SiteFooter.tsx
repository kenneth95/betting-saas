import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-pitch-700">
      <div className="mx-auto max-w-2xl px-5 py-8 text-xs leading-relaxed text-sage">
        <p>
          <strong className="text-chalk">18+ only.</strong> Gambling can be addictive - never stake more than you
          can afford to lose. {SITE_NAME} publishes statistical analysis, not guaranteed outcomes, and is not
          affiliated with any bookmaker.
        </p>
        <p className="mt-3 flex gap-4">
          <Link href="/responsible-gambling" className="underline underline-offset-2">Responsible gambling</Link>
          <Link href="/track-record" className="underline underline-offset-2">Track record</Link>
        </p>
      </div>
    </footer>
  );
}

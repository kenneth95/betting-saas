import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UpgradeForm } from "@/components/UpgradeForm";
import { getActiveSubscription } from "@/lib/subscription";
import { SUBSCRIPTION_DAYS, WEEKLY_PRICE_KES } from "@/lib/site";

export const metadata: Metadata = { title: "Unlock full weekly picks" };
export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const { user, isActive, periodEnd } = await getActiveSubscription();

  if (!user) {
    redirect("/login?next=/upgrade");
  }

  const until = periodEnd
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date(periodEnd))
    : null;

  return (
    <main className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-3xl text-chalk">Unlock full weekly picks</h1>
      <p className="mt-3 text-sm text-sage">
        KES {WEEKLY_PRICE_KES} for {SUBSCRIPTION_DAYS} days of full access. Paid by M-Pesa, one-off - it
        doesn&apos;t renew by itself.
      </p>

      {isActive && until && (
        <p className="mt-4 rounded border border-pitch-700 bg-pitch-800 px-3 py-2 text-sm text-chalk">
          You&apos;re already a member until {until}. Paying again adds {SUBSCRIPTION_DAYS} days to the end.{" "}
          <Link href="/picks" className="text-amber underline underline-offset-2">Back to picks</Link>
        </p>
      )}

      <UpgradeForm />
    </main>
  );
}

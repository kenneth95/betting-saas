import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { daysRemaining } from "@/lib/billing";
import { formatDate, formatKickoff, pageShell } from "@/lib/business";
import { SUBSCRIPTION_DAYS, WEEKLY_PRICE_KES } from "@/lib/site";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

type PaymentRow = { api_ref: string; amount: number | string; currency: string; status: string; created_at: string };

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  completed: { text: "Paid", tone: "text-amber" },
  pending: { text: "Waiting for confirmation", tone: "text-chalk" },
  failed: { text: "Not completed", tone: "text-sage" },
};

export default async function AccountPage() {
  const { user, isActive, periodEnd } = await getActiveSubscription();
  if (!user) redirect("/login?next=/account");

  // The user's own session, so RLS ("users can read their own payments") scopes this to them.
  const { data } = await createClient()
    .from("payments")
    .select("api_ref, amount, currency, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const payments = (data ?? []) as PaymentRow[];

  const left = periodEnd ? daysRemaining(periodEnd) : 0;
  const hasPending = payments.some((p) => p.status === "pending");

  return (
    <main className={`${pageShell} max-w-2xl`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">ACCOUNT</p>
      <h1 className="mt-3 font-display text-4xl text-chalk">Your account</h1>
      <p className="mt-2 text-sm text-sage">Signed in as {user.email}</p>

      <section className="mt-8 rounded border border-pitch-700 bg-pitch-800 p-5">
        <h2 className="font-display text-xl text-chalk">Membership</h2>
        {isActive && periodEnd ? (
          <>
            <p className="mt-2 text-sm text-chalk">
              Active until {formatKickoff(periodEnd)} EAT{" "}
              <span className="text-sage">
                ({left} {left === 1 ? "day" : "days"} left)
              </span>
            </p>
            <p className="mt-1 text-sm text-sage">
              Renewing early adds {SUBSCRIPTION_DAYS} days to the end of your current period.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-sage">
            You don&apos;t have an active membership. Full access is KES {WEEKLY_PRICE_KES} for {SUBSCRIPTION_DAYS} days.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/upgrade" className="min-h-11 rounded bg-amber px-4 py-3 text-sm font-medium text-pitch-950">
            {isActive ? "Add more time" : "Unlock full picks"}
          </Link>
          <Link href="/picks" className="min-h-11 rounded border border-pitch-700 px-4 py-3 text-sm text-chalk">
            View picks
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl text-chalk">Payments</h2>
        {hasPending && (
          <p className="mt-2 text-sm text-sage">
            A payment is still waiting for confirmation. If you approved it on your phone, this can take a few minutes -
            refresh this page shortly.
          </p>
        )}
        {payments.length > 0 ? (
          <ul className="mt-3 divide-y divide-pitch-700 border-y border-pitch-700">
            {payments.map((p) => {
              const label = STATUS_LABEL[p.status] ?? { text: p.status, tone: "text-sage" };
              return (
                <li key={p.api_ref} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="text-chalk">
                      {p.currency} {Number(p.amount).toLocaleString("en-KE")}
                    </div>
                    <div className="text-xs text-sage">{formatDate(p.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className={label.tone}>{label.text}</div>
                    <div className="tabular text-[11px] text-sage">Ref {p.api_ref.slice(-8)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-sage">No payments yet.</p>
        )}
        <p className="mt-4 text-xs text-sage">
          Charged but not unlocked? <Link href="/contact" className="text-amber underline underline-offset-2">Contact support</Link>{" "}
          with the reference above and your M-Pesa confirmation code.
        </p>
      </section>
    </main>
  );
}

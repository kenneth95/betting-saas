import Link from "next/link";
import { getWeeklyFixtures } from "@/lib/data";
import { FixtureRow } from "@/components/FixtureRow";
import { getActiveSubscription } from "@/lib/subscription";
import { FREE_TIER_VISIBLE_COUNT, WEEKLY_PRICE_KES } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { upgraded?: string };
}) {
  const [allFixtures, { user, isActive }] = await Promise.all([
    getWeeklyFixtures(),
    getActiveSubscription(),
  ]);

  // Gate here, on the server, before anything reaches a component: a
  // locked fixture keeps its teams and kickoff but carries no picks.
  const fixtures = allFixtures.map((fixture, index) => {
    const locked = !isActive && index >= FREE_TIER_VISIBLE_COUNT;
    return { fixture: locked ? { ...fixture, valueBets: [] } : fixture, locked };
  });

  const lockedCount = fixtures.filter((f) => f.locked).length;
  const nValue = allFixtures.filter((f) => f.valueBets.some((vb) => vb.is_value)).length;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      {searchParams?.upgraded && isActive && (
        <div className="mb-6 rounded border border-amber bg-pitch-800 px-4 py-3 text-sm text-chalk">
          Payment received - every pick this week is unlocked.
        </div>
      )}

      <section className="mb-8">
        <h1 className="font-display text-3xl leading-tight text-chalk">This week in the Premier League</h1>
        <p className="mt-3 max-w-lg text-sm text-sage">
          Our model&apos;s win/draw/loss probabilities set against the odds Kenyan bookmakers are pricing
          from. Where the model sees a real gap, the pick is flagged as value.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/track-record" className="text-amber underline underline-offset-2">
            See the full, settled track record
          </Link>
        </p>
      </section>

      {fixtures.length === 0 ? (
        <p className="text-sage">
          No fixtures loaded yet for this week. Check back once this week&apos;s data has run.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs uppercase tracking-wider text-sage">
            {fixtures.length} fixtures · {nValue} with a flagged value pick
          </p>
          <div>
            {fixtures.map(({ fixture, locked }) => (
              <FixtureRow key={fixture.id} fixture={fixture} locked={locked} />
            ))}
          </div>
        </>
      )}

      {!isActive && lockedCount > 0 && (
        <section className="mt-8 rounded border border-pitch-700 bg-pitch-800 p-5">
          <h2 className="font-display text-xl text-chalk">Unlock all {fixtures.length} fixtures</h2>
          <p className="mt-2 text-sm text-sage">
            KES {WEEKLY_PRICE_KES} for 7 days. Pay with M-Pesa - no card, no auto-renewal.
          </p>
          <Link
            href={user ? "/upgrade" : "/login?next=/upgrade"}
            className="mt-4 inline-block rounded bg-amber px-4 py-2 text-sm font-medium text-pitch-950"
          >
            {user ? "Upgrade with M-Pesa" : "Sign in to upgrade"}
          </Link>
        </section>
      )}

      <section className="mt-12 grid gap-6 text-sm text-sage sm:grid-cols-3">
        {[
          ["1. Model", "A Dixon-Coles Poisson model rates every team from past results."],
          ["2. Compare", "Its probabilities are checked against bookmaker odds with the margin stripped out."],
          ["3. Settle", "Every flagged pick is scored against the real result - wins and losses."],
        ].map(([title, body]) => (
          <div key={title}>
            <h3 className="font-display text-base text-chalk">{title}</h3>
            <p className="mt-1">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

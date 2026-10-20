import type { Metadata } from "next";
import { getWeeklyFixtures } from "@/lib/data";
import { getActiveSubscription } from "@/lib/subscription";
import { FREE_TIER_VISIBLE_COUNT } from "@/lib/site";
import { formatKickoff, pageShell } from "@/lib/business";
import { PicksBrowser } from "@/components/PicksBrowser";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Weekly picks",
  description: "Premier League model probabilities and Kenyan bookmaker odds comparisons.",
};

export default async function PicksPage({ searchParams }: { searchParams?: { upgraded?: string } }) {
  const [all, { isActive, periodEnd }] = await Promise.all([getWeeklyFixtures(), getActiveSubscription()]);

  // Gate on the server: locked fixtures have their bets stripped here, before
  // anything is handed to a component, so they never reach the browser.
  const fixtures = all.map((fixture, index) => {
    const locked = !isActive && index >= FREE_TIER_VISIBLE_COUNT;
    return { ...fixture, locked, valueBets: locked ? [] : fixture.valueBets };
  });

  return (
    <main className={pageShell}>
      {searchParams?.upgraded && isActive && periodEnd && (
        <p role="status" className="mb-6 rounded border border-amber bg-pitch-800 px-4 py-3 text-sm text-chalk">
          Payment confirmed - you&apos;re a member until {formatKickoff(periodEnd)} EAT. Enjoy the full board.
        </p>
      )}

      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">EPL / WEEKLY BOARD</p>
        <h1 className="mt-3 font-display text-4xl text-chalk">This week&apos;s picks</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-sage">
          Compare the Dixon-Coles model with bookmaker-implied probabilities. Amber rows are flagged as value.
        </p>
      </header>

      <PicksBrowser fixtures={fixtures} isMember={isActive} />
    </main>
  );
}

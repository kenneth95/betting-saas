import type { Metadata } from "next";
import { getTrackRecord } from "@/lib/trackRecord";
import { TrackRecordStats } from "@/components/TrackRecordStats";
import { SettledBetRow } from "@/components/SettledBetRow";

export const metadata: Metadata = { title: "Track record" };

// Below this many settled bets, ROI is mostly noise - say so rather than let a lucky or unlucky start mislead.
const MIN_MEANINGFUL_SAMPLE = 30;
export const dynamic = "force-dynamic";

export default async function TrackRecordPage() {
  const { summary, recentBets } = await getTrackRecord();

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-chalk">Track record</h1>
        <p className="mt-2 max-w-md text-sm text-sage">
          Every flagged value bet, settled against the actual result - wins and losses both.
          ROI assumes a flat 1-unit stake per bet at the odds shown. Each bookmaker's price on the same
          match counts as its own bet. Past results do not predict future ones.
        </p>
      </header>

      <TrackRecordStats summary={summary} />

      {summary.totalSettled > 0 && summary.totalSettled < MIN_MEANINGFUL_SAMPLE && (
        <p className="mt-3 text-xs text-sage">
          Early days: with fewer than {MIN_MEANINGFUL_SAMPLE} settled bets, win rate and ROI swing a lot from a
          single result and say little about the model yet.
        </p>
      )}

      <div className="mt-8">
        {recentBets.length === 0 ? (
          <p className="text-sage">No settled bets yet - check back once this week&apos;s fixtures finish.</p>
        ) : (
          recentBets.map((bet) => (
            <SettledBetRow key={`${bet.fixture_id}-${bet.local_label}`} bet={bet} />
          ))
        )}
      </div>
    </main>
  );
}

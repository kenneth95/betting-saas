import { getTrackRecord } from "@/lib/trackRecord";
import { TrackRecordStats } from "@/components/TrackRecordStats";
import { SettledBetRow } from "@/components/SettledBetRow";

export const dynamic = "force-dynamic";

export default async function TrackRecordPage() {
  const { summary, recentBets } = await getTrackRecord();

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-chalk">Track record</h1>
        <p className="mt-2 max-w-md text-sm text-sage">
          Every flagged value bet, settled against the actual result - wins and losses both.
          ROI assumes a flat 1-unit stake per bet.
        </p>
      </header>

      <TrackRecordStats summary={summary} />

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

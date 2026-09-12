import type { User } from "@supabase/supabase-js";
import { getWeeklyFixtures } from "@/lib/data";
import { FixtureRow } from "@/components/FixtureRow";
import { getActiveSubscription } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const FREE_TIER_VISIBLE_COUNT = 2;

export default async function HomePage() {
  const [fixtures, { user, isActive }] = await Promise.all([
    getWeeklyFixtures(),
    getActiveSubscription(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-chalk">This week in the Premier League</h1>
          <p className="mt-2 max-w-md text-sm text-sage">
            Odds captured about a week before kickoff and compared against our model.
            Predictions are probabilistic, not guarantees — bet within your means.
          </p>
        </div>
        <AccountLink user={user} isActive={isActive} />
      </header>

      <p className="mb-6 text-sm">
        <a href="/track-record" className="text-amber underline underline-offset-2">
          See our full track record
        </a>
      </p>

      {fixtures.length === 0 ? (
        <p className="text-sage">
          No fixtures loaded yet for this week. Check back once this week&apos;s data has run.
        </p>
      ) : (
        <div>
          {fixtures.map((fixture, index) => (
            <FixtureRow
              key={fixture.id}
              fixture={fixture}
              locked={!isActive && index >= FREE_TIER_VISIBLE_COUNT}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function AccountLink({ user, isActive }: { user: User | null; isActive: boolean }) {
  if (!user) {
    return (
      <a href="/login" className="whitespace-nowrap text-sm text-amber underline underline-offset-2">
        Sign in
      </a>
    );
  }
  return (
    <div className="whitespace-nowrap text-right text-sm text-sage">
      <div>{user.email}</div>
      {!isActive && (
        <a href="/upgrade" className="text-amber underline underline-offset-2">
          Upgrade
        </a>
      )}
    </div>
  );
}

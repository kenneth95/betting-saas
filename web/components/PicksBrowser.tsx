"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ValueBetRow, WeeklyFixture } from "@/lib/types";
import { bookmakerName, edgeLabel, formatKickoff, oddsForSide, sideName } from "@/lib/business";

type PickFixture = WeeklyFixture & { locked: boolean };
type Filter = "all" | "value" | "sportpesa" | "betika" | "other";
type Sort = "kickoff" | "edge";

const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["value", "Value only"],
  ["sportpesa", "SportPesa"],
  ["betika", "Betika"],
  ["other", "Other books"],
];

// Locked fixtures carry no bets, so they have no edge; sort them to the end.
const NO_EDGE = -1e9;
const bestEdge = (f: PickFixture) => (f.valueBets.length ? Math.max(...f.valueBets.map((b) => b.edge)) : NO_EDGE);

export function PicksBrowser({ fixtures, isMember }: { fixtures: PickFixture[]; isMember: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("kickoff");

  const hasLocked = fixtures.some((f) => f.locked);
  const valueCount = fixtures.filter((f) => f.valueBets.some((b) => b.is_value)).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fixtures
      .filter((f) => `${f.home_team} ${f.away_team}`.toLowerCase().includes(q))
      .filter((f) => {
        if (filter === "all") return true;
        if (filter === "value") return f.valueBets.some((b) => b.is_value);
        return f.valueBets.some((b) => b.local_label === filter);
      })
      .sort((a, b) =>
        sort === "edge"
          ? bestEdge(b) - bestEdge(a)
          : +new Date(a.kickoff_at) - +new Date(b.kickoff_at)
      );
  }, [fixtures, query, filter, sort]);

  return (
    // Bottom padding keeps the last card clear of the fixed mobile unlock bar.
    <div className={!isMember && hasLocked ? "pb-24 sm:pb-0" : undefined}>
      <div className="sticky top-0 z-10 mb-4 grid gap-3 border-y border-pitch-700 bg-pitch-950 py-4 sm:grid-cols-[1fr_auto_auto]">
        <input
          aria-label="Search teams"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams"
          className="min-h-11 rounded border border-pitch-700 bg-pitch-800 px-3 text-sm text-chalk outline-none focus:border-amber"
        />
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter picks">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-11 whitespace-nowrap rounded border px-3 text-xs ${
                filter === value ? "border-amber bg-amber text-pitch-950" : "border-pitch-700 text-sage"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="Sort picks"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="min-h-11 rounded border border-pitch-700 bg-pitch-800 px-3 text-sm text-chalk"
        >
          <option value="kickoff">Kickoff</option>
          <option value="edge">Highest edge</option>
        </select>
      </div>

      <p className="mb-4 text-xs text-sage" aria-live="polite">
        Showing {shown.length} of {fixtures.length} fixtures
        {isMember ? ` · ${valueCount} with a value flag` : ""}
      </p>

      <div className="flex flex-col gap-4">
        {shown.map((fixture) => (
          <FixtureCard key={fixture.id} fixture={fixture} />
        ))}
      </div>

      {shown.length === 0 && (
        <p className="py-10 text-center text-sage">
          {fixtures.length === 0
            ? "This week's fixtures are being updated. Check back shortly."
            : "No fixtures match those filters."}
        </p>
      )}

      {/* Value flags on locked fixtures are stripped server-side, so a "value only" view can't show them. */}
      {filter === "value" && hasLocked && (
        <p className="mt-4 text-center text-xs text-sage">
          Value flags on locked fixtures are for members.
        </p>
      )}

      {!isMember && hasLocked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-amber bg-pitch-800 p-3 shadow-lg sm:static sm:mt-8 sm:border sm:p-5">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-chalk">Unlock every fixture and bookmaker comparison.</p>
            <Link href="/upgrade" className="shrink-0 rounded bg-amber px-4 py-3 text-sm font-medium text-pitch-950">
              Unlock picks
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FixtureCard({ fixture }: { fixture: PickFixture }) {
  const ref: ValueBetRow | undefined = fixture.valueBets[0];
  const updated = fixture.valueBets
    .map((b) => b.computed_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <article className="rounded border border-pitch-700 bg-pitch-800/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl text-chalk">
          {fixture.home_team} <span className="text-sage">v</span> {fixture.away_team}
        </h2>
        <time dateTime={fixture.kickoff_at} className="text-xs text-sage">
          {formatKickoff(fixture.kickoff_at)} EAT
        </time>
      </div>

      {fixture.locked ? (
        <div className="mt-5 border-t border-pitch-700 pt-4 text-sm text-sage">
          Probabilities and odds comparison are for members.{" "}
          <Link href="/upgrade" className="text-amber underline underline-offset-2">
            Unlock full weekly picks
          </Link>
        </div>
      ) : ref ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-4 text-xs">
            <Probability label="Home" model={ref.model_prob_home} implied={ref.implied_prob_home} />
            <Probability label="Draw" model={ref.model_prob_draw} implied={ref.implied_prob_draw} />
            <Probability label="Away" model={ref.model_prob_away} implied={ref.implied_prob_away} />
          </div>

          <div className="mt-5 border-t border-pitch-700">
            {fixture.valueBets.map((bet) => (
              <div
                key={bet.local_label}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-pitch-700/70 py-3 text-sm"
              >
                <span className="text-chalk">{bookmakerName(bet.local_label)}</span>
                <span className="tabular text-sage">
                  {sideName(bet.flagged_side)} @ {oddsForSide(bet, bet.flagged_side).toFixed(2)}
                </span>
                <span className={`tabular font-semibold ${bet.is_value ? "text-amber" : "text-sage"}`}>
                  {edgeLabel(bet.edge)}
                  {bet.is_value ? " value" : ""}
                </span>
              </div>
            ))}
          </div>
          {updated && <p className="mt-3 text-[11px] text-sage">Odds captured {formatKickoff(updated)} EAT</p>}
        </>
      ) : (
        <p className="mt-5 text-sm text-sage">No odds captured for this fixture yet.</p>
      )}
    </article>
  );
}

// Model and bookmaker probability are two separate bars on the same 0-100%
// scale so they can be compared by eye. (Stacking them in one bar made two
// numbers that don't sum to anything look like parts of a whole.)
function Probability({ label, model, implied }: { label: string; model: number; implied: number }) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sage">
        <span>{label}</span>
        <span className="tabular font-semibold text-chalk">{pct(model)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-pitch-700" role="img" aria-label={`Model ${pct(model)}`}>
        <div className="h-full bg-amber" style={{ width: pct(model) }} />
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-pitch-700" role="img" aria-label={`Bookmaker ${pct(implied)}`}>
        <div className="h-full bg-sage/60" style={{ width: pct(implied) }} />
      </div>
      <p className="mt-1 tabular text-[11px] text-sage">book {pct(implied)}</p>
    </div>
  );
}

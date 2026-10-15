import type { Metadata } from "next";
import { getWeeklyFixtures } from "@/lib/data";
import { getActiveSubscription } from "@/lib/subscription";
import { FREE_TIER_VISIBLE_COUNT } from "@/lib/site";
import { PicksBrowser } from "@/components/PicksBrowser";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Weekly picks", description: "Premier League model probabilities and Kenyan bookmaker odds comparisons." };
export default async function PicksPage() { const [all, { isActive }] = await Promise.all([getWeeklyFixtures(), getActiveSubscription()]); const fixtures = all.map((fixture, index) => ({ ...fixture, locked: !isActive && index >= FREE_TIER_VISIBLE_COUNT, valueBets: !isActive && index >= FREE_TIER_VISIBLE_COUNT ? [] : fixture.valueBets })); return <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14"><header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber">EPL / WEEKLY BOARD</p><h1 className="mt-3 font-display text-4xl text-chalk">This week&apos;s picks</h1><p className="mt-3 max-w-xl text-sm leading-6 text-sage">Compare the Dixon-Coles model with bookmaker-implied probabilities. Amber rows are flagged as value.</p></header><PicksBrowser fixtures={fixtures} isMember={isActive}/></main> }

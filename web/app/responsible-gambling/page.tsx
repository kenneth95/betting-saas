import type { Metadata } from "next";

export const metadata: Metadata = { title: "Responsible gambling" };

export default function ResponsibleGamblingPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl text-chalk">Responsible gambling</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-sage">
        <p>
          You must be 18 or over to use this site. Our picks are statistical estimates: even a flagged
          &quot;value&quot; bet loses often, and no model can promise a profit.
        </p>
        <p>
          Only stake money you can afford to lose. Set a budget before you bet and stick to it, never chase
          losses, and don&apos;t bet to solve money problems.
        </p>
        <p>
          If gambling is affecting your finances, relationships or wellbeing, stop and talk to someone you trust,
          or contact a local support service. Most Kenyan bookmakers also let you set deposit limits or
          self-exclude from your account settings.
        </p>
        <p>We are an analysis service and are not affiliated with, or paid by, any bookmaker.</p>
      </div>
    </main>
  );
}

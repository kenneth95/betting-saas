import type { TrackRecordSummary } from "@/lib/trackRecordTypes";

export function TrackRecordStats({ summary }: { summary: TrackRecordSummary }) {
  const cells: Array<[string, string]> = [
    ["Settled bets", `${summary.totalSettled}`],
    ["Win rate", summary.winRate != null ? `${Math.round(summary.winRate * 100)}%` : "—"],
    [
      "ROI per bet",
      summary.roiPerBet != null
        ? `${summary.roiPerBet >= 0 ? "+" : ""}${(summary.roiPerBet * 100).toFixed(1)}%`
        : "—",
    ],
  ];

  return (
    <div className="grid grid-cols-3 gap-4 rounded border border-pitch-700 bg-pitch-800 p-4">
      {cells.map(([label, value]) => (
        <div key={label} className="text-center">
          <div className="text-xs text-sage">{label}</div>
          <div className="font-display text-2xl tabular text-chalk">{value}</div>
        </div>
      ))}
    </div>
  );
}

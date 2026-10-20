import type { TrackRecordSummary } from "@/lib/trackRecordTypes";

const signed = (n: number, digits: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;

export function TrackRecordStats({ summary }: { summary: TrackRecordSummary }) {
  const cells: Array<[string, string]> = [
    ["Settled bets", `${summary.totalSettled}`],
    ["Win rate", summary.winRate != null ? `${Math.round(summary.winRate * 100)}%` : "—"],
    ["ROI per bet", summary.roiPerBet != null ? `${signed(summary.roiPerBet * 100, 1)}%` : "—"],
    ["Profit (units)", summary.totalSettled > 0 ? signed(summary.totalPnlUnits, 1) : "—"],
  ];

  return (
    <div className="grid grid-cols-2 gap-4 rounded border border-pitch-700 bg-pitch-800 p-4 sm:grid-cols-4">
      {cells.map(([label, value]) => (
        <div key={label} className="text-center">
          <div className="text-xs text-sage">{label}</div>
          <div className="font-display text-2xl tabular text-chalk">{value}</div>
        </div>
      ))}
    </div>
  );
}

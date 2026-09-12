export function ProbTrio({
  home,
  draw,
  away,
}: {
  home?: number;
  draw?: number;
  away?: number;
}) {
  const cells: Array<[string, number | undefined]> = [
    ["Home", home],
    ["Draw", draw],
    ["Away", away],
  ];

  return (
    <div className="grid grid-cols-3 gap-4 border-t border-pitch-700 pt-3">
      {cells.map(([label, value]) => (
        <div key={label}>
          <div className="text-xs text-sage">{label}</div>
          <div className="font-display text-xl tabular text-chalk">
            {value != null ? `${Math.round(value * 100)}%` : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

interface FloorTableProps {
  floorHeights: number[];
  maxHeight: number;
}

export function FloorTable({ floorHeights, maxHeight }: FloorTableProps) {
  if (floorHeights.length === 0) return null;

  const rows: Array<{ floor: number; height: number; cumulative: number }> = [];
  let cumulative = 0;
  for (let i = 0; i < floorHeights.length; i += 1) {
    cumulative += floorHeights[i];
    if (cumulative > maxHeight + 0.01) break;
    rows.push({ floor: i + 1, height: floorHeights[i], cumulative });
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground">階高一覧</h3>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-white/75">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">階</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">階高</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">累計高さ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((row) => (
              <tr key={row.floor}>
                <td className="px-3 py-2 text-foreground/80">{row.floor}F</td>
                <td className="px-3 py-2 text-right font-mono text-foreground/80">{row.height.toFixed(1)}m</td>
                <td className="px-3 py-2 text-right font-mono text-foreground/80">{row.cumulative.toFixed(1)}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

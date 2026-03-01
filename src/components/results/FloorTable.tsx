'use client';

interface FloorTableProps {
  floorHeights: number[];
  maxHeight: number;
}

export function FloorTable({ floorHeights, maxHeight }: FloorTableProps) {
  if (floorHeights.length === 0) return null;

  const rows: { floor: number; height: number; cumulative: number }[] = [];
  let cumH = 0;
  for (let i = 0; i < floorHeights.length; i++) {
    cumH += floorHeights[i];
    if (cumH > maxHeight + 0.01) break;
    rows.push({ floor: i + 1, height: floorHeights[i], cumulative: cumH });
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold text-muted-foreground">階別面積表</h3>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">階</th>
              <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">階高</th>
              <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">累積高さ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.floor}>
                <td className="px-3 py-1 text-foreground/80">{row.floor}F</td>
                <td className="px-3 py-1 text-right text-foreground/80 font-mono">{row.height.toFixed(1)}m</td>
                <td className="px-3 py-1 text-right text-foreground/80 font-mono">{row.cumulative.toFixed(1)}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

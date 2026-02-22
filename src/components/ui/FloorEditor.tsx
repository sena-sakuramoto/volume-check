'use client';

interface FloorEditorProps {
  maxFloors: number;
  maxHeight: number;
  floorHeights: number[];
  onFloorHeightsChange: (heights: number[]) => void;
}

const FIRST_FLOOR_PRESETS = [2.8, 3.0, 3.5, 4.0];
const UPPER_FLOOR_PRESETS = [2.8, 3.0, 3.2];

export function FloorEditor({
  maxFloors,
  maxHeight,
  floorHeights,
  onFloorHeightsChange,
}: FloorEditorProps) {
  if (!maxFloors || maxFloors <= 0) {
    return (
      <div className="p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          階高設定
        </h3>
        <p className="text-xs text-gray-500 text-center py-4">
          敷地データを入力してください
        </p>
      </div>
    );
  }

  const totalHeight = floorHeights.reduce((sum, h) => sum + h, 0);
  const remaining = maxHeight - totalHeight;
  const isOverBudget = remaining < 0;

  const handleHeightChange = (index: number, value: string) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) return;
    const next = [...floorHeights];
    next[index] = parsed;
    onFloorHeightsChange(next);
  };

  const handlePreset = (index: number, value: number) => {
    const next = [...floorHeights];
    next[index] = value;
    onFloorHeightsChange(next);
  };

  const handleResetAll = () => {
    onFloorHeightsChange(Array(maxFloors).fill(3.0));
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          階高設定
        </h3>
        <button
          onClick={handleResetAll}
          className="rounded border border-gray-600 px-2 py-0.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-300 transition-colors"
        >
          全階リセット
        </button>
      </div>

      {/* Floor list */}
      <div className="flex flex-col gap-1.5">
        {floorHeights.map((height, i) => {
          const floorLabel = `${i + 1}F`;
          const presets = i === 0 ? FIRST_FLOOR_PRESETS : UPPER_FLOOR_PRESETS;

          return (
            <div
              key={i}
              className="rounded bg-gray-800 border border-gray-700 px-2 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-gray-400 w-6 shrink-0">
                  {floorLabel}
                </span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleHeightChange(i, e.target.value)}
                  step="0.1"
                  min="2.0"
                  max="10"
                  className="w-14 rounded border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-xs text-gray-100 text-right focus:border-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-gray-500">m</span>
                <div className="flex gap-0.5 ml-auto">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePreset(i, preset)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        height === preset
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-300'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-2 rounded bg-gray-800 border border-gray-700 px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">合計高さ</span>
          <span
            className={`text-xs font-bold ${
              isOverBudget ? 'text-red-400' : 'text-gray-100'
            }`}
          >
            {totalHeight.toFixed(1)}m
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-gray-400">残り</span>
          <span
            className={`text-xs font-medium ${
              isOverBudget ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {remaining.toFixed(1)}m
          </span>
        </div>
        {isOverBudget && (
          <p className="mt-1 text-[10px] text-red-400">
            最大高さ ({maxHeight.toFixed(1)}m) を超過しています
          </p>
        )}
      </div>
    </div>
  );
}

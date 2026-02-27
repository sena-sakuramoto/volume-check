'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/cn';
import type { ZoningData, VolumeResult } from '@/engine/types';

interface AiChatProps {
  zoning: ZoningData | null;
  result: VolumeResult | null;
  siteArea: number | null;
}

/** Quick-answer patterns for common questions (works without API key) */
function tryLocalAnswer(
  question: string,
  zoning: ZoningData | null,
  result: VolumeResult | null,
  siteArea: number | null,
): string | null {
  const q = question.toLowerCase();

  if (!zoning || !result) {
    if (q.includes('使い方') || q.includes('ヘルプ') || q.includes('how')) {
      return '左パネルで「デモデータを使う」をクリックするか、用途地域・敷地寸法・道路幅を入力すると3Dボリュームが表示されます。';
    }
    return 'まず敷地データを入力してください。左パネルの「デモデータを使う」ボタンで試せます。';
  }

  // Height/floor questions
  if (q.includes('階') && (q.includes('可能') || q.includes('建て'))) {
    const floors = result.maxFloors;
    return `この敷地条件では最大${floors}階建てが可能です（最大高さ${result.maxHeight}m、階高3.0m想定）。用途地域: ${zoning.district}、絶対高さ制限: ${zoning.absoluteHeightLimit ?? 'なし'}m。`;
  }

  if (q.includes('高さ')) {
    return `最大建築高さ: ${result.maxHeight}m（${result.maxFloors}階相当）。制限要因: ${zoning.absoluteHeightLimit ? `絶対高さ${zoning.absoluteHeightLimit}m` : '斜線制限'}。`;
  }

  // Coverage
  if (q.includes('建ぺい') || q.includes('建蔽')) {
    const cov = (zoning.coverageRatio * 100).toFixed(0);
    return `建ぺい率: ${cov}%。最大建築面積: ${result.maxCoverageArea.toFixed(1)}m²（敷地面積${siteArea?.toFixed(1) ?? '?'}m² × ${cov}%）。法56条の2。`;
  }

  // FAR
  if (q.includes('容積')) {
    const far = (zoning.floorAreaRatio * 100).toFixed(0);
    return `容積率: ${far}%。最大延べ面積: ${result.maxFloorArea.toFixed(1)}m²。法52条。前面道路幅員による容積率制限も考慮済み。`;
  }

  // Setback
  if (q.includes('斜線') || q.includes('setback')) {
    const info: string[] = [];
    info.push(`用途地域: ${zoning.district}`);
    if (zoning.absoluteHeightLimit) info.push(`絶対高さ: ${zoning.absoluteHeightLimit}m`);
    if (zoning.wallSetback) info.push(`外壁後退: ${zoning.wallSetback}m`);
    return `斜線制限の概要:\n${info.join('\n')}\n\n3Dビューのレイヤー切替で各斜線（道路・隣地・北側）を個別に確認できます。法56条。`;
  }

  // Summary
  if (q.includes('まとめ') || q.includes('概要') || q.includes('サマリ')) {
    return `【ボリュームチェック結果】\n用途地域: ${zoning.district}\n建ぺい率: ${(zoning.coverageRatio * 100).toFixed(0)}% → 建築面積${result.maxCoverageArea.toFixed(1)}m²\n容積率: ${(zoning.floorAreaRatio * 100).toFixed(0)}% → 延べ面積${result.maxFloorArea.toFixed(1)}m²\n最大高さ: ${result.maxHeight}m (${result.maxFloors}F)`;
  }

  return null;
}

export function AiChat({ zoning, result, siteArea }: AiChatProps) {
  const [input, setInput] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const askQuestion = async (question: string) => {
    const normalized = question.trim();
    if (!normalized || isLoading) return;

    setIsLoading(true);
    const localAnswer = tryLocalAnswer(normalized, zoning, result, siteArea);
    if (localAnswer) {
      setCurrentAnswer(localAnswer);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: normalized,
          context: {
            zoning: zoning
              ? {
                  district: zoning.district,
                  coverageRatio: zoning.coverageRatio,
                  floorAreaRatio: zoning.floorAreaRatio,
                  absoluteHeightLimit: zoning.absoluteHeightLimit,
                  wallSetback: zoning.wallSetback,
                  fireDistrict: zoning.fireDistrict,
                }
              : undefined,
            result: result
              ? {
                  maxFloorArea: result.maxFloorArea,
                  maxCoverageArea: result.maxCoverageArea,
                  maxHeight: result.maxHeight,
                  maxFloors: result.maxFloors,
                }
              : undefined,
            siteArea,
          },
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || '回答を生成できませんでした。';
      setCurrentAnswer(reply);
    } catch {
      const fallback = zoning
        ? `AI接続エラー。現在の計算結果: 最大高さ${result?.maxHeight ?? '?'}m、最大${result?.maxFloors ?? '?'}階、延べ面積${result?.maxFloorArea?.toFixed(1) ?? '?'}m²`
        : '接続エラー。まず敷地データを入力してから質問してください。';
      setCurrentAnswer(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    await askQuestion(userMessage);
  };

  const handleQuickAction = (action: string) => {
    void askQuestion(action);
  };

  const handleCopy = () => {
    if (!currentAnswer) return;
    void navigator.clipboard.writeText(currentAnswer);
  };

  const quickActions = ['何階建て可能？', '斜線制限は？', '結果まとめ'];

  return (
    <div className="rounded-lg bg-card/95 backdrop-blur-sm border border-border p-2.5 space-y-2">
      <div className="flex flex-wrap gap-1">
        {quickActions.map((action) => (
          <button
            key={action}
            onClick={() => handleQuickAction(action)}
            disabled={isLoading}
            className={cn(
              'rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors whitespace-nowrap',
              isLoading && 'opacity-60 pointer-events-none',
            )}
          >
            {action}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-xs text-muted-foreground animate-pulse px-1">考え中...</div>
      )}

      {currentAnswer && (
        <div className="rounded-lg bg-card border border-border px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-primary">AI</span>
            <span className="text-[10px] text-muted-foreground">回答</span>
          </div>
          <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
            {currentAnswer}
          </p>
          <div className="flex gap-1">
            <button
              onClick={handleCopy}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border transition-colors"
            >
              コピー
            </button>
            <button
              onClick={() => setCurrentAnswer(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <details className="group">
        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1">
          自由に質問する
        </summary>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
            placeholder="この敷地で3階建ては可能？"
            disabled={isLoading}
            className="flex-1 h-8 text-sm"
          />
          <Button
            onClick={() => void handleSubmit()}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="shrink-0"
          >
            送信
          </Button>
        </div>
      </details>
    </div>
  );
}

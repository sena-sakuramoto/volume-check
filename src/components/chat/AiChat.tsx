'use client';

import { useState, useRef, useEffect } from 'react';
import type { ZoningData, VolumeResult } from '@/engine/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setIsOpen(true);

    // Try local answer first (no API needed)
    const localAnswer = tryLocalAnswer(userMessage, zoning, result, siteArea);
    if (localAnswer) {
      setMessages((prev) => [...prev, { role: 'assistant', content: localAnswer }]);
      setIsLoading(false);
      return;
    }

    // Try Gemini API
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
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
      const reply = data.reply || data.error;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      // Fallback: provide basic info
      const fallback = zoning
        ? `AI接続エラー。現在の計算結果: 最大高さ${result?.maxHeight ?? '?'}m、最大${result?.maxFloors ?? '?'}階、延べ面積${result?.maxFloorArea?.toFixed(1) ?? '?'}m²`
        : '接続エラー。まず敷地データを入力してから質問してください。';
      setMessages((prev) => [...prev, { role: 'assistant', content: fallback }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Quick-action buttons
  const quickActions = [
    '何階建て可能？',
    '斜線制限は？',
    '結果まとめ',
  ];

  return (
    <div className="relative">
      {/* Chat history panel - slides up */}
      {isOpen && messages.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 bg-gray-900 border border-b-0 border-gray-700 rounded-t-lg shadow-2xl max-h-80 overflow-y-auto">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
            <span className="text-xs font-bold text-gray-400">AI アシスタント</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-300 text-sm"
            >
              閉じる
            </button>
          </div>
          <div className="p-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'text-right' : ''}>
                <div
                  className={`inline-block max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-200 border border-gray-700'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => handleCopy(msg.content)}
                      className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded border border-gray-700"
                    >
                      コピー
                    </button>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="text-sm text-gray-500 animate-pulse">考え中...</div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900">
        <span className="text-gray-500 text-xs font-bold flex-shrink-0">AI</span>

        {/* Quick actions */}
        {messages.length === 0 && (
          <div className="flex gap-1">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => {
                  setInput(action);
                  // Trigger submit immediately
                  const msg = action;
                  setInput('');
                  setMessages((prev) => [...prev, { role: 'user', content: msg }]);
                  setIsLoading(true);
                  setIsOpen(true);
                  const local = tryLocalAnswer(msg, zoning, result, siteArea);
                  if (local) {
                    setMessages((prev) => [...prev, { role: 'assistant', content: local }]);
                    setIsLoading(false);
                  } else {
                    // Fallback
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: 'assistant',
                        content: 'まず敷地データを入力してください。',
                      },
                    ]);
                    setIsLoading(false);
                  }
                }}
                className="rounded-full border border-gray-700 px-2.5 py-1 text-[10px] text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors whitespace-nowrap"
              >
                {action}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="この敷地で3階建ては可能？"
          className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
          disabled={isLoading}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
        >
          送信
        </button>
      </div>
    </div>
  );
}

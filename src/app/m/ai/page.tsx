'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/components/volans/MobileHeader';
import { useVolansResult } from '@/hooks/useVolansResult';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'greet',
    role: 'ai',
    content: 'こんにちは！どのような計画を検討中でしょうか？',
  },
];

const SUGGESTIONS = [
  'この条件でオフィスビルを提案',
  '容積率を最大化するパターンは？',
  '天空率緩和の可否を教えて',
];

export default function MobileAIPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const display = useVolansResult();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: msg };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setSending(true);

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          context: {
            projectName: display.projectName,
            address: display.address,
            site: { area: display.siteArea },
            zoning: {
              district: display.zoningName,
              coverageRatio: display.coverageRatioPct,
              floorAreaRatio: display.floorAreaRatioPct,
            },
            summary: {
              slantFloorArea: display.slant.floorArea,
              slantFloors: display.slant.floors,
              skyFloorArea: display.sky.floorArea,
              skyFloors: display.sky.floors,
            },
          },
        }),
      });
      const data = (await resp.json()) as { reply?: string; error?: string };
      const reply =
        data.reply ??
        (data.error
          ? `AI 応答に失敗しました: ${data.error}`
          : 'AI 応答を取得できませんでした');
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'ai', content: reply }]);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'ネットワークエラー';
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: 'ai', content: `通信エラー: ${err}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <MobileHeader back="/m" title="AIアシスタント" />
      <div
        ref={scrollRef}
        className="flex flex-col gap-3 overflow-y-auto px-4 pt-3"
        style={{ paddingBottom: 180 }}
      >
        {messages.map((m) => {
          if (m.role === 'ai') {
            return (
              <div key={m.id} className="flex gap-2">
                <Avatar />
                <Bubble>
                  <div
                    className="whitespace-pre-wrap text-[12px]"
                    style={{ color: 'var(--volans-text)' }}
                  >
                    {m.content}
                  </div>
                </Bubble>
              </div>
            );
          }
          return (
            <div key={m.id} className="flex justify-end">
              <div
                className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm px-3 py-2 text-[12px] text-white"
                style={{ background: 'var(--volans-primary)' }}
              >
                {m.content}
              </div>
            </div>
          );
        })}

        {messages.length === 1 && (
          <div className="flex flex-wrap gap-1.5 pl-9">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full px-2.5 py-1 text-[11px]"
                style={{
                  background: 'var(--volans-primary-soft)',
                  color: 'var(--volans-primary-strong)',
                  border: `1px solid var(--volans-border)`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {sending && (
          <div className="flex gap-2">
            <Avatar />
            <Bubble>
              <div
                className="flex items-center gap-2 text-[12px]"
                style={{ color: 'var(--volans-muted)' }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                考えています…
              </div>
            </Bubble>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="fixed bottom-[68px] left-0 right-0 flex items-center gap-2 px-3 py-2"
        style={{
          background: 'var(--volans-surface)',
          borderTop: `1px solid var(--volans-border)`,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          className="flex-1 rounded-full px-3 py-2 text-[12px] outline-none disabled:opacity-60"
          style={{
            background: 'var(--volans-surface-alt)',
            border: `1px solid var(--volans-border)`,
            color: 'var(--volans-text)',
          }}
          placeholder="メッセージを入力…"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="grid h-9 w-9 place-items-center rounded-full text-white disabled:opacity-50"
          style={{ background: 'var(--volans-primary)' }}
          aria-label="送信"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </form>
    </>
  );
}

function Avatar() {
  return (
    <div
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white"
      style={{ background: 'linear-gradient(135deg, #3b6de1 0%, #22a06b 100%)' }}
    >
      <Sparkles className="h-3.5 w-3.5" />
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      {children}
    </div>
  );
}

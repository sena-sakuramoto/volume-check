import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import './globals.css';

const fontVariables: CSSProperties = {
  '--font-display': '"Space Grotesk", "Noto Sans JP", "Hiragino Sans", sans-serif',
  '--font-body': '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
  '--font-mono': '"JetBrains Mono", "SF Mono", "Roboto Mono", monospace',
} as CSSProperties;

export const metadata: Metadata = {
  title: 'VolumeCheck - 建築ボリュームチェック',
  description:
    '住所入力だけで法規制を自動取得し、最大建築可能ボリュームを3Dで表示',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ja">
      <body style={fontVariables} className="antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

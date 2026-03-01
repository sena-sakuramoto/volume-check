import type { Metadata } from 'next';
import { Space_Grotesk, Noto_Sans_JP, JetBrains_Mono } from 'next/font/google';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

const body = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'VolumeCheck - 建築ボリュームチェック',
  description:
    '住所入力だけで法規制を自動取得し、最大建築可能ボリュームを3Dで表示',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${body.variable} ${display.variable} ${mono.variable} antialiased`}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

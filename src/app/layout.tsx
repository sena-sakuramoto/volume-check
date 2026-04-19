import type { Metadata } from 'next';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://volans.archi-prisma.co.jp';
const TITLE = 'VOLANS — 最大ボリュームを、一瞬で。';
const DESCRIPTION =
  '斜線制限と天空率緩和を並置比較し、敷地から建てられる最大ボリュームを一瞬で提示する建築ボリューム AI ツール。住所入力・CAD/DXF取込・測量図 OCR の 3 経路で使えます。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'VOLANS',
  keywords: [
    'VOLANS',
    '建築ボリューム',
    '天空率',
    '斜線制限',
    '56条7項',
    '容積率',
    '建ぺい率',
    '建築士',
    'AI',
    'ボリュームチェック',
  ],
  authors: [{ name: 'Archi Prisma Design works' }],
  openGraph: {
    type: 'website',
    siteName: 'VOLANS',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'ja_JP',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

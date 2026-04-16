import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VolumeCheck | 建築ボリューム計算ツール',
  description:
    '住所を入れるだけで、用途地域・斜線制限・最大ボリュームを一画面に。建築用地の初動スクリーニングを秒速で完結するツール。',
  openGraph: {
    title: 'VolumeCheck | 建築ボリューム計算ツール',
    description: '住所を入れるだけで、用途地域・斜線制限・最大ボリュームを一画面に。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VolumeCheck | 建築ボリューム計算ツール',
    description: '住所を入れるだけで、用途地域・斜線制限・最大ボリュームを一画面に。',
  },
};

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

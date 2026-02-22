import { NextRequest, NextResponse } from 'next/server';
import { fetchZoningData } from '@/server/mcp/mlit-data';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }
    const result = await fetchZoningData(address);
    if (!result) {
      return NextResponse.json({ error: 'ゾーニングデータを取得できませんでした。手動入力をお試しください。' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Zoning API error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

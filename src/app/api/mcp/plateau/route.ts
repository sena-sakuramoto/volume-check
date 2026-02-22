import { NextRequest, NextResponse } from 'next/server';
import { fetchSurroundingBuildings } from '@/server/mcp/plateau';

export async function POST(req: NextRequest) {
  try {
    const { latitude, longitude, radius } = await req.json();
    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });
    }
    const buildings = await fetchSurroundingBuildings(latitude, longitude, radius || 100);
    return NextResponse.json({ buildings });
  } catch (error) {
    console.error('PLATEAU API error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

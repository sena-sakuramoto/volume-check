import { NextRequest, NextResponse } from 'next/server';

// POST { lat, lng, siteCoordinates } → { roads: [], message: string }
// PLATEAU tran integration is planned for a future phase
export async function POST(_req: NextRequest) {
  return NextResponse.json({
    roads: [],
    message: 'Road detection is not yet implemented. PLATEAU tran integration is planned for a future phase.',
  });
}

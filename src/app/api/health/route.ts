import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BOOT_TIME = new Date().toISOString();

/**
 * Liveness probe — intentionally does zero work so a degraded downstream
 * (Gemini, PLATEAU, Firebase) doesn't flap Cloud Run.
 *
 * A deeper readiness probe that touches downstreams would live at /api/ready.
 */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'volans-web',
    bootedAt: BOOT_TIME,
    uptimeSec: Math.floor(process.uptime()),
  });
}

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Gone. Processing is now handled server-side via /api/scans/[id]/run' },
    { status: 410 }
  );
}

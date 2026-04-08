import { NextResponse } from 'next/server';
import { getTokensFromCookies } from '@/lib/bling';

export async function GET(request) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);
  return NextResponse.json({ authenticated: !!tokens });
}

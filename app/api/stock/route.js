import { NextResponse } from 'next/server';
import { blingFetch, getTokensFromCookies, createTokenCookie } from '@/lib/bling';

export async function GET(request) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);

  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('pagina') || 1;
  const limit = searchParams.get('limite') || 100;

  try {
    const params = new URLSearchParams({ pagina: page, limite: limit });
    const { data, newTokens } = await blingFetch(`/estoques/saldos?${params}`, tokens);
    const response = NextResponse.json(data);
    if (newTokens) response.headers.set('Set-Cookie', createTokenCookie(newTokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

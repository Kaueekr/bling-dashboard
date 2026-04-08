import { NextResponse } from 'next/server';
import { blingFetch, getTokensFromCookies, createTokenCookie } from '@/lib/bling';

export async function GET(request) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);

  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = searchParams.get('pagina') || 1;

  try {
    const params = new URLSearchParams({
      pagina: page,
      limite: 20,
      'tipos[]': 'F',
    });
    if (search) params.set('pesquisa', search);

    const { data, newTokens } = await blingFetch(`/contatos?${params}`, tokens);
    const response = NextResponse.json(data);
    if (newTokens) response.headers.set('Set-Cookie', createTokenCookie(newTokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

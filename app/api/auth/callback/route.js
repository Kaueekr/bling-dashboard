import { NextResponse } from 'next/server';
import { exchangeCode, createTokenCookie } from '@/lib/bling';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code);
    const response = NextResponse.redirect(new URL('/', request.url));
    response.headers.set('Set-Cookie', createTokenCookie(tokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

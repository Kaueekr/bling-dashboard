import { NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/bling';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    await exchangeCode(code);
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

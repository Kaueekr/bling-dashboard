import { NextResponse } from 'next/server';
import { blingFetch } from '@/lib/bling';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('pagina') || 1;
  const limit = searchParams.get('limite') || 100;
  const name = searchParams.get('nome') || '';
  const type = searchParams.get('tipo') || '';

  try {
    const params = new URLSearchParams({ pagina: page, limite: limit });
    if (name) params.set('nome', name);
    if (type) params.set('tipo', type);

    const data = await blingFetch(`/produtos?${params}`);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

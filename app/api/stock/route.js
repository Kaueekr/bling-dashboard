import { NextResponse } from 'next/server';
import { blingFetch } from '@/lib/bling';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('pagina') || 1;
  const limit = searchParams.get('limite') || 100;
  const productIds = searchParams.get('idsProdutos') || '';

  try {
    const params = new URLSearchParams({ pagina: page, limite: limit });
    if (productIds) params.set('idsProdutos[]', productIds);

    const data = await blingFetch(`/estoques/saldos?${params}`);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

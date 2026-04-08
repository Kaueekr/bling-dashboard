import { NextResponse } from 'next/server';
import { blingFetch } from '@/lib/bling';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('pagina') || 1;
  const limit = searchParams.get('limite') || 100;
  const startDate = searchParams.get('dataInicial') || '';
  const endDate = searchParams.get('dataFinal') || '';
  const situationId = searchParams.get('idSituacao') || '';

  try {
    const params = new URLSearchParams({ pagina: page, limite: limit });
    if (startDate) params.set('dataInicial', startDate);
    if (endDate) params.set('dataFinal', endDate);
    if (situationId) params.set('idSituacao', situationId);

    const data = await blingFetch(`/pedidos/compras?${params}`);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { blingFetch } from '@/lib/bling';

export async function GET(request, { params }) {
  try {
    const data = await blingFetch(`/pedidos/compras/${params.id}`);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

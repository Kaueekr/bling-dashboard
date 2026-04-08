import { NextResponse } from 'next/server';
import { blingFetch, getTokensFromCookies, createTokenCookie } from '@/lib/bling';

export const maxDuration = 300;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function GET(request) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);
  if (!tokens) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('dias') || '90');
  const page = parseInt(searchParams.get('page') || '1');
  const notasPerPage = 100;

  let latestTokens = null;
  const ct = () => latestTokens || tokens;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const fmt = (d) => d.toISOString().split('T')[0];

    // ── Get one page of NF-e (notas fiscais) de saída ──
    const qp = new URLSearchParams({
      pagina: page,
      limite: notasPerPage,
      dataEmissaoInicial: fmt(startDate),
      dataEmissaoFinal: fmt(endDate),
      tipo: '1', // 1 = saída
    });

    const { data: d, newTokens: t } = await blingFetch(`/nfe?${qp}`, ct());
    if (t) latestTokens = t;
    const notas = d?.data || d || [];

    // ── Get items from each NF-e ──
    const productSales = {};
    const batchSize = 3;

    for (let i = 0; i < notas.length; i += batchSize) {
      const batch = notas.slice(i, i + batchSize);

      const promises = batch.map(async (nota) => {
        try {
          const { data: detail, newTokens: t2 } = await blingFetch(
            `/nfe/${nota.id}`, ct()
          );
          if (t2) latestTokens = t2;
          const nfeData = detail?.data || detail || {};
          const items = nfeData.itens || [];

          items.forEach(item => {
            const pid = item.produto?.id;
            if (!pid) return;
            if (!productSales[pid]) productSales[pid] = { qty: 0, revenue: 0 };
            const qty = parseFloat(item.quantidade) || 0;
            const price = parseFloat(item.valor) || parseFloat(item.preco) || 0;
            productSales[pid].qty += qty;
            productSales[pid].revenue += qty * price;
          });
        } catch (e) {}
      });

      await Promise.all(promises);
      if (i + batchSize < notas.length) await sleep(350);
    }

    const hasMore = notas.length >= notasPerPage;

    const response = NextResponse.json({
      data: productSales,
      page,
      notasInPage: notas.length,
      hasMore,
    });
    if (latestTokens) response.headers.set('Set-Cookie', createTokenCookie(latestTokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

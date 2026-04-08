import { NextResponse } from 'next/server';
import { blingFetch, getTokensFromCookies, createTokenCookie } from '@/lib/bling';

// Extend Vercel timeout to max for free plan
export const maxDuration = 300;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function GET(request) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);
  if (!tokens) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('dias') || '90');

  let latestTokens = null;
  const ct = () => latestTokens || tokens;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const fmt = (d) => d.toISOString().split('T')[0];

    // ── Get ALL sales orders in period ──
    let allOrders = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 50) {
      const qp = new URLSearchParams({
        pagina: page, limite: 100,
        dataInicial: fmt(startDate), dataFinal: fmt(endDate),
      });

      try {
        const { data: d, newTokens: t } = await blingFetch(`/pedidos/vendas?${qp}`, ct());
        if (t) latestTokens = t;
        const orders = d?.data || d || [];
        if (orders.length > 0) {
          allOrders = [...allOrders, ...orders];
          page++;
          if (orders.length < 100) hasMore = false;
        } else hasMore = false;
      } catch (e) { hasMore = false; }

      if (hasMore) await sleep(200);
    }

    // ── Get item details from each order ──
    const productSales = {};
    const batchSize = 3; // Smaller batches to avoid rate limit

    for (let i = 0; i < allOrders.length; i += batchSize) {
      const batch = allOrders.slice(i, i + batchSize);

      const promises = batch.map(async (order) => {
        try {
          const { data: detail, newTokens: t2 } = await blingFetch(
            `/pedidos/vendas/${order.id}`, ct()
          );
          if (t2) latestTokens = t2;
          const items = detail?.data?.itens || detail?.itens || [];

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
      if (i + batchSize < allOrders.length) await sleep(350);
    }

    const response = NextResponse.json({
      data: productSales,
      totalOrders: allOrders.length,
      ordersProcessed: allOrders.length,
      period: { start: fmt(startDate), end: fmt(endDate), days },
    });
    if (latestTokens) response.headers.set('Set-Cookie', createTokenCookie(latestTokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

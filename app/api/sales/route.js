import { NextResponse } from 'next/server';
import { blingFetch, getTokensFromCookies, createTokenCookie } from '@/lib/bling';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);

  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('dias') || '90');

  let latestTokens = null;
  const ct = () => latestTokens || tokens;

  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const fmt = (d) => d.toISOString().split('T')[0];

    // ── Fetch ALL sales orders in the period (paginated) ──
    let allOrders = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) { // Max 2000 orders
      const qp = new URLSearchParams({
        pagina: page,
        limite: 100,
        dataInicial: fmt(startDate),
        dataFinal: fmt(endDate),
      });

      try {
        const { data: d, newTokens: t } = await blingFetch(
          `/pedidos/vendas?${qp}`, ct()
        );
        if (t) latestTokens = t;

        const orders = d?.data || d || [];
        if (orders.length > 0) {
          allOrders = [...allOrders, ...orders];
          page++;
          if (orders.length < 100) hasMore = false;
        } else {
          hasMore = false;
        }
      } catch (e) {
        hasMore = false;
      }

      if (hasMore) await sleep(300);
    }

    // ── Fetch order details to get items ──
    const productSales = {}; // productId -> { qty, revenue }
    const batchSize = 5;

    for (let i = 0; i < allOrders.length; i += batchSize) {
      const batch = allOrders.slice(i, i + batchSize);

      const promises = batch.map(async (order) => {
        try {
          const { data: detail, newTokens: t2 } = await blingFetch(
            `/pedidos/vendas/${order.id}`, ct()
          );
          if (t2) latestTokens = t2;

          const orderData = detail?.data || detail || {};
          const items = orderData.itens || [];

          items.forEach(item => {
            const pid = item.produto?.id;
            if (!pid) return;

            if (!productSales[pid]) {
              productSales[pid] = { qty: 0, revenue: 0 };
            }

            const qty = parseFloat(item.quantidade) || 0;
            const unitPrice = parseFloat(item.valor) || parseFloat(item.preco) || 0;

            productSales[pid].qty += qty;
            productSales[pid].revenue += qty * unitPrice;
          });
        } catch (e) {
          // Skip failed orders
        }
      });

      await Promise.all(promises);

      if (i + batchSize < allOrders.length) {
        await sleep(400);
      }
    }

    const response = NextResponse.json({
      data: productSales,
      totalOrders: allOrders.length,
      period: { start: fmt(startDate), end: fmt(endDate), days },
    });

    if (latestTokens) response.headers.set('Set-Cookie', createTokenCookie(latestTokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

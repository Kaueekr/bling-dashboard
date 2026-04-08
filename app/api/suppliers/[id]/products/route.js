import { NextResponse } from 'next/server';
import { blingFetch, getTokensFromCookies, createTokenCookie } from '@/lib/bling';

export async function GET(request, { params }) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);

  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supplierId = params.id;
  let latestTokens = null;

  try {
    // 1. Fetch purchase orders for this supplier (last 200)
    const purchaseParams = new URLSearchParams({
      pagina: 1,
      limite: 100,
      idContato: supplierId,
    });

    const { data: purchasesData, newTokens: t1 } = await blingFetch(
      `/pedidos/compras?${purchaseParams}`, tokens
    );
    if (t1) latestTokens = t1;
    const currentTokens = latestTokens || tokens;

    const purchases = purchasesData?.data || purchasesData || [];

    // 2. For each purchase, get the full details (items)
    const productMap = {};
    const detailPromises = purchases.slice(0, 30).map(async (purchase) => {
      try {
        const { data: detail, newTokens: t2 } = await blingFetch(
          `/pedidos/compras/${purchase.id}`, currentTokens
        );
        if (t2) latestTokens = t2;

        const orderData = detail?.data || detail || {};
        const items = orderData.itens || [];
        const orderDate = orderData.data || purchase.data;

        items.forEach(item => {
          const productId = item.produto?.id;
          if (!productId) return;

          const existing = productMap[productId];
          const itemDate = orderDate ? new Date(orderDate) : new Date(0);

          if (!existing || itemDate > new Date(existing.ultimaCompraData)) {
            productMap[productId] = {
              id: productId,
              codigo: item.produto?.codigo || item.codigo || '—',
              nome: item.descricao || item.produto?.nome || 'Sem nome',
              precoCusto: item.valor || 0,
              quantidade: item.quantidade || 0,
              ultimaCompraData: orderDate || null,
              ultimaCompraQtd: item.quantidade || 0,
              unidade: item.unidade || 'UN',
            };
          }
        });
      } catch (e) {
        // Skip failed order details
      }
    });

    await Promise.all(detailPromises);

    // 3. Fetch product details (selling price) and stock for found products
    const productIds = Object.keys(productMap);
    const enrichPromises = productIds.slice(0, 50).map(async (pid) => {
      try {
        // Get product details (selling price)
        const { data: prodDetail } = await blingFetch(
          `/produtos/${pid}`, latestTokens || tokens
        );
        const prodData = prodDetail?.data || prodDetail || {};
        productMap[pid].precoVenda = prodData.preco || 0;
        productMap[pid].nome = prodData.nome || productMap[pid].nome;
        productMap[pid].codigo = prodData.codigo || productMap[pid].codigo;
        productMap[pid].categoria = prodData.categoria?.descricao || '—';
      } catch (e) {
        productMap[pid].precoVenda = 0;
      }

      try {
        // Get stock
        const { data: stockDetail } = await blingFetch(
          `/estoques/saldos?idsProdutos[]=${pid}`, latestTokens || tokens
        );
        const stockData = stockDetail?.data || stockDetail || [];
        const totalStock = stockData.reduce((sum, s) => {
          return sum + (s.saldoFisicoTotal || s.saldoFisico || 0);
        }, 0);
        productMap[pid].estoque = totalStock;
      } catch (e) {
        productMap[pid].estoque = 0;
      }
    });

    await Promise.all(enrichPromises);

    // 4. Calculate margin and return
    const products = Object.values(productMap).map(p => ({
      ...p,
      margem: p.precoVenda && p.precoCusto
        ? (((p.precoVenda - p.precoCusto) / p.precoVenda) * 100).toFixed(1)
        : null,
    }));

    products.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const response = NextResponse.json({
      data: products,
      total: products.length,
      pedidos: purchases.length,
    });

    if (latestTokens) response.headers.set('Set-Cookie', createTokenCookie(latestTokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

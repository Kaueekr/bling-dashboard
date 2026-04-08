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
    // 1. Fetch purchase orders for this supplier
    const purchaseParams = new URLSearchParams({
      pagina: 1,
      limite: 100,
      idContato: supplierId,
    });

    const { data: purchasesData, newTokens: t1 } = await blingFetch(
      `/pedidos/compras?${purchaseParams}`, tokens
    );
    if (t1) latestTokens = t1;
    const currentTokens = () => latestTokens || tokens;

    const purchases = purchasesData?.data || purchasesData || [];

    // 2. Get details for each purchase to extract items
    const productMap = {};
    const detailPromises = purchases.slice(0, 30).map(async (purchase) => {
      try {
        const { data: detail, newTokens: t2 } = await blingFetch(
          `/pedidos/compras/${purchase.id}`, currentTokens()
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
              precoCusto: item.valor || item.preco || 0,
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

    // 3. Enrich with product details and stock (batched to avoid rate limits)
    const productIds = Object.keys(productMap);
    const batchSize = 10;

    for (let i = 0; i < productIds.length && i < 50; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const enrichPromises = batch.map(async (pid) => {
        // Get product details
        try {
          const { data: prodDetail, newTokens: t3 } = await blingFetch(
            `/produtos/${pid}`, currentTokens()
          );
          if (t3) latestTokens = t3;
          const prodData = prodDetail?.data || prodDetail || {};

          // Try multiple possible price fields
          productMap[pid].precoVenda =
            prodData.preco ||
            prodData.precoVenda ||
            prodData.valorVenda ||
            0;

          // Also get precoCusto from product if we don't have it from purchase
          if (!productMap[pid].precoCusto && prodData.precoCusto) {
            productMap[pid].precoCusto = prodData.precoCusto;
          }

          productMap[pid].nome = prodData.nome || productMap[pid].nome;
          productMap[pid].codigo = prodData.codigo || productMap[pid].codigo;

          // Category - try multiple paths
          productMap[pid].categoria =
            prodData.categoria?.descricao ||
            prodData.categoriaProduto?.descricao ||
            prodData.grupo?.nome ||
            prodData.grupoProduto ||
            '';

          // Extra useful fields
          productMap[pid].situacao = prodData.situacao || '';
          productMap[pid].estoqueMinimo = prodData.estoqueMinimo || 0;
          productMap[pid].estoqueMaximo = prodData.estoqueMaximo || 0;
        } catch (e) {
          productMap[pid].precoVenda = 0;
          productMap[pid].categoria = '';
        }

        // Get stock
        try {
          const { data: stockDetail, newTokens: t4 } = await blingFetch(
            `/estoques/saldos?idsProdutos[]=${pid}`, currentTokens()
          );
          if (t4) latestTokens = t4;
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
    }

    // 4. Calculate margin and return
    const products = Object.values(productMap).map(p => ({
      ...p,
      margem: p.precoVenda && p.precoCusto && p.precoVenda > 0
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

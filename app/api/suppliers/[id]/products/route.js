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
  const currentTokens = () => latestTokens || tokens;

  try {
    // ── Step 1: Get all product-supplier links (paginated) ──
    let allLinks = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const linkParams = new URLSearchParams({
        pagina: page,
        limite: 100,
        idContato: supplierId,
      });

      try {
        const { data: linksData, newTokens: t } = await blingFetch(
          `/produtos/fornecedores?${linkParams}`, currentTokens()
        );
        if (t) latestTokens = t;

        const links = linksData?.data || linksData || [];
        if (links.length > 0) {
          allLinks = [...allLinks, ...links];
          page++;
          if (links.length < 100) hasMore = false;
        } else {
          hasMore = false;
        }
      } catch (e) {
        // If /produtos/fornecedores doesn't work, try alternate approach
        hasMore = false;
      }
    }

    // ── Step 2: If the supplier-products endpoint didn't work, ──
    //    try getting ALL products and filter by checking each one
    if (allLinks.length === 0) {
      // Fallback: get products from purchase orders
      const purchaseParams = new URLSearchParams({
        pagina: 1, limite: 100, idContato: supplierId,
      });
      const { data: purchData, newTokens: tp } = await blingFetch(
        `/pedidos/compras?${purchaseParams}`, currentTokens()
      );
      if (tp) latestTokens = tp;
      const purchases = purchData?.data || purchData || [];

      // Get product IDs from purchase order details
      const productIds = new Set();
      const detailPromises = purchases.slice(0, 50).map(async (p) => {
        try {
          const { data: detail } = await blingFetch(
            `/pedidos/compras/${p.id}`, currentTokens()
          );
          const items = detail?.data?.itens || detail?.itens || [];
          items.forEach(item => {
            if (item.produto?.id) productIds.add(item.produto.id);
          });
        } catch (e) {}
      });
      await Promise.all(detailPromises);

      // Create fake links for these products
      productIds.forEach(id => {
        allLinks.push({ produto: { id } });
      });
    }

    // ── Step 3: Fetch full product details + stock for each product ──
    const products = [];
    const batchSize = 10;
    const productIds = allLinks.map(l =>
      l.produto?.id || l.idProduto || l.id
    ).filter(Boolean);

    // Deduplicate
    const uniqueIds = [...new Set(productIds)];

    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const batch = uniqueIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (pid) => {
        const product = { id: pid };

        // Fetch product details
        try {
          const { data: prodDetail, newTokens: t3 } = await blingFetch(
            `/produtos/${pid}`, currentTokens()
          );
          if (t3) latestTokens = t3;
          const p = prodDetail?.data || prodDetail || {};

          product.codigo = p.codigo || '—';
          product.nome = p.nome || 'Sem nome';
          product.preco = p.preco || 0;           // Selling price
          product.precoCusto = p.precoCusto || 0;  // Cost price
          product.marca = p.marca || '';
          product.unidade = p.unidade || 'UN';
          product.situacao = p.situacao || '';
          product.categoria = p.categoria?.descricao || '';
          product.gtin = p.gtin || '';
          product.estoqueMinimo = p.estoqueMinimo || 0;
          product.estoqueMaximo = p.estoqueMaximo || 0;
        } catch (e) {
          product.nome = 'Erro ao carregar';
          product.codigo = '—';
          product.preco = 0;
          product.precoCusto = 0;
        }

        // Fetch stock
        try {
          const { data: stockDetail, newTokens: t4 } = await blingFetch(
            `/estoques/saldos?idsProdutos[]=${pid}`, currentTokens()
          );
          if (t4) latestTokens = t4;
          const stockData = stockDetail?.data || stockDetail || [];
          product.estoque = stockData.reduce((sum, s) =>
            sum + (s.saldoFisicoTotal || s.saldoFisico || 0), 0
          );
        } catch (e) {
          product.estoque = 0;
        }

        // Get supplier-specific data from the link (if available)
        const link = allLinks.find(l =>
          (l.produto?.id || l.idProduto) === pid
        );
        if (link) {
          product.codigoFornecedor = link.codigo || link.produtoCodigo || '';
          product.precoCompra = link.precoCompra || link.precoCusto || 0;
        }

        // Calculate margin
        if (product.preco && product.precoCusto && product.preco > 0) {
          product.margem = (((product.preco - product.precoCusto) / product.preco) * 100).toFixed(1);
        } else {
          product.margem = null;
        }

        return product;
      });

      const batchResults = await Promise.all(batchPromises);
      products.push(...batchResults);
    }

    // Sort by name
    products.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const response = NextResponse.json({
      data: products,
      total: products.length,
    });

    if (latestTokens) response.headers.set('Set-Cookie', createTokenCookie(latestTokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { blingFetch, getTokensFromCookies, createTokenCookie } from '@/lib/bling';

// Helper: wait ms
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request, { params }) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);

  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supplierId = params.id;
  let latestTokens = null;
  const ct = () => latestTokens || tokens;

  try {
    // ── Step 1: Get ALL product-supplier links (paginated) ──
    let allLinks = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const qp = new URLSearchParams({
        pagina: page,
        limite: 100,
        idContato: supplierId,
      });

      const { data: d, newTokens: t } = await blingFetch(
        `/produtos/fornecedores?${qp}`, ct()
      );
      if (t) latestTokens = t;

      const links = d?.data || d || [];
      if (links.length > 0) {
        allLinks = [...allLinks, ...links];
        page++;
        if (links.length < 100) hasMore = false;
      } else {
        hasMore = false;
      }

      // Small delay between pages
      if (hasMore) await sleep(300);
    }

    // ── Step 2: Extract product IDs and supplier-level data ──
    const productMap = {};
    allLinks.forEach(link => {
      const pid = link.produto?.id;
      if (!pid) return;

      productMap[pid] = {
        id: pid,
        // Data from supplier link
        codigoFornecedor: link.codigo || link.produtoCodigo || '',
        descricaoFornecedor: link.descricao || link.produtoDescricao || '',
        precoCompra: link.precoCompra || 0,
        precoCustoFornecedor: link.precoCusto || 0,
        // Will be enriched from product detail
        codigo: '',
        nome: '',
        preco: 0,
        precoCusto: 0,
        marca: '',
        estoque: 0,
        categoria: '',
      };
    });

    const productIds = Object.keys(productMap);

    // ── Step 3: Fetch product details in small batches with delays ──
    const batchSize = 5;

    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);

      const promises = batch.map(async (pid) => {
        // Product detail
        try {
          const { data: pd, newTokens: t2 } = await blingFetch(
            `/produtos/${pid}`, ct()
          );
          if (t2) latestTokens = t2;
          const p = pd?.data || pd || {};

          productMap[pid].codigo = p.codigo || productMap[pid].codigoFornecedor || '—';
          productMap[pid].nome = p.nome || productMap[pid].descricaoFornecedor || 'Sem nome';
          productMap[pid].preco = p.preco || 0;
          productMap[pid].precoCusto = p.precoCusto || 0;
          productMap[pid].marca = p.marca || '';
          productMap[pid].unidade = p.unidade || 'UN';
          productMap[pid].categoria = p.categoria?.descricao || '';
        } catch (e) {
          // Use supplier link data as fallback
          productMap[pid].nome = productMap[pid].descricaoFornecedor || 'Sem nome';
          productMap[pid].codigo = productMap[pid].codigoFornecedor || '—';
        }

        // Stock
        try {
          const { data: sd, newTokens: t3 } = await blingFetch(
            `/estoques/saldos?idsProdutos[]=${pid}`, ct()
          );
          if (t3) latestTokens = t3;
          const stocks = sd?.data || sd || [];
          productMap[pid].estoque = stocks.reduce((sum, s) =>
            sum + (s.saldoFisicoTotal || s.saldoFisico || 0), 0
          );
        } catch (e) {
          productMap[pid].estoque = 0;
        }
      });

      await Promise.all(promises);

      // Delay between batches to respect rate limit
      if (i + batchSize < productIds.length) {
        await sleep(500);
      }
    }

    // ── Step 4: Build final product list ──
    const products = Object.values(productMap).map(p => {
      // Use the best cost price: product's own precoCusto, or supplier's precoCompra
      const custo = p.precoCusto || p.precoCompra || p.precoCustoFornecedor || 0;
      const venda = p.preco || 0;

      return {
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        precoCusto: custo,
        preco: venda,
        marca: p.marca,
        estoque: p.estoque,
        categoria: p.categoria,
        unidade: p.unidade,
        margem: venda > 0 && custo > 0
          ? (((venda - custo) / venda) * 100).toFixed(1)
          : null,
      };
    });

    // Sort: named products first, then by name
    products.sort((a, b) => {
      if (a.nome === 'Sem nome' && b.nome !== 'Sem nome') return 1;
      if (a.nome !== 'Sem nome' && b.nome === 'Sem nome') return -1;
      return (a.nome || '').localeCompare(b.nome || '');
    });

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

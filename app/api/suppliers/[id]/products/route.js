import { NextResponse } from 'next/server';
import { blingFetch, getTokensFromCookies, createTokenCookie } from '@/lib/bling';

// Extend Vercel timeout to max for free plan
export const maxDuration = 300;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function GET(request, { params }) {
  const cookies = request.headers.get('cookie');
  const tokens = getTokensFromCookies(cookies);
  if (!tokens) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const supplierId = params.id;
  let latestTokens = null;
  const ct = () => latestTokens || tokens;

  try {
    // ── Step 1: Get all product-supplier links ──
    let allLinks = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const qp = new URLSearchParams({
        pagina: page, limite: 100, idContato: supplierId,
      });
      const { data: d, newTokens: t } = await blingFetch(`/produtos/fornecedores?${qp}`, ct());
      if (t) latestTokens = t;
      const links = d?.data || d || [];
      if (links.length > 0) {
        allLinks = [...allLinks, ...links];
        page++;
        if (links.length < 100) hasMore = false;
      } else hasMore = false;
      if (hasMore) await sleep(250);
    }

    // ── Step 2: Get product details in batches ──
    const productMap = {};
    allLinks.forEach(link => {
      const pid = link.produto?.id;
      if (!pid) return;
      productMap[pid] = {
        id: pid,
        codigoFornecedor: link.codigo || '',
        descricaoFornecedor: link.descricao || '',
        precoCompra: link.precoCompra || 0,
        precoCustoLink: link.precoCusto || 0,
        codigo: '', nome: '', preco: 0, precoCusto: 0,
        marca: '', estoque: 0, categoria: '',
      };
    });

    const productIds = Object.keys(productMap);
    const batchSize = 3;

    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const promises = batch.map(async (pid) => {
        try {
          const { data: pd, newTokens: t2 } = await blingFetch(`/produtos/${pid}`, ct());
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
          productMap[pid].nome = productMap[pid].descricaoFornecedor || 'Sem nome';
          productMap[pid].codigo = productMap[pid].codigoFornecedor || '—';
        }
      });
      await Promise.all(promises);
      if (i + batchSize < productIds.length) await sleep(350);
    }

    // ── Step 3: Get stock for ALL products (in batches of IDs) ──
    const stockBatchSize = 50;
    for (let i = 0; i < productIds.length; i += stockBatchSize) {
      const batch = productIds.slice(i, i + stockBatchSize);
      // Build query with multiple product IDs
      const qp = new URLSearchParams();
      batch.forEach(pid => qp.append('idsProdutos[]', pid));
      qp.set('pagina', '1');
      qp.set('limite', '100');

      try {
        const { data: sd, newTokens: t3 } = await blingFetch(`/estoques/saldos?${qp}`, ct());
        if (t3) latestTokens = t3;
        const stocks = sd?.data || sd || [];
        stocks.forEach(s => {
          const pid = String(s.produto?.id);
          if (productMap[pid]) {
            productMap[pid].estoque += (s.saldoFisicoTotal || s.saldoFisico || 0);
          }
        });
      } catch (e) {
        // Fallback: fetch individually
        for (const pid of batch) {
          try {
            const { data: sd2 } = await blingFetch(
              `/estoques/saldos?idsProdutos[]=${pid}&limite=10`, ct()
            );
            const stocks2 = sd2?.data || sd2 || [];
            productMap[pid].estoque = stocks2.reduce((sum, s) =>
              sum + (s.saldoFisicoTotal || s.saldoFisico || 0), 0
            );
          } catch (e2) {}
        }
      }
      if (i + stockBatchSize < productIds.length) await sleep(300);
    }

    // ── Step 4: Build response ──
    const products = Object.values(productMap).map(p => {
      const custo = p.precoCusto || p.precoCompra || p.precoCustoLink || 0;
      return {
        id: p.id, codigo: p.codigo, nome: p.nome,
        precoCusto: custo, preco: p.preco, marca: p.marca,
        estoque: p.estoque, categoria: p.categoria, unidade: p.unidade,
      };
    });

    products.sort((a, b) => {
      if (a.nome === 'Sem nome' && b.nome !== 'Sem nome') return 1;
      if (a.nome !== 'Sem nome' && b.nome === 'Sem nome') return -1;
      return (a.nome || '').localeCompare(b.nome || '');
    });

    const response = NextResponse.json({ data: products, total: products.length });
    if (latestTokens) response.headers.set('Set-Cookie', createTokenCookie(latestTokens));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

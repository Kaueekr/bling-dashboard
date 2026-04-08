'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Package, AlertTriangle, Search, RefreshCw, ExternalLink,
  ChevronDown, Users, Loader2, ArrowUpRight, ArrowDownRight, TrendingUp,
} from 'lucide-react';

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function AuthScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 p-4">
      <div className="bg-surface-1 border border-surface-3 rounded-3xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-accent-lime/10 border border-accent-lime/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Users size={28} className="text-accent-lime" />
        </div>
        <h1 className="font-display text-xl mb-3">Painel de Fornecedores</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          Conecte sua conta do Bling para consultar produtos, vendas e estoque.
        </p>
        <a href="/api/auth/login"
          className="inline-flex items-center gap-2 bg-accent-lime text-surface-0 font-bold text-sm px-6 py-3 rounded-xl hover:bg-accent-lime/90 transition-colors">
          Conectar com Bling <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [salesMap, setSalesMap] = useState({});
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [salesStatus, setSalesStatus] = useState('idle'); // idle | loading | done | error
  const [salesProgress, setSalesProgress] = useState({ page: 0, orders: 0 });
  const [productFilter, setProductFilter] = useState('');
  const [sortField, setSortField] = useState('qtdVendida');
  const [sortDir, setSortDir] = useState('desc');
  const abortRef = useRef(false);

  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json())
      .then(d => setAuthenticated(d.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const searchSuppliers = async () => {
    if (!supplierSearch.trim()) return;
    setLoadingSuppliers(true);
    setSelectedSupplier(null);
    setProducts([]);
    setSalesMap({});
    setSalesStatus('idle');
    try {
      const res = await fetch(`/api/suppliers?search=${encodeURIComponent(supplierSearch)}`);
      const data = await res.json();
      setSuppliers(data.data || data || []);
    } catch (e) { console.error(e); }
    setLoadingSuppliers(false);
  };

  // Progressive sales loading
  const loadSalesProgressively = async () => {
    abortRef.current = false;
    setSalesMap({});
    setSalesStatus('loading');
    setSalesProgress({ page: 0, orders: 0 });

    let page = 1;
    let hasMore = true;
    let totalOrders = 0;
    const accumulated = {};

    while (hasMore && !abortRef.current) {
      try {
        const res = await fetch(`/api/sales?dias=90&page=${page}`);
        if (!res.ok) { setSalesStatus('error'); return; }
        const data = await res.json();

        // Merge results
        const pageData = data.data || {};
        Object.entries(pageData).forEach(([pid, sales]) => {
          if (!accumulated[pid]) accumulated[pid] = { qty: 0, revenue: 0 };
          accumulated[pid].qty += sales.qty;
          accumulated[pid].revenue += sales.revenue;
        });

        totalOrders += data.ordersInPage || 0;
        hasMore = data.hasMore;
        page++;

        // Update state so UI refreshes progressively
        setSalesMap({ ...accumulated });
        setSalesProgress({ page: page - 1, orders: totalOrders });
      } catch (e) {
        console.error('Sales page failed:', e);
        setSalesStatus('error');
        return;
      }
    }

    setSalesStatus('done');
  };

  const loadSupplierData = async (supplier) => {
    // Abort any ongoing sales loading
    abortRef.current = true;

    setSelectedSupplier(supplier);
    setProducts([]);
    setSalesMap({});
    setSalesStatus('idle');
    setProductFilter('');

    // Load products
    setLoadingProducts(true);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/products`);
      const data = await res.json();
      setProducts(data.data || []);
    } catch (e) { console.error(e); }
    setLoadingProducts(false);

    // Start progressive sales loading
    loadSalesProgressively();
  };

  // Merge products + sales
  const merged = products.map(p => {
    const sales = salesMap[p.id];
    const qtdVendida = sales?.qty || 0;
    const faturamento = sales?.revenue || 0;
    const custoUnit = p.precoCusto || 0;
    const custoTotal = custoUnit * qtdVendida;
    const markup = custoTotal > 0 ? (((faturamento - custoTotal) / custoTotal) * 100).toFixed(1) : null;
    return { ...p, qtdVendida, faturamento, custoTotal, markup };
  });

  // Sort
  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sorted = merged
    .filter(p =>
      !productFilter ||
      (p.nome || '').toLowerCase().includes(productFilter.toLowerCase()) ||
      (p.codigo || '').toLowerCase().includes(productFilter.toLowerCase())
    )
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      else { va = Number(va) || 0; vb = Number(vb) || 0; }
      return sortDir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
    });

  const totalFat = merged.reduce((s, p) => s + p.faturamento, 0);
  const totalQtd = merged.reduce((s, p) => s + p.qtdVendida, 0);
  const comVenda = merged.filter(p => p.qtdVendida > 0).length;
  const semVenda = merged.filter(p => p.qtdVendida === 0).length;
  const isSalesLoading = salesStatus === 'loading';

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ArrowUpRight size={10} className="inline ml-0.5" />
      : <ArrowDownRight size={10} className="inline ml-0.5" />;
  };

  if (authenticated === null) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <RefreshCw className="animate-spin text-accent-lime" size={24} />
    </div>
  );
  if (!authenticated) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="border-b border-surface-3 bg-surface-1/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-lime rounded-lg flex items-center justify-center">
              <Package size={16} className="text-surface-0" />
            </div>
            <div>
              <h1 className="font-display text-sm tracking-wider">PAINEL DE COMPRAS</h1>
              <p className="text-[10px] text-gray-500 font-mono">BLING ERP • ANÁLISE DE FORNECEDORES</p>
            </div>
            <span className="w-2 h-2 bg-emerald-400 rounded-full pulse-dot ml-1" />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Search */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Users size={18} className="text-accent-lime" />
            <h2 className="font-display text-sm uppercase tracking-widest">Buscar Fornecedor</h2>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="Digite o nome do fornecedor..."
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchSuppliers()}
                className="w-full bg-surface-2 border border-surface-4 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-accent-lime/40 placeholder:text-gray-600" />
            </div>
            <button onClick={searchSuppliers} disabled={loadingSuppliers}
              className="bg-accent-lime text-surface-0 font-bold text-sm px-6 py-3 rounded-xl hover:bg-accent-lime/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {loadingSuppliers ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Buscar
            </button>
          </div>

          {suppliers.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-3">
                {suppliers.length} fornecedor{suppliers.length !== 1 ? 'es' : ''}
              </p>
              {suppliers.map(s => (
                <button key={s.id} onClick={() => loadSupplierData(s)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedSupplier?.id === s.id
                      ? 'bg-accent-lime/10 border-accent-lime/30'
                      : 'bg-surface-2/50 border-surface-4 hover:bg-surface-2'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.nome || s.fantasia || 'Sem nome'}</p>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {s.numeroDocumento || s.cnpj || ''}
                      </p>
                    </div>
                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${selectedSupplier?.id === s.id ? 'rotate-180' : ''}`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Products Table */}
        {selectedSupplier && (
          <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-3">
                  <TrendingUp size={18} className="text-accent-lime" />
                  <h2 className="font-display text-sm uppercase tracking-widest">
                    {selectedSupplier.nome || selectedSupplier.fantasia}
                  </h2>
                </div>
                <div className="flex items-center gap-4 mt-1 ml-8">
                  {!loadingProducts && <span className="text-xs text-gray-500 font-mono">{products.length} produtos</span>}
                  {isSalesLoading && (
                    <span className="text-xs text-amber-400 font-mono flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" />
                      Carregando vendas... página {salesProgress.page} ({salesProgress.orders} pedidos)
                    </span>
                  )}
                  {salesStatus === 'done' && (
                    <span className="text-xs text-emerald-400 font-mono">
                      ✓ {salesProgress.orders} pedidos processados
                    </span>
                  )}
                  {salesStatus === 'error' && (
                    <span className="text-xs text-rose-400 font-mono">
                      Erro ao carregar vendas (dados parciais: {salesProgress.orders} pedidos)
                    </span>
                  )}
                </div>
              </div>
              {products.length > 0 && (
                <div className="relative w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" placeholder="Filtrar por nome ou código..."
                    value={productFilter} onChange={e => setProductFilter(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-4 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-accent-lime/40 placeholder:text-gray-600" />
                </div>
              )}
            </div>

            {/* Summary */}
            {!loadingProducts && products.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-surface-2/50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Faturamento 90d</p>
                  <p className="text-lg font-display font-bold text-accent-lime mt-1">{fmt(totalFat)}</p>
                </div>
                <div className="bg-surface-2/50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Qtd Vendida 90d</p>
                  <p className="text-lg font-display font-bold text-accent-blue mt-1">{totalQtd}</p>
                </div>
                <div className="bg-surface-2/50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Com Venda</p>
                  <p className="text-lg font-display font-bold text-emerald-400 mt-1">{comVenda}</p>
                </div>
                <div className="bg-surface-2/50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Sem Venda 90d</p>
                  <p className={`text-lg font-display font-bold mt-1 ${semVenda > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{semVenda}</p>
                </div>
              </div>
            )}

            {loadingProducts ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="animate-spin text-accent-lime mx-auto mb-3" size={28} />
                  <p className="text-xs text-gray-400 font-mono">Carregando catálogo do fornecedor...</p>
                </div>
              </div>
            ) : products.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-16">Nenhum produto encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr className="bg-surface-2/50">
                      <th className="pl-4 cursor-pointer select-none" onClick={() => handleSort('codigo')}>
                        Código <SortIcon field="codigo" />
                      </th>
                      <th className="cursor-pointer select-none" onClick={() => handleSort('nome')}>
                        Produto <SortIcon field="nome" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('precoCusto')}>
                        Custo Unit. <SortIcon field="precoCusto" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('qtdVendida')}>
                        Vendas 90d <SortIcon field="qtdVendida" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('faturamento')}>
                        Faturamento <SortIcon field="faturamento" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('custoTotal')}>
                        Custo Total <SortIcon field="custoTotal" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('markup')}>
                        Markup <SortIcon field="markup" />
                      </th>
                      <th className="text-right pr-4 cursor-pointer select-none" onClick={() => handleSort('estoque')}>
                        Estoque <SortIcon field="estoque" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, i) => {
                      const mkp = parseFloat(p.markup);
                      const isLow = !isNaN(mkp) && mkp < 30;
                      const isHigh = !isNaN(mkp) && mkp >= 60;
                      const lowStock = p.estoque <= 5;
                      const noSales = p.qtdVendida === 0 && salesStatus === 'done';
                      return (
                        <tr key={p.id || i} className={noSales ? 'opacity-40' : ''}>
                          <td className="pl-4 font-mono text-xs text-accent-blue">{p.codigo}</td>
                          <td>
                            <p className="text-sm">{p.nome}</p>
                            {p.marca && <p className="text-[10px] text-gray-600 mt-0.5">{p.marca}</p>}
                          </td>
                          <td className="text-right font-mono text-sm">
                            {p.precoCusto > 0 ? fmt(p.precoCusto) : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className="text-right font-mono text-sm">
                            <span className={p.qtdVendida > 0 ? 'text-accent-blue font-bold' : 'text-gray-600'}>
                              {p.qtdVendida}
                            </span>
                          </td>
                          <td className="text-right font-mono text-sm">
                            {p.faturamento > 0
                              ? <span className="text-emerald-400">{fmt(p.faturamento)}</span>
                              : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className="text-right font-mono text-sm">
                            {p.custoTotal > 0 ? fmt(p.custoTotal) : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className="text-right">
                            {p.markup
                              ? <span className={`font-mono text-sm font-bold ${isLow ? 'text-rose-400' : isHigh ? 'text-emerald-400' : 'text-accent-amber'}`}>{p.markup}%</span>
                              : <span className="text-gray-600 text-xs">—</span>}
                          </td>
                          <td className={`text-right pr-4 font-mono text-sm font-bold ${lowStock ? 'text-rose-400' : 'text-gray-200'}`}>
                            {p.estoque}
                            {lowStock && <AlertTriangle size={11} className="inline ml-1 text-rose-400" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-surface-3 mt-16">
        <div className="max-w-[1400px] mx-auto px-6 py-6 flex items-center justify-between text-[10px] text-gray-600 font-mono">
          <span>PAINEL DE COMPRAS v3.0</span>
          <span>DADOS VIA BLING API V3</span>
        </div>
      </footer>
    </div>
  );
}

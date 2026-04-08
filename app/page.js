'use client';

import { useState, useEffect } from 'react';
import {
  Package, AlertTriangle, Search, RefreshCw, ExternalLink,
  ChevronDown, Users, Loader2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// ─── Auth Screen ─────────────────────────────────
function AuthScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 p-4">
      <div className="bg-surface-1 border border-surface-3 rounded-3xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-accent-lime/10 border border-accent-lime/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Users size={28} className="text-accent-lime" />
        </div>
        <h1 className="font-display text-xl mb-3">Painel de Fornecedores</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          Conecte sua conta do Bling para consultar produtos, preços,
          margens e estoque dos seus fornecedores.
        </p>
        <a
          href="/api/auth/login"
          className="inline-flex items-center gap-2 bg-accent-lime text-surface-0 font-bold text-sm px-6 py-3 rounded-xl hover:bg-accent-lime/90 transition-colors"
        >
          Conectar com Bling
          <ExternalLink size={16} />
        </a>
        <p className="text-[11px] text-gray-600 mt-6">
          Seus dados são acessados apenas para leitura via OAuth 2.0
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────
export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState(null);

  // Supplier search state
  const [supplierSearch, setSupplierSearch] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productFilter, setProductFilter] = useState('');
  const [sortField, setSortField] = useState('nome');
  const [sortDir, setSortDir] = useState('asc');

  // Check auth
  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(d => setAuthenticated(d.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  // Search suppliers
  const searchSuppliers = async () => {
    if (!supplierSearch.trim()) return;
    setLoadingSuppliers(true);
    setSelectedSupplier(null);
    setSupplierProducts([]);
    try {
      const res = await fetch(`/api/suppliers?search=${encodeURIComponent(supplierSearch)}`);
      const data = await res.json();
      setSuppliers(data.data || data || []);
    } catch (e) {
      console.error('Supplier search failed:', e);
    }
    setLoadingSuppliers(false);
  };

  // Load products for selected supplier
  const loadSupplierProducts = async (supplier) => {
    setSelectedSupplier(supplier);
    setLoadingProducts(true);
    setSupplierProducts([]);
    setProductFilter('');
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/products`);
      const data = await res.json();
      setSupplierProducts(data.data || []);
    } catch (e) {
      console.error('Failed to load supplier products:', e);
    }
    setLoadingProducts(false);
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Filter and sort products
  const filteredProducts = supplierProducts
    .filter(p =>
      !productFilter ||
      (p.nome || '').toLowerCase().includes(productFilter.toLowerCase()) ||
      (p.codigo || '').toLowerCase().includes(productFilter.toLowerCase())
    )
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (typeof valA === 'number' || typeof valB === 'number') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  // Summary stats
  const stats = {
    total: supplierProducts.length,
    lowStock: supplierProducts.filter(p => p.estoque <= 5).length,
    avgMargin: supplierProducts.filter(p => p.margem).length
      ? (supplierProducts.reduce((s, p) => s + (parseFloat(p.margem) || 0), 0) /
         supplierProducts.filter(p => p.margem).length).toFixed(1)
      : null,
    zeroPrice: supplierProducts.filter(p => !p.precoVenda || p.precoVenda === 0).length,
  };

  // Sort indicator
  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ArrowUpRight size={10} className="inline ml-0.5" />
      : <ArrowDownRight size={10} className="inline ml-0.5" />;
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <RefreshCw className="animate-spin text-accent-lime" size={24} />
      </div>
    );
  }

  if (!authenticated) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-surface-0">
      {/* ── Header ── */}
      <header className="border-b border-surface-3 bg-surface-1/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-lime rounded-lg flex items-center justify-center">
              <Package size={16} className="text-surface-0" />
            </div>
            <div>
              <h1 className="font-display text-sm tracking-wider">PAINEL DE FORNECEDORES</h1>
              <p className="text-[10px] text-gray-500 font-mono">BLING ERP • CONSULTA DE COMPRAS</p>
            </div>
            <span className="w-2 h-2 bg-emerald-400 rounded-full pulse-dot ml-1" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* ── Search Box ── */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Users size={18} className="text-accent-lime" />
            <h2 className="font-display text-sm uppercase tracking-widest">Buscar Fornecedor</h2>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Digite o nome do fornecedor..."
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchSuppliers()}
                className="w-full bg-surface-2 border border-surface-4 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-accent-lime/40 placeholder:text-gray-600"
              />
            </div>
            <button
              onClick={searchSuppliers}
              disabled={loadingSuppliers}
              className="bg-accent-lime text-surface-0 font-bold text-sm px-6 py-3 rounded-xl hover:bg-accent-lime/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loadingSuppliers ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Buscar
            </button>
          </div>

          {/* Supplier results */}
          {suppliers.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-3">
                {suppliers.length} fornecedor{suppliers.length !== 1 ? 'es' : ''} encontrado{suppliers.length !== 1 ? 's' : ''}
              </p>
              {suppliers.map(s => (
                <button
                  key={s.id}
                  onClick={() => loadSupplierProducts(s)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedSupplier?.id === s.id
                      ? 'bg-accent-lime/10 border-accent-lime/30'
                      : 'bg-surface-2/50 border-surface-4 hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.nome || s.fantasia || 'Sem nome'}</p>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {s.numeroDocumento || s.cnpj || s.cpf || ''}
                        {s.fantasia && s.nome !== s.fantasia ? ` • ${s.fantasia}` : ''}
                      </p>
                    </div>
                    {selectedSupplier?.id === s.id && loadingProducts ? (
                      <Loader2 size={14} className="animate-spin text-accent-lime" />
                    ) : (
                      <ChevronDown size={14} className={`text-gray-500 transition-transform ${selectedSupplier?.id === s.id ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Products Table ── */}
        {selectedSupplier && (
          <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-3">
                  <Package size={18} className="text-accent-lime" />
                  <h2 className="font-display text-sm uppercase tracking-widest">
                    {selectedSupplier.nome || selectedSupplier.fantasia}
                  </h2>
                </div>
                {!loadingProducts && supplierProducts.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1 ml-8 font-mono">
                    {supplierProducts.length} produto{supplierProducts.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {supplierProducts.length > 0 && (
                <div className="relative w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome ou código..."
                    value={productFilter}
                    onChange={e => setProductFilter(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-4 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-accent-lime/40 placeholder:text-gray-600"
                  />
                </div>
              )}
            </div>

            {/* Summary cards */}
            {!loadingProducts && supplierProducts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-surface-2/50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Total Produtos</p>
                  <p className="text-xl font-display font-bold text-accent-lime mt-1">{stats.total}</p>
                </div>
                <div className="bg-surface-2/50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Estoque Baixo (≤5)</p>
                  <p className={`text-xl font-display font-bold mt-1 ${stats.lowStock > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {stats.lowStock}
                  </p>
                </div>
                <div className="bg-surface-2/50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Margem Média</p>
                  <p className="text-xl font-display font-bold text-accent-amber mt-1">
                    {stats.avgMargin ? `${stats.avgMargin}%` : '—'}
                  </p>
                </div>
                <div className="bg-surface-2/50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Sem Preço Venda</p>
                  <p className={`text-xl font-display font-bold mt-1 ${stats.zeroPrice > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {stats.zeroPrice}
                  </p>
                </div>
              </div>
            )}

            {loadingProducts ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="animate-spin text-accent-lime mx-auto mb-3" size={28} />
                  <p className="text-xs text-gray-400 font-mono">Carregando produtos, preços e estoque...</p>
                  <p className="text-[10px] text-gray-600 mt-1">Consultando pedidos de compra do fornecedor</p>
                </div>
              </div>
            ) : supplierProducts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-16">
                Nenhum produto encontrado nos pedidos de compra deste fornecedor
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr className="bg-surface-2/50">
                      <th className="pl-6 cursor-pointer select-none" onClick={() => handleSort('codigo')}>
                        Código <SortIcon field="codigo" />
                      </th>
                      <th className="cursor-pointer select-none" onClick={() => handleSort('nome')}>
                        Produto <SortIcon field="nome" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('precoCusto')}>
                        Custo <SortIcon field="precoCusto" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('precoVenda')}>
                        Venda <SortIcon field="precoVenda" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('margem')}>
                        Margem <SortIcon field="margem" />
                      </th>
                      <th className="text-right cursor-pointer select-none" onClick={() => handleSort('estoque')}>
                        Estoque <SortIcon field="estoque" />
                      </th>
                      <th className="text-right pr-6 cursor-pointer select-none" onClick={() => handleSort('ultimaCompraData')}>
                        Última Compra <SortIcon field="ultimaCompraData" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p, i) => {
                      const margin = parseFloat(p.margem);
                      const isLowMargin = !isNaN(margin) && margin < 20;
                      const isHighMargin = !isNaN(margin) && margin >= 40;
                      const isLowStock = p.estoque <= 5;
                      const noPrice = !p.precoVenda || p.precoVenda === 0;
                      return (
                        <tr key={p.id || i}>
                          <td className="pl-6 font-mono text-xs text-accent-blue">{p.codigo}</td>
                          <td>
                            <p className="text-sm">{p.nome}</p>
                            {p.categoria && (
                              <p className="text-[10px] text-gray-600 mt-0.5">{p.categoria}</p>
                            )}
                          </td>
                          <td className="text-right font-mono text-sm">{formatCurrency(p.precoCusto)}</td>
                          <td className={`text-right font-mono text-sm ${noPrice ? 'text-gray-600' : ''}`}>
                            {noPrice ? (
                              <span className="text-[10px] text-amber-500/70 font-mono">SEM PREÇO</span>
                            ) : formatCurrency(p.precoVenda)}
                          </td>
                          <td className="text-right">
                            {p.margem ? (
                              <span className={`font-mono text-sm font-bold ${
                                isLowMargin ? 'text-rose-400' : isHighMargin ? 'text-emerald-400' : 'text-accent-amber'
                              }`}>
                                {p.margem}%
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          <td className={`text-right font-mono text-sm font-bold ${isLowStock ? 'text-rose-400' : 'text-gray-200'}`}>
                            {p.estoque}
                            {isLowStock && <AlertTriangle size={11} className="inline ml-1 text-rose-400" />}
                          </td>
                          <td className="text-right pr-6">
                            <p className="text-xs text-gray-400 font-mono">{formatDate(p.ultimaCompraData)}</p>
                            <p className="text-[10px] text-gray-600">{p.ultimaCompraQtd} {p.unidade}</p>
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

      {/* Footer */}
      <footer className="border-t border-surface-3 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-[10px] text-gray-600 font-mono">
          <span>PAINEL DE FORNECEDORES v2.0</span>
          <span>DADOS VIA BLING API V3</span>
        </div>
      </footer>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  Package, TrendingUp, AlertTriangle, DollarSign,
  Search, Filter, RefreshCw, ExternalLink, ChevronDown,
  ShoppingCart, BarChart3, Boxes, ArrowUpRight, ArrowDownRight,
  Users, Loader2, Percent,
} from 'lucide-react';

const COLORS = ['#c4f442', '#60a5fa', '#fb7185', '#fbbf24', '#a78bfa', '#34d399', '#f472b6', '#38bdf8'];

const STATUS_MAP = {
  0: { label: 'Em aberto', color: '#fbbf24' },
  1: { label: 'Atendido', color: '#34d399' },
  2: { label: 'Cancelado', color: '#fb7185' },
  3: { label: 'Em andamento', color: '#60a5fa' },
  9: { label: 'Outro', color: '#a78bfa' },
};

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// ─── KPI Card ────────────────────────────────────
function KpiCard({ icon: Icon, label, value, subtitle, trend, color = 'lime' }) {
  const colorMap = {
    lime: 'text-accent-lime border-accent-lime/20 bg-accent-lime/5',
    blue: 'text-accent-blue border-accent-blue/20 bg-accent-blue/5',
    rose: 'text-accent-rose border-accent-rose/20 bg-accent-rose/5',
    amber: 'text-accent-amber border-accent-amber/20 bg-accent-amber/5',
  };

  return (
    <div className="card-hover bg-surface-1 border border-surface-3 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl border ${colorMap[color]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-mono ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold font-display tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-mono">{label}</p>
      {subtitle && <p className="text-xs text-gray-600 mt-2">{subtitle}</p>}
    </div>
  );
}

// ─── Section Header ──────────────────────────────
function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-accent-lime" />
        <h2 className="font-display text-sm uppercase tracking-widest">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────
function StatusBadge({ situacao }) {
  const status = STATUS_MAP[situacao?.id] || STATUS_MAP[9];
  const label = situacao?.valor || status.label;
  return (
    <span
      className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border"
      style={{ color: status.color, borderColor: status.color + '33', backgroundColor: status.color + '0d' }}
    >
      {label}
    </span>
  );
}

// ─── Custom Tooltip ──────────────────────────────
function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-surface-4 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-400 font-mono mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Auth Screen ─────────────────────────────────
function AuthScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 p-4">
      <div className="bg-surface-1 border border-surface-3 rounded-3xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-accent-lime/10 border border-accent-lime/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShoppingCart size={28} className="text-accent-lime" />
        </div>
        <h1 className="font-display text-xl mb-3">Painel de Compras</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          Conecte sua conta do Bling para visualizar seus pedidos de compra, 
          estoque e gastos por fornecedor em tempo real.
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

// ─── Main Dashboard ──────────────────────────────
export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [stock, setStock] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState('all');

  // Supplier search state
  const [supplierSearch, setSupplierSearch] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [supplierProductSearch, setSupplierProductSearch] = useState('');

  // Check auth
  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(d => setAuthenticated(d.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('dataInicial', dateRange.start);
      if (dateRange.end) params.set('dataFinal', dateRange.end);

      const [purchasesRes, productsRes, stockRes] = await Promise.allSettled([
        fetch(`/api/purchases?${params}`).then(r => r.json()),
        fetch('/api/products?limite=100').then(r => r.json()),
        fetch('/api/stock?limite=100').then(r => r.json()),
      ]);

      if (purchasesRes.status === 'fulfilled' && purchasesRes.value.data) {
        setPurchases(purchasesRes.value.data);
      }
      if (productsRes.status === 'fulfilled' && productsRes.value.data) {
        setProducts(productsRes.value.data);
      }
      if (stockRes.status === 'fulfilled' && stockRes.value.data) {
        setStock(stockRes.value.data);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated, fetchData]);

  // ── Computed data ──
  const totalSpent = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
  const avgOrderValue = purchases.length ? totalSpent / purchases.length : 0;
  const openOrders = purchases.filter(p => p.situacao?.id === 0 || !p.situacao).length;

  // Spending by supplier
  const supplierMap = {};
  purchases.forEach(p => {
    const name = p.fornecedor?.nome || p.fornecedor?.nomeFantasia || 'Desconhecido';
    supplierMap[name] = (supplierMap[name] || 0) + (p.total || 0);
  });
  const supplierData = Object.entries(supplierMap)
    .map(([name, value]) => ({ name: name.substring(0, 20), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Spending by month
  const monthMap = {};
  purchases.forEach(p => {
    if (!p.data) return;
    const month = p.data.substring(0, 7); // YYYY-MM
    monthMap[month] = (monthMap[month] || 0) + (p.total || 0);
  });
  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      name: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      value,
    }));

  // Status distribution
  const statusMap = {};
  purchases.forEach(p => {
    const label = p.situacao?.valor || 'Sem status';
    statusMap[label] = (statusMap[label] || 0) + 1;
  });
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  // Low stock items
  const lowStockItems = stock
    .filter(s => {
      const qty = s.saldoFisicoTotal || s.saldoFisico || 0;
      return qty <= 5 && qty >= 0;
    })
    .slice(0, 10);

  // Filter purchases for table
  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = !searchTerm ||
      (p.fornecedor?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(p.numero || '').includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || String(p.situacao?.id) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Supplier functions ──
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

  const loadSupplierProducts = async (supplier) => {
    setSelectedSupplier(supplier);
    setLoadingProducts(true);
    setSupplierProducts([]);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/products`);
      const data = await res.json();
      setSupplierProducts(data.data || []);
    } catch (e) {
      console.error('Failed to load supplier products:', e);
    }
    setLoadingProducts(false);
  };

  // Filter supplier products
  const filteredSupplierProducts = supplierProducts.filter(p =>
    !supplierProductSearch ||
    (p.nome || '').toLowerCase().includes(supplierProductSearch.toLowerCase()) ||
    (p.codigo || '').toLowerCase().includes(supplierProductSearch.toLowerCase())
  );

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <RefreshCw className="animate-spin text-accent-lime" size={24} />
      </div>
    );
  }

  if (!authenticated) return <AuthScreen />;

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
    { id: 'suppliers', label: 'Fornecedores', icon: Users },
    { id: 'purchases', label: 'Pedidos de Compra', icon: ShoppingCart },
    { id: 'stock', label: 'Estoque', icon: Boxes },
  ];

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
              <h1 className="font-display text-sm tracking-wider">PAINEL DE COMPRAS</h1>
              <p className="text-[10px] text-gray-500 font-mono">BLING ERP • LIVE</p>
            </div>
            <span className="w-2 h-2 bg-emerald-400 rounded-full pulse-dot ml-1" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="date"
                value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-surface-2 border border-surface-4 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-accent-lime/40"
              />
              <span>→</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-surface-2 border border-surface-4 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-accent-lime/40"
              />
            </div>
            <button
              onClick={fetchData}
              className="bg-surface-2 border border-surface-4 rounded-lg p-2 hover:bg-surface-3 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-accent-lime' : 'text-gray-400'} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-accent-lime text-accent-lime'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <RefreshCw className="animate-spin text-accent-lime mx-auto mb-4" size={32} />
              <p className="text-sm text-gray-400 font-mono">Carregando dados do Bling...</p>
            </div>
          </div>
        ) : (
          <>
            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard icon={DollarSign} label="Total em Compras" value={formatCurrency(totalSpent)} color="lime" />
                  <KpiCard icon={ShoppingCart} label="Pedidos" value={purchases.length} subtitle={`${openOrders} em aberto`} color="blue" />
                  <KpiCard icon={TrendingUp} label="Ticket Médio" value={formatCurrency(avgOrderValue)} color="amber" />
                  <KpiCard icon={AlertTriangle} label="Estoque Baixo" value={lowStockItems.length} subtitle="itens ≤ 5 unidades" color="rose" />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Spending by supplier */}
                  <div className="lg:col-span-2 bg-surface-1 border border-surface-3 rounded-2xl p-6">
                    <SectionHeader icon={BarChart3} title="Gastos por Fornecedor" />
                    {supplierData.length ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={supplierData} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'Space Mono' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                            {supplierData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-gray-500 text-sm text-center py-16">Nenhum dado de fornecedor disponível</p>
                    )}
                  </div>

                  {/* Status distribution */}
                  <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
                    <SectionHeader icon={Filter} title="Status dos Pedidos" />
                    {statusData.length ? (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                              {statusData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                          {statusData.map((item, i) => (
                            <div key={item.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                <span className="text-gray-400">{item.name}</span>
                              </div>
                              <span className="font-mono text-gray-300">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm text-center py-16">Sem dados</p>
                    )}
                  </div>
                </div>

                {/* Monthly trend */}
                <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
                  <SectionHeader icon={TrendingUp} title="Evolução Mensal de Compras" />
                  {monthlyData.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222230" />
                        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'Space Mono' }} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'Space Mono' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                        <Line type="monotone" dataKey="value" stroke="#c4f442" strokeWidth={2.5} dot={{ fill: '#c4f442', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-16">Nenhum dado mensal disponível</p>
                  )}
                </div>
              </div>
            )}

            {/* ═══ PURCHASES TAB ═══ */}
            {activeTab === 'purchases' && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Buscar por fornecedor ou nº do pedido..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-surface-1 border border-surface-3 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-accent-lime/40 placeholder:text-gray-600"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="appearance-none bg-surface-1 border border-surface-3 rounded-xl px-4 py-2.5 pr-8 text-sm outline-none focus:border-accent-lime/40 text-gray-300"
                    >
                      <option value="all">Todos os status</option>
                      <option value="0">Em aberto</option>
                      <option value="1">Atendido</option>
                      <option value="2">Cancelado</option>
                      <option value="3">Em andamento</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    {filteredPurchases.length} pedido{filteredPurchases.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Table */}
                <div className="bg-surface-1 border border-surface-3 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr className="bg-surface-2/50">
                          <th className="pl-6">Nº</th>
                          <th>Fornecedor</th>
                          <th>Data</th>
                          <th>Previsão</th>
                          <th>Status</th>
                          <th className="text-right pr-6">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPurchases.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-gray-500 py-16">
                              Nenhum pedido encontrado
                            </td>
                          </tr>
                        ) : (
                          filteredPurchases.map(p => (
                            <tr key={p.id} className="group cursor-pointer">
                              <td className="pl-6 font-mono text-accent-lime">#{p.numero || p.id}</td>
                              <td>
                                <div>
                                  <p className="text-sm">{p.fornecedor?.nome || p.fornecedor?.nomeFantasia || '—'}</p>
                                  {p.fornecedor?.cnpj && (
                                    <p className="text-[10px] text-gray-600 font-mono">{p.fornecedor.cnpj}</p>
                                  )}
                                </div>
                              </td>
                              <td className="text-gray-400 text-xs font-mono">{formatDate(p.data)}</td>
                              <td className="text-gray-400 text-xs font-mono">{formatDate(p.dataPrevista)}</td>
                              <td><StatusBadge situacao={p.situacao} /></td>
                              <td className="text-right pr-6 font-mono font-bold">{formatCurrency(p.total)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STOCK TAB ═══ */}
            {activeTab === 'stock' && (
              <div className="space-y-6">
                {/* Low stock alert */}
                {lowStockItems.length > 0 && (
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={16} className="text-rose-400" />
                      <span className="text-sm font-mono uppercase tracking-wider text-rose-400">
                        Alerta de Estoque Baixo
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {lowStockItems.length} produto{lowStockItems.length !== 1 ? 's' : ''} com 5 ou menos unidades em estoque.
                    </p>
                  </div>
                )}

                {/* Stock table */}
                <div className="bg-surface-1 border border-surface-3 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr className="bg-surface-2/50">
                          <th className="pl-6">Produto</th>
                          <th>Depósito</th>
                          <th className="text-right">Saldo Físico</th>
                          <th className="text-right pr-6">Saldo Virtual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center text-gray-500 py-16">
                              Nenhum dado de estoque disponível
                            </td>
                          </tr>
                        ) : (
                          stock.map((s, i) => {
                            const fisico = s.saldoFisicoTotal || s.saldoFisico || 0;
                            const virtual = s.saldoVirtualTotal || s.saldoVirtual || 0;
                            const isLow = fisico <= 5;
                            return (
                              <tr key={s.produto?.id || i}>
                                <td className="pl-6">
                                  <div>
                                    <p className={`text-sm ${isLow ? 'text-rose-300' : ''}`}>
                                      {s.produto?.nome || `Produto #${s.produto?.id || i}`}
                                    </p>
                                    {s.produto?.codigo && (
                                      <p className="text-[10px] text-gray-600 font-mono">{s.produto.codigo}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="text-xs text-gray-400">{s.deposito?.descricao || 'Geral'}</td>
                                <td className={`text-right font-mono font-bold ${isLow ? 'text-rose-400' : 'text-gray-200'}`}>
                                  {fisico}
                                  {isLow && <AlertTriangle size={12} className="inline ml-1.5 text-rose-400" />}
                                </td>
                                <td className="text-right pr-6 font-mono text-gray-400">{virtual}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ SUPPLIERS TAB ═══ */}
            {activeTab === 'suppliers' && (
              <div className="space-y-6">
                {/* Search bar */}
                <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
                  <SectionHeader icon={Users} title="Buscar Fornecedor" />
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
                              : 'bg-surface-2/50 border-surface-4 hover:border-surface-4 hover:bg-surface-2'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{s.nome || s.fantasia || 'Sem nome'}</p>
                              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                                {s.cnpj || s.cpf || ''} {s.fantasia && s.nome !== s.fantasia ? `• ${s.fantasia}` : ''}
                              </p>
                            </div>
                            <ChevronDown size={14} className={`text-gray-500 transition-transform ${selectedSupplier?.id === s.id ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected supplier products */}
                {selectedSupplier && (
                  <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="flex items-center gap-3">
                          <Users size={18} className="text-accent-lime" />
                          <h2 className="font-display text-sm uppercase tracking-widest">
                            Produtos de {selectedSupplier.nome || selectedSupplier.fantasia}
                          </h2>
                        </div>
                        {!loadingProducts && (
                          <p className="text-xs text-gray-500 mt-1 ml-8 font-mono">
                            {supplierProducts.length} produto{supplierProducts.length !== 1 ? 's' : ''} encontrado{supplierProducts.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      {supplierProducts.length > 0 && (
                        <div className="relative w-64">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <input
                            type="text"
                            placeholder="Filtrar produtos..."
                            value={supplierProductSearch}
                            onChange={e => setSupplierProductSearch(e.target.value)}
                            className="w-full bg-surface-2 border border-surface-4 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-accent-lime/40 placeholder:text-gray-600"
                          />
                        </div>
                      )}
                    </div>

                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                          <Loader2 className="animate-spin text-accent-lime mx-auto mb-3" size={28} />
                          <p className="text-xs text-gray-400 font-mono">Carregando produtos e estoque...</p>
                          <p className="text-[10px] text-gray-600 mt-1">Isso pode levar alguns segundos</p>
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
                              <th className="pl-6">Código</th>
                              <th>Produto</th>
                              <th>Categoria</th>
                              <th className="text-right">Custo</th>
                              <th className="text-right">Venda</th>
                              <th className="text-right">Margem</th>
                              <th className="text-right">Estoque</th>
                              <th className="text-right pr-6">Última Compra</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSupplierProducts.map((p, i) => {
                              const margin = parseFloat(p.margem);
                              const isLowMargin = margin < 20;
                              const isLowStock = p.estoque <= 5;
                              return (
                                <tr key={p.id || i}>
                                  <td className="pl-6 font-mono text-xs text-accent-blue">{p.codigo}</td>
                                  <td>
                                    <p className="text-sm">{p.nome}</p>
                                  </td>
                                  <td className="text-xs text-gray-400">{p.categoria}</td>
                                  <td className="text-right font-mono text-sm">{formatCurrency(p.precoCusto)}</td>
                                  <td className="text-right font-mono text-sm">{formatCurrency(p.precoVenda)}</td>
                                  <td className="text-right">
                                    {p.margem ? (
                                      <span className={`font-mono text-sm font-bold ${
                                        isLowMargin ? 'text-rose-400' : margin >= 40 ? 'text-emerald-400' : 'text-accent-amber'
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
                                    <div>
                                      <p className="text-xs text-gray-400 font-mono">{formatDate(p.ultimaCompraData)}</p>
                                      <p className="text-[10px] text-gray-600">{p.ultimaCompraQtd} {p.unidade}</p>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Summary cards */}
                        <div className="grid grid-cols-3 gap-4 mt-6 px-6 pb-2">
                          <div className="bg-surface-2/50 rounded-xl p-4">
                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Margem Média</p>
                            <p className="text-lg font-display font-bold text-accent-amber mt-1">
                              {supplierProducts.filter(p => p.margem).length
                                ? (supplierProducts.reduce((sum, p) => sum + (parseFloat(p.margem) || 0), 0) / supplierProducts.filter(p => p.margem).length).toFixed(1) + '%'
                                : '—'}
                            </p>
                          </div>
                          <div className="bg-surface-2/50 rounded-xl p-4">
                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Produtos Estoque Baixo</p>
                            <p className="text-lg font-display font-bold text-rose-400 mt-1">
                              {supplierProducts.filter(p => p.estoque <= 5).length}
                            </p>
                          </div>
                          <div className="bg-surface-2/50 rounded-xl p-4">
                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Total Produtos</p>
                            <p className="text-lg font-display font-bold text-accent-lime mt-1">
                              {supplierProducts.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-3 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-[10px] text-gray-600 font-mono">
          <span>BLING DASHBOARD v1.0</span>
          <span>DADOS ATUALIZADOS VIA API V3</span>
        </div>
      </footer>
    </div>
  );
}

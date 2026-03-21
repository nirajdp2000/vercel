import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Brain, ChevronDown, ChevronUp,
  Cpu, Gauge, Layers, Radar, RefreshCw, Shield,
  Sparkles, TrendingUp, Waves, Zap, BarChart2, Target, Filter,
  Star, Award, Flame, TrendingDown
} from 'lucide-react';
import { HedgeFundSignalRanking, type HedgeFundSignalDashboard } from './HedgeFundSignalRanking';
import { UltraQuantHeatmap } from './UltraQuantHeatmap';
import { fetchJson } from '../lib/api';

function cleanSymbol(raw: string): string {
  return raw.replace(/^(NSE_EQ|BSE_EQ)[|:]/, '');
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisResult = {
  symbol: string; sector: string; industry: string;
  cagr: number; momentum: number; trendStrength: number;
  volatility: number; maxDrawdown: number; growthRatio: number;
  score: number; earningsGrowth: number; revenueGrowth: number;
  volumeGrowth: number; breakoutFrequency: number; sentimentScore: number;
  marketCap: number; drawdownProbability: number; positionSize: number;
  gradientBoostProb: number; lstmPredictedPrice: number;
  marketRegime: string; marketState: string; rlAction: string;
  finalPredictionScore: number; orderImbalance: number;
  volumeProfile?: { poc?: number; vah?: number; val?: number };
  alerts: Array<{ stockSymbol: string; signalType: string; confidenceScore: number; timestamp: string }>;
};

type UltraQuantDashboard = {
  results: AnalysisResult[];
  alerts: Array<{ stockSymbol: string; signalType: string; confidenceScore: number; timestamp: string }>;
  sectors: Array<{ sector: string; sectorStrength: number; averageScore: number; leaders: string[] }>;
  hedgeFundSignals: HedgeFundSignalDashboard;
  summary: { scannedUniverse: number; returned: number; historicalPeriodYears: number; avgScore: number; multibaggerCandidates: number; buySignals: number };
  architecture: Array<{ stage: string; description: string }>;
};

type Filters = {
  historicalPeriodYears: number; minCagr: number; sectorFilter: string;
  minMarketCap: number; maxMarketCap: number; minVolume: number;
  maxDrawdown: number; volatilityThreshold: number; breakoutFrequency: number;
  trendStrengthThreshold: number; riskPercentage: number;
};

const sectors = ['ALL','Technology','Financials','Energy','Healthcare','Consumer','Industrials','Telecom','Materials'];

const defaultFilters: Filters = {
  historicalPeriodYears: 5, minCagr: 18, sectorFilter: 'ALL',
  minMarketCap: 0, maxMarketCap: 200000, minVolume: 100000,
  maxDrawdown: 45, volatilityThreshold: 0.5, breakoutFrequency: 0.08,
  trendStrengthThreshold: 0.12, riskPercentage: 1,
};

const normalizeFilters = (f: Filters): Filters => ({
  historicalPeriodYears: Number.isFinite(f.historicalPeriodYears) ? Math.min(15, Math.max(1, f.historicalPeriodYears)) : defaultFilters.historicalPeriodYears,
  minCagr: Number.isFinite(f.minCagr) ? f.minCagr : defaultFilters.minCagr,
  sectorFilter: f.sectorFilter || defaultFilters.sectorFilter,
  minMarketCap: Number.isFinite(f.minMarketCap) ? Math.max(0, f.minMarketCap) : defaultFilters.minMarketCap,
  maxMarketCap: Number.isFinite(f.maxMarketCap) ? Math.max(0, f.maxMarketCap) : defaultFilters.maxMarketCap,
  minVolume: Number.isFinite(f.minVolume) ? Math.max(0, f.minVolume) : defaultFilters.minVolume,
  maxDrawdown: Number.isFinite(f.maxDrawdown) ? Math.max(0, f.maxDrawdown) : defaultFilters.maxDrawdown,
  volatilityThreshold: Number.isFinite(f.volatilityThreshold) ? Math.max(0, f.volatilityThreshold) : defaultFilters.volatilityThreshold,
  breakoutFrequency: Number.isFinite(f.breakoutFrequency) ? Math.max(0, f.breakoutFrequency) : defaultFilters.breakoutFrequency,
  trendStrengthThreshold: Number.isFinite(f.trendStrengthThreshold) ? Math.max(0, f.trendStrengthThreshold) : defaultFilters.trendStrengthThreshold,
  riskPercentage: Number.isFinite(f.riskPercentage) ? Math.max(0.1, f.riskPercentage) : defaultFilters.riskPercentage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBar({ value, max = 100, color = 'bg-cyan-400', thin = false }: { value: number; max?: number; color?: string; thin?: boolean }) {
  return (
    <div className={`w-full rounded-full bg-white/5 overflow-hidden ${thin ? 'h-1' : 'h-2'}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function SignalPill({ action }: { action: string }) {
  const map: Record<string, string> = {
    BUY:        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    STRONG_BUY: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40',
    SELL:       'bg-rose-500/20 text-rose-300 border-rose-500/30',
    HOLD:       'bg-amber-500/15 text-amber-300 border-amber-500/25',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] ${map[action] ?? 'bg-white/10 text-zinc-300 border-white/10'}`}>
      {action}
    </span>
  );
}

function RegimePill({ regime }: { regime: string }) {
  const map: Record<string, string> = {
    'Trending Up':             'text-emerald-400 bg-emerald-500/10',
    'Trending Down':           'text-rose-400 bg-rose-500/10',
    'High Volatility':         'text-amber-400 bg-amber-500/10',
    'Low Volatility Sideways': 'text-cyan-400 bg-cyan-500/10',
    'Sideways':                'text-zinc-400 bg-white/5',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] ${map[regime] ?? 'text-zinc-400 bg-white/5'}`}>
      {regime}
    </span>
  );
}

function CagrBadge({ cagr }: { cagr: number }) {
  if (cagr >= 40) return <span className="rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.1em] bg-violet-500/20 text-violet-300">10x</span>;
  if (cagr >= 25) return <span className="rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.1em] bg-emerald-500/20 text-emerald-300">Growth</span>;
  if (cagr >= 15) return <span className="rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.1em] bg-cyan-500/15 text-cyan-400">Stable</span>;
  return null;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-[14px]">🥇</span>;
  if (rank === 2) return <span className="text-[14px]">🥈</span>;
  if (rank === 3) return <span className="text-[14px]">🥉</span>;
  return <span className="text-[9px] text-zinc-600 font-mono w-5 text-center">{rank}</span>;
}

function StatCard({ label, value, sub, color = 'text-white', icon: Icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
        {Icon && <Icon size={11} className="text-zinc-600" />}
      </div>
      <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[9px] text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

/** Mini score distribution histogram — 5 buckets */
function ScoreHistogram({ results }: { results: AnalysisResult[] }) {
  if (!results.length) return null;
  const buckets = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
  results.forEach(r => { buckets[Math.min(4, Math.floor(r.score / 20))]++; });
  const max = Math.max(...buckets, 1);
  const labels = ['0-20', '20-40', '40-60', '60-80', '80+'];
  const colors = ['bg-zinc-600', 'bg-zinc-500', 'bg-amber-500', 'bg-cyan-400', 'bg-emerald-400'];
  return (
    <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Score Distribution</p>
      <div className="flex items-end gap-1.5 h-10">
        {buckets.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[8px] text-zinc-600 font-mono">{count}</span>
            <div className={`w-full rounded-t ${colors[i]} transition-all duration-700`} style={{ height: `${Math.max(4, (count / max) * 28)}px` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {labels.map((l, i) => <span key={i} className="flex-1 text-center text-[7px] text-zinc-600">{l}</span>)}
      </div>
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({ filters, setFilters, onScan, onReset, loading }: {
  filters: Filters; setFilters: (f: Filters) => void;
  onScan: () => void; onReset: () => void; loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const inp = 'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40 transition-colors';

  return (
    <div className="rounded-[2rem] border border-cyan-500/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_40%),linear-gradient(180deg,rgba(4,10,18,0.97),rgba(8,12,18,0.97))] p-6 shadow-2xl shadow-black/40">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-cyan-300 mb-2">
            <Cpu size={11} /> Ultra Quant Analyzer
          </p>
          <h2 className="text-2xl font-black tracking-tight text-white">Institutional Multibagger Scanner</h2>
          <p className="text-[11px] text-zinc-500 mt-1">CAGR · Momentum · Regime · Order Flow · AI Signal Fusion</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onScan} disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">
            {loading ? <Activity size={13} className="animate-spin" /> : <Zap size={13} />}
            {loading ? 'Scanning…' : 'Run Scan'}
          </button>
          <button onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:border-cyan-400/30 transition">
            <RefreshCw size={12} /> Reset
          </button>
          <button onClick={() => setOpen(o => !o)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white transition">
            <Filter size={12} /> Filters {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="space-y-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">History (yrs)</span>
          <input type="number" min={1} max={15} value={filters.historicalPeriodYears}
            onChange={e => setFilters({ ...filters, historicalPeriodYears: Number(e.target.value) })} className={inp} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Min CAGR (%)</span>
          <input type="number" value={filters.minCagr}
            onChange={e => setFilters({ ...filters, minCagr: Number(e.target.value) })} className={inp} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Sector</span>
          <select value={filters.sectorFilter}
            onChange={e => setFilters({ ...filters, sectorFilter: e.target.value })}
            className={inp + ' appearance-none'}>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Max Drawdown (%)</span>
          <input type="number" value={filters.maxDrawdown}
            onChange={e => setFilters({ ...filters, maxDrawdown: Number(e.target.value) })} className={inp} />
        </label>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 border-t border-white/5 pt-4">
          <label className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Min Cap (Cr)</span>
            <input type="number" value={filters.minMarketCap}
              onChange={e => setFilters({ ...filters, minMarketCap: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Max Cap (Cr)</span>
            <input type="number" value={filters.maxMarketCap}
              onChange={e => setFilters({ ...filters, maxMarketCap: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Min Volume</span>
            <input type="number" value={filters.minVolume}
              onChange={e => setFilters({ ...filters, minVolume: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Volatility ≤</span>
            <input type="number" step="0.01" value={filters.volatilityThreshold}
              onChange={e => setFilters({ ...filters, volatilityThreshold: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Breakout Freq ≥</span>
            <input type="number" step="0.01" value={filters.breakoutFrequency}
              onChange={e => setFilters({ ...filters, breakoutFrequency: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Trend Strength ≥</span>
            <input type="number" step="0.01" value={filters.trendStrengthThreshold}
              onChange={e => setFilters({ ...filters, trendStrengthThreshold: Number(e.target.value) })} className={inp} />
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Stock Table ──────────────────────────────────────────────────────────────

type SignalFilter = 'ALL' | 'BUY' | 'STRONG_BUY' | 'HOLD' | 'SELL';

function StockTable({ results }: { results: AnalysisResult[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof AnalysisResult>('score');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [search, setSearch] = useState('');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');

  const filtered = [...results]
    .filter(r => {
      const matchSearch = !search || cleanSymbol(r.symbol).includes(search.toUpperCase()) || r.sector.toLowerCase().includes(search.toLowerCase());
      const matchSignal = signalFilter === 'ALL' || r.rlAction === signalFilter;
      return matchSearch && matchSignal;
    })
    .sort((a, b) => {
      const av = Number(a[sortKey]), bv = Number(b[sortKey]);
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const counts: Record<SignalFilter, number> = {
    ALL: results.length,
    BUY: results.filter(r => r.rlAction === 'BUY').length,
    STRONG_BUY: results.filter(r => r.rlAction === 'STRONG_BUY').length,
    HOLD: results.filter(r => r.rlAction === 'HOLD').length,
    SELL: results.filter(r => r.rlAction === 'SELL').length,
  };

  const signalTabs: Array<{ key: SignalFilter; label: string; cls: string }> = [
    { key: 'ALL',        label: 'All',         cls: 'text-zinc-300 border-white/10 hover:border-cyan-400/30' },
    { key: 'STRONG_BUY', label: 'Strong Buy',  cls: 'text-emerald-300 border-emerald-500/20 hover:border-emerald-400/40' },
    { key: 'BUY',        label: 'Buy',         cls: 'text-emerald-400 border-emerald-500/15 hover:border-emerald-400/30' },
    { key: 'HOLD',       label: 'Hold',        cls: 'text-amber-300 border-amber-500/20 hover:border-amber-400/30' },
    { key: 'SELL',       label: 'Sell',        cls: 'text-rose-400 border-rose-500/20 hover:border-rose-400/30' },
  ];

  const cols: Array<{ key: keyof AnalysisResult; label: string }> = [
    { key: 'score',                label: 'Score' },
    { key: 'cagr',                 label: 'CAGR' },
    { key: 'momentum',             label: 'Mom' },
    { key: 'finalPredictionScore', label: 'AI %' },
    { key: 'orderImbalance',       label: 'OI' },
    { key: 'maxDrawdown',          label: 'DD%' },
  ];

  const SortIcon = ({ k }: { k: keyof AnalysisResult }) =>
    sortKey === k
      ? (sortDir === 'desc' ? <ChevronDown size={9} className="text-cyan-400 inline ml-0.5" /> : <ChevronUp size={9} className="text-cyan-400 inline ml-0.5" />)
      : <ChevronDown size={9} className="opacity-20 inline ml-0.5" />;

  return (
    <div className="rounded-[2rem] border border-white/5 bg-zinc-950/70 shadow-2xl shadow-black/30 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/5 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white shrink-0">
            <TrendingUp size={14} className="text-cyan-300" /> Top Bullish Stocks
          </h3>
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-1.5 flex-1 max-w-[200px]">
            <Filter size={10} className="text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Symbol / sector…"
              className="bg-transparent text-[11px] text-white placeholder-white/20 outline-none w-full" />
          </div>
          <span className="text-[10px] text-zinc-500 font-bold shrink-0">{filtered.length} stocks</span>
        </div>

        {/* Signal filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {signalTabs.map(tab => (
            <button key={tab.key}
              onClick={() => setSignalFilter(tab.key)}
              className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] transition-all ${tab.cls} ${signalFilter === tab.key ? 'bg-white/8' : 'bg-transparent opacity-60 hover:opacity-100'}`}>
              {tab.label} <span className="opacity-60">({counts[tab.key]})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[44rem] overflow-y-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="sticky top-0 bg-zinc-950/98 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500 border-b border-white/5">
            <tr>
              <th className="px-5 py-3">Stock</th>
              {cols.map(c => (
                <th key={String(c.key)} className="cursor-pointer px-3 py-3 text-left"
                  onClick={() => { setSortKey(c.key); setSortDir(d => sortKey === c.key ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }}>
                  {c.label}<SortIcon k={c.key} />
                </th>
              ))}
              <th className="px-3 py-3">Regime</th>
              <th className="px-3 py-3">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((stock, i) => (
              <React.Fragment key={stock.symbol}>
                <tr
                  onClick={() => setExpanded(expanded === stock.symbol ? null : stock.symbol)}
                  className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${expanded === stock.symbol ? 'bg-cyan-500/[0.05]' : ''}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 shrink-0 flex justify-center">
                        <RankBadge rank={i + 1} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-black text-white">{cleanSymbol(stock.symbol)}</p>
                          <CagrBadge cagr={stock.cagr} />
                        </div>
                        <p className="text-[9px] text-zinc-500">{stock.sector}</p>
                      </div>
                    </div>
                  </td>
                  {/* Score with bar */}
                  <td className="px-3 py-3 w-20">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-black text-cyan-300">{stock.score.toFixed(1)}</span>
                      <ScoreBar value={stock.score} color="bg-cyan-400" />
                    </div>
                  </td>
                  <td className={`px-3 py-3 text-[11px] font-bold ${stock.cagr >= 20 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {stock.cagr.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-[11px] text-zinc-300 font-bold">{stock.momentum.toFixed(2)}x</td>
                  <td className="px-3 py-3 w-20">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-black text-emerald-400">{stock.finalPredictionScore.toFixed(1)}%</span>
                      <ScoreBar value={stock.finalPredictionScore} color="bg-emerald-400" />
                    </div>
                  </td>
                  <td className={`px-3 py-3 text-[11px] font-bold ${stock.orderImbalance >= 2.5 ? 'text-violet-400' : 'text-zinc-400'}`}>
                    {stock.orderImbalance.toFixed(2)}x
                  </td>
                  <td className={`px-3 py-3 text-[11px] font-bold ${stock.maxDrawdown <= 25 ? 'text-emerald-400' : stock.maxDrawdown <= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {stock.maxDrawdown.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3"><RegimePill regime={stock.marketRegime} /></td>
                  <td className="px-3 py-3"><SignalPill action={stock.rlAction} /></td>
                </tr>
                {expanded === stock.symbol && (
                  <tr className="bg-cyan-500/[0.04] border-b border-cyan-500/10">
                    <td colSpan={9} className="px-5 py-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6 text-[10px]">
                        {[
                          { label: 'Growth Ratio',   value: `${stock.growthRatio.toFixed(2)}x`,          color: 'text-emerald-400' },
                          { label: 'Earnings Growth', value: `${stock.earningsGrowth.toFixed(1)}%`,       color: 'text-cyan-400' },
                          { label: 'Revenue Growth',  value: `${stock.revenueGrowth.toFixed(1)}%`,        color: 'text-cyan-300' },
                          { label: 'Volume Growth',   value: `${stock.volumeGrowth.toFixed(1)}%`,         color: 'text-amber-400' },
                          { label: 'Sentiment',       value: `${stock.sentimentScore.toFixed(1)}%`,       color: 'text-violet-400' },
                          { label: 'Gradient Boost',  value: `${stock.gradientBoostProb.toFixed(1)}%`,    color: 'text-white' },
                          { label: 'LSTM Price',      value: stock.lstmPredictedPrice.toFixed(2),         color: 'text-cyan-300' },
                          { label: 'HMM State',       value: stock.marketState,                           color: 'text-amber-300' },
                          { label: 'Drawdown Prob',   value: `${stock.drawdownProbability.toFixed(1)}%`,  color: 'text-rose-400' },
                          { label: 'Position Size',   value: `${stock.positionSize.toFixed(0)} sh`,       color: 'text-emerald-400' },
                          { label: 'POC/VAH/VAL',     value: `${stock.volumeProfile?.poc?.toFixed(0) ?? '--'} / ${stock.volumeProfile?.vah?.toFixed(0) ?? '--'} / ${stock.volumeProfile?.val?.toFixed(0) ?? '--'}`, color: 'text-zinc-300' },
                          { label: 'Breakout Freq',   value: `${(stock.breakoutFrequency * 100).toFixed(1)}%`, color: 'text-amber-400' },
                        ].map(m => (
                          <div key={m.label} className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
                            <p className="text-zinc-500 uppercase tracking-[0.12em] mb-0.5">{m.label}</p>
                            <p className={`font-black ${m.color}`}>{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[12px] text-zinc-600">No stocks match the current filter.</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

const UltraQuantTab = () => {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<UltraQuantDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const runScan = async (nextFilters?: Filters) => {
    setLoading(true); setError(null);
    try {
      const f = normalizeFilters(nextFilters ?? filtersRef.current);
      const payload = await fetchJson<UltraQuantDashboard>('/api/ultra-quant/dashboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      startTransition(() => { setFilters(f); setDashboard(payload); setLastRefreshed(new Date()); });
    } catch (e: any) {
      setError(e.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScan();
    refreshTimer.current = setInterval(() => runScan(), 1_800_000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, []);

  const results = useDeferredValue(dashboard?.results ?? []);
  const alerts = dashboard?.alerts ?? [];
  const sectorRows = dashboard?.sectors ?? [];
  const topPick = results[0];
  const sum = dashboard?.summary;

  return (
    <div className="space-y-6">
      {/* Filter panel */}
      <FilterPanel
        filters={filters} setFilters={setFilters}
        onScan={() => runScan()} loading={loading}
        onReset={() => { startTransition(() => setFilters(defaultFilters)); runScan(defaultFilters); }}
      />

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]">
          <span className={`h-2 w-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-zinc-500">
            {loading ? 'Scanning universe…' : lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Ready'}
          </span>
        </div>
        {error && <span className="text-[11px] text-rose-400 font-bold">{error}</span>}
      </div>

      {/* KPI row + score distribution */}
      {sum && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
          <StatCard label="Universe"     value={sum.scannedUniverse}                  color="text-white"      icon={Layers} />
          <StatCard label="Returned"     value={sum.returned}                         color="text-cyan-300"   icon={Target} />
          <StatCard label="Multibaggers" value={sum.multibaggerCandidates}            color="text-emerald-400" icon={Flame} />
          <StatCard label="Buy Signals"  value={sum.buySignals}                       color="text-emerald-300" icon={TrendingUp} />
          <StatCard label="Avg Score"    value={sum.avgScore?.toFixed(1) ?? '--'}     color="text-amber-300"  icon={BarChart2} />
          <StatCard label="History"      value={`${sum.historicalPeriodYears}y`}      color="text-zinc-300"   icon={Radar} />
          <ScoreHistogram results={results} />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-[2rem] border border-cyan-500/10 bg-zinc-950/70 p-8 flex items-center gap-3 text-sm text-zinc-400">
          <Activity size={16} className="animate-spin text-cyan-300" />
          Running ultra quant scan across the universe and model stack…
        </div>
      )}

      {/* No results */}
      {dashboard && !loading && results.length === 0 && (
        <div className="rounded-[2rem] border border-amber-500/10 bg-amber-500/5 p-6 text-sm text-zinc-300">
          No stocks matched the current filters. Try lowering Min CAGR, increasing Max Drawdown, or setting Sector to ALL.
        </div>
      )}

      {/* Top pick hero */}
      {topPick && !loading && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          {/* Left: top pick */}
          <div className="rounded-[2rem] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_50%),rgba(9,9,11,0.8)] p-6 shadow-2xl shadow-black/30">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Star size={9} className="fill-emerald-400" /> Top Opportunity
                </p>
                <div className="flex items-center gap-2">
                  <h3 className="text-3xl font-black text-white">{cleanSymbol(topPick.symbol)}</h3>
                  <CagrBadge cagr={topPick.cagr} />
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">{topPick.sector} · {topPick.industry}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-1">AI Prediction</p>
                <p className="text-3xl font-black text-white">{topPick.finalPredictionScore.toFixed(1)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
              {[
                { label: 'CAGR',         value: `${topPick.cagr.toFixed(1)}%`,           color: topPick.cagr >= 20 ? 'text-emerald-400' : 'text-zinc-300' },
                { label: 'Growth Ratio', value: `${topPick.growthRatio.toFixed(2)}x`,    color: topPick.growthRatio >= 5 ? 'text-emerald-400' : 'text-zinc-300' },
                { label: 'Order Imbal.', value: `${topPick.orderImbalance.toFixed(2)}x`, color: topPick.orderImbalance >= 2.5 ? 'text-violet-400' : 'text-zinc-300' },
                { label: 'RL Action',    value: topPick.rlAction,                         color: 'text-cyan-300' },
              ].map(m => (
                <div key={m.label} className="rounded-2xl border border-white/5 bg-black/20 p-3.5">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 mb-1.5">{m.label}</p>
                  <p className={`text-xl font-black ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Model score bars */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                { label: 'Gradient Boost', value: topPick.gradientBoostProb,      color: 'bg-cyan-400',    text: 'text-cyan-300' },
                { label: 'Final Signal',   value: topPick.finalPredictionScore,   color: 'bg-emerald-400', text: 'text-emerald-300' },
                { label: 'Sentiment',      value: topPick.sentimentScore,         color: 'bg-amber-400',   text: 'text-amber-300' },
              ].map(m => (
                <div key={m.label} className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-zinc-500">{m.label}</span>
                    <span className={`text-[11px] font-black ${m.text}`}>{m.value.toFixed(1)}%</span>
                  </div>
                  <ScoreBar value={m.value} color={m.color} />
                </div>
              ))}
            </div>
          </div>

          {/* Right: risk + regime */}
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/5 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30">
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white mb-4">
                <Shield size={13} className="text-amber-300" /> Risk Engine
              </h3>
              <div className="space-y-3 text-[11px]">
                {[
                  { label: 'Drawdown Prob',   value: `${topPick.drawdownProbability.toFixed(1)}%`,  color: 'text-rose-400' },
                  { label: 'Position Size',   value: `${topPick.positionSize.toFixed(0)} shares`,   color: 'text-emerald-400' },
                  { label: 'Max Drawdown',    value: `${topPick.maxDrawdown.toFixed(1)}%`,           color: 'text-amber-400' },
                  { label: 'POC / VAH / VAL', value: `${topPick.volumeProfile?.poc?.toFixed(0) ?? '--'} / ${topPick.volumeProfile?.vah?.toFixed(0) ?? '--'} / ${topPick.volumeProfile?.val?.toFixed(0) ?? '--'}`, color: 'text-zinc-300' },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
                    <span className="text-zinc-500">{m.label}</span>
                    <span className={`font-black ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/5 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30">
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white mb-4">
                <Brain size={13} className="text-violet-300" /> Market State
              </h3>
              <div className="space-y-2.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Regime</span>
                  <RegimePill regime={topPick.marketRegime} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">HMM State</span>
                  <span className="font-black text-amber-300">{topPick.marketState}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">LSTM Next</span>
                  <span className="font-black text-cyan-300">{topPick.lstmPredictedPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hedge fund signals */}
      <HedgeFundSignalRanking dashboard={dashboard?.hedgeFundSignals ?? null} />

      {/* Main content grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px] min-w-0 overflow-hidden">
          <div className="min-w-0 overflow-hidden">
            <StockTable results={results} />
          </div>

          {/* Right sidebar */}
          <div className="space-y-5 min-w-0">
            {/* Sector rotation */}
            <div className="rounded-[2rem] border border-white/5 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30">
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white mb-4">
                <Waves size={13} className="text-emerald-300" /> Sector Rotation
              </h3>
              <div className="space-y-2.5">
                {sectorRows.slice(0, 7).map((s, i) => {
                  const maxScore = sectorRows[0]?.averageScore || 100;
                  return (
                    <div key={s.sector} className="rounded-xl border border-white/5 bg-black/20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-600 font-mono w-4">{i + 1}</span>
                          <span className="text-[11px] font-black text-white">{s.sector}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-emerald-400">{s.averageScore.toFixed(1)}</span>
                          <span className="text-[9px] text-zinc-600">str {s.sectorStrength.toFixed(2)}</span>
                        </div>
                      </div>
                      <ScoreBar value={s.averageScore} max={maxScore} color="bg-emerald-400" />
                      <p className="text-[9px] text-zinc-600 mt-1.5 truncate">{s.leaders.slice(0, 3).map(cleanSymbol).join(' · ')}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alerts */}
            <div className="rounded-[2rem] border border-white/5 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30">
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white mb-4">
                <AlertTriangle size={13} className="text-rose-300" /> Live Alerts
              </h3>
              <div className="space-y-2">
                {alerts.slice(0, 8).map((a, i) => (
                  <div key={`${a.stockSymbol}-${i}`} className="rounded-xl border border-rose-500/10 bg-rose-500/[0.04] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-white">{cleanSymbol(a.stockSymbol)}</span>
                      <span className="text-[10px] font-black text-rose-300">{a.confidenceScore.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-500 shrink-0">{a.signalType}</span>
                      <ScoreBar value={a.confidenceScore} color="bg-rose-400" />
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && <p className="text-[11px] text-zinc-600 text-center py-4">No active alerts</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap */}
      {!loading && results.length > 0 && <UltraQuantHeatmap stocks={results.slice(0, 24)} />}

      {/* Info cards */}
      {!loading && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            { icon: Gauge,    color: 'text-amber-300',   title: 'Multibagger Engine',  body: 'Uses 5-year growth ratio, earnings expansion, revenue expansion, momentum persistence, and controlled drawdown to isolate 5x–10x long-duration growth candidates.' },
            { icon: Radar,    color: 'text-emerald-300', title: 'Market State Models', body: 'Regime detection tags trending, sideways, and high-volatility states while hidden state logic flags accumulation, distribution, breakout, and reversal behavior.' },
            { icon: Sparkles, color: 'text-cyan-300',    title: 'Signal Fusion',       body: 'Final score fuses gradient boost probability, LSTM trajectory, random-forest regime scoring, HMM state conviction, and sentiment into a single trading confidence output.' },
          ].map(c => (
            <div key={c.title} className="rounded-[2rem] border border-white/5 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30">
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white mb-3">
                <c.icon size={13} className={c.color} /> {c.title}
              </h3>
              <p className="text-[11px] leading-5 text-zinc-400">{c.body}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default UltraQuantTab;

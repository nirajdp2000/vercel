import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Brain, ChevronDown, ChevronUp,
  Cpu, Gauge, Layers, Radar, RefreshCw, Shield,
  Sparkles, TrendingUp, Waves, Zap, BarChart2, Target, Filter,
  Star, Award, Flame, TrendingDown, Info, ChevronRight
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
  currentPrice?: number | null;
  dataSource?: string;
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
    <div className={`w-full rounded-full bg-white/5 overflow-hidden ${thin ? 'h-1' : 'h-1.5'}`}>
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
      {action.replace('_', ' ')}
    </span>
  );
}

function RegimePill({ regime }: { regime: string }) {
  const map: Record<string, string> = {
    'Trending Up':             'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'Trending Down':           'text-rose-400 bg-rose-500/10 border-rose-500/20',
    'High Volatility':         'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'Low Volatility Sideways': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    'Sideways':                'text-zinc-400 bg-white/5 border-white/10',
  };
  return (
    <span className={`rounded-lg border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] ${map[regime] ?? 'text-zinc-400 bg-white/5 border-white/10'}`}>
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

/** Mini score distribution histogram */
function ScoreHistogram({ results }: { results: AnalysisResult[] }) {
  if (!results.length) return null;
  const buckets = [0, 0, 0, 0, 0];
  results.forEach(r => { buckets[Math.min(4, Math.floor(r.score / 20))]++; });
  const max = Math.max(...buckets, 1);
  const labels = ['0-20', '20-40', '40-60', '60-80', '80+'];
  const colors = ['bg-zinc-600', 'bg-zinc-500', 'bg-amber-500', 'bg-cyan-400', 'bg-emerald-400'];
  return (
    <div className="flex items-end gap-1 h-8">
      {buckets.map((count, i) => (
        <div key={i} title={`${labels[i]}: ${count}`} className="flex-1 flex flex-col items-center gap-0.5">
          <div className={`w-full rounded-t ${colors[i]}`} style={{ height: `${Math.max(3, (count / max) * 28)}px` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Scan Controls Header ─────────────────────────────────────────────────────

function ScanHeader({ filters, setFilters, onScan, onReset, loading, lastRefreshed, sum }: {
  filters: Filters; setFilters: (f: Filters) => void;
  onScan: () => void; onReset: () => void; loading: boolean;
  lastRefreshed: Date | null;
  sum?: UltraQuantDashboard['summary'];
}) {
  const [showFilters, setShowFilters] = useState(false);
  const inp = 'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40 transition-colors';

  return (
    <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-950/40 via-slate-950/60 to-slate-950/80 shadow-xl shadow-black/30 overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/20">
            <Cpu size={16} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-[13px] font-black text-white tracking-tight">Ultra Quant Analyzer</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em]">Institutional Multibagger Scanner</p>
          </div>
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]">
          <span className={`h-2 w-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-zinc-500">
            {loading ? 'Scanning…' : lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Ready'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(o => !o)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${showFilters ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' : 'border-white/10 bg-black/25 text-zinc-400 hover:text-white'}`}>
            <Filter size={11} /> Filters {showFilters ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          <button onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 hover:text-white hover:border-white/20 transition">
            <RefreshCw size={11} /> Reset
          </button>
          <button onClick={onScan} disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60 shadow-lg shadow-cyan-400/20">
            {loading ? <Activity size={12} className="animate-spin" /> : <Zap size={12} />}
            {loading ? 'Scanning…' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Quick filters row — always visible */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 px-5 py-4">
        <label className="space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">History (yrs)</span>
          <input type="number" min={1} max={15} value={filters.historicalPeriodYears}
            onChange={e => setFilters({ ...filters, historicalPeriodYears: Number(e.target.value) })} className={inp} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Min CAGR (%)</span>
          <input type="number" value={filters.minCagr}
            onChange={e => setFilters({ ...filters, minCagr: Number(e.target.value) })} className={inp} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Sector</span>
          <select value={filters.sectorFilter}
            onChange={e => setFilters({ ...filters, sectorFilter: e.target.value })}
            className={inp + ' appearance-none'}>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Max Drawdown (%)</span>
          <input type="number" value={filters.maxDrawdown}
            onChange={e => setFilters({ ...filters, maxDrawdown: Number(e.target.value) })} className={inp} />
        </label>
      </div>

      {/* Advanced filters — collapsible */}
      {showFilters && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 px-5 pb-4 border-t border-white/5 pt-4">
          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Min Cap (Cr)</span>
            <input type="number" value={filters.minMarketCap}
              onChange={e => setFilters({ ...filters, minMarketCap: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Max Cap (Cr)</span>
            <input type="number" value={filters.maxMarketCap}
              onChange={e => setFilters({ ...filters, maxMarketCap: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Min Volume</span>
            <input type="number" value={filters.minVolume}
              onChange={e => setFilters({ ...filters, minVolume: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Volatility ≤</span>
            <input type="number" step="0.01" value={filters.volatilityThreshold}
              onChange={e => setFilters({ ...filters, volatilityThreshold: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Breakout Freq ≥</span>
            <input type="number" step="0.01" value={filters.breakoutFrequency}
              onChange={e => setFilters({ ...filters, breakoutFrequency: Number(e.target.value) })} className={inp} />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Trend Strength ≥</span>
            <input type="number" step="0.01" value={filters.trendStrengthThreshold}
              onChange={e => setFilters({ ...filters, trendStrengthThreshold: Number(e.target.value) })} className={inp} />
          </label>
        </div>
      )}
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiStrip({ sum, results }: { sum: UltraQuantDashboard['summary']; results: AnalysisResult[] }) {
  const kpis = [
    { label: 'Universe',     value: sum.scannedUniverse.toLocaleString(), icon: Layers,    color: 'text-white',       sub: 'stocks scanned' },
    { label: 'Returned',     value: sum.returned,                         icon: Target,    color: 'text-cyan-300',    sub: 'passed filters' },
    { label: 'Multibaggers', value: sum.multibaggerCandidates,            icon: Flame,     color: 'text-emerald-400', sub: '5x–10x candidates' },
    { label: 'Buy Signals',  value: sum.buySignals,                       icon: TrendingUp,color: 'text-emerald-300', sub: 'BUY + STRONG BUY' },
    { label: 'Avg Score',    value: sum.avgScore?.toFixed(1) ?? '--',     icon: BarChart2, color: 'text-amber-300',   sub: 'composite score' },
    { label: 'History',      value: `${sum.historicalPeriodYears}y`,      icon: Radar,     color: 'text-zinc-300',    sub: 'lookback period' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {kpis.map(k => (
        <div key={k.label} className="rounded-xl border border-white/5 bg-black/25 px-3 py-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500">{k.label}</span>
            <k.icon size={10} className="text-zinc-600" />
          </div>
          <p className={`text-xl font-black leading-none ${k.color}`}>{k.value}</p>
          <p className="text-[8px] text-zinc-600">{k.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Top Pick Card ────────────────────────────────────────────────────────────

function TopPickCard({ stock }: { stock: AnalysisResult }) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-slate-950/60 to-slate-950/80 p-5 space-y-4">
      {/* Badge + symbol */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-cyan-400 mb-1.5">🥇 Top Pick</p>
          <p className="text-2xl font-black text-white leading-none">{cleanSymbol(stock.symbol)}</p>
          <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-[0.15em]">{stock.sector} · {stock.industry}</p>
        </div>
        <SignalPill action={stock.rlAction} />
      </div>

      {/* Score ring area */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 border-cyan-400/30 bg-cyan-400/5 shrink-0">
          <p className="text-xl font-black text-cyan-300 leading-none">{stock.score.toFixed(0)}</p>
          <p className="text-[7px] text-zinc-500 uppercase tracking-[0.1em]">Score</p>
        </div>
        <div className="flex-1 space-y-2">
          {[
            { label: 'AI Signal',  value: stock.finalPredictionScore, color: 'bg-emerald-400', text: 'text-emerald-300' },
            { label: 'Grad Boost', value: stock.gradientBoostProb,    color: 'bg-cyan-400',    text: 'text-cyan-300' },
            { label: 'Sentiment',  value: stock.sentimentScore,       color: 'bg-amber-400',   text: 'text-amber-300' },
          ].map(m => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] text-zinc-500 uppercase tracking-[0.1em]">{m.label}</span>
                <span className={`text-[9px] font-black ${m.text}`}>{m.value.toFixed(1)}%</span>
              </div>
              <ScoreBar value={m.value} color={m.color} thin />
            </div>
          ))}
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {[
          { label: 'CAGR',         value: `${stock.cagr.toFixed(1)}%`,              color: stock.cagr >= 20 ? 'text-emerald-400' : 'text-zinc-300' },
          { label: 'Momentum',     value: `${stock.momentum.toFixed(2)}x`,           color: 'text-cyan-300' },
          { label: 'Max DD',       value: `${stock.maxDrawdown.toFixed(1)}%`,        color: stock.maxDrawdown <= 25 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Order Imbal.', value: `${stock.orderImbalance.toFixed(2)}x`,     color: stock.orderImbalance >= 2.5 ? 'text-violet-400' : 'text-zinc-300' },
          { label: 'DD Prob',      value: `${stock.drawdownProbability.toFixed(1)}%`,color: 'text-rose-400' },
          { label: 'Position',     value: `${stock.positionSize.toFixed(0)} sh`,     color: 'text-emerald-400' },
        ].map(m => (
          <div key={m.label} className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 py-2">
            <p className="text-[8px] text-zinc-500 uppercase tracking-[0.1em] mb-0.5">{m.label}</p>
            <p className={`font-black ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Regime + state */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <RegimePill regime={stock.marketRegime} />
        <span className="text-[9px] text-zinc-500">HMM: <span className="text-amber-300 font-black">{stock.marketState}</span></span>
        <span className="text-[9px] text-zinc-500">LSTM: <span className="text-cyan-300 font-black">{stock.lstmPredictedPrice.toFixed(1)}</span></span>
      </div>
    </div>
  );
}

// ─── Sector Rotation Sidebar ──────────────────────────────────────────────────

function SectorPanel({ sectorRows }: { sectorRows: UltraQuantDashboard['sectors'] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-950/70 p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">
        <Waves size={12} className="text-emerald-300" /> Sector Rotation
      </h3>
      <div className="space-y-2">
        {sectorRows.slice(0, 7).map((s, i) => {
          const maxScore = sectorRows[0]?.averageScore || 100;
          return (
            <div key={s.sector} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-zinc-600 font-mono w-3">{i + 1}</span>
                  <span className="text-[11px] font-black text-white">{s.sector}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-emerald-400">{s.averageScore.toFixed(1)}</span>
                  <span className="text-[8px] text-zinc-600">str {s.sectorStrength.toFixed(2)}</span>
                </div>
              </div>
              <ScoreBar value={s.averageScore} max={maxScore} color="bg-emerald-400" thin />
              <p className="text-[8px] text-zinc-600 mt-1 truncate">{s.leaders.slice(0, 3).map(cleanSymbol).join(' · ')}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Alerts Sidebar ───────────────────────────────────────────────────────────

function AlertsPanel({ alerts }: { alerts: UltraQuantDashboard['alerts'] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-950/70 p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">
        <AlertTriangle size={12} className="text-rose-300" /> Live Alerts
        {alerts.length > 0 && (
          <span className="ml-auto rounded-full bg-rose-500/20 border border-rose-500/30 px-1.5 py-0.5 text-[8px] font-black text-rose-300">{alerts.length}</span>
        )}
      </h3>
      <div className="space-y-1.5">
        {alerts.slice(0, 8).map((a, i) => (
          <div key={`${a.stockSymbol}-${i}`} className="rounded-xl border border-rose-500/10 bg-rose-500/[0.04] px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black text-white">{cleanSymbol(a.stockSymbol)}</span>
              <span className="text-[10px] font-black text-rose-300">{a.confidenceScore.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[8px] uppercase tracking-[0.12em] text-zinc-500 shrink-0">{a.signalType}</span>
              <ScoreBar value={a.confidenceScore} color="bg-rose-400" thin />
            </div>
          </div>
        ))}
        {alerts.length === 0 && <p className="text-[11px] text-zinc-600 text-center py-3">No active alerts</p>}
      </div>
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

  const signalTabs: Array<{ key: SignalFilter; label: string; active: string; inactive: string }> = [
    { key: 'ALL',        label: 'All',         active: 'bg-white/10 text-white border-white/20',                    inactive: 'text-zinc-400 border-white/8' },
    { key: 'STRONG_BUY', label: 'Strong Buy',  active: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30', inactive: 'text-emerald-500/60 border-emerald-500/15' },
    { key: 'BUY',        label: 'Buy',         active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', inactive: 'text-emerald-500/50 border-emerald-500/10' },
    { key: 'HOLD',       label: 'Hold',        active: 'bg-amber-500/15 text-amber-300 border-amber-500/20',       inactive: 'text-amber-500/50 border-amber-500/10' },
    { key: 'SELL',       label: 'Sell',        active: 'bg-rose-500/15 text-rose-300 border-rose-500/20',          inactive: 'text-rose-500/50 border-rose-500/10' },
  ];

  const cols: Array<{ key: keyof AnalysisResult; label: string; tip: string }> = [
    { key: 'score',                label: 'Score', tip: 'Composite quant score' },
    { key: 'cagr',                 label: 'CAGR',  tip: 'Compound annual growth rate' },
    { key: 'momentum',             label: 'Mom',   tip: 'Price momentum multiplier' },
    { key: 'finalPredictionScore', label: 'AI %',  tip: 'AI prediction confidence' },
    { key: 'orderImbalance',       label: 'OI',    tip: 'Order imbalance ratio' },
    { key: 'maxDrawdown',          label: 'DD%',   tip: 'Max historical drawdown' },
  ];

  const SortIcon = ({ k }: { k: keyof AnalysisResult }) =>
    sortKey === k
      ? (sortDir === 'desc' ? <ChevronDown size={9} className="text-cyan-400 inline ml-0.5" /> : <ChevronUp size={9} className="text-cyan-400 inline ml-0.5" />)
      : <ChevronDown size={9} className="opacity-20 inline ml-0.5" />;

  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-950/70 shadow-xl shadow-black/20 overflow-hidden">
      {/* Table header controls */}
      <div className="border-b border-white/5 px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white shrink-0">
            <TrendingUp size={13} className="text-cyan-300" /> Stock Results
          </h3>
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-1.5 flex-1 max-w-[220px]">
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
              className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${signalFilter === tab.key ? tab.active : tab.inactive + ' hover:opacity-100 opacity-70'}`}>
              {tab.label} <span className="opacity-60">({counts[tab.key]})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[42rem] overflow-y-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="sticky top-0 bg-zinc-950/98 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500 border-b border-white/5">
            <tr>
              <th className="px-4 py-3">Stock</th>
              {cols.map(c => (
                <th key={String(c.key)} title={c.tip} className="cursor-pointer px-3 py-3 text-left hover:text-zinc-300 transition-colors"
                  onClick={() => { setSortKey(c.key); setSortDir(d => sortKey === c.key ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }}>
                  {c.label}<SortIcon k={c.key} />
                </th>
              ))}
              <th className="px-3 py-3">Price</th>
              <th className="px-3 py-3">Regime</th>
              <th className="px-3 py-3">Signal</th>
              <th className="px-3 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((stock, i) => (
              <React.Fragment key={stock.symbol}>
                <tr
                  onClick={() => setExpanded(expanded === stock.symbol ? null : stock.symbol)}
                  className={`cursor-pointer transition-colors hover:bg-white/[0.025] ${expanded === stock.symbol ? 'bg-cyan-500/[0.04]' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 shrink-0 flex justify-center"><RankBadge rank={i + 1} /></div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-black text-white">{cleanSymbol(stock.symbol)}</p>
                          <CagrBadge cagr={stock.cagr} />
                          {(stock as any).dataSource === 'real'
                            ? <span className="text-[8px] font-black px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 tracking-widest">LIVE</span>
                            : <span className="text-[8px] font-black px-1 py-0.5 rounded bg-zinc-700/40 text-zinc-500 border border-zinc-600/30 tracking-widest">SIM</span>
                          }
                        </div>
                        <p className="text-[9px] text-zinc-500">{stock.sector}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 w-20">
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-cyan-300">{stock.score.toFixed(1)}</span>
                      <ScoreBar value={stock.score} color="bg-cyan-400" thin />
                    </div>
                  </td>
                  <td className={`px-3 py-3 text-[11px] font-bold ${stock.cagr >= 20 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {stock.cagr.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-[11px] text-zinc-300 font-bold">{stock.momentum.toFixed(2)}x</td>
                  <td className="px-3 py-3 w-20">
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-emerald-400">{stock.finalPredictionScore.toFixed(1)}%</span>
                      <ScoreBar value={stock.finalPredictionScore} color="bg-emerald-400" thin />
                    </div>
                  </td>
                  <td className={`px-3 py-3 text-[11px] font-bold ${stock.orderImbalance >= 2.5 ? 'text-violet-400' : 'text-zinc-400'}`}>
                    {stock.orderImbalance.toFixed(2)}x
                  </td>
                  <td className={`px-3 py-3 text-[11px] font-bold ${stock.maxDrawdown <= 25 ? 'text-emerald-400' : stock.maxDrawdown <= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {stock.maxDrawdown.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3"><RegimePill regime={stock.marketRegime} /></td>
                  <td className="px-3 py-3">
                    <span className="text-[11px] font-black text-amber-300">
                      {(stock as any).currentPrice != null ? `₹${Number((stock as any).currentPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3"><SignalPill action={stock.rlAction} /></td>
                  <td className="px-3 py-3 text-zinc-600">
                    {expanded === stock.symbol ? <ChevronUp size={12} /> : <ChevronRight size={12} />}
                  </td>
                </tr>
                {expanded === stock.symbol && (
                  <tr className="bg-cyan-500/[0.03] border-b border-cyan-500/10">
                    <td colSpan={11} className="px-4 py-4">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6 text-[10px]">
                        {[
                          { label: 'Growth Ratio',    value: `${stock.growthRatio.toFixed(2)}x`,                    color: 'text-emerald-400' },
                          { label: 'Earnings Growth', value: `${stock.earningsGrowth.toFixed(1)}%`,                 color: 'text-cyan-400' },
                          { label: 'Revenue Growth',  value: `${stock.revenueGrowth.toFixed(1)}%`,                  color: 'text-cyan-300' },
                          { label: 'Volume Growth',   value: `${stock.volumeGrowth.toFixed(1)}%`,                   color: 'text-amber-400' },
                          { label: 'Sentiment',       value: `${stock.sentimentScore.toFixed(1)}%`,                 color: 'text-violet-400' },
                          { label: 'Gradient Boost',  value: `${stock.gradientBoostProb.toFixed(1)}%`,              color: 'text-white' },
                          { label: 'LSTM Price',      value: stock.lstmPredictedPrice.toFixed(2),                   color: 'text-cyan-300' },
                          { label: 'HMM State',       value: stock.marketState,                                     color: 'text-amber-300' },
                          { label: 'Drawdown Prob',   value: `${stock.drawdownProbability.toFixed(1)}%`,            color: 'text-rose-400' },
                          { label: 'Position Size',   value: `${stock.positionSize.toFixed(0)} sh`,                 color: 'text-emerald-400' },
                          { label: 'POC/VAH/VAL',     value: `${stock.volumeProfile?.poc?.toFixed(0) ?? '--'} / ${stock.volumeProfile?.vah?.toFixed(0) ?? '--'} / ${stock.volumeProfile?.val?.toFixed(0) ?? '--'}`, color: 'text-zinc-300' },
                          { label: 'Breakout Freq',   value: `${(stock.breakoutFrequency * 100).toFixed(1)}%`,      color: 'text-amber-400' },
                        ].map(m => (
                          <div key={m.label} className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
                            <p className="text-zinc-500 uppercase tracking-[0.1em] mb-0.5 text-[8px]">{m.label}</p>
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
    <div className="space-y-5">

      {/* ── 1. Scan Controls ── */}
      <ScanHeader
        filters={filters} setFilters={setFilters}
        onScan={() => runScan()} loading={loading}
        onReset={() => { startTransition(() => setFilters(defaultFilters)); runScan(defaultFilters); }}
        lastRefreshed={lastRefreshed} sum={sum}
      />

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-400 font-bold">
          {error}
        </div>
      )}

      {/* ── 2. KPI Strip ── */}
      {sum && <KpiStrip sum={sum} results={results} />}

      {/* ── 3. Loading skeleton ── */}
      {loading && (
        <div className="rounded-2xl border border-cyan-500/10 bg-zinc-950/70 p-8 flex items-center gap-3 text-sm text-zinc-400">
          <Activity size={16} className="animate-spin text-cyan-300" />
          Running ultra quant scan across the universe and model stack…
        </div>
      )}

      {/* ── 4. No results ── */}
      {dashboard && !loading && results.length === 0 && (
        <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-6 text-[12px] text-amber-400 font-bold text-center">
          No stocks matched the current filters. Try relaxing CAGR or drawdown thresholds.
        </div>
      )}

      {/* ── 5. Main content: table + sidebar ── */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">

          {/* Left: stock table */}
          <div className="min-w-0 overflow-hidden space-y-5">
            <StockTable results={results} />

            {/* Heatmap below table */}
            <UltraQuantHeatmap stocks={results.slice(0, 24)} />

            {/* Hedge fund signals */}
            <HedgeFundSignalRanking dashboard={dashboard?.hedgeFundSignals ?? null} />
          </div>

          {/* Right sidebar */}
          <div className="space-y-4 min-w-0">
            {/* Top pick card */}
            {topPick && <TopPickCard stock={topPick} />}

            {/* Score distribution */}
            <div className="rounded-2xl border border-white/5 bg-black/25 px-4 py-3 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Score Distribution</p>
              <ScoreHistogram results={results} />
              <div className="flex gap-1 mt-1">
                {['0-20','20-40','40-60','60-80','80+'].map(l => (
                  <span key={l} className="flex-1 text-center text-[7px] text-zinc-600">{l}</span>
                ))}
              </div>
            </div>

            {/* Sector rotation */}
            <SectorPanel sectorRows={sectorRows} />

            {/* Alerts */}
            <AlertsPanel alerts={alerts} />
          </div>
        </div>
      )}

      {/* ── 6. Info footer ── */}
      {!loading && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[
            { icon: Gauge,    color: 'text-amber-300',   title: 'Multibagger Engine',  body: 'Uses 5-year growth ratio, earnings expansion, revenue expansion, momentum persistence, and controlled drawdown to isolate 5x–10x long-duration growth candidates.' },
            { icon: Radar,    color: 'text-emerald-300', title: 'Market State Models', body: 'Regime detection tags trending, sideways, and high-volatility states while hidden state logic flags accumulation, distribution, breakout, and reversal behavior.' },
            { icon: Sparkles, color: 'text-cyan-300',    title: 'Signal Fusion',       body: 'Final score fuses gradient boost probability, LSTM trajectory, random-forest regime scoring, HMM state conviction, and sentiment into a single trading confidence output.' },
          ].map(c => (
            <div key={c.title} className="rounded-2xl border border-white/5 bg-zinc-950/60 p-4">
              <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white mb-2">
                <c.icon size={12} className={c.color} /> {c.title}
              </h3>
              <p className="text-[10px] leading-5 text-zinc-500">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UltraQuantTab;

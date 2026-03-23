import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Markdown from 'react-markdown';
import {
  Activity,
  AlertTriangle,
  BarChartHorizontal,
  BrainCircuit,
  Cpu,
  Database,
  MessageSquare,
  Network,
  Shield,
  Target,
  TrendingUp,
  Waves,
  Zap
} from 'lucide-react';
import { InstitutionalService, OrderBook, SectorRotationNode, VolumeProfileNode } from '../services/InstitutionalService';
import { fetchJson } from '../lib/api';

interface InstitutionalAnalyticsProps {
  symbol: string;
  instrumentKey?: string;
  candles: Array<{ close: number; volume: number }>;
  onAnalyze?: () => void;
  theme?: 'dark' | 'light';
  aiAnalysis?: string | null;
  aiHedgeFund?: any;
  aiLoading?: boolean;
  aiConfidence?: number;
  aiRecommendation?: string | null;
  aiLastUpdated?: string | null;
  aiSources?: Array<{ title?: string; url?: string }>;
}

type TabId = 'order-flow' | 'volume-profile' | 'microstructure' | 'sector-rotation' | 'sentiment';

const DEFAULT_STOCKS = [
  { symbol: 'RELIANCE', key: 'NSE_EQ|INE002A01018', label: 'Reliance' },
  { symbol: 'HDFCBANK', key: 'NSE_EQ|INE040A01034', label: 'HDFC Bank' },
  { symbol: 'INFY',     key: 'NSE_EQ|INE009A01021', label: 'Infosys' },
  { symbol: 'TCS',      key: 'NSE_EQ|INE467B01029', label: 'TCS' },
  { symbol: 'ICICIBANK',key: 'NSE_EQ|INE090A01021', label: 'ICICI Bank' },
];


const emptyVolumeProfile = {
  profile: [] as VolumeProfileNode[],
  poc: 0,
  vah: 0,
  val: 0
};

// ─── Hedge-Fund Structured Output Panel ──────────────────────────────────────
function SignalBadge({ signal }: { signal: string }) {
  const s = (signal ?? '').toUpperCase();
  const cls = s === 'BUY'
    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
    : s === 'SELL'
      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
  return <span className={`rounded-full px-4 py-1.5 text-sm font-black uppercase tracking-[0.2em] ${cls}`}>{s || 'HOLD'}</span>;
}

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/5 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className={`mt-2 text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 mb-3">{children}</h4>;
}

function HedgeFundPanel({ hf, sources, panelClass, subPanelClass, mutedClass, softClass, isLight }: {
  hf: any; sources: any[]; panelClass: string; subPanelClass: string; mutedClass: string; softClass: string; isLight: boolean;
}) {
  const kl = hf.keyLevels ?? {};
  const rr = hf.riskReward ?? {};
  const ti = hf.technicalIndicators ?? {};
  const inst = hf.institutionalFlow ?? {};
  const sc = hf.sectorContext ?? {};
  const mtf = hf.multiTimeframeConfluence ?? {};
  const bull = hf.scenarios?.bull ?? {};
  const bear = hf.scenarios?.bear ?? {};
  const trend = hf.trendAnalysis ?? {};

  const signalColor = (hf.signal ?? '').toUpperCase() === 'BUY'
    ? 'text-emerald-400' : (hf.signal ?? '').toUpperCase() === 'SELL'
      ? 'text-rose-400' : 'text-amber-300';

  return (
    <div className="space-y-5">
      {/* Hero row */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/5 border border-white/5 p-5">
        <SignalBadge signal={hf.signal ?? 'HOLD'} />
        <div className="flex-1 min-w-0">
          <p className={`text-base font-bold ${signalColor}`}>{hf.signalReason}</p>
          <p className="mt-1 text-[11px] text-white/40">{hf.executiveSummary}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-2xl font-black text-white">{hf.confidence ?? 0}%</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Confidence</span>
        </div>
      </div>

      {/* Market regime + MTF confluence */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Market Regime" value={hf.marketRegime ?? '—'} color="text-cyan-300" />
        <StatCard label="Trend" value={`${trend.direction ?? '—'} · ${trend.strength ?? '—'}`} color="text-white" />
        <StatCard label="MTF Confluence" value={`${mtf.confluenceScore ?? 0}%`} sub={mtf.confluenceSummary} color="text-amber-300" />
        <StatCard label="RSI-14" value={ti.rsi14 ?? '—'} sub={ti.rsiSignal} color={Number(ti.rsi14) > 70 ? 'text-rose-400' : Number(ti.rsi14) < 30 ? 'text-emerald-400' : 'text-white'} />
      </div>

      {/* Key levels + Risk/Reward */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`rounded-2xl p-5 ${panelClass}`}>
          <SectionTitle>Key Levels</SectionTitle>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { l: 'S2', v: kl.s2, c: 'text-rose-500' },
              { l: 'S1', v: kl.s1, c: 'text-rose-400' },
              { l: 'Pivot', v: kl.pivot, c: 'text-white' },
              { l: 'R1', v: kl.r1, c: 'text-emerald-400' },
              { l: 'R2', v: kl.r2, c: 'text-emerald-500' },
              { l: 'Stop Loss', v: rr.stopLoss ?? kl.stopLoss, c: 'text-rose-400' },
            ].map(({ l, v, c }) => (
              <div key={l} className={`rounded-xl p-3 ${subPanelClass}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">{l}</p>
                <p className={`mt-1 text-sm font-black ${c}`}>{v != null ? `₹${Number(v).toFixed(2)}` : '—'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl p-5 ${panelClass}`}>
          <SectionTitle>Risk / Reward</SectionTitle>
          <div className="space-y-2">
            {[
              { l: 'Entry Zone', v: rr.entryZone ?? '—' },
              { l: 'Target 1', v: rr.target1 != null ? `₹${Number(rr.target1).toFixed(2)}` : '—' },
              { l: 'Target 2', v: rr.target2 != null ? `₹${Number(rr.target2).toFixed(2)}` : '—' },
              { l: 'R:R Ratio', v: rr.rrRatio ?? '—' },
              { l: 'Max Risk', v: rr.maxRiskPct != null ? `${rr.maxRiskPct}%` : '—' },
              { l: 'Kelly Size', v: rr.kellyPositionSizePct != null ? `${rr.kellyPositionSizePct}% of capital` : '—' },
            ].map(({ l, v }) => (
              <div key={l} className="flex items-center justify-between text-sm">
                <span className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em]">{l}</span>
                <span className="font-black text-white">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Technical indicators + Institutional flow */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`rounded-2xl p-5 ${panelClass}`}>
          <SectionTitle>Technical Indicators</SectionTitle>
          <div className="space-y-2">
            {[
              { l: 'Volume Signal', v: ti.volumeSignal ?? '—' },
              { l: 'Volume Ratio', v: ti.volumeRatio != null ? `${ti.volumeRatio}x` : '—' },
              { l: 'ATR-14', v: ti.atr14 != null ? `₹${ti.atr14}` : '—' },
              { l: 'Candle Pattern', v: ti.candlePattern ?? '—' },
              { l: 'MACD Signal', v: ti.macdSignal ?? '—' },
              { l: 'EMA Alignment', v: trend.ema9VsEma21 ?? '—' },
            ].map(({ l, v }) => (
              <div key={l} className="flex items-center justify-between text-sm">
                <span className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em]">{l}</span>
                <span className="font-black text-white">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl p-5 ${panelClass}`}>
          <SectionTitle>Institutional Flow</SectionTitle>
          <div className="space-y-2">
            {[
              { l: 'Phase', v: inst.phase ?? '—' },
              { l: 'Smart Money Bias', v: inst.smartMoneyBias ?? '—' },
              { l: 'Order Flow', v: inst.orderFlowImbalance ?? '—' },
              { l: 'FII/DII Context', v: inst.fiiDiiContext ?? '—' },
              { l: 'Sector Bias', v: sc.sectorBias ?? '—' },
              { l: 'Rotation Signal', v: sc.rotationSignal ?? '—' },
            ].map(({ l, v }) => (
              <div key={l} className="flex items-start justify-between gap-4 text-sm">
                <span className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] shrink-0">{l}</span>
                <span className="font-bold text-white text-right text-[12px]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bull / Bear scenarios */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Bull Case</SectionTitle>
            <span className="text-emerald-400 font-black text-sm">{bull.probability ?? 0}%</span>
          </div>
          <p className="text-[11px] text-white/60 mb-2">{bull.trigger ?? '—'}</p>
          <p className="text-emerald-400 font-black">Target ₹{bull.target != null ? Number(bull.target).toFixed(2) : '—'}</p>
        </div>
        <div className="rounded-2xl bg-rose-500/5 border border-rose-500/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Bear Case</SectionTitle>
            <span className="text-rose-400 font-black text-sm">{bear.probability ?? 0}%</span>
          </div>
          <p className="text-[11px] text-white/60 mb-2">{bear.trigger ?? '—'}</p>
          <p className="text-rose-400 font-black">Target ₹{bear.target != null ? Number(bear.target).toFixed(2) : '—'}</p>
        </div>
      </div>

      {/* Psychological audit + Action plan */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {hf.psychologicalAudit && (
          <div className={`rounded-2xl p-5 ${panelClass}`}>
            <SectionTitle>Psychological Audit</SectionTitle>
            <p className="text-[12px] text-white/60 leading-6">{hf.psychologicalAudit}</p>
          </div>
        )}
        {hf.actionPlan && (
          <div className={`rounded-2xl p-5 ${panelClass}`}>
            <SectionTitle>Action Plan</SectionTitle>
            <p className="text-[12px] text-white/60 leading-6">{hf.actionPlan}</p>
          </div>
        )}
      </div>

      {/* Catalyst calendar */}
      {hf.catalystCalendar && (
        <div className={`rounded-2xl p-4 ${panelClass}`}>
          <SectionTitle>Catalyst Calendar</SectionTitle>
          <p className="text-[12px] text-white/60">{hf.catalystCalendar}</p>
        </div>
      )}

      {/* Grounding sources */}
      {sources.length > 0 && (
        <div className={`rounded-2xl p-5 ${panelClass}`}>
          <SectionTitle>Grounding Sources</SectionTitle>
          <div className="space-y-2">
            {sources.slice(0, 4).map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer"
                className={`block rounded-xl px-3 py-2 text-sm transition ${subPanelClass} hover:border-cyan-400/30`}>
                <p className="font-bold text-white/80">{s.title ?? 'Source'}</p>
                <p className="mt-0.5 text-[10px] break-all text-white/30">{s.url}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export const InstitutionalAnalytics: React.FC<InstitutionalAnalyticsProps> = ({
  symbol,
  instrumentKey,
  candles,
  onAnalyze,
  theme = 'dark',
  aiAnalysis,
  aiHedgeFund,
  aiLoading = false,
  aiConfidence = 0,
  aiRecommendation,
  aiLastUpdated,
  aiSources = []
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('order-flow');
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] });
  const [imbalanceData, setImbalanceData] = useState<{ imbalance: number; signal: string; score: number } | null>(null);
  const [volumeProfile, setVolumeProfile] = useState<{
    profile: VolumeProfileNode[];
    poc: number;
    vah: number;
    val: number;
  }>(emptyVolumeProfile);
  const [microstructure, setMicrostructure] = useState({ frequency: 0, spread: 0, accumulation: 0 });
  const [sectorRotation, setSectorRotation] = useState<SectorRotationNode[]>([]);
  const [sentimentScore, setSentimentScore] = useState(72);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Self-contained stock selector — used when no stock is selected on Analytics tab
  const [selfStock, setSelfStock] = useState(DEFAULT_STOCKS[0]);
  const [selfCandles, setSelfCandles] = useState<Array<{ close: number; volume: number }>>([]);
  const [selfLoading, setSelfLoading] = useState(false);

  // Effective values: prefer prop candles/symbol, fall back to self-fetched
  const effectiveCandles = candles.length > 0 ? candles : selfCandles;
  const effectiveSymbol  = candles.length > 0 ? symbol : selfStock.symbol;
  const effectiveKey     = candles.length > 0 ? instrumentKey : selfStock.key;

  // Auto-fetch candles for the self-selected stock when prop candles are absent
  const fetchSelfCandles = useCallback(async (stock: typeof DEFAULT_STOCKS[0]) => {
    setSelfLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const from  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const url   = `/api/stocks/historical?instrumentKey=${encodeURIComponent(stock.key)}&interval=day&fromDate=${from}&toDate=${today}`;
      const resp  = await fetchJson<{ candles: Array<[string, number, number, number, number, number]> }>(url);
      if (resp?.candles?.length) {
        setSelfCandles(resp.candles.map(c => ({ close: c[4], volume: c[5] })));
      }
    } catch (_e) {
      // silently ignore — will show empty state
    } finally {
      setSelfLoading(false);
    }
  }, []);

  // Fetch on mount and whenever selfStock changes (only when prop candles are absent)
  useEffect(() => {
    if (candles.length === 0) {
      fetchSelfCandles(selfStock);
    }
  }, [selfStock, candles.length, fetchSelfCandles]);

  const isLight = theme === 'light';
  const shellClass = isLight
    ? 'bg-white/90 border border-zinc-200 text-zinc-900 shadow-[0_30px_90px_rgba(15,23,42,0.12)]'
    : 'bg-[#0a0a0a] border border-white/5 text-white shadow-2xl';
  const panelClass = isLight
    ? 'bg-zinc-50 border border-zinc-200'
    : 'bg-white/5 border border-white/5';
  const subPanelClass = isLight
    ? 'bg-white border border-zinc-200'
    : 'bg-black/20 border border-white/5';
  const mutedClass = isLight ? 'text-zinc-500' : 'text-white/50';
  const softClass = isLight ? 'text-zinc-600' : 'text-white/40';

  useEffect(() => {
    if (!effectiveCandles.length) {
      setOrderBook({ bids: [], asks: [] });
      setImbalanceData(null);
      setVolumeProfile(emptyVolumeProfile);
      return;
    }

    let active = true;
    const lastPrice = effectiveCandles[effectiveCandles.length - 1].close;

    const loadOrderFlow = async () => {
      try {
        const ikParam = effectiveKey ? `&instrumentKey=${encodeURIComponent(effectiveKey)}` : '';
        const [book, profile, micro, rotation] = await Promise.all([
          fetchJson<OrderBook>(`/api/institutional/order-book?lastPrice=${lastPrice}${ikParam}`),
          InstitutionalService.calculateVolumeProfile(effectiveCandles, 2),
          fetchJson<{ frequency: number; spread: number; accumulation: number }>(`/api/institutional/microstructure?lastPrice=${lastPrice}${ikParam}`),
          InstitutionalService.getSectorRotation()
        ]);
        const imbalance = await InstitutionalService.calculateOrderImbalance(book);
        if (!active) {
          return;
        }
        setOrderBook(book);
        setImbalanceData(imbalance);
        setVolumeProfile(profile);
        setMicrostructure(micro);
        setSectorRotation(rotation);
        setSentimentScore(Math.min(95, Math.max(35, Math.round((micro.accumulation + (rotation[0]?.strength ?? 50)) / 2))));
        setLoadError(null);
      } catch (error: any) {
        if (active) {
          setLoadError(error.message || 'Unable to refresh institutional analytics');
        }
      }
    };

    loadOrderFlow();
    const intervalId = window.setInterval(loadOrderFlow, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [effectiveCandles.length, effectiveSymbol, effectiveKey]);

  const derived = useMemo(() => {
    const bestBid = orderBook.bids[0]?.price ?? 0;
    const bestAsk = orderBook.asks[0]?.price ?? 0;
    const support = [...orderBook.bids].sort((left, right) => right.volume - left.volume)[0];
    const resistance = [...orderBook.asks].sort((left, right) => right.volume - left.volume)[0];
    const spread = Math.max(0, bestAsk - bestBid);
    const accumulationBias = ((imbalanceData?.score ?? 50) * 0.6) + (microstructure.accumulation * 0.4);

    return {
      bestBid,
      bestAsk,
      support,
      resistance,
      spread,
      accumulationBias,
      liquidityGap: spread + ((resistance?.price ?? bestAsk) - (support?.price ?? bestBid))
    };
  }, [imbalanceData, microstructure.accumulation, orderBook]);

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: 'order-flow', label: 'Order Flow', icon: Activity },
    { id: 'volume-profile', label: 'Volume Profile', icon: BarChartHorizontal },
    { id: 'microstructure', label: 'Microstructure', icon: Cpu },
    { id: 'sector-rotation', label: 'Sector Rotation', icon: Waves },
    { id: 'sentiment', label: 'Sentiment', icon: BrainCircuit }
  ];

  const heatmapData = [...orderBook.bids, ...orderBook.asks].sort((left, right) => left.price - right.price);
  const canAnalyze = Boolean(onAnalyze && effectiveCandles.length > 0);

  return (
    <div className={`overflow-hidden rounded-[2rem] ${shellClass}`}>
      <div className={`border-b px-6 py-6 ${isLight ? 'border-zinc-200 bg-gradient-to-r from-emerald-500/10 to-cyan-500/5' : 'border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent'}`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Institutional Intelligence Engine</h2>
                <p className={`text-[11px] font-mono uppercase tracking-[0.25em] ${mutedClass}`}>
                  Order flow, liquidity, volume profile, and sector sponsorship
                </p>
              </div>
            </div>
            {loadError && (
              <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/10 text-amber-300'}`}>
                <AlertTriangle size={14} />
                {loadError}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Stock selector — only shown when no stock is selected on Analytics tab */}
            {candles.length === 0 && (
              <select
                value={selfStock.symbol}
                onChange={e => {
                  const s = DEFAULT_STOCKS.find(d => d.symbol === e.target.value) ?? DEFAULT_STOCKS[0];
                  setSelfStock(s);
                }}
                className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.15em] border outline-none cursor-pointer ${
                  isLight
                    ? 'bg-white border-zinc-300 text-zinc-800'
                    : 'bg-white/5 border-white/10 text-white'
                }`}
              >
                {DEFAULT_STOCKS.map(s => (
                  <option key={s.symbol} value={s.symbol}>{s.label}</option>
                ))}
              </select>
            )}
            <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isLight ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-500/10 text-cyan-300'}`}>
              {effectiveSymbol} Desk
              {selfLoading && <span className="ml-1 opacity-60">…</span>}
            </div>
            <button
              onClick={onAnalyze}
              disabled={!canAnalyze || aiLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiLoading ? <Activity size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
              {aiLoading ? 'Scanning' : 'AI Deep Scan'}
            </button>
          </div>
        </div>

        {selfLoading && (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-[11px] font-bold ${isLight ? 'bg-zinc-100 text-zinc-700' : 'bg-white/5 text-zinc-400'}`}>
            Loading {selfStock.label} data…
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className={`rounded-2xl p-4 ${panelClass}`}>
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Support Cluster</p>
            <p className="mt-2 text-lg font-black text-emerald-400">Rs {(derived.support?.price ?? derived.bestBid).toFixed(2)}</p>
            <p className={`text-[10px] ${mutedClass}`}>{(derived.support?.volume ?? 0).toLocaleString()} bid volume</p>
          </div>
          <div className={`rounded-2xl p-4 ${panelClass}`}>
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Resistance Cluster</p>
            <p className="mt-2 text-lg font-black text-rose-400">Rs {(derived.resistance?.price ?? derived.bestAsk).toFixed(2)}</p>
            <p className={`text-[10px] ${mutedClass}`}>{(derived.resistance?.volume ?? 0).toLocaleString()} ask volume</p>
          </div>
          <div className={`rounded-2xl p-4 ${panelClass}`}>
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Liquidity Gap</p>
            <p className="mt-2 text-lg font-black text-cyan-400">{derived.liquidityGap.toFixed(2)}</p>
            <p className={`text-[10px] ${mutedClass}`}>Spread plus cluster separation</p>
          </div>
          <div className={`rounded-2xl p-4 ${panelClass}`}>
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Accumulation Bias</p>
            <p className="mt-2 text-lg font-black text-amber-300">{derived.accumulationBias.toFixed(0)}</p>
            <p className={`text-[10px] ${mutedClass}`}>{derived.accumulationBias >= 75 ? 'Institutional accumulation' : 'Balanced participation'}</p>
          </div>
        </div>
      </div>

      {(aiAnalysis || aiLoading) && (
        <div className={`border-b px-6 py-6 ${isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-white/5 bg-black/20'}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em]">Institutional AI Deep Scan</h3>
              <p className={`mt-1 text-[11px] ${mutedClass}`}>
                {aiLastUpdated ? `Updated ${aiLastUpdated}` : 'Awaiting scan output'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {aiRecommendation && (
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                  aiRecommendation === 'BUY'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : aiRecommendation === 'SELL'
                      ? 'bg-rose-500/15 text-rose-400'
                      : isLight
                        ? 'bg-zinc-200 text-zinc-700'
                        : 'bg-white/10 text-zinc-300'
                }`}>
                  {aiRecommendation}
                </span>
              )}
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isLight ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-500/10 text-cyan-300'}`}>
                Confidence {aiConfidence}%
              </span>
            </div>
          </div>

          {aiLoading ? (
            <div className={`rounded-2xl p-5 ${panelClass}`}>
              <div className="flex items-center gap-3">
                <Activity size={18} className="animate-spin text-emerald-400" />
                <span className={mutedClass}>Running hedge-fund-grade analysis across candles, technicals, and quant context…</span>
              </div>
            </div>
          ) : aiHedgeFund ? (
            <HedgeFundPanel hf={aiHedgeFund} sources={aiSources} panelClass={panelClass} subPanelClass={subPanelClass} mutedClass={mutedClass} softClass={softClass} isLight={isLight} />
          ) : aiAnalysis ? (
            <div className={`rounded-2xl p-5 ${panelClass}`}>
              <div className={`prose max-w-none ${isLight ? 'prose-zinc' : 'prose-invert'}`}>
                <Markdown>{aiAnalysis}</Markdown>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className={`flex flex-wrap border-b ${isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-white/5 bg-white/2'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex min-w-[8rem] flex-1 items-center justify-center gap-2 px-3 py-4 text-[11px] font-black uppercase tracking-[0.18em] transition ${
              activeTab === tab.id
                ? 'text-emerald-400'
                : isLight
                  ? 'text-zinc-500 hover:text-zinc-900'
                  : 'text-white/40 hover:text-white/70'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && <motion.div layoutId="institutional-active-tab" className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-500" />}
          </button>
        ))}
      </div>

      <div className="min-h-[420px] p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'order-flow' && (
            <motion.div key="order-flow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className={`rounded-2xl p-5 ${panelClass}`}>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Order Imbalance</p>
                      <p className="mt-2 text-3xl font-black text-emerald-400">{(imbalanceData?.imbalance ?? 0).toFixed(2)}x</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">{imbalanceData?.signal ?? 'NEUTRAL'}</p>
                      <p className={`text-[10px] ${mutedClass}`}>Score {(imbalanceData?.score ?? 0).toFixed(0)}</p>
                    </div>
                  </div>
                  <div className={`mt-4 h-2 overflow-hidden rounded-full ${isLight ? 'bg-zinc-200' : 'bg-white/5'}`}>
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700" style={{ width: `${Math.min(100, imbalanceData?.score ?? 0)}%` }} />
                  </div>
                </div>

                <div className={`rounded-2xl p-5 ${panelClass}`}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className={`rounded-xl p-3 ${subPanelClass}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Best Bid</p>
                      <p className="mt-2 text-sm font-black text-emerald-400">Rs {derived.bestBid.toFixed(2)}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${subPanelClass}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Best Ask</p>
                      <p className="mt-2 text-sm font-black text-rose-400">Rs {derived.bestAsk.toFixed(2)}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${subPanelClass}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Spread</p>
                      <p className="mt-2 text-sm font-black text-cyan-400">{derived.spread.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl p-5 ${panelClass}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em]">Liquidity Heatmap</h3>
                    <p className={`mt-1 text-[11px] ${mutedClass}`}>Support clusters, resistance stacks, and price voids</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/10 text-blue-300'}`}>
                    <Network size={12} className="inline-block mr-1" />
                    Live
                  </div>
                </div>

                <div className="mt-5 h-[290px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={heatmapData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="price" type="number" domain={['auto', 'auto']} hide />
                      <Tooltip contentStyle={{ backgroundColor: isLight ? '#ffffff' : '#111827', border: `1px solid ${isLight ? '#e4e4e7' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px' }} />
                      <Bar dataKey="volume" radius={[0, 6, 6, 0]}>
                        {heatmapData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.price <= (effectiveCandles[effectiveCandles.length - 1]?.close ?? 0) ? '#10b981' : '#f43f5e'} fillOpacity={0.32} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'volume-profile' && (
            <motion.div key="volume-profile" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className={`rounded-2xl p-4 ${panelClass}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>POC</p>
                  <p className="mt-2 text-2xl font-black text-emerald-400">Rs {volumeProfile.poc.toFixed(2)}</p>
                </div>
                <div className={`rounded-2xl p-4 ${panelClass}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>VAH</p>
                  <p className="mt-2 text-2xl font-black">Rs {volumeProfile.vah.toFixed(2)}</p>
                </div>
                <div className={`rounded-2xl p-4 ${panelClass}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>VAL</p>
                  <p className="mt-2 text-2xl font-black">Rs {volumeProfile.val.toFixed(2)}</p>
                </div>
                <div className={`rounded-2xl p-4 ${panelClass}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Auction</p>
                  <p className="mt-2 text-sm font-black text-cyan-400">{(effectiveCandles[effectiveCandles.length - 1]?.close ?? 0) >= volumeProfile.val && (effectiveCandles[effectiveCandles.length - 1]?.close ?? 0) <= volumeProfile.vah ? 'Inside Value' : 'Outside Value'}</p>
                </div>
              </div>

              <div className={`rounded-2xl p-5 ${panelClass}`}>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeProfile.profile} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="price" type="number" domain={['auto', 'auto']} stroke={isLight ? '#71717a' : 'rgba(255,255,255,0.3)'} fontSize={10} />
                      <Tooltip cursor={{ fill: isLight ? 'rgba(24,24,27,0.04)' : 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: isLight ? '#ffffff' : '#111827', border: `1px solid ${isLight ? '#e4e4e7' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px' }} />
                      <Bar dataKey="volume" radius={[0, 6, 6, 0]}>
                        {volumeProfile.profile.map((entry, index) => (
                          <Cell key={`profile-${index}`} fill={entry.isPOC ? '#10b981' : entry.isInValueArea ? '#0ea5e9' : '#71717a'} fillOpacity={entry.isPOC ? 1 : 0.45} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'microstructure' && (
            <motion.div key="microstructure" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className={`rounded-2xl p-6 text-center ${panelClass}`}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-400"><Activity size={30} /></div>
                <p className={`mt-4 text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Trade Frequency</p>
                <p className="mt-2 text-3xl font-black">{microstructure.frequency}</p>
                <p className={`mt-2 text-[10px] font-mono uppercase tracking-[0.18em] ${mutedClass}`}>Ticks per minute</p>
              </div>
              <div className={`rounded-2xl p-6 text-center ${panelClass}`}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-400"><Cpu size={30} /></div>
                <p className={`mt-4 text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Spread Dynamics</p>
                <p className="mt-2 text-3xl font-black">{microstructure.spread.toFixed(3)}%</p>
                <p className={`mt-2 text-[10px] font-mono uppercase tracking-[0.18em] ${mutedClass}`}>Liquidity depth stable</p>
              </div>
              <div className={`rounded-2xl p-6 text-center ${panelClass}`}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"><Target size={30} /></div>
                <p className={`mt-4 text-[10px] font-bold uppercase tracking-[0.2em] ${softClass}`}>Accumulation Score</p>
                <p className="mt-2 text-3xl font-black">{microstructure.accumulation}%</p>
                <p className={`mt-2 text-[10px] font-mono uppercase tracking-[0.18em] ${mutedClass}`}>Smart money phase active</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'sector-rotation' && (
            <motion.div key="sector-rotation" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className={`rounded-2xl p-6 ${panelClass}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">Sector Rotation Dashboard</h3>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/10 text-blue-300'}`}>Leadership Map</div>
                </div>
                <div className="mt-6 space-y-4">
                  {sectorRotation.map((sector) => (
                    <div key={sector.sector} className={`rounded-2xl p-4 ${subPanelClass}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black">{sector.sector}</p>
                          <p className={`text-[11px] ${mutedClass}`}>Leader {sector.leader} | {sector.flow}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-400">{sector.strength.toFixed(0)}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${softClass}`}>{sector.bias}</p>
                        </div>
                      </div>
                      <div className={`mt-3 h-2 overflow-hidden rounded-full ${isLight ? 'bg-zinc-200' : 'bg-white/5'}`}>
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-500" style={{ width: `${sector.strength}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-2xl p-6 ${panelClass}`}>
                <h3 className="text-sm font-black uppercase tracking-[0.2em]">Institutional Footprint</h3>
                <div className="mt-6 space-y-4">
                  <div className={`rounded-2xl p-4 ${subPanelClass}`}>
                    <div className="flex items-center gap-3">
                      <TrendingUp className="text-emerald-400" size={18} />
                      <div>
                        <p className="text-sm font-black">{sectorRotation[0]?.sector ?? 'N/A'}</p>
                        <p className={`text-[11px] ${mutedClass}`}>Top sector by relative strength and sponsorship</p>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-2xl p-4 ${subPanelClass}`}>
                    <div className="flex items-center gap-3">
                      <Zap className="text-cyan-400" size={18} />
                      <div>
                        <p className="text-sm font-black">{sectorRotation[1]?.sector ?? 'N/A'}</p>
                        <p className={`text-[11px] ${mutedClass}`}>Improving breadth and faster intraday accumulation</p>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-2xl p-4 ${subPanelClass}`}>
                    <div className="flex items-center gap-3">
                      <Network className="text-amber-400" size={18} />
                      <div>
                        <p className="text-sm font-black">Accumulation Bias {derived.accumulationBias.toFixed(0)}</p>
                        <p className={`text-[11px] ${mutedClass}`}>Liquidity sponsorship remains {derived.accumulationBias >= 75 ? 'constructive' : 'mixed'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sentiment' && (
            <motion.div key="sentiment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className={`rounded-[2rem] p-8 text-center ${isLight ? 'bg-gradient-to-br from-emerald-50 to-cyan-50 border border-zinc-200' : 'bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-white/5'}`}>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">NLP Sentiment Score</div>
                <div className="mt-4 text-7xl font-black">{sentimentScore}</div>
                <div className="mt-5 flex justify-center gap-2">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div key={index} className={`h-8 w-2 rounded-full ${index < sentimentScore / 10 ? 'bg-emerald-500' : isLight ? 'bg-zinc-200' : 'bg-white/10'}`} />
                  ))}
                </div>
                <p className={`mx-auto mt-6 max-w-xl text-sm leading-6 ${mutedClass}`}>Institutional sentiment is being blended from accumulation, sector leadership, and liquidity sponsorship instead of a single headline feed.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className={`flex items-center gap-4 rounded-2xl p-4 ${panelClass}`}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><MessageSquare size={18} /></div>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${softClass}`}>Social Velocity</div>
                    <div className="text-sm font-black">+240% vs avg</div>
                  </div>
                </div>
                <div className={`flex items-center gap-4 rounded-2xl p-4 ${panelClass}`}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><TrendingUp size={18} /></div>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${softClass}`}>News Bias</div>
                    <div className="text-sm font-black">82% positive</div>
                  </div>
                </div>
                <div className={`flex items-center gap-4 rounded-2xl p-4 ${panelClass}`}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><Database size={18} /></div>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${softClass}`}>Accumulation State</div>
                    <div className="text-sm font-black">{derived.accumulationBias >= 75 ? 'Accumulation' : 'Balanced'}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`flex flex-col gap-3 border-t px-6 py-4 text-[10px] uppercase tracking-[0.18em] md:flex-row md:items-center md:justify-between ${isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-white/5 bg-white/2'}`}>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className={mutedClass}>Engine status operational</span>
          </div>
          <div className="flex items-center gap-2">
            <Database size={12} className={mutedClass} />
            <span className={mutedClass}>Latency 12ms</span>
          </div>
        </div>
        <div className={softClass}>QUANT-V3.3.0-INSTITUTIONAL</div>
      </div>
    </div>
  );
};

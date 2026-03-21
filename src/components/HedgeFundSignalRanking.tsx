import React, { useEffect, useState } from 'react';
import { BarChart3, Building2, Flame, Radar, TrendingUp } from 'lucide-react';

function cleanSymbol(raw: string): string {
  return raw.replace(/^(NSE_EQ|BSE_EQ)[|:]/, '');
}

export type HedgeFundSignalScore = {
  rank: number;
  stockSymbol: string;
  sector: string;
  momentumScore: number;
  trendScore: number;
  volumeScore: number;
  volatilityScore: number;
  sectorScore: number;
  institutionalScore: number;
  breakoutScore: number;
  finalScore: number;
  momentumValue: number;
  orderImbalance: number;
  breakoutProbability: number;
};

export type HedgeFundSignalDashboard = {
  rankings: HedgeFundSignalScore[];
  sectorStrength: Array<{ sector: string; averageReturn: number; sectorScore: number; leaders: string[] }>;
  momentumHeatmap: Array<{ symbol: string; sector: string; momentumScore: number; finalScore: number; breakoutScore: number }>;
  summary: { scannedUniverse: number; returned: number; averageFinalScore: number; leadingSector: string; institutionalAccumulationCandidates: number };
};

const scoreTone = (s: number) => s >= 80 ? 'text-emerald-300' : s >= 60 ? 'text-cyan-300' : s >= 40 ? 'text-amber-300' : 'text-rose-300';
const barColor  = (s: number) => s >= 80 ? 'bg-emerald-400' : s >= 60 ? 'bg-cyan-400' : s >= 40 ? 'bg-amber-300' : 'bg-rose-400';
const heatTone  = (s: number) => s >= 80 ? 'from-emerald-400/30 to-emerald-500/10 border-emerald-400/20'
                                : s >= 60 ? 'from-cyan-400/25 to-cyan-500/10 border-cyan-400/20'
                                : s >= 40 ? 'from-amber-400/25 to-amber-500/10 border-amber-400/20'
                                :           'from-rose-400/20 to-rose-500/10 border-rose-400/20';

export function HedgeFundSignalRanking({ dashboard }: { dashboard?: HedgeFundSignalDashboard | null }) {
  const rankings      = dashboard?.rankings ?? [];
  const sectorStrength = dashboard?.sectorStrength ?? [];
  const momentumHeatmap = dashboard?.momentumHeatmap ?? [];
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => { setSelectedSymbol(rankings[0]?.stockSymbol ?? null); }, [rankings[0]?.stockSymbol]);

  if (!dashboard) return null;
  if (!rankings.length) return (
    <section className="rounded-[2rem] border border-white/5 bg-zinc-950/70 p-6 text-sm text-zinc-300">
      Hedge fund signal ranking is waiting for a usable universe.
    </section>
  );

  const selected = rankings.find(r => r.stockSymbol === selectedSymbol) ?? rankings[0];

  return (
    <section className="rounded-[2rem] border border-emerald-500/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,rgba(5,11,17,0.97),rgba(8,12,18,0.97))] p-6 shadow-2xl shadow-black/30 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-emerald-300 mb-3">
            <BarChart3 className="h-3 w-3" /> Hedge Fund Signal Ranking
          </p>
          <h3 className="text-2xl font-black tracking-tight text-white">Multi-factor institutional ranking</h3>
          <p className="text-[11px] text-zinc-500 mt-1">Momentum · Trend · Volume · Volatility · Sector · Institutional · Breakout</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 shrink-0">
          {[
            { label: 'Scanned',        value: dashboard.summary.scannedUniverse,              color: 'text-white' },
            { label: 'Returned',       value: dashboard.summary.returned,                     color: 'text-cyan-300' },
            { label: 'Avg Score',      value: dashboard.summary.averageFinalScore.toFixed(1), color: 'text-emerald-300' },
            { label: 'Lead Sector',    value: dashboard.summary.leadingSector,                color: 'text-amber-300' },
          ].map(k => (
            <div key={k.label} className="rounded-2xl border border-white/5 bg-black/25 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">{k.label}</p>
              <p className={`mt-1.5 text-lg font-black leading-none ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Full-width rankings table ── */}
      <div className="rounded-[1.5rem] border border-white/5 bg-zinc-950/75 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-300" /> Top {rankings.length} Stocks
          </h4>
          <span className="text-[10px] text-zinc-500">Click a row to inspect factors</span>
        </div>
        {/* Scrollable table — no height cap, scrolls the whole page naturally */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-zinc-950/90 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500 border-b border-white/5">
              <tr>
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-3 py-3 text-right">Mom</th>
                <th className="px-3 py-3 text-right">Trend</th>
                <th className="px-3 py-3 text-right">Vol</th>
                <th className="px-3 py-3 text-right">Sector</th>
                <th className="px-3 py-3 text-right">Breakout</th>
                <th className="px-4 py-3 text-right">Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rankings.map(signal => {
                const isSel = signal.stockSymbol === selected.stockSymbol;
                return (
                  <tr key={signal.stockSymbol} onClick={() => setSelectedSymbol(signal.stockSymbol)}
                    className={`cursor-pointer transition-colors ${isSel ? 'bg-emerald-400/[0.07]' : 'hover:bg-white/[0.025]'}`}>
                    <td className="px-4 py-2.5 text-[11px] font-black text-zinc-500">#{signal.rank}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-[12px] font-bold text-white">{cleanSymbol(signal.stockSymbol)}</div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-zinc-500">{signal.sector}</div>
                    </td>
                    <td className={`px-3 py-2.5 text-[11px] font-bold text-right ${scoreTone(signal.momentumScore)}`}>{signal.momentumScore.toFixed(1)}</td>
                    <td className={`px-3 py-2.5 text-[11px] font-bold text-right ${scoreTone(signal.trendScore)}`}>{signal.trendScore.toFixed(1)}</td>
                    <td className={`px-3 py-2.5 text-[11px] font-bold text-right ${scoreTone(signal.volumeScore)}`}>{signal.volumeScore.toFixed(1)}</td>
                    <td className={`px-3 py-2.5 text-[11px] font-bold text-right ${scoreTone(signal.sectorScore)}`}>{signal.sectorScore.toFixed(1)}</td>
                    <td className={`px-3 py-2.5 text-[11px] font-bold text-right ${scoreTone(signal.breakoutScore)}`}>{signal.breakoutScore.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-[13px] font-black text-right text-emerald-300">{signal.finalScore.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Factor breakdown + Sector strength side by side ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Factor breakdown */}
        <div className="rounded-[1.5rem] border border-white/5 bg-zinc-950/75 p-5">
          <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white mb-4">
            <Radar className="h-3.5 w-3.5 text-cyan-300" /> Factor Breakdown
          </h4>
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Selected</p>
                <h5 className="text-xl font-black text-white mt-1">{cleanSymbol(selected.stockSymbol)}</h5>
                <p className="text-[11px] text-zinc-400">{selected.sector}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-300">Final</p>
                <p className="text-2xl font-black text-white">{selected.finalScore.toFixed(1)}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {([
                ['Momentum',    selected.momentumScore],
                ['Trend',       selected.trendScore],
                ['Volume',      selected.volumeScore],
                ['Volatility',  selected.volatilityScore],
                ['Sector',      selected.sectorScore],
                ['Institutional', selected.institutionalScore],
                ['Breakout',    selected.breakoutScore],
              ] as [string, number][]).map(([label, score]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">
                    <span>{label}</span>
                    <span className="font-bold text-white">{score.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`${barColor(score)} h-full rounded-full`} style={{ width: `${Math.min(score, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl border border-white/5 bg-black/25 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">3M Momentum</p>
                <p className="mt-1.5 font-black text-cyan-300">{selected.momentumValue.toFixed(2)}x</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/25 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">Order Imbalance</p>
                <p className="mt-1.5 font-black text-emerald-300">{selected.orderImbalance.toFixed(2)}x</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sector strength */}
        <div className="rounded-[1.5rem] border border-white/5 bg-zinc-950/75 p-5">
          <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white mb-4">
            <Building2 className="h-3.5 w-3.5 text-amber-300" /> Sector Strength
          </h4>
          <div className="space-y-2.5">
            {sectorStrength.slice(0, 7).map(s => (
              <div key={s.sector} className="rounded-xl border border-white/5 bg-black/20 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-white">{s.sector}</span>
                  <span className={`text-[12px] font-black ${scoreTone(s.sectorScore)}`}>{s.sectorScore.toFixed(1)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1.5">
                  <div className={`${barColor(s.sectorScore)} h-full rounded-full`} style={{ width: `${Math.min(s.sectorScore, 100)}%` }} />
                </div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-zinc-500">
                  Avg {s.averageReturn.toFixed(1)}% · {s.leaders.slice(0, 3).map(cleanSymbol).join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Momentum heatmap ── */}
      <div className="rounded-[1.5rem] border border-white/5 bg-zinc-950/75 p-5">
        <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white mb-4">
          <Flame className="h-3.5 w-3.5 text-rose-300" /> Momentum Heatmap
        </h4>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {momentumHeatmap.map(tile => (
            <button key={tile.symbol} onClick={() => setSelectedSymbol(tile.symbol)}
              className={`rounded-2xl border bg-gradient-to-br p-3.5 text-left transition hover:-translate-y-0.5 ${heatTone(tile.finalScore)}`}>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400 truncate">{tile.sector}</p>
              <h5 className="mt-1.5 text-[14px] font-black text-white truncate">{cleanSymbol(tile.symbol)}</h5>
              <div className="mt-2.5 flex items-end justify-between">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.12em] text-zinc-500">Mom</p>
                  <p className="text-[12px] font-black text-cyan-300">{tile.momentumScore.toFixed(0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] uppercase tracking-[0.12em] text-zinc-500">Final</p>
                  <p className="text-[12px] font-black text-white">{tile.finalScore.toFixed(0)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

    </section>
  );
}

import React from 'react';
import { TrendingUp, Zap } from 'lucide-react';

type HeatmapStock = {
  symbol: string;
  sector: string;
  score: number;
  finalPredictionScore: number;
  momentum: number;
  cagr: number;
};

function cleanSymbol(raw: string): string {
  return raw.replace(/^(NSE_EQ|BSE_EQ)[|:]/, '');
}

function scoreGradient(score: number) {
  if (score >= 85) return { bg: 'from-emerald-500/20 to-cyan-500/10 border-emerald-400/25', text: 'text-emerald-300', bar: 'bg-emerald-400' };
  if (score >= 70) return { bg: 'from-cyan-500/15 to-sky-500/10 border-cyan-400/20',       text: 'text-cyan-300',   bar: 'bg-cyan-400' };
  if (score >= 55) return { bg: 'from-amber-500/15 to-orange-500/10 border-amber-400/20',  text: 'text-amber-300',  bar: 'bg-amber-400' };
  return              { bg: 'from-zinc-700/20 to-zinc-800/10 border-white/8',              text: 'text-zinc-400',   bar: 'bg-zinc-500' };
}

export function UltraQuantHeatmap({ stocks }: { stocks: HeatmapStock[] }) {
  if (!stocks.length) return null;
  return (
    <section className="rounded-[2rem] border border-white/5 bg-zinc-950/70 p-6 shadow-2xl shadow-black/30">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400 mb-1">Conviction Heatmap</p>
          <h3 className="text-sm font-black uppercase tracking-[0.15em] text-white">Top Bullish Names</h3>
        </div>
        <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {stocks.length} tiles
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {stocks.map((stock) => {
          const g = scoreGradient(stock.score);
          const pct = Math.min(100, stock.score);
          return (
            <div
              key={stock.symbol}
              className={`group relative rounded-2xl border bg-gradient-to-br p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${g.bg}`}
            >
              {/* Score arc */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-black tracking-tight text-white truncate">{cleanSymbol(stock.symbol)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500 mt-0.5 truncate">{stock.sector}</p>
                </div>
                <span className={`text-[13px] font-black ml-1 shrink-0 ${g.text}`}>{stock.score.toFixed(0)}</span>
              </div>

              {/* Score bar */}
              <div className="h-1 w-full rounded-full bg-white/5 mb-3 overflow-hidden">
                <div className={`h-full rounded-full ${g.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>

              {/* Metrics */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 flex items-center gap-1"><Zap size={8} className="text-violet-400" />AI</span>
                  <span className={`font-black ${g.text}`}>{stock.finalPredictionScore.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 flex items-center gap-1"><TrendingUp size={8} className="text-cyan-400" />Mom</span>
                  <span className="font-bold text-zinc-300">{stock.momentum.toFixed(2)}x</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500">CAGR</span>
                  <span className={`font-bold ${stock.cagr >= 20 ? 'text-emerald-400' : 'text-zinc-300'}`}>{stock.cagr.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

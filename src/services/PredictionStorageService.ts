/**
 * PredictionStorageService — Store and retrieve stock predictions for accuracy tracking
 *
 * Storage priority (first available wins):
 *   1. Supabase  — works everywhere including Vercel
 *   2. SQLite    — local dev / Railway / Render
 *   3. Memory    — last resort; resets on cold start
 */

import { createRequire } from 'module';
import path from 'path';
import { getSupabaseClient } from '../lib/supabase';

export interface StockPrediction {
  id?: number;
  stock_symbol: string;
  prediction_date: string;
  target_date: string;
  prediction: 'Bullish' | 'Bearish' | 'Neutral';
  confidence: number;
  predicted_price: number;
  actual_price?: number;
  actual_change?: number;
  accuracy?: number;
  signals: {
    RSI: number;
    MACD: number;
    Volume: number;
    Trend: number;
    Sentiment: number;
    Bollinger: number;
    ATR: number;
  };
  explanation: string;
  created_at?: number;
}

// ─── SQLite ───────────────────────────────────────────────────────────────────

type SqliteDB = { exec: (sql: string) => void; prepare: (sql: string) => any };
let sqliteDb: SqliteDB | null = null;
let sqliteInitialized = false;

function getSqliteDb(): SqliteDB | null {
  if (sqliteInitialized) return sqliteDb;
  sqliteInitialized = true;
  if (process.env.VERCEL) return null;
  try {
    const _require = createRequire(import.meta.url);
    const Database = _require('better-sqlite3');
    const dbPath = path.join(process.cwd(), 'predictions.db');
    sqliteDb = new Database(dbPath) as SqliteDB;
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_symbol TEXT NOT NULL,
        prediction_date TEXT NOT NULL,
        target_date TEXT NOT NULL,
        prediction TEXT NOT NULL,
        confidence REAL NOT NULL,
        predicted_price REAL NOT NULL,
        actual_price REAL,
        actual_change REAL,
        accuracy REAL,
        signals TEXT NOT NULL,
        explanation TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    sqliteDb.exec(`CREATE INDEX IF NOT EXISTS idx_target_date ON predictions(target_date)`);
    sqliteDb.exec(`CREATE INDEX IF NOT EXISTS idx_stock_symbol ON predictions(stock_symbol)`);
    console.log('[PredictionStorage] SQLite storage initialized');
  } catch {
    console.log('[PredictionStorage] SQLite unavailable');
  }
  return sqliteDb;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────
const memoryStore: StockPrediction[] = [];

// ─── Helper ───────────────────────────────────────────────────────────────────

function calcAccuracy(prediction: string, actualChange: number): number {
  const predictedDir = prediction === 'Bullish' ? 1 : prediction === 'Bearish' ? -1 : 0;
  const actualDir = actualChange > 0 ? 1 : actualChange < 0 ? -1 : 0;
  return predictedDir === actualDir ? 100 : 0;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PredictionStorageService {

  static async savePrediction(pred: StockPrediction): Promise<void> {
    const now = Date.now();

    // 1. Supabase
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { error } = await sb.from('predictions').insert({
          stock_symbol: pred.stock_symbol,
          prediction_date: pred.prediction_date,
          target_date: pred.target_date,
          prediction: pred.prediction,
          confidence: pred.confidence,
          predicted_price: pred.predicted_price,
          signals: pred.signals,
          explanation: pred.explanation,
          created_at: now,
        });
        if (!error) return;
        console.error('[PredictionStorage] Supabase insert error:', error.message);
      } catch (e: any) {
        console.error('[PredictionStorage] Supabase insert exception:', e.message);
      }
    }

    // 2. SQLite
    const db = getSqliteDb();
    if (db) {
      db.prepare(`
        INSERT INTO predictions (
          stock_symbol, prediction_date, target_date, prediction, confidence,
          predicted_price, signals, explanation, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        pred.stock_symbol, pred.prediction_date, pred.target_date,
        pred.prediction, pred.confidence, pred.predicted_price,
        JSON.stringify(pred.signals), pred.explanation, now
      );
      return;
    }

    // 3. Memory
    memoryStore.push({ ...pred, id: memoryStore.length + 1, created_at: now });
  }

  static async getPredictionsByDate(targetDate: string): Promise<StockPrediction[]> {
    // 1. Supabase
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('predictions')
          .select('*')
          .eq('target_date', targetDate)
          .order('confidence', { ascending: false });
        if (!error && data) {
          return data.map((r: any) => ({
            ...r,
            signals: typeof r.signals === 'string' ? JSON.parse(r.signals) : r.signals,
          }));
        }
      } catch (e: any) {
        console.error('[PredictionStorage] Supabase query error:', e.message);
      }
    }

    // 2. SQLite
    const db = getSqliteDb();
    if (db) {
      const rows = db.prepare('SELECT * FROM predictions WHERE target_date = ? ORDER BY confidence DESC').all(targetDate);
      return rows.map((r: any) => ({ ...r, signals: JSON.parse(r.signals) }));
    }

    // 3. Memory
    return memoryStore.filter(p => p.target_date === targetDate);
  }

  static async updateActualPrice(id: number, actualPrice: number, actualChange: number): Promise<void> {
    // 1. Supabase
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data } = await sb.from('predictions').select('prediction').eq('id', id).single();
        if (data) {
          const accuracy = calcAccuracy(data.prediction, actualChange);
          await sb.from('predictions')
            .update({ actual_price: actualPrice, actual_change: actualChange, accuracy })
            .eq('id', id);
          return;
        }
      } catch (e: any) {
        console.error('[PredictionStorage] Supabase update error:', e.message);
      }
    }

    // 2. SQLite
    const db = getSqliteDb();
    if (db) {
      const pred = db.prepare('SELECT prediction FROM predictions WHERE id = ?').get(id) as any;
      if (!pred) return;
      const accuracy = calcAccuracy(pred.prediction, actualChange);
      db.prepare('UPDATE predictions SET actual_price = ?, actual_change = ?, accuracy = ? WHERE id = ?')
        .run(actualPrice, actualChange, accuracy, id);
      return;
    }

    // 3. Memory
    const pred = memoryStore.find(p => p.id === id);
    if (pred) {
      pred.accuracy = calcAccuracy(pred.prediction, actualChange);
      pred.actual_price = actualPrice;
      pred.actual_change = actualChange;
    }
  }

  static async getAccuracyStats(fromDate?: string, toDate?: string): Promise<{
    total: number; correct: number; accuracy: number; avgConfidence: number;
  }> {
    let predictions: StockPrediction[] = [];

    // 1. Supabase
    const sb = getSupabaseClient();
    if (sb) {
      try {
        let query = sb.from('predictions').select('*').not('accuracy', 'is', null);
        if (fromDate) query = query.gte('target_date', fromDate);
        if (toDate) query = query.lte('target_date', toDate);
        const { data, error } = await query;
        if (!error && data) {
          predictions = data.map((r: any) => ({
            ...r,
            signals: typeof r.signals === 'string' ? JSON.parse(r.signals) : r.signals,
          }));
        }
      } catch (e: any) {
        console.error('[PredictionStorage] Supabase stats error:', e.message);
      }
    } else {
      // 2. SQLite
      const db = getSqliteDb();
      if (db) {
        let q = 'SELECT * FROM predictions WHERE accuracy IS NOT NULL';
        const params: any[] = [];
        if (fromDate) { q += ' AND target_date >= ?'; params.push(fromDate); }
        if (toDate) { q += ' AND target_date <= ?'; params.push(toDate); }
        const rows = db.prepare(q).all(...params);
        predictions = rows.map((r: any) => ({ ...r, signals: JSON.parse(r.signals) }));
      } else {
        // 3. Memory
        predictions = memoryStore.filter(p => {
          if (p.accuracy === undefined) return false;
          if (fromDate && p.target_date < fromDate) return false;
          if (toDate && p.target_date > toDate) return false;
          return true;
        });
      }
    }

    const total = predictions.length;
    const correct = predictions.filter(p => p.accuracy === 100).length;
    const avgConfidence = total > 0 ? predictions.reduce((s, p) => s + p.confidence, 0) / total : 0;
    return { total, correct, accuracy: total > 0 ? (correct / total) * 100 : 0, avgConfidence };
  }

  static async getAllDatesWithPredictions(): Promise<string[]> {
    // 1. Supabase
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb
          .from('predictions')
          .select('target_date')
          .order('target_date', { ascending: false });
        if (!error && data) {
          return [...new Set(data.map((r: any) => r.target_date as string))];
        }
      } catch (e: any) {
        console.error('[PredictionStorage] Supabase dates error:', e.message);
      }
    }

    // 2. SQLite
    const db = getSqliteDb();
    if (db) {
      const rows = db.prepare('SELECT DISTINCT target_date FROM predictions ORDER BY target_date DESC').all();
      return rows.map((r: any) => r.target_date);
    }

    // 3. Memory
    return [...new Set(memoryStore.map(p => p.target_date))].sort().reverse();
  }
}

/**
 * Vercel Serverless Entry Point
 *
 * IMPORTANT: process.env.VERCEL must be set BEFORE server.ts is imported,
 * because server.ts (and its transitive imports like UpstoxTokenManager,
 * PredictionStorageService) check process.env.VERCEL at module evaluation time
 * to decide whether to initialise better-sqlite3.
 *
 * ESM static imports are hoisted and evaluated before any code in this file runs,
 * so we MUST use a dynamic import() to ensure the env var is set first.
 */

process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

import type { IncomingMessage, ServerResponse } from 'http';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

type AppHandler = (req: IncomingMessage, res: ServerResponse) => void;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// createRequire base must be a file URL or absolute path to a file (not a dir)
const require = createRequire(import.meta.url);

let appPromise: Promise<AppHandler> | null = null;

function resolveServerBundlePath(): string {
  const candidates = [
    // Vercel: includeFiles "../server.cjs" places it alongside the function bundle
    path.join(__dirname, 'server.cjs'),
    // Vercel alternate: function output directory
    path.join(process.cwd(), '.vercel', 'output', 'functions', 'api', 'index.func', 'server.cjs'),
    // Local / Railway: root of project
    path.join(process.cwd(), 'server.cjs'),
    // One level up from api/
    path.join(__dirname, '..', 'server.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate server bundle. Checked:\n${candidates.join('\n')}`);
}

function getApp(): Promise<AppHandler> {
  if (!appPromise) {
    appPromise = Promise.resolve().then(() => {
      const bundlePath = resolveServerBundlePath();
      console.log(`[api/index] Loading server bundle from: ${bundlePath}`);
      const mod = require(bundlePath) as {
        startServerlessApp: () => Promise<AppHandler>;
      };
      return mod.startServerlessApp();
    });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const expressApp = await getApp();
    return expressApp(req, res);
  } catch (err: any) {
    console.error('[api/index] Fatal error loading app:', err.message);
    (res as any).statusCode = 500;
    res.end(JSON.stringify({ error: 'Server initialization failed', detail: err.message }));
  }
}

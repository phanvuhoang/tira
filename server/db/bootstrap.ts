// ════════════════════════════════════════════════════════════════════════════
// TIRA — Bootstrap DB tables + one-time JSON → DB migration
// ════════════════════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";
import { getPool, isDbEnabled } from "./index";

const DDL = `
CREATE TABLE IF NOT EXISTS reports (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  ticker          TEXT NOT NULL,
  report_type     TEXT NOT NULL DEFAULT 'financial',
  content         TEXT,
  analysis_params JSONB DEFAULT '{}'::jsonb,
  user_id         TEXT DEFAULT 'anonymous',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reports_user_idx     ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_ticker_idx   ON reports(ticker);
CREATE INDEX IF NOT EXISTS reports_created_idx  ON reports(created_at DESC);

CREATE TABLE IF NOT EXISTS analyses (
  id               TEXT PRIMARY KEY,
  name             TEXT,
  ticker           TEXT NOT NULL,
  report_type      TEXT NOT NULL DEFAULT 'financial',
  years            JSONB DEFAULT '[]'::jsonb,
  comparisons      JSONB DEFAULT '[]'::jsonb,
  percentile_low   INTEGER NOT NULL DEFAULT 25,
  percentile_high  INTEGER NOT NULL DEFAULT 75,
  user_id          TEXT DEFAULT 'anonymous',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS analyses_user_idx    ON analyses(user_id);
CREATE INDEX IF NOT EXISTS analyses_ticker_idx  ON analyses(ticker);
CREATE INDEX IF NOT EXISTS analyses_created_idx ON analyses(created_at DESC);

CREATE TABLE IF NOT EXISTS deep_company_analyses (
  id            TEXT PRIMARY KEY,
  meta          JSONB DEFAULT '{}'::jsonb,
  inputs        JSONB,
  analysis      JSONB NOT NULL,
  report        TEXT,
  user_id       TEXT DEFAULT 'anonymous',
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dc_user_idx    ON deep_company_analyses(user_id);
CREATE INDEX IF NOT EXISTS dc_savedat_idx ON deep_company_analyses(saved_at DESC);
`;

async function tableEmpty(table: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return (r.rows[0]?.c ?? 0) === 0;
}

async function importReports(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  const file = path.resolve(process.cwd(), "data", "report_history.json");
  if (!fs.existsSync(file)) return 0;
  let rows: any[] = [];
  try {
    rows = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return 0;
  }
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let n = 0;
  for (const r of rows) {
    try {
      await pool.query(
        `INSERT INTO reports (id, name, ticker, report_type, content, analysis_params, user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.name ?? null,
          r.ticker,
          r.report_type ?? "financial",
          r.content ?? null,
          r.analysis_params ?? {},
          r.user_id ?? "anonymous",
          r.created_at ?? new Date().toISOString(),
        ]
      );
      n++;
    } catch (e: any) {
      console.warn(`[db][import-reports] skip ${r.id}: ${e?.message}`);
    }
  }
  return n;
}

async function importAnalyses(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  const file = path.resolve(process.cwd(), "data", "saved_analyses.json");
  if (!fs.existsSync(file)) return 0;
  let rows: any[] = [];
  try {
    rows = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return 0;
  }
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let n = 0;
  for (const r of rows) {
    try {
      await pool.query(
        `INSERT INTO analyses (id, name, ticker, report_type, years, comparisons,
                               percentile_low, percentile_high, user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.name ?? null,
          r.ticker,
          r.report_type ?? "financial",
          r.years ?? [],
          r.comparisons ?? [],
          r.percentile_low ?? 25,
          r.percentile_high ?? 75,
          r.user_id ?? "anonymous",
          r.created_at ?? new Date().toISOString(),
        ]
      );
      n++;
    } catch (e: any) {
      console.warn(`[db][import-analyses] skip ${r.id}: ${e?.message}`);
    }
  }
  return n;
}

async function importDeepCompany(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  const file = path.resolve(process.cwd(), "data", "deep_company_analyses.json");
  if (!fs.existsSync(file)) return 0;
  let rows: any[] = [];
  try {
    rows = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return 0;
  }
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let n = 0;
  for (const r of rows) {
    try {
      await pool.query(
        `INSERT INTO deep_company_analyses (id, meta, inputs, analysis, report, user_id, saved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.meta ?? {},
          r.inputs ?? null,
          r.analysis ?? {},
          r.report ?? null,
          r.user_id ?? "anonymous",
          r.savedAt ?? r.saved_at ?? new Date().toISOString(),
        ]
      );
      n++;
    } catch (e: any) {
      console.warn(`[db][import-deep] skip ${r.id}: ${e?.message}`);
    }
  }
  return n;
}

/**
 * Tạo bảng nếu chưa có + chạy migration JSON → DB một lần (nếu bảng rỗng).
 * KHÔNG xóa file JSON gốc — vẫn giữ làm backup. Routes sau khi DB bật sẽ
 * không ghi vào JSON nữa.
 */
export async function bootstrapDb(): Promise<void> {
  if (!isDbEnabled()) return;
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(DDL);
    console.log("[db] ✓ Tables sẵn sàng (reports, analyses, deep_company_analyses).");

    // One-time import nếu bảng rỗng và file JSON có data
    const [empReports, empAnalyses, empDeep] = await Promise.all([
      tableEmpty("reports"),
      tableEmpty("analyses"),
      tableEmpty("deep_company_analyses"),
    ]);

    if (empReports) {
      const n = await importReports();
      if (n > 0) console.log(`[db] ✓ Import ${n} report(s) từ report_history.json.`);
    }
    if (empAnalyses) {
      const n = await importAnalyses();
      if (n > 0) console.log(`[db] ✓ Import ${n} analysis từ saved_analyses.json.`);
    }
    if (empDeep) {
      const n = await importDeepCompany();
      if (n > 0)
        console.log(`[db] ✓ Import ${n} deep-company analysis từ deep_company_analyses.json.`);
    }
  } catch (e: any) {
    console.error(`[db] ✗ Bootstrap thất bại: ${e?.message}`);
  }
}

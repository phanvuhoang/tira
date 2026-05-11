// ════════════════════════════════════════════════════════════════════════════
// TIRA — Repositories
//
// Mỗi repo có 2 cài đặt:
//   - DB (Postgres) khi isDbEnabled() === true
//   - JSON fallback (giữ tương thích ngược với data/*.json hiện có)
//
// Routes chỉ gọi vào repo — không touch fs hay DB trực tiếp.
// ════════════════════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";
import { getPool, isDbEnabled } from "./index";

// ── JSON helpers ────────────────────────────────────────────────────────────
function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
    }
  } catch {}
  return fallback;
}
function writeJson(file: string, data: any): void {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`[repo] writeJson ${file} fail:`, e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 1) REPORTS REPO   ── /api/reports
// ════════════════════════════════════════════════════════════════════════════
export interface ReportRecord {
  id: string;
  name: string | null;
  ticker: string;
  report_type: string;
  content: string | null;
  analysis_params: Record<string, any>;
  user_id: string;
  created_at: string;
}

const REPORTS_FILE = path.resolve(process.cwd(), "data", "report_history.json");

export const reportsRepo = {
  async insert(rec: ReportRecord): Promise<ReportRecord> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      await pool.query(
        `INSERT INTO reports (id, name, ticker, report_type, content, analysis_params, user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          rec.id,
          rec.name,
          rec.ticker,
          rec.report_type,
          rec.content,
          rec.analysis_params,
          rec.user_id,
          rec.created_at,
        ]
      );
      return rec;
    }
    // JSON fallback
    const arr = readJson<ReportRecord[]>(REPORTS_FILE, []);
    arr.push(rec);
    writeJson(REPORTS_FILE, arr);
    return rec;
  },

  async listForUser(opts: { userId?: string; isAdmin: boolean }): Promise<ReportRecord[]> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      let r;
      if (opts.isAdmin) {
        r = await pool.query(`SELECT * FROM reports ORDER BY created_at DESC`);
      } else if (opts.userId) {
        r = await pool.query(
          `SELECT * FROM reports
           WHERE user_id = $1 OR user_id = 'anonymous'
           ORDER BY created_at DESC`,
          [opts.userId]
        );
      } else {
        r = await pool.query(`SELECT * FROM reports ORDER BY created_at DESC`);
      }
      return r.rows.map(rowToReport);
    }
    let arr = readJson<ReportRecord[]>(REPORTS_FILE, []);
    if (!opts.isAdmin && opts.userId) {
      arr = arr.filter((r) => r.user_id === opts.userId || r.user_id === "anonymous");
    }
    return arr
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getById(id: string): Promise<ReportRecord | null> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      const r = await pool.query(`SELECT * FROM reports WHERE id = $1`, [id]);
      return r.rows.length ? rowToReport(r.rows[0]) : null;
    }
    const arr = readJson<ReportRecord[]>(REPORTS_FILE, []);
    return arr.find((r) => r.id === id) ?? null;
  },

  async delete(id: string): Promise<boolean> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      const r = await pool.query(`DELETE FROM reports WHERE id = $1`, [id]);
      return (r.rowCount ?? 0) > 0;
    }
    const arr = readJson<ReportRecord[]>(REPORTS_FILE, []);
    const before = arr.length;
    const next = arr.filter((r) => r.id !== id);
    writeJson(REPORTS_FILE, next);
    return next.length < before;
  },
};

function rowToReport(row: any): ReportRecord {
  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    report_type: row.report_type,
    content: row.content,
    analysis_params:
      typeof row.analysis_params === "string"
        ? JSON.parse(row.analysis_params)
        : row.analysis_params ?? {},
    user_id: row.user_id,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 2) ANALYSES REPO   ── /api/analyses
// ════════════════════════════════════════════════════════════════════════════
export interface AnalysisRecord {
  id: string;
  name: string | null;
  ticker: string;
  report_type: string;
  years: string[];
  comparisons: string[];
  percentile_low: number;
  percentile_high: number;
  user_id: string;
  created_at: string;
}

const ANALYSES_FILE = path.resolve(process.cwd(), "data", "saved_analyses.json");

export const analysesRepo = {
  async insert(rec: AnalysisRecord): Promise<AnalysisRecord> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      await pool.query(
        `INSERT INTO analyses (id, name, ticker, report_type, years, comparisons,
                               percentile_low, percentile_high, user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          rec.id,
          rec.name,
          rec.ticker,
          rec.report_type,
          JSON.stringify(rec.years),
          JSON.stringify(rec.comparisons),
          rec.percentile_low,
          rec.percentile_high,
          rec.user_id,
          rec.created_at,
        ]
      );
      return rec;
    }
    const arr = readJson<AnalysisRecord[]>(ANALYSES_FILE, []);
    arr.unshift(rec);
    writeJson(ANALYSES_FILE, arr);
    return rec;
  },

  async listForUser(opts: { userId?: string; isAdmin: boolean }): Promise<AnalysisRecord[]> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      let r;
      if (opts.isAdmin) {
        r = await pool.query(`SELECT * FROM analyses ORDER BY created_at DESC`);
      } else if (opts.userId) {
        r = await pool.query(
          `SELECT * FROM analyses
           WHERE user_id = $1 OR user_id = 'anonymous'
           ORDER BY created_at DESC`,
          [opts.userId]
        );
      } else {
        r = await pool.query(`SELECT * FROM analyses ORDER BY created_at DESC`);
      }
      return r.rows.map(rowToAnalysis);
    }
    let arr = readJson<AnalysisRecord[]>(ANALYSES_FILE, []);
    if (!opts.isAdmin && opts.userId) {
      arr = arr.filter((a) => a.user_id === opts.userId || a.user_id === "anonymous");
    }
    return arr
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async delete(id: string): Promise<boolean> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      const r = await pool.query(`DELETE FROM analyses WHERE id = $1`, [id]);
      return (r.rowCount ?? 0) > 0;
    }
    const arr = readJson<AnalysisRecord[]>(ANALYSES_FILE, []);
    const before = arr.length;
    const next = arr.filter((a) => a.id !== id);
    writeJson(ANALYSES_FILE, next);
    return next.length < before;
  },
};

function rowToAnalysis(row: any): AnalysisRecord {
  const parseArr = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try {
        const j = JSON.parse(v);
        return Array.isArray(j) ? j : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    report_type: row.report_type,
    years: parseArr(row.years),
    comparisons: parseArr(row.comparisons),
    percentile_low: Number(row.percentile_low ?? 25),
    percentile_high: Number(row.percentile_high ?? 75),
    user_id: row.user_id,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 3) DEEP-COMPANY REPO   ── /api/deep-company
// ════════════════════════════════════════════════════════════════════════════
export interface DeepCompanyRecord {
  id: string;
  meta: any;
  inputs: any;
  analysis: any;
  report: string | null;
  user_id: string;
  saved_at: string;
}

const DEEP_FILE = path.resolve(process.cwd(), "data", "deep_company_analyses.json");

export const deepCompanyRepo = {
  async insert(rec: DeepCompanyRecord): Promise<DeepCompanyRecord> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      await pool.query(
        `INSERT INTO deep_company_analyses (id, meta, inputs, analysis, report, user_id, saved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rec.id, rec.meta ?? {}, rec.inputs ?? null, rec.analysis, rec.report, rec.user_id, rec.saved_at]
      );
      return rec;
    }
    const arr = readJson<DeepCompanyRecord[]>(DEEP_FILE, []);
    arr.unshift(rec);
    // giữ tối đa 200 record (matching behavior cũ)
    writeJson(DEEP_FILE, arr.slice(0, 200));
    return rec;
  },

  async listForUser(opts: { userId?: string; isAdmin: boolean }): Promise<DeepCompanyRecord[]> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      let r;
      if (opts.isAdmin) {
        r = await pool.query(`SELECT * FROM deep_company_analyses ORDER BY saved_at DESC`);
      } else if (opts.userId) {
        r = await pool.query(
          `SELECT * FROM deep_company_analyses
           WHERE user_id = $1 OR user_id = 'anonymous'
           ORDER BY saved_at DESC`,
          [opts.userId]
        );
      } else {
        r = await pool.query(`SELECT * FROM deep_company_analyses ORDER BY saved_at DESC`);
      }
      return r.rows.map(rowToDeep);
    }
    let arr = readJson<DeepCompanyRecord[]>(DEEP_FILE, []);
    if (!opts.isAdmin && opts.userId) {
      arr = arr.filter((a) => a.user_id === opts.userId || a.user_id === "anonymous");
    }
    return arr.slice();
  },

  async getById(id: string): Promise<DeepCompanyRecord | null> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      const r = await pool.query(`SELECT * FROM deep_company_analyses WHERE id = $1`, [id]);
      return r.rows.length ? rowToDeep(r.rows[0]) : null;
    }
    const arr = readJson<DeepCompanyRecord[]>(DEEP_FILE, []);
    return arr.find((a) => a.id === id) ?? null;
  },

  async delete(id: string): Promise<boolean> {
    if (isDbEnabled()) {
      const pool = getPool()!;
      const r = await pool.query(`DELETE FROM deep_company_analyses WHERE id = $1`, [id]);
      return (r.rowCount ?? 0) > 0;
    }
    const arr = readJson<DeepCompanyRecord[]>(DEEP_FILE, []);
    const before = arr.length;
    const next = arr.filter((a) => a.id !== id);
    writeJson(DEEP_FILE, next);
    return next.length < before;
  },
};

function rowToDeep(row: any): DeepCompanyRecord {
  const parseObj = (v: any): any => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }
    return v;
  };
  return {
    id: row.id,
    meta: parseObj(row.meta) ?? {},
    inputs: parseObj(row.inputs),
    analysis: parseObj(row.analysis) ?? {},
    report: row.report,
    user_id: row.user_id,
    saved_at:
      row.saved_at instanceof Date ? row.saved_at.toISOString() : String(row.saved_at),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TIRA — DB connection layer
//
// Sử dụng node-postgres (`pg`) trực tiếp để giữ đơn giản. Drizzle đã có trong
// deps nhưng các bảng nhỏ và truy vấn đơn giản nên ta dùng pool.query() để
// tránh phải build schema/migration phức tạp.
//
// Nếu DATABASE_URL không được set → pool = null → các repo tự fall back sang
// JSON. Như vậy app vẫn chạy được trong dev/staging mà chưa cần DB.
// ════════════════════════════════════════════════════════════════════════════

import { Pool, type PoolConfig } from "pg";

let _pool: Pool | null = null;
let _enabled = false;
let _initPromise: Promise<void> | null = null;

function shouldUseSsl(url: string): boolean {
  // Coolify thường expose DB qua mạng nội bộ — không cần SSL.
  // Cho phép user opt-in bằng ?sslmode=require trong URL, hoặc DATABASE_SSL=true.
  if (/sslmode=(require|verify-ca|verify-full)/i.test(url)) return true;
  if (process.env.DATABASE_SSL === "true") return true;
  return false;
}

export function getPool(): Pool | null {
  return _pool;
}

export function isDbEnabled(): boolean {
  return _enabled;
}

/**
 * Khởi tạo pool (idempotent — gọi nhiều lần vẫn an toàn).
 * Trả về Promise<void> — KHÔNG throw nếu DB không reachable; app vẫn chạy
 * bằng JSON fallback, chỉ in cảnh báo.
 */
export function initDb(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      console.log("[db] DATABASE_URL không set → dùng JSON fallback.");
      _enabled = false;
      return;
    }
    const config: PoolConfig = {
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    if (shouldUseSsl(url)) {
      config.ssl = { rejectUnauthorized: false };
    }
    try {
      const pool = new Pool(config);
      // Ping
      const r = await pool.query("SELECT 1 AS ok");
      if (r.rows?.[0]?.ok !== 1) throw new Error("Ping failed");
      _pool = pool;
      _enabled = true;
      console.log("[db] ✓ Kết nối Postgres OK.");
    } catch (e: any) {
      console.warn(
        `[db] ✗ Không kết nối được Postgres (${e?.message || e}). Tiếp tục với JSON fallback.`
      );
      _enabled = false;
      _pool = null;
    }
  })();
  return _initPromise;
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    try {
      await _pool.end();
    } catch {}
    _pool = null;
    _enabled = false;
    _initPromise = null;
  }
}

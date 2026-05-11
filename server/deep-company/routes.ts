// ════════════════════════════════════════════════════════════════════════════
// TIRA Phase 2 — API routes cho module "Phân tích sâu Cty"
//
// Endpoints (tất cả prefix /api/deep-company):
//   GET  /template                   — tải file Excel mẫu
//   POST /upload (multipart file)    — upload Excel mẫu, parse → trả về inputs
//   POST /analyze                    — chạy 39 chỉ số + Beneish + scoring
//   POST /report                     — tạo báo cáo AI từ kết quả analyze
//   POST /save                       — lưu kết quả phân tích vào file JSON
//   GET  /list                       — danh sách phân tích đã lưu
//   GET  /:id                        — đọc một phân tích đã lưu
// ════════════════════════════════════════════════════════════════════════════

import type { Express, Request, Response } from "express";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";

import {
  calculateAllIndicators,
  calculateBeneish,
} from "./indicators";
import {
  scoreIndicators,
  detectConflicts,
  findMissingFields,
} from "./risk-scoring";
import { buildDeepCompanyPrompt } from "./ai-report";
import { buildDeepCompanyTemplate, parseDeepCompanyTemplate } from "./template";
import type { DeepCompanyInputs, DeepCompanyAnalysis } from "./types";
import { deepCompanyRepo } from "../db/repositories";
import { verifyToken } from "../auth";

const upload = multer({ dest: "/tmp/uploads/" });

// Extract user context từ Bearer token (matching pattern ở /api/reports)
function extractUserContext(req: Request): { userId?: string; isAdmin: boolean } {
  const authH = req.headers.authorization;
  if (authH?.startsWith("Bearer ")) {
    const p = verifyToken(authH.slice(7));
    if (p) {
      return { userId: p.id, isAdmin: p.role === "admin" };
    }
  }
  // No auth → admin view (giữ tương thích với hành vi JSON cũ là trả về tất cả)
  return { isAdmin: true };
}

function runAnalysis(inputs: DeepCompanyInputs): DeepCompanyAnalysis {
  const indicators = calculateAllIndicators(inputs);
  const beneish = calculateBeneish(inputs);
  const scoring = scoreIndicators(indicators, beneish);
  const conflicts = detectConflicts(inputs);
  const missingFields = findMissingFields(inputs);
  return {
    meta: inputs.meta || {},
    indicators,
    beneish,
    scoring,
    conflicts,
    missingFields,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Đăng ký routes — gọi từ server/routes.ts.
 * `generateReportText` được truyền vào để tránh duplicate AI client logic.
 */
export function registerDeepCompanyRoutes(
  app: Express,
  generateReportText: (prompt: string, aiModel: string) => Promise<string>
) {
  // ── Tải file Excel mẫu ────────────────────────────────────────────────
  app.get("/api/deep-company/template", (_req: Request, res: Response) => {
    try {
      const buf = buildDeepCompanyTemplate();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="tira_phantich_sau_cty_template.xlsx"'
      );
      res.send(buf);
    } catch (e: any) {
      res.status(500).json({ error: "Không tạo được template", detail: e?.message });
    }
  });

  // ── Upload file Excel đã điền → parse trả về inputs JSON ──────────────
  app.post(
    "/api/deep-company/upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) return res.status(400).json({ error: "Thiếu file upload" });
        const buf = fs.readFileSync(req.file.path);
        const { inputs, warnings } = parseDeepCompanyTemplate(buf);
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
        res.json({ inputs, warnings });
      } catch (e: any) {
        res.status(400).json({ error: "Đọc file thất bại", detail: e?.message });
      }
    }
  );

  // ── Phân tích: từ inputs → 39 chỉ số + Beneish + scoring ──────────────
  app.post("/api/deep-company/analyze", (req: Request, res: Response) => {
    try {
      const inputs = req.body?.inputs as DeepCompanyInputs;
      if (!inputs || !inputs.bctc || !inputs.beneish) {
        return res.status(400).json({ error: "Thiếu inputs hoặc cấu trúc không hợp lệ" });
      }
      const analysis = runAnalysis(inputs);
      res.json(analysis);
    } catch (e: any) {
      console.error("[deep-company/analyze]", e);
      res.status(500).json({ error: "Lỗi khi phân tích", detail: e?.message });
    }
  });

  // ── Tạo báo cáo AI từ kết quả analysis ───────────────────────────────
  app.post("/api/deep-company/report", async (req: Request, res: Response) => {
    try {
      const analysis = req.body?.analysis as DeepCompanyAnalysis;
      const aiModel: string = req.body?.ai_model || "anthropic";
      if (!analysis || !analysis.indicators) {
        return res.status(400).json({ error: "Thiếu analysis hoặc cấu trúc không hợp lệ" });
      }
      const prompt = buildDeepCompanyPrompt(analysis);
      const reportText = await generateReportText(prompt, aiModel);
      res.json({
        report: reportText,
        ai_model: aiModel,
        generated_at: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error("[deep-company/report]", e);
      res.status(500).json({ error: "Lỗi khi tạo báo cáo AI", detail: e?.message });
    }
  });

  // ── Lưu phân tích ────────────────────────────────────────────────────
  app.post("/api/deep-company/save", async (req: Request, res: Response) => {
    try {
      const { inputs, analysis, report } = req.body || {};
      if (!analysis) return res.status(400).json({ error: "Thiếu analysis" });
      const ctx = extractUserContext(req);
      const rec = {
        id: uuidv4(),
        saved_at: new Date().toISOString(),
        meta: analysis.meta || {},
        inputs: inputs || null,
        analysis,
        report: report || null,
        user_id: ctx.userId || "anonymous",
      };
      await deepCompanyRepo.insert(rec);
      res.json({ success: true, id: rec.id });
    } catch (e: any) {
      console.error("[deep-company/save]", e);
      res.status(500).json({ error: "Không lưu được", detail: e?.message });
    }
  });

  // ── Danh sách phân tích đã lưu ────────────────────────────────────────
  app.get("/api/deep-company/list", async (req: Request, res: Response) => {
    try {
      const ctx = extractUserContext(req);
      const arr = await deepCompanyRepo.listForUser(ctx);
      res.json(
        arr.map((a: any) => ({
          id: a.id,
          // Giữ field name `savedAt` (camelCase) cho UI compat
          savedAt: a.saved_at,
          meta: a.meta,
          composite: a.analysis?.scoring?.composite,
          overallLevel: a.analysis?.scoring?.overallLevel,
          red: a.analysis?.scoring?.summary?.red,
          yellow: a.analysis?.scoring?.summary?.yellow,
        }))
      );
    } catch (e: any) {
      console.error("[deep-company/list]", e);
      res.status(500).json({ error: "Không tải được danh sách", detail: e?.message });
    }
  });

  // ── Đọc 1 phân tích ───────────────────────────────────────────────────
  app.get("/api/deep-company/:id", async (req: Request, res: Response) => {
    try {
      const rec = await deepCompanyRepo.getById(String(req.params.id));
      if (!rec) return res.status(404).json({ error: "Không tìm thấy" });
      // Map back về shape cũ với `savedAt` cho UI compat
      res.json({
        id: rec.id,
        savedAt: rec.saved_at,
        meta: rec.meta,
        inputs: rec.inputs,
        analysis: rec.analysis,
        report: rec.report,
      });
    } catch (e: any) {
      console.error("[deep-company/get]", e);
      res.status(500).json({ error: "Không đọc được", detail: e?.message });
    }
  });

  // ── Xoá 1 phân tích ───────────────────────────────────────────────────
  app.delete("/api/deep-company/:id", async (req: Request, res: Response) => {
    try {
      const ok = await deepCompanyRepo.delete(String(req.params.id));
      res.json({ success: true, removed: ok ? 1 : 0 });
    } catch (e: any) {
      console.error("[deep-company/delete]", e);
      res.status(500).json({ error: "Không xoá được", detail: e?.message });
    }
  });

  console.log("[deep-company] Đã đăng ký 7 routes /api/deep-company/*");
}

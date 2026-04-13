import type { Express, Request, Response } from "express";
import type { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { storage } from "./storage";
import { calculateTiraIndicators } from "./tira-engine";
import { loadUsers, login, register, verifyToken, getAllUsers, updateUserRole, deleteUser, resetPassword, authMiddleware, requireRole } from "./auth";
import { loadRiskWeights, getDefaultWeights, updateDefaultWeights, calculateCompositeScore, calculateYearScore, calculateMultiYearScore, calcRiskSeverity } from "./risk-scoring";

const upload = multer({ dest: "/tmp/uploads/" });

// ─────────────────────────────────────────────
// AI model configuration via env vars
// ─────────────────────────────────────────────
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-reasoner";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const deepseekClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─────────────────────────────────────────────
// Report history – JSON file persistence
// ─────────────────────────────────────────────
const HISTORY_FILE = path.resolve(process.cwd(), "data", "report_history.json");

interface ReportRecord {
  id: string;
  name: string;
  ticker: string;
  created_at: string;
  report_type: string;
  content: string;
  analysis_params: Record<string, any>;
  user_id?: string;
}

function loadHistory(): ReportRecord[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8")) as ReportRecord[];
    }
  } catch {
    // ignore parse errors, start fresh
  }
  return [];
}

function saveHistory(records: ReportRecord[]): void {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(records, null, 2), "utf-8");
}

// In-memory cache (loaded once on startup, kept in sync on writes)
let reportHistory: ReportRecord[] = loadHistory();

// ─────────────────────────────────────────────
// Helper: run the same analysis logic as /api/analyze
// ─────────────────────────────────────────────
function runAnalysis(
  ticker: string,
  reportType: string,
  years: string[],
  comparisons: string[],
  pLow: number,
  pHigh: number
) {
  const company = storage.getCompany(ticker);
  if (!company) return null;

  const finData = storage.getFinancialData(ticker, reportType);
  if (!finData) return null;

  const availableYears = Object.keys(finData).sort().reverse();
  const selectedYears = years.length > 0 ? years : availableYears.slice(0, 3);

  // Target TIRA indicators
  const targetResult: Record<string, any> = {};
  for (const year of selectedYears) {
    const currentData = finData[year];
    if (!currentData) continue;
    const prevYear = String(parseInt(year) - 1);
    const previousData = finData[prevYear] || null;

    const industryData = storage.getIndustryFinancialData(
      company.nganh_2 || "",
      year,
      reportType
    );
    const prevIndustryData = storage.getIndustryFinancialData(
      company.nganh_2 || "",
      prevYear,
      reportType
    );

    targetResult[year] = calculateTiraIndicators(
      currentData,
      previousData,
      year,
      industryData,
      prevIndustryData.length > 0 ? prevIndustryData : null,
      pLow,
      pHigh
    );
  }

  // Comparison companies TIRA indicators
  const compResults: Record<string, any> = {};
  for (const compTicker of comparisons) {
    const compCompany = storage.getCompany(compTicker);
    if (!compCompany) continue;
    const compFinData = storage.getFinancialData(compTicker, reportType);
    if (!compFinData) continue;

    const compResult: Record<string, any> = {};
    for (const year of selectedYears) {
      const currentData = compFinData[year];
      if (!currentData) continue;
      const prevYear = String(parseInt(year) - 1);
      const previousData = compFinData[prevYear] || null;

      const industryData = storage.getIndustryFinancialData(
        compCompany.nganh_2 || "",
        year,
        reportType
      );
      const prevIndustryData = storage.getIndustryFinancialData(
        compCompany.nganh_2 || "",
        prevYear,
        reportType
      );

      compResult[year] = calculateTiraIndicators(
        currentData,
        previousData,
        year,
        industryData,
        prevIndustryData.length > 0 ? prevIndustryData : null,
        pLow,
        pHigh
      );
    }
    compResults[compTicker] = { company: compCompany, indicators: compResult };
  }

  return {
    company,
    selectedYears,
    finData,
    targetIndicators: targetResult,
    compResults,
  };
}

// ─────────────────────────────────────────────
// AI call helpers
// ─────────────────────────────────────────────
async function callAnthropicModel(prompt: string, modelId: string): Promise<string> {
  if (!anthropicClient) {
    throw new Error("ANTHROPIC_API_KEY is not set. Please set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY environment variable.");
  }
  try {
    const msg = await anthropicClient.messages.create({
      model: modelId,
      max_tokens: 16384,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    if (block.type === "text") return block.text;
    return "";
  } catch (err: any) {
    throw new Error(`Anthropic API error: ${err.message || err}`);
  }
}

async function callDeepSeekModel(prompt: string, modelId: string): Promise<string> {
  if (!deepseekClient) {
    throw new Error("DEEPSEEK_API_KEY is not set. Please set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY environment variable.");
  }
  try {
    const completion = await deepseekClient.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 16384,
    });
    return completion.choices[0]?.message?.content || "";
  } catch (err: any) {
    throw new Error(`DeepSeek API error: ${err.message || err}`);
  }
}

async function callOpenAIModel(prompt: string, modelId: string): Promise<string> {
  if (!openaiClient) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  try {
    const completion = await openaiClient.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 16384,
    });
    return completion.choices[0]?.message?.content || "";
  } catch (err: any) {
    throw new Error(`OpenAI API error: ${err.message || err}`);
  }
}

async function generateReportText(
  prompt: string,
  aiModel: string
): Promise<string> {
  if (aiModel === "deepseek") {
    return callDeepSeekModel(prompt, DEEPSEEK_MODEL);
  }
  if (aiModel === "openai") {
    return callOpenAIModel(prompt, OPENAI_MODEL);
  }
  // default: anthropic
  return callAnthropicModel(prompt, ANTHROPIC_MODEL);
}

// ─────────────────────────────────────────────
// Register all routes
// ─────────────────────────────────────────────
export async function registerRoutes(httpServer: Server, app: Express) {
  // Load data on startup
  await storage.loadData();
  loadUsers();
  loadRiskWeights();

  // ── Company search ──────────────────────────
  app.get("/api/companies/search", (req: Request, res: Response) => {
    const query = (req.query.q as string) || "";
    const results = storage.searchCompanies(query);
    res.json(results);
  });

  // ── All companies (paginated) ───────────────
  app.get("/api/companies", (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const nganh_2 = req.query.nganh_2 as string;

    let filtered = storage.companies;
    if (nganh_2) {
      filtered = filtered.filter((c) => c.nganh_2 === nganh_2);
    }

    const start = (page - 1) * limit;
    res.json({
      data: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    });
  });

  // ── Company details ─────────────────────────
  app.get("/api/companies/:ma_ck", (req: Request, res: Response) => {
    const maCk = req.params.ma_ck as string;
    const company = storage.getCompany(maCk);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const hasParent = !!storage.getFinancialData(maCk, "Parent");
    const hasConsolidated = !!storage.getFinancialData(maCk, "Consolidated");

    const finData = storage.getFinancialData(
      maCk,
      hasParent ? "Parent" : "Consolidated"
    );
    const years = finData ? Object.keys(finData).sort().reverse() : [];

    res.json({ ...company, hasParent, hasConsolidated, availableYears: years });
  });

  // ── Suggested comparables ───────────────────
  app.get("/api/companies/:ma_ck/comparables", (req: Request, res: Response) => {
    const maCk = req.params.ma_ck as string;
    const company = storage.getCompany(maCk);
    if (!company || !company.nganh_2) {
      return res.json([]);
    }

    const reportType = (req.query.report_type as string) || "Parent";
    const sameIndustry = storage
      .getIndustryCompanies(company.nganh_2)
      .filter((c) => c.ma_ck !== maCk)
      .filter((c) => !!storage.getFinancialData(c.ma_ck, reportType));

    const targetVon = company.von_dieu_le || 0;
    sameIndustry.sort((a, b) => {
      const diffA = Math.abs((a.von_dieu_le || 0) - targetVon);
      const diffB = Math.abs((b.von_dieu_le || 0) - targetVon);
      return diffA - diffB;
    });

    res.json(sameIndustry.slice(0, 20));
  });

  // ── Industries ──────────────────────────────
  app.get("/api/industries", (req: Request, res: Response) => {
    const industries = storage.getUniqueIndustries();
    res.json(industries);
  });

  // ── Main analysis endpoint ──────────────────
  app.post("/api/analyze", (req: Request, res: Response) => {
    const {
      target_ticker,
      report_type,
      comparison_tickers,
      years,
      percentile_low,
      percentile_high,
    } = req.body;
    const pLow: number = typeof percentile_low === "number" ? percentile_low : 25;
    const pHigh: number = typeof percentile_high === "number" ? percentile_high : 75;

    if (!target_ticker || !report_type) {
      return res.status(400).json({ error: "Missing target_ticker or report_type" });
    }

    const company = storage.getCompany(target_ticker);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const finData = storage.getFinancialData(target_ticker, report_type);
    if (!finData) {
      return res.status(404).json({ error: "Financial data not found" });
    }

    const availableYears = Object.keys(finData).sort().reverse();
    const selectedYears = years || availableYears.slice(0, 3);

    // Calculate TIRA for target company
    const targetResult: Record<string, any> = {};
    for (const year of selectedYears) {
      const currentData = finData[year];
      if (!currentData) continue;

      const prevYear = String(parseInt(year) - 1);
      const previousData = finData[prevYear] || null;

      const industryData = storage.getIndustryFinancialData(
        company.nganh_2 || "",
        year,
        report_type
      );
      const prevIndustryData = storage.getIndustryFinancialData(
        company.nganh_2 || "",
        prevYear,
        report_type
      );

      const indicators = calculateTiraIndicators(
        currentData,
        previousData,
        year,
        industryData,
        prevIndustryData.length > 0 ? prevIndustryData : null,
        pLow,
        pHigh
      );

      targetResult[year] = indicators;
    }

    // Calculate TIRA for comparison companies
    const comparisons: Record<string, any> = {};
    const compTickers = comparison_tickers || [];
    for (const compTicker of compTickers) {
      const compCompany = storage.getCompany(compTicker);
      if (!compCompany) continue;

      const compFinData = storage.getFinancialData(compTicker, report_type);
      if (!compFinData) continue;

      const compResult: Record<string, any> = {};
      for (const year of selectedYears) {
        const currentData = compFinData[year];
        if (!currentData) continue;

        const prevYear = String(parseInt(year) - 1);
        const previousData = compFinData[prevYear] || null;

        const industryData = storage.getIndustryFinancialData(
          compCompany.nganh_2 || "",
          year,
          report_type
        );
        const prevIndustryData = storage.getIndustryFinancialData(
          compCompany.nganh_2 || "",
          prevYear,
          report_type
        );

        const indicators = calculateTiraIndicators(
          currentData,
          previousData,
          year,
          industryData,
          prevIndustryData.length > 0 ? prevIndustryData : null,
          pLow,
          pHigh
        );

        compResult[year] = indicators;
      }

      comparisons[compTicker] = {
        company: compCompany,
        indicators: compResult,
      };
    }

    res.json({
      target: {
        company,
        report_type,
        years: selectedYears,
        indicators: targetResult,
      },
      comparisons,
    });
  });

  // ── Upload new data ─────────────────────────
  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const XLSX = await import("xlsx");
      const workbook = XLSX.readFile(req.file.path);

      // uploadType is set by the new 3-slot UI; falls back to "auto" for
      // backward-compatible behaviour (sheet-name-based detection).
      const uploadType = (req.query.type as string) || "auto";

      let addedCompanies = 0;
      let addedFinancial = 0;

      // ── Helper: parse a financial sheet in the standard matrix layout ──
      // Row 0: labels, Row 1: dates (YYYYMMDD…), Row 2: tickers,
      // Row 3+: data rows keyed by column A.
      const parseFinancialSheet = (
        ws: any,
        storageTarget: Record<string, Record<string, Record<string, any>>>,
        suffix: string
      ) => {
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length <= 3) return;
        const dateRow = data[1];
        const tickerRow = data[2];
        for (let col = 2; col < dateRow.length; col++) {
          const dateVal = dateRow[col];
          const tickerVal = tickerRow[col];
          if (!dateVal || !tickerVal) continue;
          const year = String(dateVal).substring(0, 4);
          const tk = `${tickerVal} - ${suffix}`;
          if (!storageTarget[tk]) storageTarget[tk] = {};
          if (!storageTarget[tk][year]) storageTarget[tk][year] = {};
          for (let row = 3; row < data.length; row++) {
            const key = String(data[row][0]);
            const val = data[row][col];
            if (key && val !== undefined && val !== null && val !== "") {
              storageTarget[tk][year][key] = val;
              addedFinancial++;
            }
          }
        }
      };

      // ── Helper: parse general company-info sheet ──────────────
      const parseGeneralSheet = (ws: any) => {
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        for (const row of data) {
          const ma_ck = row["Mã CK"];
          if (ma_ck && !storage.companyMap.has(ma_ck)) {
            const company = {
              ma_ck,
              name: row["Name"] || "",
              ten_tv: row["Tên tiếng Việt"] || "",
              san: row["Sàn"] || "",
              nganh_1: row["Ngành cấp 1"] || "",
              nganh_2: row["Ngành cấp 2"] || "",
              nganh_3: row["Ngành cấp 3"] || "",
              nganh_4: row["Ngành cấp 4"] || "",
              loai_dn: row["Loại doanh nghiệp"] || "",
              von_dieu_le: row["Vốn điều lệ (đồng)"] || 0,
            };
            storage.companies.push(company);
            storage.companyMap.set(ma_ck, company);
            addedCompanies++;
          }
        }
      };

      // ═══════════════════════════════════════════════════════
      // TYPE-SPECIFIC UPLOAD (new 3-slot UI)
      // Always uses the FIRST sheet regardless of its name.
      // ═══════════════════════════════════════════════════════

      if (uploadType === "parent") {
        // First sheet → parent financial data (financial_full storage)
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        parseFinancialSheet(firstSheet, storage.financialFull, "Parent");

      } else if (uploadType === "consolidated") {
        // First sheet → consolidated financial data (financialPC storage)
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        parseFinancialSheet(firstSheet, storage.financialPC, "Consolidated");

      } else if (uploadType === "general") {
        // First sheet → company info
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        parseGeneralSheet(firstSheet);

      } else {
        // ═══════════════════════════════════════════════════════
        // AUTO / BACKWARD-COMPATIBLE: detect by sheet name
        // ═══════════════════════════════════════════════════════

        // financial_full → parent data
        if (workbook.SheetNames.includes("financial_full")) {
          parseFinancialSheet(
            workbook.Sheets["financial_full"],
            storage.financialFull,
            "Parent"
          );
        }

        // financial_pc → consolidated data
        if (workbook.SheetNames.includes("financial_pc")) {
          parseFinancialSheet(
            workbook.Sheets["financial_pc"],
            storage.financialPC,
            "Consolidated"
          );
        }

        // financial_data → template format (single-company)
        if (workbook.SheetNames.includes("financial_data")) {
          const ws = workbook.Sheets["financial_data"];
          const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];

          const templateTicker =
            rawData[3] && rawData[3][1] != null ? String(rawData[3][1]).trim() : "";
          const templateCompanyName =
            rawData[2] && rawData[2][1] != null ? String(rawData[2][1]).trim() : "";
          const templateIndustry =
            rawData[4] && rawData[4][1] != null ? String(rawData[4][1]).trim() : "";

          if (templateTicker) {
            const headerRow: any[] = rawData[6] || [];
            const yearCols: { year: string; colIdx: number }[] = [];
            for (let c = 2; c < headerRow.length; c++) {
              const cellVal = headerRow[c];
              if (cellVal != null && String(cellVal).trim() !== "") {
                yearCols.push({ year: String(cellVal).trim(), colIdx: c });
              }
            }

            const tk = `${templateTicker} - Parent`;
            if (!storage.financialFull[tk]) storage.financialFull[tk] = {};
            for (const { year } of yearCols) {
              if (!storage.financialFull[tk][year]) storage.financialFull[tk][year] = {};
            }

            for (let r = 7; r < rawData.length; r++) {
              const row = rawData[r];
              if (!row) continue;
              const key = row[0] != null ? String(row[0]).trim() : "";
              if (!key) continue;
              for (const { year, colIdx } of yearCols) {
                const val = row[colIdx];
                if (val !== null && val !== undefined && val !== "") {
                  storage.financialFull[tk][year][key] = val;
                  addedFinancial++;
                }
              }
            }

            if (!storage.companyMap.has(templateTicker)) {
              const newCompany = {
                ma_ck: templateTicker,
                name: templateCompanyName,
                ten_tv: templateCompanyName,
                san: "",
                nganh_1: "",
                nganh_2: templateIndustry,
                nganh_3: "",
                nganh_4: "",
                loai_dn: "",
                von_dieu_le: 0,
              };
              storage.companies.push(newCompany);
              storage.companyMap.set(templateTicker, newCompany);
              addedCompanies++;
            }
          }
        }

        // general_data → company info
        if (workbook.SheetNames.includes("general_data")) {
          parseGeneralSheet(workbook.Sheets["general_data"]);
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      // ── Persist to JSON (auto after upload) ──────────────────────────────
      // Strategy: upsert per company per year, keep max 6 most-recent years
      // per company. Backup old JSON before writing (.bak file).
      const MAX_YEARS = 6;
      const dataDir = path.resolve(process.cwd(), "data");
      let persistWarning = "";

      const pruneYears = (
        data: Record<string, Record<string, Record<string, any>>>
      ): Record<string, Record<string, Record<string, any>>> => {
        const pruned: typeof data = {};
        for (const tk of Object.keys(data)) {
          const years = Object.keys(data[tk]).sort(); // ascending
          const keep = years.slice(-MAX_YEARS);        // keep N most recent
          pruned[tk] = {};
          for (const y of keep) pruned[tk][y] = data[tk][y];
        }
        return pruned;
      };

      const persistJSON = (filename: string, newData: Record<string, any>) => {
        const filePath = path.join(dataDir, filename);
        const bakPath  = path.join(dataDir, filename.replace(".json", ".bak.json"));
        // Backup current file
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, bakPath);
        }
        fs.writeFileSync(filePath, JSON.stringify(newData, null, 2), "utf-8");
      };

      try {
        if (uploadType === "parent" || uploadType === "auto") {
          const pruned = pruneYears(storage.financialFull);
          persistJSON("data_financial_full.json", pruned);
          // Sync in-memory to pruned version
          storage.financialFull = pruned;
        }
        if (uploadType === "consolidated" || uploadType === "auto") {
          const pruned = pruneYears(storage.financialPC);
          persistJSON("data_financial_pc.json", pruned);
          storage.financialPC = pruned;
        }
        if (uploadType === "general" || uploadType === "auto") {
          persistJSON("data_companies.json", storage.companies);
        }
      } catch (persistErr: any) {
        persistWarning = ` (Cảnh báo: không thể lưu vĩnh viễn — ${persistErr.message})`;
      }
      // ─────────────────────────────────────────────────────────────────────

      let message: string;
      if (uploadType === "parent") {
        message = `Đã tải lên và lưu vĩnh viễn dữ liệu Công ty mẹ. Thêm ${addedFinancial} dòng dữ liệu.${persistWarning}`;
      } else if (uploadType === "consolidated") {
        message = `Đã tải lên và lưu vĩnh viễn dữ liệu Hợp nhất. Thêm ${addedFinancial} dòng dữ liệu.${persistWarning}`;
      } else if (uploadType === "general") {
        message = `Đã tải lên và lưu vĩnh viễn thông tin công ty. Thêm ${addedCompanies} công ty mới.${persistWarning}`;
      } else {
        message = `Đã tải lên và lưu vĩnh viễn. Thêm ${addedCompanies} công ty mới, ${addedFinancial} dòng dữ liệu.${persistWarning}`;
      }

      res.json({ success: true, message });
    } catch (error: any) {
      res.status(500).json({ error: `Lỗi xử lý file: ${error.message}` });
    }
  });

  // ── Custom company analysis ─────────────────
  app.post("/api/analyze-custom", (req: Request, res: Response) => {
    const { company_name, nganh_2, financial_data, percentile_low, percentile_high } =
      req.body;
    const pLow: number = typeof percentile_low === "number" ? percentile_low : 25;
    const pHigh: number = typeof percentile_high === "number" ? percentile_high : 75;

    if (!company_name || !nganh_2 || !financial_data) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const years = Object.keys(financial_data).sort().reverse();
    const result: Record<string, any> = {};

    for (const year of years) {
      const currentData = financial_data[year];
      if (!currentData) continue;

      const prevYear = String(parseInt(year) - 1);
      const previousData = financial_data[prevYear] || null;

      const industryData = storage.getIndustryFinancialData(nganh_2, year, "Parent");
      const prevIndustryData = storage.getIndustryFinancialData(nganh_2, prevYear, "Parent");

      const indicators = calculateTiraIndicators(
        currentData,
        previousData,
        year,
        industryData,
        prevIndustryData.length > 0 ? prevIndustryData : null,
        pLow,
        pHigh
      );

      result[year] = indicators;
    }

    res.json({
      target: {
        company: { ma_ck: "CUSTOM", ten_tv: company_name, nganh_2 },
        report_type: "Custom",
        years,
        indicators: result,
      },
      comparisons: {},
    });
  });

  // ════════════════════════════════════════════════════════════
  // Financial Data API
  // GET /api/financial-data/:ticker/:reportType/:year
  // POST /api/financial-data/batch
  // ════════════════════════════════════════════════════════════
  app.get("/api/financial-data/:ticker/:reportType/:year", (req: Request, res: Response) => {
    const { ticker, reportType, year } = req.params;
    const data = storage.getFinancialData(ticker, reportType);
    if (!data || !data[year]) {
      return res.status(404).json({ error: "Không tìm thấy dữ liệu" });
    }
    res.json({ ticker, reportType, year, data: data[year] });
  });

  app.post("/api/financial-data/batch", (req: Request, res: Response) => {
    const { tickers, reportType, years } = req.body;
    const result: Record<string, Record<string, any>> = {};
    for (const ticker of tickers) {
      result[ticker] = {};
      const data = storage.getFinancialData(ticker, reportType);
      if (data) {
        for (const year of years) {
          if (data[year]) result[ticker][year] = data[year];
        }
      }
    }
    res.json(result);
  });

  // ════════════════════════════════════════════════════════════
  // AI Company Suggestion API
  // POST /api/suggest-comparables
  // ════════════════════════════════════════════════════════════
  app.post("/api/suggest-comparables", async (req: Request, res: Response) => {
    const { ticker, company_name, industry } = req.body;

    // Get all companies for validation (after AI responds)
    const allCompanies = storage.searchCompanies("").slice(0, 2000);

    const prompt = `Bạn là chuyên gia phân tích chứng khoán Việt Nam. Tìm 10-15 công ty đã niêm yết trên sàn HOSE, HNX hoặc UPCOM có thể so sánh với:

Công ty mục tiêu: ${ticker} - ${company_name}
Ngành: ${industry}

Hãy sử dụng kiến thức của bạn về thị trường chứng khoán Việt Nam để tìm các công ty phù hợp nhất. Tham khảo thông tin từ:
- congbothongtin.ssc.gov.vn (Ủy ban Chứng khoán Nhà nước)
- cafef.vn
- vietstock.vn

Tiêu chí:
1. Hoạt động kinh doanh TƯƠNG ĐỒNG NHẤT với ${company_name}
2. Ưu tiên: đối thủ cạnh tranh trực tiếp > cùng chuỗi giá trị > cùng phân khúc thị trường
3. Chỉ đưa ra mã chứng khoán THỰC SỰ đang niêm yết trên sàn Việt Nam

Trả lời JSON array:
[{"ticker": "MÃCK", "relevance": "cao/trung bình/thấp", "reason": "Lý do ngắn gọn bằng tiếng Việt"}]

Chỉ trả lời JSON array, không giải thích thêm.`;

    try {
      let response = "";
      // Try OpenAI first, fallback to DeepSeek
      if (openaiClient) {
        const completion = await openaiClient.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1500,
        });
        response = completion.choices[0]?.message?.content || "[]";
      } else if (deepseekClient) {
        const completion = await deepseekClient.chat.completions.create({
          model: DEEPSEEK_MODEL,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1500,
        });
        response = completion.choices[0]?.message?.content || "[]";
      } else if (anthropicClient) {
        const msg = await anthropicClient.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        });
        const block = msg.content[0];
        response = block.type === "text" ? block.text : "[]";
      } else {
        return res.status(400).json({ error: "Không có AI API key nào được cấu hình" });
      }

      // Parse response
      const match = response.match(/\[[\s\S]*\]/);
      if (!match) return res.json({ suggestions: [] });

      let parsed: any[];
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return res.json({ suggestions: [] });
      }

      const validSuggestions = parsed
        .filter((item: any) => item.ticker && allCompanies.some(c => c.ma_ck === item.ticker))
        .filter((item: any) => item.ticker !== ticker)
        .map((item: any) => {
          const company = allCompanies.find(c => c.ma_ck === item.ticker);
          return company ? {
            ma_ck: company.ma_ck,
            ten_tv: company.ten_tv,
            nganh_2: company.nganh_2,
            relevance: item.relevance || "trung bình",
            reason: item.reason || "",
          } : null;
        })
        .filter(Boolean);

      res.json({ suggestions: validSuggestions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════════════════════
  // FEATURE 1: AI Report Generation
  // POST /api/generate-report
  // ════════════════════════════════════════════════════════════
  app.post("/api/generate-report", async (req: Request, res: Response) => {
    try {
      const {
        ticker,
        report_type = "Parent",
        years = [],
        selected_years,
        comparisons = [],
        percentile_low = 25,
        percentile_high = 75,
        report_types = ["financial"],
        ai_model = "claude-haiku",
        language = "vi",
      } = req.body;

      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker" });
      }

      // Check that at least one AI client is available
      const usingDeepSeek = ai_model === "deepseek";
      if (usingDeepSeek && !deepseekClient) {
        return res.status(400).json({
          error:
            "DEEPSEEK_API_KEY is not set. Please set DEEPSEEK_API_KEY or ANTHROPIC_API_KEY environment variable.",
        });
      }
      if (!usingDeepSeek && !anthropicClient && ai_model !== "openai") {
        return res.status(400).json({
          error:
            "ANTHROPIC_API_KEY is not set. Please set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY environment variable.",
        });
      }
      if (ai_model === "openai" && !openaiClient) {
        return res.status(400).json({ error: "OPENAI_API_KEY is not set." });
      }

      // Run analysis
      const analysis = runAnalysis(
        ticker,
        report_type,
        years,
        comparisons,
        percentile_low,
        percentile_high
      );

      if (!analysis) {
        return res.status(404).json({ error: "Company or financial data not found" });
      }

      const { company, selectedYears, finData, targetIndicators, compResults } = analysis;
      const companyName = company.ten_tv || company.name || ticker;

      // Determine which years to include in the report
      const reportYears: string[] = (selected_years && Array.isArray(selected_years) && selected_years.length > 0)
        ? selected_years.filter((y: string) => selectedYears.includes(y))
        : selectedYears;

      const latestYear = reportYears[0];

      // Key financial summary from latest year (compact)
      const latestFin = finData?.[latestYear] || {};
      const financialSummary = `Doanh thu thuần: ${latestFin["210"] || "N/A"}, Giá vốn: ${latestFin["211"] || "N/A"}, LN gộp: ${latestFin["220"] || "N/A"}, LNKT trước thuế: ${latestFin["250"] || "N/A"}, CP thuế hiện hành: ${latestFin["251"] || "N/A"}, LN sau thuế: ${latestFin["260"] || "N/A"}, Tổng TS: ${latestFin["1270"] || "N/A"}, Nợ PT: ${latestFin["1300"] || "N/A"}, VCSH: ${latestFin["1400"] || "N/A"}`;

      // Build per-year risk data
      const analysisResult = { target: { indicators: targetIndicators } };
      const yearSummaries: string[] = [];
      for (const year of reportYears) {
        const yearInds = analysisResult.target.indicators[year] || [];
        const risky = yearInds.filter((i: any) => i.risk_level_1 === "red" || i.risk_level_2 === "red");
        if (risky.length === 0) {
          yearSummaries.push(`Năm ${year}: Không có chỉ số rủi ro.`);
          continue;
        }
        const indSummary = risky.map((i: any) =>
          `  - ${i.id} ${i.name}: ${i.company_value?.toFixed(4) ?? "N/A"}, RR1=${i.risk_level_1}, RR2=${i.risk_level_2}`
        ).join('\n');
        yearSummaries.push(`Năm ${year} (${risky.length} chỉ số rủi ro):\n${indSummary}`);
      }
      let allYearData = yearSummaries.join('\n\n');
      // Truncate if too long (keep under 6000 chars for the data part)
      if (allYearData.length > 6000) {
        allYearData = allYearData.substring(0, 5997) + "...";
      }

      // For backward compat: latest-year risky indicators (used in financial prompt)
      const latestInds = targetIndicators[latestYear] || [];
      const riskyInds = latestInds.filter((i: any) => i.risk_level_1 === "red" || i.risk_level_2 === "red");
      const indicatorSummary = riskyInds.map((i: any) =>
        `${i.id} ${i.name}: value=${i.company_value}, RR1=${i.risk_level_1}, RR2=${i.risk_level_2}, median=${i.industry_median}, range=[${i.industry_p_low}-${i.industry_p_high}]`
      ).join('\n');

      // Generate requested reports
      const generatedReports: Record<string, string> = {};

      const langInstruction = language === "en"
        ? "Write in English. Use professional financial analysis tone."
        : "Viết bằng tiếng Việt. Sử dụng giọng phân tích tài chính chuyên nghiệp.";

      const reportTypeList: string[] = Array.isArray(report_types) ? report_types : ["financial"];

      for (const rType of reportTypeList) {
        let prompt = "";

        if (rType === "financial") {
          prompt = `${langInstruction}

Bạn là chuyên gia phân tích tài chính và tư vấn thuế. Viết báo cáo phân tích tài chính cho công ty ${ticker} (${companyName}), các năm ${reportYears.join(', ')}.

Số liệu chính (${latestYear}): ${financialSummary}

Các chỉ số có rủi ro:
${allYearData}

Yêu cầu:
- Xuất ra định dạng HTML chuẩn (dùng <h2>, <h3>, <p>, <ul>, <li>, <strong>, <table>)
- Báo cáo dài 4-5 trang A4, chuyên nghiệp, sử dụng bullet points
- Tập trung vào rủi ro và mối quan hệ giữa các chỉ số

Cấu trúc báo cáo:
<h2>1. Tóm tắt điều hành (Executive Summary)</h2>
- Tổng quan rủi ro tài chính và thuế trong 3-5 bullet points
- Đánh giá mức độ rủi ro chung

<h2>2. Phân tích tình hình tài chính</h2>
- Doanh thu và lợi nhuận: xu hướng, biến động bất thường
- Cơ cấu tài sản và nợ: những điểm đáng lưu ý
- Hiệu quả hoạt động: các vấn đề nổi bật

<h2>3. Mối quan hệ giữa tài chính và rủi ro thuế</h2>
- Phân tích các mối liên hệ (VD: DT tăng nhưng ETR giảm)
- Các dấu hiệu cảnh báo từ số liệu tài chính

<h2>4. Khuyến nghị</h2>
- Các hành động cần thiết

KHÔNG phân tích các điểm an toàn. Chỉ tập trung vào rủi ro.`;
        } else if (rType === "tax") {
          prompt = `${langInstruction}

Bạn là chuyên gia tư vấn thuế. Viết báo cáo phân tích rủi ro thuế TIRA cho công ty ${ticker} (${companyName}), các năm ${reportYears.join(', ')}.

Dữ liệu chỉ số rủi ro theo từng năm:
${allYearData}

Số liệu tài chính chính (${latestYear}): ${financialSummary}

Yêu cầu:
- Xuất ra định dạng HTML chuẩn (dùng <h2>, <h3>, <p>, <ul>, <li>, <strong>, <table>, <em>)
- Báo cáo dài 4-5 trang A4, chuyên nghiệp, dùng bullet points
- Tập trung vào rủi ro và mối quan hệ giữa các chỉ số

Cấu trúc báo cáo:
<h2>1. Tóm tắt điều hành (Executive Summary)</h2>
- Tổng quan mức độ rủi ro thuế của công ty
- Các rủi ro trọng yếu nhất cần lưu ý
- Xu hướng rủi ro qua các năm

<h2>2. Phân tích Yếu tố rủi ro 1 (Ngưỡng cơ quan thuế)</h2>
- Liệt kê và phân tích các chỉ số vượt ngưỡng CQT
- Giải thích ý nghĩa và hậu quả tiềm tàng
- Dùng bảng HTML nếu cần so sánh số liệu

<h2>3. Phân tích Yếu tố rủi ro 2 (So sánh ngành)</h2>
- Các chỉ số lệch xa phân vị ngành
- So sánh với trung vị và phân tích xu hướng

<h2>4. Mối quan hệ giữa các rủi ro</h2>
- Phân tích cross-reference: VD doanh thu tăng nhưng ETR giảm, lợi nhuận giảm nhưng chi phí thuế tăng
- Các pattern đáng ngờ từ góc nhìn cơ quan thuế

<h2>5. Kết luận và khuyến nghị</h2>
- Đánh giá mức độ rủi ro tổng thể
- Các hành động cần thiết theo thứ tự ưu tiên

KHÔNG phân tích chỉ số an toàn. Viết đầy đủ, không cắt ngắn báo cáo.`;
        } else {
          // Unknown report type — skip gracefully
          continue;
        }

        const reportText = await generateReportText(prompt, ai_model);
        generatedReports[rType] = reportText;
      }

      res.json({
        success: true,
        ticker,
        company_name: companyName,
        years: selectedYears,
        ai_model,
        reports: generatedReports,
      });
    } catch (error: any) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: `Lỗi tạo báo cáo: ${error.message}` });
    }
  });

  // ════════════════════════════════════════════════════════════
  // FEATURE 2: Report History (JSON file persistence)
  // ════════════════════════════════════════════════════════════

  // Save a report
  app.post("/api/reports/save", (req: Request, res: Response) => {
    try {
      const { name, ticker, date, type, report_type, content, analysis_params } = req.body;

      if (!ticker) {
        return res.status(400).json({ error: "Missing required field: ticker" });
      }

      // Extract user if authenticated
      let userId = "anonymous";
      const authH = req.headers.authorization;
      if (authH?.startsWith("Bearer ")) {
        const p = verifyToken(authH.slice(7));
        if (p) userId = p.id;
      }

      const record: ReportRecord = {
        id: uuidv4(),
        name:
          name ||
          `${ticker} - ${date || new Date().toISOString().split("T")[0]} - ${
            type === "tax" ? "Phân tích rủi ro thuế" : "Phân tích tài chính"
          }`,
        ticker,
        created_at: new Date().toISOString(),
        report_type: type || report_type || "financial",
        content,
        analysis_params: analysis_params || {},
        user_id: userId,
      };

      reportHistory.push(record);
      saveHistory(reportHistory);

      res.json({ success: true, id: record.id, record });
    } catch (error: any) {
      res.status(500).json({ error: `Lỗi lưu báo cáo: ${error.message}` });
    }
  });

  // List all reports
  app.get("/api/reports", (req: Request, res: Response) => {
    // Filter by user
    const authH2 = req.headers.authorization;
    let filteredReports = reportHistory;
    if (authH2?.startsWith("Bearer ")) {
      const p = verifyToken(authH2.slice(7));
      if (p && p.role !== "admin") {
        filteredReports = reportHistory.filter(r => r.user_id === p.id || r.user_id === "anonymous");
      }
    }

    // Return list sorted newest first, without heavy content field but with has_content flag
    const items = filteredReports
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map(r => ({
        ...r,
        has_content: !!r.content && r.content.length > 0,
        content: undefined, // Don't send content in list
      }));
    res.json(items);
  });

  // Get a specific report
  app.get("/api/reports/:id", (req: Request, res: Response) => {
    const record = reportHistory.find((r) => r.id === req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(record);
  });

  // Chart data for AI reports
  app.post("/api/report-charts", (req: Request, res: Response) => {
    const { ticker, report_type, years } = req.body;

    // Get financial data for trend charts
    const finData = storage.getFinancialData(ticker, report_type);
    if (!finData) return res.json({ charts: [] });

    const charts: any[] = [];

    // Chart 1: Revenue & Profit trend
    const revenueTrend = years.map((y: string) => ({
      year: y,
      revenue: finData[y]?.["210"] || 0,
      profit: finData[y]?.["260"] || 0,
      tax: finData[y]?.["251"] || 0,
    })).reverse();
    charts.push({ type: "revenue_trend", title: "Xu hướng Doanh thu - Lợi nhuận - Thuế", data: revenueTrend });

    // Chart 2: Key ratios
    const ratios = years.map((y: string) => {
      const rev = finData[y]?.["210"] || 1;
      const pbt = finData[y]?.["250"] || 0;
      const tax = finData[y]?.["251"] || 0;
      return {
        year: y,
        gross_margin: ((finData[y]?.["220"] || 0) / rev * 100).toFixed(1),
        net_margin: ((finData[y]?.["260"] || 0) / rev * 100).toFixed(1),
        etr: (Math.abs(tax) / Math.abs(pbt || 1) * 100).toFixed(1),
      };
    }).reverse();
    charts.push({ type: "ratios", title: "Biên lợi nhuận và ETR", data: ratios });

    res.json({ charts });
  });

  // Delete a report
  app.delete("/api/reports/:id", (req: Request, res: Response) => {
    const idx = reportHistory.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Report not found" });
    }
    reportHistory.splice(idx, 1);
    saveHistory(reportHistory);
    res.json({ success: true });
  });

  // ════════════════════════════════════════════════════════════
  // FEATURE 3: Template Excel Download
  // GET /api/template/download
  // ════════════════════════════════════════════════════════════
  app.get("/api/template/download", (_req: Request, res: Response) => {
    const templatePath = path.resolve(process.cwd(), "data", "tira_template.xlsx");

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Template file not found" });
    }

    res.download(templatePath, "tira_template.xlsx", (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: "Error sending template file" });
      }
    });
  });

  // ========= AUTH ROUTES =========
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username và password là bắt buộc" });
    const result = login(username, password);
    if (!result) return res.status(401).json({ error: "Sai username hoặc password" });
    res.json(result);
  });

  app.post("/api/auth/register", (req: Request, res: Response) => {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username và password là bắt buộc" });
    if (password.length < 6) return res.status(400).json({ error: "Password phải có ít nhất 6 ký tự" });
    const user = register(username, password, email);
    if (!user) return res.status(409).json({ error: "Username đã tồn tại" });
    const { password_hash, ...safe } = user;
    res.json({ success: true, user: safe });
  });

  app.post("/api/auth/forgot-password", (req: Request, res: Response) => {
    const { username, new_password } = req.body;
    if (!username || !new_password) return res.status(400).json({ error: "Thiếu thông tin" });
    // In production, this should send email. For now, admin can reset.
    // Only allow if request comes from admin
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const payload = verifyToken(authHeader.slice(7));
      if (payload?.role === "admin") {
        const ok = resetPassword(username, new_password);
        if (!ok) return res.status(404).json({ error: "User không tồn tại" });
        return res.json({ success: true });
      }
    }
    return res.status(403).json({ error: "Chỉ admin mới có thể reset password" });
  });

  app.get("/api/auth/me", authMiddleware, (req: any, res: Response) => {
    res.json({ user: req.user });
  });

  // ========= ADMIN ROUTES =========
  app.get("/api/admin/users", authMiddleware, requireRole("admin"), (_req: Request, res: Response) => {
    res.json(getAllUsers());
  });

  app.patch("/api/admin/users/:userId/role", authMiddleware, requireRole("admin"), (req: any, res: Response) => {
    const { role } = req.body;
    if (!["admin", "editor", "viewer"].includes(role)) return res.status(400).json({ error: "Role không hợp lệ" });
    const ok = updateUserRole(req.params.userId, role);
    if (!ok) return res.status(404).json({ error: "User không tìm thấy" });
    res.json({ success: true });
  });

  app.delete("/api/admin/users/:userId", authMiddleware, requireRole("admin"), (req: any, res: Response) => {
    const ok = deleteUser(req.params.userId);
    if (!ok) return res.status(404).json({ error: "User không tìm thấy" });
    res.json({ success: true });
  });

  // ========= RISK WEIGHTS ROUTES =========
  app.get("/api/risk-weights", (_req: Request, res: Response) => {
    res.json(getDefaultWeights());
  });

  app.put("/api/risk-weights", authMiddleware, requireRole("admin"), (req: any, res: Response) => {
    const { weights } = req.body;
    if (!Array.isArray(weights)) return res.status(400).json({ error: "weights phải là array" });
    updateDefaultWeights(weights);
    res.json({ success: true });
  });

  app.post("/api/risk-score", (req: Request, res: Response) => {
    const { indicators, weights } = req.body;
    if (!Array.isArray(indicators)) return res.status(400).json({ error: "indicators phải là array" });
    const result = calculateCompositeScore(indicators, weights);
    res.json(result);
  });

  app.post("/api/risk-score/multi-year", (req: Request, res: Response) => {
    const { yearIndicators, weights } = req.body;
    // yearIndicators: { [year: string]: indicator[] }
    if (!yearIndicators || typeof yearIndicators !== "object") {
      return res.status(400).json({ error: "yearIndicators required" });
    }

    const yearScores = Object.entries(yearIndicators).map(([year, inds]: [string, any]) => {
      const result = calculateYearScore(inds, weights);
      return { year, score: result.score, breakdown: result.breakdown };
    });

    const multiYear = calculateMultiYearScore(yearScores);
    res.json({ yearScores, multiYear });
  });

  // ════════════════════════════════════════════════════════════
  // FEATURE 4: Save / Load Analysis Params
  // ════════════════════════════════════════════════════════════

  // Save analysis
  app.post("/api/analyses/save", (req: Request, res: Response) => {
    try {
      const { ticker, report_type, years, comparisons, percentile_low, percentile_high, name } = req.body;
      let userId = "anonymous";
      const authH = req.headers.authorization;
      if (authH?.startsWith("Bearer ")) {
        const p = verifyToken(authH.slice(7));
        if (p) userId = p.id;
      }

      const analysis = {
        id: uuidv4(),
        name: name || `${ticker} - ${new Date().toLocaleDateString("vi-VN")}`,
        ticker,
        report_type,
        years,
        comparisons,
        percentile_low: percentile_low || 25,
        percentile_high: percentile_high || 75,
        user_id: userId,
        created_at: new Date().toISOString(),
      };

      // Load existing analyses
      const analysesFile = path.resolve(process.cwd(), "data", "saved_analyses.json");
      let analyses: any[] = [];
      try {
        if (fs.existsSync(analysesFile)) {
          analyses = JSON.parse(fs.readFileSync(analysesFile, "utf-8"));
        }
      } catch {}
      analyses.unshift(analysis);
      fs.writeFileSync(analysesFile, JSON.stringify(analyses, null, 2));

      res.json({ success: true, analysis });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // List analyses
  app.get("/api/analyses", (req: Request, res: Response) => {
    const analysesFile = path.resolve(process.cwd(), "data", "saved_analyses.json");
    let analyses: any[] = [];
    try {
      if (fs.existsSync(analysesFile)) {
        analyses = JSON.parse(fs.readFileSync(analysesFile, "utf-8"));
      }
    } catch {}

    // Filter by user
    const authH = req.headers.authorization;
    if (authH?.startsWith("Bearer ")) {
      const p = verifyToken(authH.slice(7));
      if (p && p.role !== "admin") {
        analyses = analyses.filter((a: any) => a.user_id === p.id || a.user_id === "anonymous");
      }
    }

    res.json(analyses);
  });

  // Delete analysis
  app.delete("/api/analyses/:id", (req: Request, res: Response) => {
    const analysesFile = path.resolve(process.cwd(), "data", "saved_analyses.json");
    let analyses: any[] = [];
    try {
      if (fs.existsSync(analysesFile)) {
        analyses = JSON.parse(fs.readFileSync(analysesFile, "utf-8"));
      }
    } catch {}
    analyses = analyses.filter((a: any) => a.id !== req.params.id);
    fs.writeFileSync(analysesFile, JSON.stringify(analyses, null, 2));
    res.json({ success: true });
  });

  return httpServer;
}

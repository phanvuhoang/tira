import type { Express, Request, Response } from "express";
import type { Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { calculateTiraIndicators } from "./tira-engine";

const upload = multer({ dest: "/tmp/uploads/" });

export async function registerRoutes(httpServer: Server, app: Express) {
  // Load data on startup
  await storage.loadData();

  // Search companies
  app.get("/api/companies/search", (req: Request, res: Response) => {
    const query = (req.query.q as string) || "";
    const results = storage.searchCompanies(query);
    res.json(results);
  });

  // Get all companies (paginated)
  app.get("/api/companies", (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const nganh_2 = req.query.nganh_2 as string;
    
    let filtered = storage.companies;
    if (nganh_2) {
      filtered = filtered.filter(c => c.nganh_2 === nganh_2);
    }
    
    const start = (page - 1) * limit;
    res.json({
      data: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    });
  });

  // Get company details
  app.get("/api/companies/:ma_ck", (req: Request, res: Response) => {
    const company = storage.getCompany(req.params.ma_ck);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    
    // Check available report types
    const hasParent = !!storage.getFinancialData(req.params.ma_ck, "Parent");
    const hasConsolidated = !!storage.getFinancialData(req.params.ma_ck, "Consolidated");
    
    // Get available years
    const finData = storage.getFinancialData(req.params.ma_ck, hasParent ? "Parent" : "Consolidated");
    const years = finData ? Object.keys(finData).sort().reverse() : [];
    
    res.json({
      ...company,
      hasParent,
      hasConsolidated,
      availableYears: years,
    });
  });

  // Get suggested comparables
  app.get("/api/companies/:ma_ck/comparables", (req: Request, res: Response) => {
    const company = storage.getCompany(req.params.ma_ck);
    if (!company || !company.nganh_2) {
      return res.json([]);
    }
    
    const reportType = (req.query.report_type as string) || "Parent";
    const sameIndustry = storage.getIndustryCompanies(company.nganh_2)
      .filter(c => c.ma_ck !== req.params.ma_ck)
      .filter(c => !!storage.getFinancialData(c.ma_ck, reportType));
    
    // Sort by von_dieu_le similarity
    const targetVon = company.von_dieu_le || 0;
    sameIndustry.sort((a, b) => {
      const diffA = Math.abs((a.von_dieu_le || 0) - targetVon);
      const diffB = Math.abs((b.von_dieu_le || 0) - targetVon);
      return diffA - diffB;
    });
    
    res.json(sameIndustry.slice(0, 20));
  });

  // Get unique industries
  app.get("/api/industries", (req: Request, res: Response) => {
    const industries = storage.getUniqueIndustries();
    res.json(industries);
  });

  // Main analysis endpoint
  app.post("/api/analyze", (req: Request, res: Response) => {
    const { target_ticker, report_type, comparison_tickers, years, percentile_low, percentile_high } = req.body;
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
      
      // Get industry data for benchmarking
      const industryData = storage.getIndustryFinancialData(
        company.nganh_2 || "", year, report_type
      );
      const prevIndustryData = storage.getIndustryFinancialData(
        company.nganh_2 || "", prevYear, report_type
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
          compCompany.nganh_2 || "", year, report_type
        );
        const prevIndustryData = storage.getIndustryFinancialData(
          compCompany.nganh_2 || "", prevYear, report_type
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

  // Upload new data
  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const XLSX = await import("xlsx");
      const workbook = XLSX.readFile(req.file.path);
      
      let addedCompanies = 0;
      let addedFinancial = 0;

      // Parse financial_full sheet
      if (workbook.SheetNames.includes("financial_full")) {
        const ws = workbook.Sheets["financial_full"];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (data.length > 3) {
          const dateRow = data[1];
          const tickerRow = data[2];
          
          for (let col = 2; col < dateRow.length; col++) {
            const dateVal = dateRow[col];
            const tickerVal = tickerRow[col];
            if (!dateVal || !tickerVal) continue;
            
            const year = String(dateVal).substring(0, 4);
            const tk = `${tickerVal} - Parent`;
            
            if (!storage.financialFull[tk]) {
              storage.financialFull[tk] = {};
            }
            if (!storage.financialFull[tk][year]) {
              storage.financialFull[tk][year] = {};
            }
            
            for (let row = 3; row < data.length; row++) {
              const key = String(data[row][0]);
              const val = data[row][col];
              if (key && val !== undefined && val !== null) {
                storage.financialFull[tk][year][key] = val;
                addedFinancial++;
              }
            }
          }
        }
      }

      // Parse general_data sheet for new companies
      if (workbook.SheetNames.includes("general_data")) {
        const ws = workbook.Sheets["general_data"];
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
      }

      // Clean up uploaded file
      const fs = await import("fs");
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Đã tải lên thành công. Thêm ${addedCompanies} công ty mới, ${addedFinancial} dòng dữ liệu tài chính.`,
      });
    } catch (error: any) {
      res.status(500).json({ error: `Lỗi xử lý file: ${error.message}` });
    }
  });

  // Custom company analysis
  app.post("/api/analyze-custom", (req: Request, res: Response) => {
    const { company_name, nganh_2, financial_data, percentile_low, percentile_high } = req.body;
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

  return httpServer;
}

import { z } from "zod";

// Company info
export const companySchema = z.object({
  ma_ck: z.string(),
  ten_tv: z.string(),
  san: z.string().optional(),
  nganh_1: z.string().optional(),
  nganh_2: z.string().optional(),
  nganh_3: z.string().optional(),
  nganh_4: z.string().optional(),
  loai_dn: z.string().optional(),
  von_dieu_le: z.number().optional(),
  name: z.string().optional(),
});

export type Company = z.infer<typeof companySchema>;

// Financial data for a single company-year
export const financialDataSchema = z.record(z.string(), z.any());
export type FinancialData = z.infer<typeof financialDataSchema>;

// TIRA indicator result
export const tiraIndicatorSchema = z.object({
  id: z.string(),
  group: z.string(),
  name: z.string(),
  risk_factor: z.string(),
  company_value: z.number().nullable(),
  industry_range: z.string().nullable(),
  industry_p35: z.number().nullable(),
  industry_p65: z.number().nullable(),
  risk_level: z.enum(["green", "yellow", "red", "gray"]), // backward compat (= risk_level_1)
  risk_level_1: z.enum(["green", "red", "gray"]),         // absolute threshold (CQT)
  risk_level_2: z.enum(["green", "red", "gray"]),         // IQR / percentile comparison
  industry_median: z.number().nullable(),
  industry_p_low: z.number().nullable(),   // configurable lower percentile
  industry_p_high: z.number().nullable(),  // configurable upper percentile
});

export type TiraIndicator = z.infer<typeof tiraIndicatorSchema>;

// TIRA result for a company across years
export const tiraResultSchema = z.object({
  ticker: z.string(),
  company_name: z.string(),
  report_type: z.string(),
  years: z.array(z.string()),
  indicators: z.record(z.string(), z.array(tiraIndicatorSchema)), // year -> indicators
});

export type TiraResult = z.infer<typeof tiraResultSchema>;

// Request schemas
export const analyzeRequestSchema = z.object({
  target_ticker: z.string(),
  report_type: z.enum(["Parent", "Consolidated"]),
  comparison_tickers: z.array(z.string()).optional(),
  years: z.array(z.string()).optional(),
  percentile_low: z.number().min(0).max(100).optional(),  // default 25
  percentile_high: z.number().min(0).max(100).optional(), // default 75
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

// Custom company data
export const customCompanySchema = z.object({
  company_name: z.string(),
  nganh_2: z.string(),
  financial_data: z.record(z.string(), z.record(z.string(), z.number())), // year -> {key: value}
});

export type CustomCompany = z.infer<typeof customCompanySchema>;

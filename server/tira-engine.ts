// TIRA - Tax Index Risk Analysis Engine
// Calculates 24+ tax risk indicators from financial statement data

import type { TiraIndicator } from "../shared/schema";

// Financial statement key mappings
const KEYS = {
  // Balance Sheet (BC1)
  TOTAL_ASSETS: "1270",
  CURRENT_ASSETS: "1100",
  LONG_TERM_ASSETS: "1200",
  TOTAL_LIABILITIES: "1300",
  SHORT_TERM_LIABILITIES: "1310",
  TAX_PAYABLE: "1313",
  LONG_TERM_LIABILITIES: "1330",
  EQUITY: "1400",
  EQUITY_DETAIL: "1410",
  CONTRIBUTED_CAPITAL: "1411",
  INVENTORY: "1140",
  SHORT_TERM_RECEIVABLES: "1130",
  TRADE_RECEIVABLES: "1131",
  VAT_DEDUCTIBLE: "1152",
  FIXED_ASSETS: "1220",
  TANGIBLE_FIXED_ASSETS: "1221",
  TANGIBLE_FA_COST: "1222",
  TANGIBLE_FA_DEPRECIATION: "1223",
  RETAINED_EARNINGS: "1418",
  PREPAID_SHORT: "1151",
  PREPAID_LONG: "1261",
  // P&L (BC2)
  GROSS_REVENUE: "21",
  REVENUE_DEDUCTIONS: "22",
  NET_REVENUE: "210",
  COGS: "211",
  GROSS_PROFIT: "220",
  FINANCIAL_INCOME: "221",
  FINANCIAL_EXPENSE: "222",
  INTEREST_EXPENSE: "223",
  SELLING_EXPENSE: "225",
  ADMIN_EXPENSE: "226",
  OPERATING_PROFIT: "230",
  PBT: "250",
  CURRENT_TAX: "251",
  DEFERRED_TAX: "252",
  NET_INCOME: "260",
  // Cash Flow (BC5)
  DEPRECIATION: "5121",
  CFO: "51",
};

type FinData = Record<string, any>;

function safeNum(val: any): number | null {
  if (val === null || val === undefined || val === "" || val === "None") return null;
  const n = Number(val);
  return isFinite(n) ? n : null;
}

function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

// Get value from financial data
function getVal(data: FinData, key: string): number | null {
  return safeNum(data[key]);
}

// Determine risk level for an indicator
function riskLevel(
  value: number | null,
  p35: number | null,
  p65: number | null,
  riskCheck: (v: number) => boolean,
  higherIsBetter: boolean = true
): "green" | "yellow" | "red" | "gray" {
  if (value === null) return "gray";
  
  // Check risk condition first
  if (riskCheck(value)) return "red";
  
  // Check industry range
  if (p35 !== null && p65 !== null) {
    if (higherIsBetter) {
      if (value > p65) return "green";
      if (value >= p35) return "yellow";
      return "red";
    } else {
      if (value < p35) return "green";
      if (value <= p65) return "yellow";
      return "red";
    }
  }
  
  return "yellow";
}

// Calculate all TIRA indicators for a single company-year
export function calculateTiraIndicators(
  currentData: FinData,
  previousData: FinData | null,
  year: string,
  industryData: FinData[], // all companies in same industry for this year
  previousIndustryData: FinData[] | null, // all companies in same industry for previous year
  percentileLow: number = 25,
  percentileHigh: number = 75,
): TiraIndicator[] {
  const indicators: TiraIndicator[] = [];

  function formatPct(v: number | null): string {
    if (v === null) return "N/A";
    return (v * 100).toFixed(1) + "%";
  }

  // Helper to calc industry percentiles at configurable levels + median
  function calcPercentiles(values: (number | null)[], pLow: number = percentileLow, pHigh: number = percentileHigh): {
    p_low: number | null; p_high: number | null; median: number | null; range: string | null
  } {
    const valid = values.filter((v): v is number => v !== null && isFinite(v));
    if (valid.length < 3) return { p_low: null, p_high: null, median: null, range: null };
    valid.sort((a, b) => a - b);
    const pLowIdx = Math.floor(valid.length * (pLow / 100));
    const pHighIdx = Math.floor(valid.length * (pHigh / 100));
    const medIdx = Math.floor(valid.length * 0.50);
    const p_low = valid[Math.min(pLowIdx, valid.length - 1)];
    const p_high = valid[Math.min(pHighIdx, valid.length - 1)];
    const median = valid[Math.min(medIdx, valid.length - 1)];
    return {
      p_low,
      p_high,
      median,
      range: `(${formatPct(p_low)} - ${formatPct(p_high)})`,
    };
  }

  function calcPercentilesAbs(values: (number | null)[], pLow: number = percentileLow, pHigh: number = percentileHigh): {
    p_low: number | null; p_high: number | null; median: number | null; range: string | null
  } {
    const valid = values.filter((v): v is number => v !== null && isFinite(v));
    if (valid.length < 3) return { p_low: null, p_high: null, median: null, range: null };
    valid.sort((a, b) => a - b);
    const pLowIdx = Math.floor(valid.length * (pLow / 100));
    const pHighIdx = Math.floor(valid.length * (pHigh / 100));
    const medIdx = Math.floor(valid.length * 0.50);
    const p_low = valid[Math.min(pLowIdx, valid.length - 1)];
    const p_high = valid[Math.min(pHighIdx, valid.length - 1)];
    const median = valid[Math.min(medIdx, valid.length - 1)];
    return {
      p_low,
      p_high,
      median,
      range: `(${p_low.toFixed(2)} - ${p_high.toFixed(2)})`,
    };
  }

  // risk_level_2: IQR / percentile comparison (higher-is-better by default)
  // If higherIsBetter=true: below p_low => red, within range => green, above p_high => green
  // If higherIsBetter=false (cost/risk metric): above p_high => red, within range => green, below p_low => green
  function calcRiskLevel2(
    value: number | null,
    p_low: number | null,
    p_high: number | null,
    higherIsBetter: boolean = true
  ): "green" | "red" | "gray" {
    if (value === null) return "gray";
    if (p_low === null || p_high === null) return "gray";
    if (higherIsBetter) {
      // lower-is-worse: below p_low => red, else green
      return value < p_low ? "red" : "green";
    } else {
      // lower-is-better (cost/risk): above p_high => red, else green
      return value > p_high ? "red" : "green";
    }
  }

  // === Values ===
  const netRevenue = getVal(currentData, KEYS.NET_REVENUE);
  const netRevenuePrev = previousData ? getVal(previousData, KEYS.NET_REVENUE) : null;
  const grossRevenue = getVal(currentData, KEYS.GROSS_REVENUE);
  const revenueDeductions = getVal(currentData, KEYS.REVENUE_DEDUCTIONS);
  const cogs = getVal(currentData, KEYS.COGS);
  const cogsPrev = previousData ? getVal(previousData, KEYS.COGS) : null;
  const grossProfit = getVal(currentData, KEYS.GROSS_PROFIT);
  const grossProfitPrev = previousData ? getVal(previousData, KEYS.GROSS_PROFIT) : null;
  const sellingExp = getVal(currentData, KEYS.SELLING_EXPENSE);
  const adminExp = getVal(currentData, KEYS.ADMIN_EXPENSE);
  const sga = (sellingExp !== null ? Math.abs(sellingExp) : 0) + (adminExp !== null ? Math.abs(adminExp) : 0);
  const sgaPrev = previousData ? (
    (safeNum(previousData[KEYS.SELLING_EXPENSE]) !== null ? Math.abs(safeNum(previousData[KEYS.SELLING_EXPENSE])!) : 0) +
    (safeNum(previousData[KEYS.ADMIN_EXPENSE]) !== null ? Math.abs(safeNum(previousData[KEYS.ADMIN_EXPENSE])!) : 0)
  ) : null;
  const pbt = getVal(currentData, KEYS.PBT);
  const pbtPrev = previousData ? getVal(previousData, KEYS.PBT) : null;
  const currentTax = getVal(currentData, KEYS.CURRENT_TAX);
  const currentTaxPrev = previousData ? getVal(previousData, KEYS.CURRENT_TAX) : null;
  const deferredTax = getVal(currentData, KEYS.DEFERRED_TAX);
  const netIncome = getVal(currentData, KEYS.NET_INCOME);
  const totalAssets = getVal(currentData, KEYS.TOTAL_ASSETS);
  const totalAssetsPrev = previousData ? getVal(previousData, KEYS.TOTAL_ASSETS) : null;
  const currentAssets = getVal(currentData, KEYS.CURRENT_ASSETS);
  const currentAssetsPrev = previousData ? getVal(previousData, KEYS.CURRENT_ASSETS) : null;
  const totalLiabilities = getVal(currentData, KEYS.TOTAL_LIABILITIES);
  const equity = getVal(currentData, KEYS.EQUITY);
  const equityPrev = previousData ? getVal(previousData, KEYS.EQUITY) : null;
  const taxPayable = getVal(currentData, KEYS.TAX_PAYABLE);
  const vatDeductible = getVal(currentData, KEYS.VAT_DEDUCTIBLE);
  const vatDeductiblePrev = previousData ? getVal(previousData, KEYS.VAT_DEDUCTIBLE) : null;
  const retainedEarnings = getVal(currentData, KEYS.RETAINED_EARNINGS);
  const inventory = getVal(currentData, KEYS.INVENTORY);
  const inventoryPrev = previousData ? getVal(previousData, KEYS.INVENTORY) : null;
  const tradeReceivables = getVal(currentData, KEYS.TRADE_RECEIVABLES);
  const tradeReceivablesPrev = previousData ? getVal(previousData, KEYS.TRADE_RECEIVABLES) : null;
  const interestExpense = getVal(currentData, KEYS.INTEREST_EXPENSE);
  const depreciation = getVal(currentData, KEYS.DEPRECIATION);
  const tangibleFACost = getVal(currentData, KEYS.TANGIBLE_FA_COST);
  const tangibleFACostPrev = previousData ? getVal(previousData, KEYS.TANGIBLE_FA_COST) : null;
  const tangibleFADepr = getVal(currentData, KEYS.TANGIBLE_FA_DEPRECIATION);
  const tangibleFADeprPrev = previousData ? getVal(previousData, KEYS.TANGIBLE_FA_DEPRECIATION) : null;
  const fixedAssets = getVal(currentData, KEYS.FIXED_ASSETS);
  const fixedAssetsPrev = previousData ? getVal(previousData, KEYS.FIXED_ASSETS) : null;
  const cfo = getVal(currentData, KEYS.CFO);

  // Calculated values
  const taxExpenseTotal = (currentTax !== null ? Math.abs(currentTax) : 0) + (deferredTax !== null ? Math.abs(deferredTax) : 0);
  const ebitda = pbt !== null && interestExpense !== null && depreciation !== null
    ? pbt + Math.abs(interestExpense) + Math.abs(depreciation)
    : null;
  
  // Industry calcs helper
  function industryCalc(calcFn: (d: FinData) => number | null): {
    p_low: number | null; p_high: number | null; median: number | null; range: string | null;
    // legacy aliases
    p35: number | null; p65: number | null;
  } {
    const vals = industryData.map(calcFn);
    const r = calcPercentiles(vals);
    return { ...r, p35: r.p_low, p65: r.p_high };
  }

  function industryCalcAbs(calcFn: (d: FinData) => number | null): {
    p_low: number | null; p_high: number | null; median: number | null; range: string | null;
    p35: number | null; p65: number | null;
  } {
    const vals = industryData.map(calcFn);
    const r = calcPercentilesAbs(vals);
    return { ...r, p35: r.p_low, p65: r.p_high };
  }

  // Industry calcs with YoY (needs previous year data)
  function industryCalcYoY(
    calcFnCurrent: (d: FinData) => number | null,
    calcFnPrev: (d: FinData) => number | null
  ): {
    p_low: number | null; p_high: number | null; median: number | null; range: string | null;
    p35: number | null; p65: number | null;
  } {
    if (!previousIndustryData) return { p_low: null, p_high: null, median: null, range: null, p35: null, p65: null };
    const vals: (number | null)[] = [];
    for (let i = 0; i < industryData.length; i++) {
      const curr = calcFnCurrent(industryData[i]);
      const prev = i < previousIndustryData.length ? calcFnPrev(previousIndustryData[i]) : null;
      vals.push(pctChange(curr, prev));
    }
    const r = calcPercentiles(vals);
    return { ...r, p35: r.p_low, p65: r.p_high };
  }

  // ============= CRITICAL RED LINES =============
  
  // 0.1 Chi phí thuế / Doanh thu
  const taxRevRatio = currentTax !== null && netRevenue !== null && netRevenue !== 0
    ? Math.abs(currentTax) / Math.abs(netRevenue) : null;
  const ind01 = industryCalc(d => {
    const tax = safeNum(d[KEYS.CURRENT_TAX]);
    const rev = safeNum(d[KEYS.NET_REVENUE]);
    return tax !== null && rev !== null && rev !== 0 ? Math.abs(tax) / Math.abs(rev) : null;
  });
  const rl1_01: "green" | "red" | "gray" = taxRevRatio === null ? "gray" : taxRevRatio < 0.02 ? "red" : "green";
  const rl2_01 = calcRiskLevel2(taxRevRatio, ind01.p_low, ind01.p_high, true);
  indicators.push({
    id: "0.1",
    group: "CRITICAL RED LINES",
    name: "Chi phí thuế / Doanh thu",
    risk_factor: "Thấp hơn thuế suất hộ KD ngành: 2%",
    company_value: taxRevRatio,
    industry_range: ind01.range,
    industry_p35: ind01.p_low,
    industry_p65: ind01.p_high,
    risk_level: rl1_01,
    risk_level_1: rl1_01,
    risk_level_2: rl2_01,
    industry_median: ind01.median,
    industry_p_low: ind01.p_low,
    industry_p_high: ind01.p_high,
  });

  // 0.2 Biến động LNKT trước thuế / DT
  const pbtMargin = safeDiv(pbt, netRevenue);
  const pbtMarginPrev = previousData ? safeDiv(pbtPrev, netRevenuePrev) : null;
  const pbtMarginChange = pbtMargin !== null && pbtMarginPrev !== null ? pbtMargin - pbtMarginPrev : null;
  const ind02 = industryCalc(d => safeDiv(safeNum(d[KEYS.PBT]), safeNum(d[KEYS.NET_REVENUE])));
  const rl1_02: "green" | "red" | "gray" = pbtMarginChange === null
    ? (pbtMargin === null ? "gray" : "green")
    : pbtMarginChange <= -0.10 ? "red" : "green";
  const rl2_02 = calcRiskLevel2(pbtMargin, ind02.p_low, ind02.p_high, true);
  indicators.push({
    id: "0.2",
    group: "CRITICAL RED LINES",
    name: "Biến động LN kế toán trước thuế / Doanh thu",
    risk_factor: "Giảm từ 10% trở lên so với năm trước",
    company_value: pbtMargin,
    industry_range: ind02.range,
    industry_p35: ind02.p_low,
    industry_p65: ind02.p_high,
    risk_level: rl1_02,
    risk_level_1: rl1_02,
    risk_level_2: rl2_02,
    industry_median: ind02.median,
    industry_p_low: ind02.p_low,
    industry_p_high: ind02.p_high,
  });

  // 0.3 Biến động doanh thu thuần
  const revChange = pctChange(netRevenue, netRevenuePrev);
  const ind03b = industryCalcYoY(
    d => safeNum(d[KEYS.NET_REVENUE]),
    d => safeNum(d[KEYS.NET_REVENUE])
  );
  const rl1_03: "green" | "red" | "gray" = revChange === null ? "gray" : revChange <= -0.10 ? "red" : "green";
  const rl2_03 = calcRiskLevel2(revChange, ind03b.p_low, ind03b.p_high, true);
  indicators.push({
    id: "0.3",
    group: "CRITICAL RED LINES",
    name: "Biến động doanh thu thuần",
    risk_factor: "Giảm từ 10% trở lên so với năm trước",
    company_value: revChange,
    industry_range: ind03b.range,
    industry_p35: ind03b.p_low,
    industry_p65: ind03b.p_high,
    risk_level: rl1_03,
    risk_level_1: rl1_03,
    risk_level_2: rl2_03,
    industry_median: ind03b.median,
    industry_p_low: ind03b.p_low,
    industry_p_high: ind03b.p_high,
  });

  // ============= REVENUE - PROFITS - TAX =============

  // 1.1 Thuế suất hiệu quả
  const etr = pbt !== null && pbt !== 0 && currentTax !== null ? Math.abs(currentTax) / Math.abs(pbt) : null;
  const ind11 = industryCalc(d => {
    const p = safeNum(d[KEYS.PBT]);
    const t = safeNum(d[KEYS.CURRENT_TAX]);
    return p && p !== 0 && t !== null ? Math.abs(t) / Math.abs(p) : null;
  });
  const rl1_11: "green" | "red" | "gray" = etr === null ? "gray" : etr < 0.15 ? "red" : "green";
  const rl2_11 = calcRiskLevel2(etr, ind11.p_low, ind11.p_high, true);
  indicators.push({
    id: "1.1",
    group: "DOANH THU - LỢI NHUẬN - THUẾ",
    name: "Thuế suất hiệu quả (ETR)",
    risk_factor: "Dưới 15%",
    company_value: etr,
    industry_range: ind11.range,
    industry_p35: ind11.p_low,
    industry_p65: ind11.p_high,
    risk_level: rl1_11,
    risk_level_1: rl1_11,
    risk_level_2: rl2_11,
    industry_median: ind11.median,
    industry_p_low: ind11.p_low,
    industry_p_high: ind11.p_high,
  });

  // 1.2 Thuế suất hiệu quả gộp  
  const etrGross = pbt !== null && pbt !== 0 ? taxExpenseTotal / Math.abs(pbt) : null;
  const ind12 = industryCalc(d => {
    const p = safeNum(d[KEYS.PBT]);
    const t1 = safeNum(d[KEYS.CURRENT_TAX]);
    const t2 = safeNum(d[KEYS.DEFERRED_TAX]);
    const total = (t1 !== null ? Math.abs(t1) : 0) + (t2 !== null ? Math.abs(t2) : 0);
    return p && p !== 0 ? total / Math.abs(p) : null;
  });
  const rl1_12: "green" | "red" | "gray" = etrGross === null ? "gray" : etrGross < 0.15 ? "red" : "green";
  const rl2_12 = calcRiskLevel2(etrGross, ind12.p_low, ind12.p_high, true);
  indicators.push({
    id: "1.2",
    group: "DOANH THU - LỢI NHUẬN - THUẾ",
    name: "Thuế suất hiệu quả gộp",
    risk_factor: "Dưới 15%",
    company_value: etrGross,
    industry_range: ind12.range,
    industry_p35: ind12.p_low,
    industry_p65: ind12.p_high,
    risk_level: rl1_12,
    risk_level_1: rl1_12,
    risk_level_2: rl2_12,
    industry_median: ind12.median,
    industry_p_low: ind12.p_low,
    industry_p_high: ind12.p_high,
  });

  // 1.3 Biến động LNKT trước thuế
  const pbtChange = pctChange(pbt, pbtPrev);
  const ind13 = industryCalcYoY(d => safeNum(d[KEYS.PBT]), d => safeNum(d[KEYS.PBT]));
  const rl1_13: "green" | "red" | "gray" = pbtChange === null ? "gray" : pbtChange <= -0.10 ? "red" : "green";
  const rl2_13 = calcRiskLevel2(pbtChange, ind13.p_low, ind13.p_high, true);
  indicators.push({
    id: "1.3",
    group: "DOANH THU - LỢI NHUẬN - THUẾ",
    name: "Biến động LN kế toán trước thuế",
    risk_factor: "Giảm từ 10% trở lên so với năm trước",
    company_value: pbtChange,
    industry_range: ind13.range,
    industry_p35: ind13.p_low,
    industry_p65: ind13.p_high,
    risk_level: rl1_13,
    risk_level_1: rl1_13,
    risk_level_2: rl2_13,
    industry_median: ind13.median,
    industry_p_low: ind13.p_low,
    industry_p_high: ind13.p_high,
  });

  // 1.4 Biến động CP thuế hiện hành
  const taxChange = currentTax !== null && currentTaxPrev !== null && currentTaxPrev !== 0
    ? (Math.abs(currentTax) - Math.abs(currentTaxPrev)) / Math.abs(currentTaxPrev) : null;
  const ind14 = industryCalcYoY(
    d => { const v = safeNum(d[KEYS.CURRENT_TAX]); return v !== null ? Math.abs(v) : null; },
    d => { const v = safeNum(d[KEYS.CURRENT_TAX]); return v !== null ? Math.abs(v) : null; }
  );
  const rl1_14: "green" | "red" | "gray" = taxChange === null ? "gray" : taxChange <= -0.10 ? "red" : "green";
  const rl2_14 = calcRiskLevel2(taxChange, ind14.p_low, ind14.p_high, true);
  indicators.push({
    id: "1.4",
    group: "DOANH THU - LỢI NHUẬN - THUẾ",
    name: "Biến động chi phí thuế hiện hành",
    risk_factor: "Giảm từ 10% trở lên so với năm trước",
    company_value: taxChange,
    industry_range: ind14.range,
    industry_p35: ind14.p_low,
    industry_p65: ind14.p_high,
    risk_level: rl1_14,
    risk_level_1: rl1_14,
    risk_level_2: rl2_14,
    industry_median: ind14.median,
    industry_p_low: ind14.p_low,
    industry_p_high: ind14.p_high,
  });

  // 1.5 Biên lợi nhuận gộp
  const grossMargin = safeDiv(grossProfit, netRevenue);
  const ind15 = industryCalc(d => safeDiv(safeNum(d[KEYS.GROSS_PROFIT]), safeNum(d[KEYS.NET_REVENUE])));
  // 1.5: risk_level_1 is YoY drop >= 10% in gross margin
  const grossMarginPrev = previousData ? safeDiv(getVal(previousData, KEYS.GROSS_PROFIT), getVal(previousData, KEYS.NET_REVENUE)) : null;
  const grossMarginChange = grossMargin !== null && grossMarginPrev !== null ? grossMargin - grossMarginPrev : null;
  const rl1_15: "green" | "red" | "gray" = grossMarginChange === null
    ? (grossMargin === null ? "gray" : "green")
    : grossMarginChange <= -0.10 ? "red" : "green";
  const rl2_15 = calcRiskLevel2(grossMargin, ind15.p_low, ind15.p_high, true);
  indicators.push({
    id: "1.5",
    group: "DOANH THU - LỢI NHUẬN - THUẾ",
    name: "Biên lợi nhuận gộp",
    risk_factor: "Giảm từ 10% trở lên so với năm trước",
    company_value: grossMargin,
    industry_range: ind15.range,
    industry_p35: ind15.p_low,
    industry_p65: ind15.p_high,
    risk_level: rl1_15,
    risk_level_1: rl1_15,
    risk_level_2: rl2_15,
    industry_median: ind15.median,
    industry_p_low: ind15.p_low,
    industry_p_high: ind15.p_high,
  });

  // 1.6 Biên lợi nhuận hoạt động
  const opMargin = netRevenue !== null && netRevenue !== 0 && grossProfit !== null
    ? (grossProfit - sga) / Math.abs(netRevenue) : null;
  const ind16 = industryCalc(d => {
    const gp = safeNum(d[KEYS.GROSS_PROFIT]);
    const rev = safeNum(d[KEYS.NET_REVENUE]);
    const se = safeNum(d[KEYS.SELLING_EXPENSE]);
    const ae = safeNum(d[KEYS.ADMIN_EXPENSE]);
    const s = (se !== null ? Math.abs(se) : 0) + (ae !== null ? Math.abs(ae) : 0);
    return gp !== null && rev !== null && rev !== 0 ? (gp - s) / Math.abs(rev) : null;
  });
  const opMarginPrev = previousData ? (() => {
    const gpP = getVal(previousData, KEYS.GROSS_PROFIT);
    const nrP = getVal(previousData, KEYS.NET_REVENUE);
    return nrP !== null && nrP !== 0 && gpP !== null ? (gpP - sgaPrev!) / Math.abs(nrP) : null;
  })() : null;
  const opMarginChange = opMargin !== null && opMarginPrev !== null ? opMargin - opMarginPrev : null;
  const rl1_16: "green" | "red" | "gray" = opMarginChange === null
    ? (opMargin === null ? "gray" : "green")
    : opMarginChange <= -0.10 ? "red" : "green";
  const rl2_16 = calcRiskLevel2(opMargin, ind16.p_low, ind16.p_high, true);
  indicators.push({
    id: "1.6",
    group: "DOANH THU - LỢI NHUẬN - THUẾ",
    name: "Biên lợi nhuận hoạt động",
    risk_factor: "Giảm từ 10% trở lên so với năm trước",
    company_value: opMargin,
    industry_range: ind16.range,
    industry_p35: ind16.p_low,
    industry_p65: ind16.p_high,
    risk_level: rl1_16,
    risk_level_1: rl1_16,
    risk_level_2: rl2_16,
    industry_median: ind16.median,
    industry_p_low: ind16.p_low,
    industry_p_high: ind16.p_high,
  });

  // 1.7 Biên lợi nhuận sau thuế
  const netMargin = safeDiv(netIncome, netRevenue);
  const ind17 = industryCalc(d => safeDiv(safeNum(d[KEYS.NET_INCOME]), safeNum(d[KEYS.NET_REVENUE])));
  // 1.7: risk_level_1 = loss (net margin < 0) for 2 consecutive years; simplified: red if current < 0
  const rl1_17: "green" | "red" | "gray" = netMargin === null ? "gray" : netMargin < 0 ? "red" : "green";
  const rl2_17 = calcRiskLevel2(netMargin, ind17.p_low, ind17.p_high, true);
  indicators.push({
    id: "1.7",
    group: "DOANH THU - LỢI NHUẬN - THUẾ",
    name: "Biên lợi nhuận sau thuế",
    risk_factor: "Lỗ 2 năm liên tục",
    company_value: netMargin,
    industry_range: ind17.range,
    industry_p35: ind17.p_low,
    industry_p65: ind17.p_high,
    risk_level: rl1_17,
    risk_level_1: rl1_17,
    risk_level_2: rl2_17,
    industry_median: ind17.median,
    industry_p_low: ind17.p_low,
    industry_p_high: ind17.p_high,
  });

  // ============= TAX OWING / INVOICING RISK =============

  // 2.1 Tỷ lệ nợ thuế
  const taxDebtRatio = safeDiv(taxPayable !== null ? Math.abs(taxPayable) : null, totalLiabilities !== null ? Math.abs(totalLiabilities) : null);
  const ind21 = industryCalc(d => {
    const tp = safeNum(d[KEYS.TAX_PAYABLE]);
    const tl = safeNum(d[KEYS.TOTAL_LIABILITIES]);
    return tp !== null && tl !== null && tl !== 0 ? Math.abs(tp) / Math.abs(tl) : null;
  });
  // 2.1: risk_level_1 = YoY increase >= 10%
  const taxDebtRatioPrev = previousData ? safeDiv(
    safeNum(previousData[KEYS.TAX_PAYABLE]) !== null ? Math.abs(safeNum(previousData[KEYS.TAX_PAYABLE])!) : null,
    safeNum(previousData[KEYS.TOTAL_LIABILITIES]) !== null ? Math.abs(safeNum(previousData[KEYS.TOTAL_LIABILITIES])!) : null
  ) : null;
  const taxDebtRatioChange = taxDebtRatio !== null && taxDebtRatioPrev !== null && taxDebtRatioPrev !== 0
    ? (taxDebtRatio - taxDebtRatioPrev) / Math.abs(taxDebtRatioPrev) : null;
  const rl1_21: "green" | "red" | "gray" = taxDebtRatioChange === null
    ? (taxDebtRatio === null ? "gray" : "green")
    : taxDebtRatioChange >= 0.10 ? "red" : "green";
  const rl2_21 = calcRiskLevel2(taxDebtRatio, ind21.p_low, ind21.p_high, false); // lower is better
  indicators.push({
    id: "2.1",
    group: "RỦI RO NỢ THUẾ - HÓA ĐƠN",
    name: "Tỷ lệ nợ thuế",
    risk_factor: "Tăng từ 10% trở lên so với năm trước",
    company_value: taxDebtRatio,
    industry_range: ind21.range,
    industry_p35: ind21.p_low,
    industry_p65: ind21.p_high,
    risk_level: rl1_21,
    risk_level_1: rl1_21,
    risk_level_2: rl2_21,
    industry_median: ind21.median,
    industry_p_low: ind21.p_low,
    industry_p_high: ind21.p_high,
  });

  // 2.2 Biến động thuế đầu vào
  const vatChange = pctChange(vatDeductible, vatDeductiblePrev);
  const ind22 = industryCalcYoY(
    d => safeNum(d[KEYS.VAT_DEDUCTIBLE]),
    d => safeNum(d[KEYS.VAT_DEDUCTIBLE])
  );
  const rl1_22: "green" | "red" | "gray" = vatChange === null ? "gray" : vatChange >= 0.10 ? "red" : "green";
  const rl2_22 = calcRiskLevel2(vatChange, ind22.p_low, ind22.p_high, false); // lower change is safer
  indicators.push({
    id: "2.2",
    group: "RỦI RO NỢ THUẾ - HÓA ĐƠN",
    name: "Biến động thuế đầu vào",
    risk_factor: "Tăng từ 10% trở lên so với năm trước",
    company_value: vatChange,
    industry_range: ind22.range,
    industry_p35: ind22.p_low,
    industry_p65: ind22.p_high,
    risk_level: rl1_22,
    risk_level_1: rl1_22,
    risk_level_2: rl2_22,
    industry_median: ind22.median,
    industry_p_low: ind22.p_low,
    industry_p_high: ind22.p_high,
  });

  // 2.3 Doanh thu / Vốn CSH
  const revEquity = safeDiv(netRevenue, equity);
  const ind23 = industryCalcAbs(d => safeDiv(safeNum(d[KEYS.NET_REVENUE]), safeNum(d[KEYS.EQUITY])));
  const rl1_23: "green" | "red" | "gray" = revEquity === null ? "gray" : (revEquity < 1 || revEquity > 10) ? "red" : "green";
  const rl2_23 = calcRiskLevel2(revEquity, ind23.p_low, ind23.p_high, true);
  indicators.push({
    id: "2.3",
    group: "RỦI RO NỢ THUẾ - HÓA ĐƠN",
    name: "Doanh thu / Vốn Chủ Sở Hữu",
    risk_factor: "Nhỏ hơn 1 hoặc cao hơn 10",
    company_value: revEquity,
    industry_range: ind23.range,
    industry_p35: ind23.p_low,
    industry_p65: ind23.p_high,
    risk_level: rl1_23,
    risk_level_1: rl1_23,
    risk_level_2: rl2_23,
    industry_median: ind23.median,
    industry_p_low: ind23.p_low,
    industry_p_high: ind23.p_high,
  });

  // 2.4 Lợi nhuận chưa phân phối / Vốn CSH
  const retEarningsRatio = safeDiv(retainedEarnings, equity);
  const ind24 = industryCalc(d => safeDiv(safeNum(d[KEYS.RETAINED_EARNINGS]), safeNum(d[KEYS.EQUITY])));
  const rl1_24: "green" | "red" | "gray" = retEarningsRatio === null ? "gray" : retEarningsRatio < -0.50 ? "red" : "green";
  const rl2_24 = calcRiskLevel2(retEarningsRatio, ind24.p_low, ind24.p_high, true);
  indicators.push({
    id: "2.4",
    group: "RỦI RO NỢ THUẾ - HÓA ĐƠN",
    name: "Lợi nhuận chưa phân phối / Vốn CSH",
    risk_factor: "Âm trên 50%",
    company_value: retEarningsRatio,
    industry_range: ind24.range,
    industry_p35: ind24.p_low,
    industry_p65: ind24.p_high,
    risk_level: rl1_24,
    risk_level_1: rl1_24,
    risk_level_2: rl2_24,
    industry_median: ind24.median,
    industry_p_low: ind24.p_low,
    industry_p_high: ind24.p_high,
  });

  // 2.5 Nợ phải trả / Vốn CSH
  const debtEquity = safeDiv(totalLiabilities, equity);
  const ind25 = industryCalcAbs(d => safeDiv(safeNum(d[KEYS.TOTAL_LIABILITIES]), safeNum(d[KEYS.EQUITY])));
  const rl1_25: "green" | "red" | "gray" = debtEquity === null ? "gray" : debtEquity > 1 ? "red" : "green";
  const rl2_25 = calcRiskLevel2(debtEquity, ind25.p_low, ind25.p_high, false); // lower is better
  indicators.push({
    id: "2.5",
    group: "RỦI RO NỢ THUẾ - HÓA ĐƠN",
    name: "Nợ phải trả / Vốn Chủ Sở Hữu",
    risk_factor: "Lớn hơn 1",
    company_value: debtEquity,
    industry_range: ind25.range,
    industry_p35: ind25.p_low,
    industry_p65: ind25.p_high,
    risk_level: rl1_25,
    risk_level_1: rl1_25,
    risk_level_2: rl2_25,
    industry_median: ind25.median,
    industry_p_low: ind25.p_low,
    industry_p_high: ind25.p_high,
  });

  // 2.6 Modified K Co-efficient
  // New formula: DT thuần / (COGS + Dư cuối kì HTK)
  // COGS = key "211", inventory = key "1140"
  const kCoeff = netRevenue !== null && cogs !== null && inventory !== null
    && (Math.abs(cogs) + Math.abs(inventory)) !== 0
    ? Math.abs(netRevenue) / (Math.abs(cogs) + Math.abs(inventory))
    : null;
  const ind26 = industryCalcAbs(d => {
    const nr = safeNum(d[KEYS.NET_REVENUE]);
    const c = safeNum(d[KEYS.COGS]);
    const inv = safeNum(d[KEYS.INVENTORY]);
    if (nr === null || c === null || inv === null) return null;
    const denom = Math.abs(c) + Math.abs(inv);
    return denom !== 0 ? Math.abs(nr) / denom : null;
  });
  const rl1_26: "green" | "red" | "gray" = kCoeff === null ? "gray" : kCoeff > 1 ? "red" : "green";
  const rl2_26 = calcRiskLevel2(kCoeff, ind26.p_low, ind26.p_high, false); // lower is safer
  indicators.push({
    id: "2.6",
    group: "RỦI RO NỢ THUẾ - HÓA ĐƠN",
    name: "Modified K Co-efficient",
    risk_factor: "Lớn hơn 1",
    company_value: kCoeff,
    industry_range: ind26.range,
    industry_p35: ind26.p_low,
    industry_p65: ind26.p_high,
    risk_level: rl1_26,
    risk_level_1: rl1_26,
    risk_level_2: rl2_26,
    industry_median: ind26.median,
    industry_p_low: ind26.p_low,
    industry_p_high: ind26.p_high,
  });

  // 2.7 Beneish M-Score
  // Components
  const dsr = tradeReceivables !== null && netRevenue !== null && netRevenue !== 0 &&
    tradeReceivablesPrev !== null && netRevenuePrev !== null && netRevenuePrev !== 0
    ? (tradeReceivables / netRevenue) / (tradeReceivablesPrev / netRevenuePrev) : null;
  
  const gmi = grossProfitPrev !== null && netRevenuePrev !== null && netRevenuePrev !== 0 &&
    grossProfit !== null && netRevenue !== null && netRevenue !== 0
    ? (grossProfitPrev / netRevenuePrev) / (grossProfit / netRevenue) : null;

  const aqi = currentAssets !== null && fixedAssets !== null && totalAssets !== null && totalAssets !== 0 &&
    currentAssetsPrev !== null && fixedAssetsPrev !== null && totalAssetsPrev !== null && totalAssetsPrev !== 0
    ? (1 - (currentAssets + fixedAssets) / totalAssets) / (1 - (currentAssetsPrev + fixedAssetsPrev) / totalAssetsPrev) : null;

  const sgi = netRevenue !== null && netRevenuePrev !== null && netRevenuePrev !== 0
    ? netRevenue / netRevenuePrev : null;

  const depRate = tangibleFACost !== null && tangibleFACost !== 0 && tangibleFADepr !== null
    ? Math.abs(tangibleFADepr) / Math.abs(tangibleFACost) : null;
  const depRatePrev = tangibleFACostPrev !== null && tangibleFACostPrev !== 0 && tangibleFADeprPrev !== null
    ? Math.abs(tangibleFADeprPrev) / Math.abs(tangibleFACostPrev) : null;
  const depi = depRate !== null && depRatePrev !== null && depRate !== 0
    ? depRatePrev / depRate : null;

  const sgai = netRevenue !== null && netRevenue !== 0 && netRevenuePrev !== null && netRevenuePrev !== 0 && sgaPrev !== null
    ? (sga / Math.abs(netRevenue)) / (sgaPrev / Math.abs(netRevenuePrev)) : null;

  const accruals = netIncome !== null && cfo !== null && totalAssets !== null && totalAssets !== 0
    ? (netIncome - cfo) / totalAssets : null;

  const leverage = totalLiabilities !== null && totalAssets !== null && totalAssets !== 0
    ? totalLiabilities / totalAssets : null;
  const leveragePrev = previousData ? safeDiv(
    safeNum(previousData[KEYS.TOTAL_LIABILITIES]),
    safeNum(previousData[KEYS.TOTAL_ASSETS])
  ) : null;
  const levi = leverage !== null && leveragePrev !== null && leveragePrev !== 0
    ? leverage / leveragePrev : null;

  // M-Score calculation
  let mScore: number | null = null;
  if (dsr !== null && gmi !== null && aqi !== null && sgi !== null && depi !== null && sgai !== null && accruals !== null && levi !== null) {
    mScore = -4.84 + 0.920 * dsr + 0.528 * gmi + 0.404 * aqi + 0.892 * sgi + 0.115 * depi - 0.172 * sgai + 4.679 * accruals - 0.327 * levi;
  }

  const ind27 = industryCalcAbs(d => {
    // Simplified - just show range
    return null; // M-Score requires prev year, complex to calc for all
  });
  const rl1_27: "green" | "red" | "gray" = mScore === null ? "gray" : mScore > -2.22 ? "red" : "green";
  const rl2_27 = calcRiskLevel2(mScore, ind27.p_low, ind27.p_high, false); // lower M-score is safer
  indicators.push({
    id: "2.7",
    group: "RỦI RO NỢ THUẾ - HÓA ĐƠN",
    name: "Beneish M-Score",
    risk_factor: "Lớn hơn -2.22",
    company_value: mScore,
    industry_range: ind27.range,
    industry_p35: ind27.p_low,
    industry_p65: ind27.p_high,
    risk_level: rl1_27,
    risk_level_1: rl1_27,
    risk_level_2: rl2_27,
    industry_median: ind27.median,
    industry_p_low: ind27.p_low,
    industry_p_high: ind27.p_high,
  });

  // ============= OPERATION - EFFICIENCY =============

  // 3.1 Tỷ trọng giảm trừ DT / DT thuần
  const deductionRatio = revenueDeductions !== null && netRevenue !== null && netRevenue !== 0
    ? Math.abs(revenueDeductions) / Math.abs(netRevenue) : null;
  const ind31 = industryCalc(d => {
    const rd = safeNum(d[KEYS.REVENUE_DEDUCTIONS]);
    const nr = safeNum(d[KEYS.NET_REVENUE]);
    return rd !== null && nr !== null && nr !== 0 ? Math.abs(rd) / Math.abs(nr) : null;
  });
  // 3.1: risk_level_1 = YoY increase >= 10%
  const deductionRatioPrev = previousData ? (() => {
    const rd = safeNum(previousData[KEYS.REVENUE_DEDUCTIONS]);
    const nr = safeNum(previousData[KEYS.NET_REVENUE]);
    return rd !== null && nr !== null && nr !== 0 ? Math.abs(rd) / Math.abs(nr) : null;
  })() : null;
  const deductionRatioChange = deductionRatio !== null && deductionRatioPrev !== null && deductionRatioPrev !== 0
    ? (deductionRatio - deductionRatioPrev) / Math.abs(deductionRatioPrev) : null;
  const rl1_31: "green" | "red" | "gray" = deductionRatioChange === null
    ? (deductionRatio === null ? "gray" : "green")
    : deductionRatioChange >= 0.10 ? "red" : "green";
  const rl2_31 = calcRiskLevel2(deductionRatio, ind31.p_low, ind31.p_high, false); // lower is better
  indicators.push({
    id: "3.1",
    group: "VẬN HÀNH - HIỆU QUẢ",
    name: "Tỷ trọng giảm trừ DT / DT thuần",
    risk_factor: "Tăng từ 10% trở lên so với năm trước",
    company_value: deductionRatio,
    industry_range: ind31.range,
    industry_p35: ind31.p_low,
    industry_p65: ind31.p_high,
    risk_level: rl1_31,
    risk_level_1: rl1_31,
    risk_level_2: rl2_31,
    industry_median: ind31.median,
    industry_p_low: ind31.p_low,
    industry_p_high: ind31.p_high,
  });

  // 3.2 Tỷ trọng CP bán hàng / DT thuần
  const sellingRatio = sellingExp !== null && netRevenue !== null && netRevenue !== 0
    ? Math.abs(sellingExp) / Math.abs(netRevenue) : null;
  const ind32 = industryCalc(d => {
    const se = safeNum(d[KEYS.SELLING_EXPENSE]);
    const nr = safeNum(d[KEYS.NET_REVENUE]);
    return se !== null && nr !== null && nr !== 0 ? Math.abs(se) / Math.abs(nr) : null;
  });
  // 3.2: risk_level_1 = YoY increase >= 10%
  const sellingRatioPrev = previousData ? (() => {
    const se = safeNum(previousData[KEYS.SELLING_EXPENSE]);
    const nr = safeNum(previousData[KEYS.NET_REVENUE]);
    return se !== null && nr !== null && nr !== 0 ? Math.abs(se) / Math.abs(nr) : null;
  })() : null;
  const sellingRatioChange = sellingRatio !== null && sellingRatioPrev !== null && sellingRatioPrev !== 0
    ? (sellingRatio - sellingRatioPrev) / Math.abs(sellingRatioPrev) : null;
  const rl1_32: "green" | "red" | "gray" = sellingRatioChange === null
    ? (sellingRatio === null ? "gray" : "green")
    : sellingRatioChange >= 0.10 ? "red" : "green";
  const rl2_32 = calcRiskLevel2(sellingRatio, ind32.p_low, ind32.p_high, false); // lower is better
  indicators.push({
    id: "3.2",
    group: "VẬN HÀNH - HIỆU QUẢ",
    name: "Tỷ trọng CP bán hàng / DT thuần",
    risk_factor: "Tăng từ 10% trở lên so với năm trước",
    company_value: sellingRatio,
    industry_range: ind32.range,
    industry_p35: ind32.p_low,
    industry_p65: ind32.p_high,
    risk_level: rl1_32,
    risk_level_1: rl1_32,
    risk_level_2: rl2_32,
    industry_median: ind32.median,
    industry_p_low: ind32.p_low,
    industry_p_high: ind32.p_high,
  });

  // 3.3 Tỷ trọng CP quản lý / DT thuần
  const adminRatio = adminExp !== null && netRevenue !== null && netRevenue !== 0
    ? Math.abs(adminExp) / Math.abs(netRevenue) : null;
  const ind33 = industryCalc(d => {
    const ae = safeNum(d[KEYS.ADMIN_EXPENSE]);
    const nr = safeNum(d[KEYS.NET_REVENUE]);
    return ae !== null && nr !== null && nr !== 0 ? Math.abs(ae) / Math.abs(nr) : null;
  });
  // 3.3: risk_level_1 = YoY increase >= 10%
  const adminRatioPrev = previousData ? (() => {
    const ae = safeNum(previousData[KEYS.ADMIN_EXPENSE]);
    const nr = safeNum(previousData[KEYS.NET_REVENUE]);
    return ae !== null && nr !== null && nr !== 0 ? Math.abs(ae) / Math.abs(nr) : null;
  })() : null;
  const adminRatioChange = adminRatio !== null && adminRatioPrev !== null && adminRatioPrev !== 0
    ? (adminRatio - adminRatioPrev) / Math.abs(adminRatioPrev) : null;
  const rl1_33: "green" | "red" | "gray" = adminRatioChange === null
    ? (adminRatio === null ? "gray" : "green")
    : adminRatioChange >= 0.10 ? "red" : "green";
  const rl2_33 = calcRiskLevel2(adminRatio, ind33.p_low, ind33.p_high, false); // lower is better
  indicators.push({
    id: "3.3",
    group: "VẬN HÀNH - HIỆU QUẢ",
    name: "Tỷ trọng CP quản lý / DT thuần",
    risk_factor: "Tăng từ 10% trở lên so với năm trước",
    company_value: adminRatio,
    industry_range: ind33.range,
    industry_p35: ind33.p_low,
    industry_p65: ind33.p_high,
    risk_level: rl1_33,
    risk_level_1: rl1_33,
    risk_level_2: rl2_33,
    industry_median: ind33.median,
    industry_p_low: ind33.p_low,
    industry_p_high: ind33.p_high,
  });

  // 3.4 Lãi vay / EBITDA
  const intEbitda = interestExpense !== null && ebitda !== null && ebitda !== 0
    ? Math.abs(interestExpense) / ebitda : null;
  const ind34 = industryCalc(d => {
    const ie = safeNum(d[KEYS.INTEREST_EXPENSE]);
    const p = safeNum(d[KEYS.PBT]);
    const i2 = safeNum(d[KEYS.INTEREST_EXPENSE]);
    const dep = safeNum(d[KEYS.DEPRECIATION]);
    if (p === null || i2 === null || dep === null) return null;
    const eb = p + Math.abs(i2) + Math.abs(dep);
    return eb !== 0 && ie !== null ? Math.abs(ie) / eb : null;
  });
  const rl1_34: "green" | "red" | "gray" = intEbitda === null ? "gray" : intEbitda > 0.30 ? "red" : "green";
  const rl2_34 = calcRiskLevel2(intEbitda, ind34.p_low, ind34.p_high, false); // lower is better
  indicators.push({
    id: "3.4",
    group: "VẬN HÀNH - HIỆU QUẢ",
    name: "Lãi vay / EBITDA",
    risk_factor: "Trên 30%",
    company_value: intEbitda,
    industry_range: ind34.range,
    industry_p35: ind34.p_low,
    industry_p65: ind34.p_high,
    risk_level: rl1_34,
    risk_level_1: rl1_34,
    risk_level_2: rl2_34,
    industry_median: ind34.median,
    industry_p_low: ind34.p_low,
    industry_p_high: ind34.p_high,
  });

  // 3.5 Số ngày tồn kho
  const daysInventory = inventory !== null && cogs !== null && cogs !== 0
    ? Math.abs(inventory) / Math.abs(cogs) * 365 : null;
  const ind35 = industryCalcAbs(d => {
    const inv = safeNum(d[KEYS.INVENTORY]);
    const c = safeNum(d[KEYS.COGS]);
    return inv !== null && c !== null && c !== 0 ? Math.abs(inv) / Math.abs(c) * 365 : null;
  });
  // 3.5: risk_level_1 = YoY increase >= 10%
  const daysInventoryPrev = previousData ? (() => {
    const inv = safeNum(previousData[KEYS.INVENTORY]);
    const c = safeNum(previousData[KEYS.COGS]);
    return inv !== null && c !== null && c !== 0 ? Math.abs(inv) / Math.abs(c) * 365 : null;
  })() : null;
  const daysInventoryChange = daysInventory !== null && daysInventoryPrev !== null && daysInventoryPrev !== 0
    ? (daysInventory - daysInventoryPrev) / Math.abs(daysInventoryPrev) : null;
  const rl1_35: "green" | "red" | "gray" = daysInventoryChange === null
    ? (daysInventory === null ? "gray" : "green")
    : daysInventoryChange >= 0.10 ? "red" : "green";
  const rl2_35 = calcRiskLevel2(daysInventory, ind35.p_low, ind35.p_high, false); // lower is better
  indicators.push({
    id: "3.5",
    group: "VẬN HÀNH - HIỆU QUẢ",
    name: "Số ngày tồn kho",
    risk_factor: "Tăng từ 10% trở lên so với năm trước",
    company_value: daysInventory,
    industry_range: ind35.range,
    industry_p35: ind35.p_low,
    industry_p65: ind35.p_high,
    risk_level: rl1_35,
    risk_level_1: rl1_35,
    risk_level_2: rl2_35,
    industry_median: ind35.median,
    industry_p_low: ind35.p_low,
    industry_p_high: ind35.p_high,
  });

  // 3.6 Số ngày phải thu
  const daysReceivable = tradeReceivables !== null && netRevenue !== null && netRevenue !== 0
    ? Math.abs(tradeReceivables) / Math.abs(netRevenue) * 365 : null;
  const ind36 = industryCalcAbs(d => {
    const tr = safeNum(d[KEYS.TRADE_RECEIVABLES]);
    const nr = safeNum(d[KEYS.NET_REVENUE]);
    return tr !== null && nr !== null && nr !== 0 ? Math.abs(tr) / Math.abs(nr) * 365 : null;
  });
  // 3.6: risk_level_1 = YoY increase >= 10%
  const daysReceivablePrev = previousData ? (() => {
    const tr = safeNum(previousData[KEYS.TRADE_RECEIVABLES]);
    const nr = safeNum(previousData[KEYS.NET_REVENUE]);
    return tr !== null && nr !== null && nr !== 0 ? Math.abs(tr) / Math.abs(nr) * 365 : null;
  })() : null;
  const daysReceivableChange = daysReceivable !== null && daysReceivablePrev !== null && daysReceivablePrev !== 0
    ? (daysReceivable - daysReceivablePrev) / Math.abs(daysReceivablePrev) : null;
  const rl1_36: "green" | "red" | "gray" = daysReceivableChange === null
    ? (daysReceivable === null ? "gray" : "green")
    : daysReceivableChange >= 0.10 ? "red" : "green";
  const rl2_36 = calcRiskLevel2(daysReceivable, ind36.p_low, ind36.p_high, false); // lower is better
  indicators.push({
    id: "3.6",
    group: "VẬN HÀNH - HIỆU QUẢ",
    name: "Số ngày phải thu",
    risk_factor: "Tăng từ 10% trở lên so với năm trước",
    company_value: daysReceivable,
    industry_range: ind36.range,
    industry_p35: ind36.p_low,
    industry_p65: ind36.p_high,
    risk_level: rl1_36,
    risk_level_1: rl1_36,
    risk_level_2: rl2_36,
    industry_median: ind36.median,
    industry_p_low: ind36.p_low,
    industry_p_high: ind36.p_high,
  });

  // 3.7 Tốc độ tăng DT / Tốc độ tăng Giá vốn
  const revGrowth = pctChange(netRevenue, netRevenuePrev);
  const cogsGrowth = cogs !== null && cogsPrev !== null && cogsPrev !== 0
    ? (Math.abs(cogs) - Math.abs(cogsPrev)) / Math.abs(cogsPrev) : null;
  const revCogsRatio = revGrowth !== null && cogsGrowth !== null && cogsGrowth !== 0
    ? (1 + revGrowth) / (1 + cogsGrowth) : null;
  const ind37 = industryCalcAbs(d => {
    // Simplified
    return null;
  });
  const rl1_37: "green" | "red" | "gray" = revCogsRatio === null ? "gray" : revCogsRatio < 1 ? "red" : "green";
  const rl2_37 = calcRiskLevel2(revCogsRatio, ind37.p_low, ind37.p_high, true); // higher is better
  indicators.push({
    id: "3.7",
    group: "VẬN HÀNH - HIỆU QUẢ",
    name: "Tốc độ tăng DT / Tốc độ tăng Giá vốn",
    risk_factor: "Thấp hơn 1",
    company_value: revCogsRatio,
    industry_range: ind37.range,
    industry_p35: ind37.p_low,
    industry_p65: ind37.p_high,
    risk_level: rl1_37,
    risk_level_1: rl1_37,
    risk_level_2: rl2_37,
    industry_median: ind37.median,
    industry_p_low: ind37.p_low,
    industry_p_high: ind37.p_high,
  });

  return indicators;
}

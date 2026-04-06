import fs from "fs";
import path from "path";

export interface RiskWeight {
  indicator_id: string;
  weight: number; // 1-10, where 10 = highest importance
}

const DATA_FILE = path.resolve(process.cwd(), "data", "risk_weights.json");

const DEFAULT_WEIGHTS: RiskWeight[] = [
  { indicator_id: "0.1", weight: 10 },
  { indicator_id: "0.2", weight: 10 },
  { indicator_id: "0.3", weight: 9 },
  { indicator_id: "1.1", weight: 8 },
  { indicator_id: "1.2", weight: 7 },
  { indicator_id: "1.3", weight: 7 },
  { indicator_id: "1.4", weight: 7 },
  { indicator_id: "1.5", weight: 6 },
  { indicator_id: "1.6", weight: 5 },
  { indicator_id: "1.7", weight: 8 },
  { indicator_id: "2.1", weight: 7 },
  { indicator_id: "2.2", weight: 6 },
  { indicator_id: "2.3", weight: 5 },
  { indicator_id: "2.4", weight: 6 },
  { indicator_id: "2.5", weight: 7 },
  { indicator_id: "2.6", weight: 8 },
  { indicator_id: "2.7", weight: 6 },
  { indicator_id: "3.1", weight: 4 },
  { indicator_id: "3.2", weight: 3 },
  { indicator_id: "3.3", weight: 3 },
  { indicator_id: "3.4", weight: 5 },
  { indicator_id: "3.5", weight: 3 },
  { indicator_id: "3.6", weight: 3 },
  { indicator_id: "3.7", weight: 4 },
];

let weights: RiskWeight[] = [];

export function loadRiskWeights() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      weights = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      // If old scale (max 5), migrate to new scale (max 10)
      const maxW = Math.max(...weights.map(w => w.weight));
      if (maxW <= 5) {
        weights = weights.map(w => ({ ...w, weight: w.weight * 2 }));
        saveRiskWeights();
      }
    } else {
      weights = [...DEFAULT_WEIGHTS];
      saveRiskWeights();
    }
  } catch {
    weights = [...DEFAULT_WEIGHTS];
    saveRiskWeights();
  }
}

function saveRiskWeights() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(weights, null, 2));
}

export function getDefaultWeights(): RiskWeight[] {
  return weights;
}

export function updateDefaultWeights(newWeights: RiskWeight[]): void {
  weights = newWeights;
  saveRiskWeights();
}

// Calculate risk severity for a single indicator (0-5 scale)
// 0 = safe, 1 = very low risk, 2 = low, 3 = moderate, 4 = high, 5 = very high
export function calcRiskSeverity(
  riskLevel: string,
  companyValue: number | null,
  median: number | null,
  pLow: number | null,
  pHigh: number | null,
  indicatorId: string
): number {
  if (riskLevel === "gray" || companyValue === null) return 0;
  if (riskLevel === "green") return 0;
  // riskLevel === "red"

  // For RR1: binary (threshold breached or not) → severity based on how far beyond
  // For RR2: distance from IQR
  // Generic approach: measure deviation
  if (median !== null && pLow !== null && pHigh !== null) {
    const iqr = Math.abs(pHigh - pLow);
    if (iqr === 0) return 3; // Default moderate if no spread

    let deviation = 0;
    if (companyValue < pLow) {
      deviation = Math.abs(pLow - companyValue) / iqr;
    } else if (companyValue > pHigh) {
      deviation = Math.abs(companyValue - pHigh) / iqr;
    }

    // Map deviation to 1-5 scale
    if (deviation <= 0.25) return 1;
    if (deviation <= 0.5) return 2;
    if (deviation <= 1.0) return 3;
    if (deviation <= 2.0) return 4;
    return 5;
  }

  // Fallback: if red, default severity 3
  return 3;
}

// Calculate composite risk score for one year
export interface YearScore {
  year: string;
  score: number;       // 0-100
  maxScore: number;
  yearWeight: number;  // recency weight
  breakdown: Array<{
    id: string;
    weight: number;
    rr1_severity: number;  // 0-5
    rr2_severity: number;  // 0-5
    total_severity: number; // rr1 + rr2 (0-10)
    weighted_score: number;
  }>;
}

export function calculateYearScore(
  indicators: Array<{
    id: string;
    risk_level_1?: string;
    risk_level_2?: string;
    risk_level?: string;
    company_value?: number | null;
    industry_median?: number | null;
    industry_p_low?: number | null;
    industry_p_high?: number | null;
  }>,
  customWeights?: RiskWeight[]
): { score: number; maxScore: number; breakdown: YearScore["breakdown"] } {
  const w = customWeights || weights;
  const weightMap = new Map(w.map(wt => [wt.indicator_id, wt.weight]));

  let totalWeighted = 0;
  let maxWeighted = 0;
  const breakdown: YearScore["breakdown"] = [];

  for (const ind of indicators) {
    const iw = weightMap.get(ind.id) ?? 5;
    const r1 = ind.risk_level_1 || ind.risk_level || "gray";
    const r2 = ind.risk_level_2 || "gray";

    const rr1_sev = calcRiskSeverity(r1, ind.company_value ?? null, ind.industry_median ?? null, ind.industry_p_low ?? null, ind.industry_p_high ?? null, ind.id);
    const rr2_sev = calcRiskSeverity(r2, ind.company_value ?? null, ind.industry_median ?? null, ind.industry_p_low ?? null, ind.industry_p_high ?? null, ind.id);

    const total_sev = rr1_sev + rr2_sev; // 0-10
    const weighted = total_sev * iw;

    // Only count indicators that have risk (severity > 0)
    if (total_sev > 0) {
      totalWeighted += weighted;
      maxWeighted += 10 * iw; // max severity 10 * weight
    }

    breakdown.push({ id: ind.id, weight: iw, rr1_severity: rr1_sev, rr2_severity: rr2_sev, total_severity: total_sev, weighted_score: weighted });
  }

  return {
    score: maxWeighted > 0 ? Math.round((totalWeighted / maxWeighted) * 100) : 0,
    maxScore: maxWeighted,
    breakdown,
  };
}

// Calculate multi-year weighted average score
// More recent years get higher weight
export function calculateMultiYearScore(
  yearScores: Array<{ year: string; score: number }>,
  currentYear: number = new Date().getFullYear()
): { averageScore: number; yearDetails: Array<{ year: string; score: number; recencyWeight: number; weightedScore: number }> } {
  if (yearScores.length === 0) return { averageScore: 0, yearDetails: [] };

  // Sort by year descending
  const sorted = [...yearScores].sort((a, b) => Number(b.year) - Number(a.year));

  // Assign recency weights: nearest year gets highest weight
  // Weight = totalYears - index (so nearest=N, furthest=1)
  const n = sorted.length;
  let totalWeight = 0;
  let totalWeightedScore = 0;

  const yearDetails = sorted.map((ys, idx) => {
    const recencyWeight = n - idx; // nearest=n, furthest=1
    totalWeight += recencyWeight;
    totalWeightedScore += ys.score * recencyWeight;
    return { year: ys.year, score: ys.score, recencyWeight, weightedScore: ys.score * recencyWeight };
  });

  return {
    averageScore: totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0,
    yearDetails,
  };
}

// Keep old function for backward compatibility
export function calculateCompositeScore(
  indicators: Array<{ id: string; risk_level_1?: string; risk_level_2?: string; risk_level?: string; company_value?: number | null; industry_median?: number | null; industry_p_low?: number | null; industry_p_high?: number | null }>,
  customWeights?: RiskWeight[]
): { score: number; maxScore: number; percentage: number; breakdown: Array<{ id: string; weight: number; risk_points: number; weighted_points: number }> } {
  const result = calculateYearScore(indicators, customWeights);
  return {
    score: result.score,
    maxScore: result.maxScore,
    percentage: result.score,
    breakdown: result.breakdown.map(b => ({ id: b.id, weight: b.weight, risk_points: b.total_severity, weighted_points: b.weighted_score })),
  };
}

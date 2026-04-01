import fs from "fs";
import path from "path";

export interface RiskWeight {
  indicator_id: string;
  weight: number; // 1-5, where 1 = highest importance
}

const DATA_FILE = path.resolve(process.cwd(), "data", "risk_weights.json");

// Default weights - all indicators start at weight 3 (medium)
const DEFAULT_WEIGHTS: RiskWeight[] = [
  { indicator_id: "0.1", weight: 1 },
  { indicator_id: "0.2", weight: 1 },
  { indicator_id: "0.3", weight: 1 },
  { indicator_id: "1.1", weight: 2 },
  { indicator_id: "1.2", weight: 2 },
  { indicator_id: "1.3", weight: 2 },
  { indicator_id: "1.4", weight: 2 },
  { indicator_id: "1.5", weight: 3 },
  { indicator_id: "1.6", weight: 3 },
  { indicator_id: "1.7", weight: 2 },
  { indicator_id: "2.1", weight: 2 },
  { indicator_id: "2.2", weight: 3 },
  { indicator_id: "2.3", weight: 3 },
  { indicator_id: "2.4", weight: 3 },
  { indicator_id: "2.5", weight: 2 },
  { indicator_id: "2.6", weight: 2 },
  { indicator_id: "2.7", weight: 3 },
  { indicator_id: "3.1", weight: 4 },
  { indicator_id: "3.2", weight: 4 },
  { indicator_id: "3.3", weight: 4 },
  { indicator_id: "3.4", weight: 3 },
  { indicator_id: "3.5", weight: 4 },
  { indicator_id: "3.6", weight: 4 },
  { indicator_id: "3.7", weight: 4 },
];

let weights: RiskWeight[] = [];

export function loadRiskWeights() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      weights = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } else {
      weights = [...DEFAULT_WEIGHTS];
      saveRiskWeights();
    }
  } catch {
    weights = [...DEFAULT_WEIGHTS];
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

// Calculate composite risk score with weights
// Each indicator: risk_score = (risk1_score + risk2_score) * weight_factor
// weight_factor: weight 1 = 1.0, weight 2 = 0.8, weight 3 = 0.6, weight 4 = 0.4, weight 5 = 0.2
export function calculateCompositeScore(
  indicators: Array<{ id: string; risk_level_1?: string; risk_level_2?: string; risk_level?: string }>,
  customWeights?: RiskWeight[]
): { score: number; maxScore: number; percentage: number; breakdown: Array<{ id: string; weight: number; risk_points: number; weighted_points: number }> } {
  const w = customWeights || weights;
  const weightMap = new Map(w.map(wt => [wt.indicator_id, wt.weight]));
  
  const WEIGHT_FACTORS: Record<number, number> = { 1: 1.0, 2: 0.8, 3: 0.6, 4: 0.4, 5: 0.2 };
  
  let totalScore = 0;
  let maxScore = 0;
  const breakdown: Array<{ id: string; weight: number; risk_points: number; weighted_points: number }> = [];
  
  for (const ind of indicators) {
    const weight = weightMap.get(ind.id) ?? 3;
    const factor = WEIGHT_FACTORS[weight] ?? 0.6;
    
    const r1 = ind.risk_level_1 || ind.risk_level;
    const r2 = ind.risk_level_2 || "gray";
    
    let risk_points = 0;
    if (r1 === "red") risk_points += 2;
    if (r2 === "red") risk_points += 2;
    // Max per indicator = 4
    
    const weighted = risk_points * factor;
    totalScore += weighted;
    maxScore += 4 * factor;
    
    breakdown.push({ id: ind.id, weight, risk_points, weighted_points: weighted });
  }
  
  return {
    score: Math.round(totalScore * 10) / 10,
    maxScore: Math.round(maxScore * 10) / 10,
    percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
    breakdown,
  };
}

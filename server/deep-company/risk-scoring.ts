// ════════════════════════════════════════════════════════════════════════════
// TIRA Phase 2 — Risk scoring engine cho module "Phân tích sâu Cty"
//
// Logic bám sát file gốc:
//   - Mỗi chỉ số có một mức xanh/vàng/đỏ/xám (do indicators.ts trả về)
//   - Đỏ = 1.0, Vàng = 0.5, Xanh = 0, Xám = không tính (thiếu dữ liệu)
//   - Composite = tổng điểm / tổng số chỉ số có dữ liệu × 100
//   - Tách điểm theo nhóm để hiển thị radar / bar chart
//
// Conflict detection: phát hiện mâu thuẫn dữ liệu giữa các nguồn
// (vd doanh thu GTGT vs doanh thu KQKD chênh nhau quá lớn)
// ════════════════════════════════════════════════════════════════════════════

import type {
  DeepCompanyInputs,
  IndicatorResult,
  BeneishResult,
  RiskFlag,
  RiskLevel,
} from "./types";

const LEVEL_SCORE: Record<RiskLevel, number> = {
  red: 1.0,
  yellow: 0.5,
  green: 0.0,
  gray: 0,
};

export interface ScoringResult {
  composite: number;
  byGroup: Record<
    string,
    { score: number; count: number; red: number; yellow: number; green: number; gray: number }
  >;
  summary: { red: number; yellow: number; green: number; gray: number; total: number };
  overallLevel: RiskLevel;
  flags: RiskFlag[];
}

export function scoreIndicators(
  indicators: IndicatorResult[],
  beneish: BeneishResult
): ScoringResult {
  const summary = { red: 0, yellow: 0, green: 0, gray: 0, total: indicators.length };
  const byGroup: ScoringResult["byGroup"] = {};
  const flags: RiskFlag[] = [];

  let totalScore = 0;
  let totalCounted = 0;

  for (const ind of indicators) {
    summary[ind.level] += 1;

    const g = ind.group || "Khác";
    if (!byGroup[g]) {
      byGroup[g] = { score: 0, count: 0, red: 0, yellow: 0, green: 0, gray: 0 };
    }
    byGroup[g][ind.level] += 1;

    if (ind.level !== "gray") {
      const s = LEVEL_SCORE[ind.level];
      totalScore += s;
      totalCounted += 1;
      byGroup[g].score += s;
      byGroup[g].count += 1;
    }

    if (ind.flag) flags.push(ind.flag);
  }

  // Bổ sung Beneish như một flag riêng (không nằm trong 39 chỉ số gốc nhưng vẫn ảnh hưởng tổng)
  if (beneish.flagged) {
    flags.push({
      type: "beneish_manipulation",
      message: `Beneish M-Score = ${beneish.mScore.toFixed(2)} (> -2.22) — có dấu hiệu thao túng BCTC.`,
    });
    // Cộng thêm 1 đơn vị red vào tổng để phản ánh
    totalScore += 1;
    totalCounted += 1;
  }

  const composite = totalCounted === 0 ? 0 : (totalScore / totalCounted) * 100;

  // Tính điểm % cho từng nhóm
  for (const g of Object.keys(byGroup)) {
    const grp = byGroup[g];
    grp.score = grp.count === 0 ? 0 : (grp.score / grp.count) * 100;
  }

  const overallLevel: RiskLevel =
    composite >= 50 ? "red" : composite >= 25 ? "yellow" : composite > 0 ? "green" : "gray";

  return { composite, byGroup, summary, overallLevel, flags };
}

// ────────────────────────────────────────────────────────────────────────────
// Conflict detection
// Phát hiện mâu thuẫn / lệch lớn giữa các nguồn dữ liệu.
// KHÔNG ảnh hưởng tới score — chỉ là cảnh báo cho user/AI.
// ────────────────────────────────────────────────────────────────────────────
export function detectConflicts(inp: DeepCompanyInputs): string[] {
  const out: string[] = [];

  // 1) Doanh thu GTGT vs Doanh thu BCTC (KQKD)
  const dtGtgt = (inp.gtgt.doanhThuChiuThue || 0) + (inp.gtgt.doanhThuKhongChiuThue || 0);
  const dtBctc = inp.bctc.kqkdDoanhThuBanHangCN || 0;
  if (dtBctc > 0 && dtGtgt > 0) {
    const lech = Math.abs(dtGtgt - dtBctc) / Math.max(dtGtgt, dtBctc);
    if (lech > 0.05) {
      out.push(
        `Doanh thu trên tờ khai GTGT (${dtGtgt.toLocaleString("vi-VN")}) lệch ${(lech * 100).toFixed(
          1
        )}% so với KQKD (${dtBctc.toLocaleString("vi-VN")}).`
      );
    }
  }

  // 2) Phải thu KH — cuối năm CDKT vs PS Nợ TK 131 - PS Có TK 131 (xấp xỉ)
  const ptCuoi = inp.bctc.cdktPhaiThuKHCuoiNam || 0;
  const ptDau = inp.bctc.cdktPhaiThuKHDauNam || 0;
  const psNo131 = inp.bctc.psNo131 || 0;
  if (ptDau > 0 && ptCuoi > 0 && psNo131 > 0) {
    const bienDong = Math.abs(ptCuoi - ptDau);
    if (psNo131 > 0 && bienDong / psNo131 > 5) {
      out.push(
        `Biến động Phải thu KH (đầu→cuối năm) khác bất thường so với PS Nợ TK 131 trong kỳ.`
      );
    }
  }

  // 3) Thuế GTGT đầu vào — PS TK 1331 vs CDKT mã 152
  const psNo1331 = inp.bctc.psNo1331 || 0;
  const gtgtCuoi = inp.bctc.gtgtDuocKTCuoiNam || 0;
  const gtgtDau = inp.bctc.gtgtDuocKTDauNam || 0;
  if (psNo1331 > 0 && gtgtCuoi > 0 && gtgtCuoi - gtgtDau < 0 && Math.abs(gtgtCuoi - gtgtDau) > psNo1331 * 2) {
    out.push(
      `Số dư GTGT được khấu trừ giảm bất thường so với PS Nợ 1331 — cần kiểm tra hoàn thuế / kết chuyển.`
    );
  }

  // 4) Tổng cộng số liệu Beneish — kiểm tra dấu
  const bn = inp.beneish.namNay;
  if (bn.tongTaiSan > 0 && bn.taiSanCoDinhRong + bn.taiSanNganHan > bn.tongTaiSan * 1.05) {
    out.push(
      `Beneish năm nay: TSCĐ + TS ngắn hạn (${(bn.taiSanCoDinhRong + bn.taiSanNganHan).toLocaleString(
        "vi-VN"
      )}) > Tổng TS (${bn.tongTaiSan.toLocaleString("vi-VN")}) — kiểm tra số liệu.`
    );
  }

  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Phát hiện field thiếu dữ liệu (chấm 0 ở đầu vào hoặc null/undefined)
// Trả về nhãn tiếng Việt — UI dùng để highlight.
// ────────────────────────────────────────────────────────────────────────────
export function findMissingFields(inp: DeepCompanyInputs): string[] {
  const missing: string[] = [];

  const check = (val: any, label: string) => {
    if (val === null || val === undefined || val === "") missing.push(label);
  };

  // Bắt buộc tối thiểu để chạy được phần lớn chỉ số
  if (!inp.gtgt.tongDoanhThu) check(inp.gtgt.tongDoanhThu, "GTGT — Tổng doanh thu");
  if (!inp.bctc.kqkdDoanhThuBanHangCN)
    check(inp.bctc.kqkdDoanhThuBanHangCN, "BCTC — KQKD Doanh thu BH&CCDV");
  if (!inp.beneish.namNay.doanhThuThuan)
    check(inp.beneish.namNay.doanhThuThuan, "Beneish — Doanh thu thuần năm nay");
  if (!inp.beneish.namTruoc.doanhThuThuan)
    check(inp.beneish.namTruoc.doanhThuThuan, "Beneish — Doanh thu thuần năm trước");
  if (!inp.beneish.namNay.tongTaiSan)
    check(inp.beneish.namNay.tongTaiSan, "Beneish — Tổng tài sản năm nay");
  if (!inp.beneish.namTruoc.tongTaiSan)
    check(inp.beneish.namTruoc.tongTaiSan, "Beneish — Tổng tài sản năm trước");

  return missing;
}

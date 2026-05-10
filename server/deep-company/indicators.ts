// ════════════════════════════════════════════════════════════════════════════
// TIRA Phase 2 — Module "Phân tích sâu Cty"
// 39 chỉ số rủi ro thuế (R01–R39) + Beneish M-Score
//
// Nguồn nghiệp vụ: file "Tong-hop-rui-ro.xlsx" (Cục thuế Hà Nội — Phòng NV-DT-PC)
// và macro VBA trong Codes.txt.
//
// Toàn bộ công thức ở đây bám sát công thức cell-level trong sheet
// "Bieu danh gia" và "Mo hinh Beneish" của file Excel gốc.
// ════════════════════════════════════════════════════════════════════════════

import type { DeepCompanyInputs, IndicatorResult, BeneishResult, RiskFlag } from "./types";

// ---- Helpers ---------------------------------------------------------------
const num = (v: any): number => {
  if (v === null || v === undefined || v === "" || v === "None") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const div = (a: number, b: number): number => (b === 0 ? 0 : a / b);
const isMissing = (v: any): boolean =>
  v === null || v === undefined || v === "" || (typeof v === "number" && !Number.isFinite(v));

// ════════════════════════════════════════════════════════════════════════════
// 39 ĐỊNH NGHĨA CHỈ SỐ (R01..R39)
// Theo sheet "Bieu danh gia"
//   formula(in)  → tái tạo chính xác công thức tại cột E (Chênh lệch / SL đánh giá)
//   risk(...)    → quy tắc cảnh báo (đỏ/vàng/xanh) và cờ
// ════════════════════════════════════════════════════════════════════════════
export interface IndicatorDef {
  id: string;                              // R01..R39
  group: "GTGT-TNDN" | "GTGT-KT" | "BCTC-LCTT" | "TNDN" | "BCTC-CDKT" | "BCTC-Khac";
  name: string;
  description: string;
  riskCategory: string;                    // F/G/H columns of Excel (DT, KT, CP, ...)
  formula: (i: DeepCompanyInputs) => number | null;
  // tier: 0 = trực tiếp ghi nhận giá trị; 1 = chênh lệch (SL1-SL2)
  tier: 0 | 1;
  thresholdNote: string;
  evaluate: (value: number | null, i: DeepCompanyInputs) =>
    { level: "green" | "yellow" | "red" | "gray"; reason: string; flag?: RiskFlag };
}

// Ngưỡng tương đối: nếu |Chênh lệch| / max(|SL1|,|SL2|, 1) > materiality → red
const MATERIALITY = 0.05; // 5%
const SOFT_MATERIALITY = 0.01; // 1%

function evalDelta(
  sl1: number, sl2: number, value: number | null, name: string
): { level: "green" | "yellow" | "red" | "gray"; reason: string; flag?: RiskFlag } {
  if (value === null) return { level: "gray", reason: "Chưa đủ dữ liệu để tính" };
  const base = Math.max(Math.abs(sl1), Math.abs(sl2), 1);
  const ratio = Math.abs(value) / base;
  if (Math.abs(value) < 1) return { level: "green", reason: "Không có chênh lệch trọng yếu" };
  if (ratio > MATERIALITY) {
    return {
      level: "red",
      reason: `Chênh lệch ${(ratio * 100).toFixed(1)}% vượt ngưỡng trọng yếu 5%`,
      flag: { type: "material_gap", message: name },
    };
  }
  if (ratio > SOFT_MATERIALITY) {
    return { level: "yellow", reason: `Chênh lệch ${(ratio * 100).toFixed(2)}% (1–5%)` };
  }
  return { level: "green", reason: "Chênh lệch không trọng yếu" };
}

function evalPositive(value: number | null, label: string):
  { level: "green" | "yellow" | "red" | "gray"; reason: string; flag?: RiskFlag } {
  if (value === null) return { level: "gray", reason: "Chưa đủ dữ liệu" };
  if (value > 0) {
    return {
      level: "yellow",
      reason: `${label} = ${value.toLocaleString("vi-VN")} — cần soát xét`,
      flag: { type: "needs_review", message: label },
    };
  }
  return { level: "green", reason: "Không có giá trị bất thường" };
}

// Build all 39 indicators
export const INDICATORS: IndicatorDef[] = [
  // ── Nhóm I: Đối chiếu GTGT ↔ TNDN ↔ BCTC ──────────────────────────────
  {
    id: "R01",
    group: "GTGT-TNDN",
    name: "Chênh lệch giữa Doanh thu tính thuế GTGT và Doanh thu tính thuế TNDN",
    description:
      "Doanh thu GTGT ([34] tờ khai 01/GTGT, tổng cả năm) so với Doanh thu bán HHDV theo BCTC + Điều chỉnh tăng [B2] - Giảm trừ doanh thu tính thuế năm trước [B9].",
    riskCategory: "DT — Doanh thu",
    tier: 1,
    formula: (i) => {
      const sl1 = num(i.gtgt.tongDoanhThu); // GTGT!U13 (tổng cột [34])
      const sl2 = num(i.bctc.kqkdDoanhThuBanHangCN) + num(i.tndn.dieuChinhTangDoanhThuB2) - num(i.tndn.giamTruDTNamTruocB9);
      return sl1 - sl2;
    },
    thresholdNote: "Chênh lệch âm lớn → có thể chậm xuất hóa đơn, lệch thời điểm ghi nhận DT.",
    evaluate: (v, i) => {
      const sl1 = num(i.gtgt.tongDoanhThu);
      const sl2 = num(i.bctc.kqkdDoanhThuBanHangCN) + num(i.tndn.dieuChinhTangDoanhThuB2) - num(i.tndn.giamTruDTNamTruocB9);
      return evalDelta(sl1, sl2, v, "Chênh lệch DT GTGT vs TNDN");
    },
  },
  {
    id: "R02",
    group: "GTGT-KT",
    name: "Chênh lệch thuế GTGT đầu ra",
    description: "Chỉ tiêu [35] tờ khai 01/GTGT vs Phát sinh Có TK 33311.",
    riskCategory: "ĐR — Đầu ra",
    tier: 1,
    formula: (i) => num(i.gtgt.thueGTGTDauRa) - num(i.bctc.psCo33311),
    thresholdNote: "Sai lệch cho thấy có thể hạch toán/kê khai thiếu doanh thu hoặc thuế đầu ra.",
    evaluate: (v, i) => evalDelta(num(i.gtgt.thueGTGTDauRa), num(i.bctc.psCo33311), v, "Thuế GTGT đầu ra"),
  },
  {
    id: "R03",
    group: "GTGT-KT",
    name: "Chênh lệch thuế GTGT đầu vào",
    description: "Chỉ tiêu [25] tờ khai 01/GTGT vs Phát sinh Nợ TK 1331.",
    riskCategory: "KT — Khấu trừ",
    tier: 1,
    formula: (i) => num(i.gtgt.thueGTGTDuocKT) - num(i.bctc.psNo1331),
    thresholdNote: "Chênh lệch lớn → rủi ro xác định sai số GTGT được khấu trừ/hoàn.",
    evaluate: (v, i) => evalDelta(num(i.gtgt.thueGTGTDuocKT), num(i.bctc.psNo1331), v, "Thuế GTGT đầu vào"),
  },
  {
    id: "R04",
    group: "GTGT-KT",
    name: "Xác định thuế GTGT đầu vào được khấu trừ khi có doanh thu không chịu thuế",
    description: "Chỉ tiêu [24] vs [25] — nếu có doanh thu không chịu thuế GTGT mà [24]=[25] → có rủi ro phân bổ.",
    riskCategory: "KT, CP",
    tier: 1,
    formula: (i) => num(i.gtgt.thueGTGTHHDVMuaVao) - num(i.gtgt.thueGTGTDuocKT),
    thresholdNote: "Khi có DT không chịu thuế nhưng đầu vào khấu trừ = đầu vào mua → chưa phân bổ.",
    evaluate: (v, i) => {
      if (v === null) return { level: "gray", reason: "Thiếu dữ liệu" };
      const dtKhongCT = num(i.gtgt.doanhThuKhongChiuThue);
      if (dtKhongCT > 0 && Math.abs(v) < 1) {
        return {
          level: "red",
          reason: "Có DT không chịu thuế nhưng [24]=[25] — nghi ngờ chưa phân bổ thuế đầu vào",
          flag: { type: "tax_logic", message: "GTGT đầu vào không phân bổ" },
        };
      }
      return { level: "green", reason: "Không phát hiện bất thường" };
    },
  },
  {
    id: "R05",
    group: "GTGT-KT",
    name: "Chênh lệch GTGT còn được khấu trừ kỳ trước chuyển sang",
    description: "Chỉ tiêu [22] tờ khai đầu năm vs Số dư GTGT được khấu trừ đầu năm trên BCTC.",
    riskCategory: "KT",
    tier: 1,
    formula: (i) => num(i.gtgt.gtgtConKTKyTruocChuyenSang) - num(i.bctc.gtgtDuocKTDauNam),
    thresholdNote: "Chênh lệch → kê khai sai số dư đầu kỳ.",
    evaluate: (v, i) => evalDelta(num(i.gtgt.gtgtConKTKyTruocChuyenSang), num(i.bctc.gtgtDuocKTDauNam), v, "GTGT đầu năm"),
  },
  {
    id: "R06",
    group: "GTGT-KT",
    name: "Chênh lệch GTGT còn được khấu trừ chuyển kỳ sau",
    description: "Chỉ tiêu [43] tờ khai cuối năm vs Số dư GTGT được khấu trừ cuối năm trên BCTC.",
    riskCategory: "KT",
    tier: 1,
    formula: (i) => num(i.gtgt.gtgtConKTChuyenKySau) - num(i.bctc.gtgtDuocKTCuoiNam),
    thresholdNote: "Chênh lệch → kê khai sai số dư cuối kỳ hoặc đã hoàn thuế chưa hạch toán.",
    evaluate: (v, i) => evalDelta(num(i.gtgt.gtgtConKTChuyenKySau), num(i.bctc.gtgtDuocKTCuoiNam), v, "GTGT cuối năm"),
  },
  {
    id: "R07",
    group: "GTGT-KT",
    name: "Chênh lệch HHDV bán ra, thuế đầu ra và phát sinh Nợ TK 131",
    description: "(Doanh thu GTGT + Thuế GTGT đầu ra) vs Phát sinh Nợ TK 131.",
    riskCategory: "DT, ĐR",
    tier: 1,
    formula: (i) => num(i.gtgt.tongDoanhThu) + num(i.gtgt.thueGTGTDauRa) - num(i.bctc.psNo131),
    thresholdNote: "Chênh lệch → rủi ro thiếu/trùng doanh thu hoặc điều kiện thanh toán.",
    evaluate: (v, i) =>
      evalDelta(num(i.gtgt.tongDoanhThu) + num(i.gtgt.thueGTGTDauRa), num(i.bctc.psNo131), v, "Bán ra vs Nợ 131"),
  },
  {
    id: "R08",
    group: "GTGT-KT",
    name: "Chênh lệch HHDV mua vào, thuế đầu vào và phát sinh Có TK 331",
    description: "([23]+[24]) vs Phát sinh Có TK 331.",
    riskCategory: "KT, CP",
    tier: 1,
    formula: (i) => num(i.gtgt.giaTriHHDVMuaVao) + num(i.gtgt.thueGTGTHHDVMuaVao) - num(i.bctc.psCo331),
    thresholdNote: "Chênh lệch → rủi ro kê khai thừa/thiếu đầu vào, điều kiện thanh toán.",
    evaluate: (v, i) =>
      evalDelta(num(i.gtgt.giaTriHHDVMuaVao) + num(i.gtgt.thueGTGTHHDVMuaVao), num(i.bctc.psCo331), v, "Mua vào vs Có 331"),
  },
  {
    id: "R09",
    group: "GTGT-KT",
    name: "Chênh lệch hạch toán thuế GTGT đầu vào được hoàn",
    description: "|Có TK 133 - Nợ TK 33311| vs Thuế GTGT đã được hoàn trong kỳ.",
    riskCategory: "KT, CP",
    tier: 1,
    formula: (i) => Math.abs(num(i.bctc.psCo1331) - num(i.bctc.psNo33311)) - num(i.gtgt.thueGTGTDuocHoan),
    thresholdNote: "Sai → rủi ro xác định khấu trừ/hoàn thuế.",
    evaluate: (v, i) =>
      evalDelta(
        Math.abs(num(i.bctc.psCo1331) - num(i.bctc.psNo33311)),
        num(i.gtgt.thueGTGTDuocHoan), v, "Hoàn thuế GTGT"
      ),
  },
  {
    id: "R10",
    group: "BCTC-LCTT",
    name: "Chênh lệch dòng tiền thu từ bán hàng và doanh thu",
    description:
      "([34]+[35]) + (PThuKH ĐN - CN) - (NMTrTrước ĐN - CN) so với MS01 - LCTT.",
    riskCategory: "DT, ĐR, KH",
    tier: 1,
    formula: (i) => {
      const sl1 = num(i.gtgt.doanhThuChiuThue) + num(i.gtgt.thueGTGTDauRa)
        + (num(i.bctc.cdktPhaiThuKHDauNam) - num(i.bctc.cdktPhaiThuKHCuoiNam))
        - (num(i.bctc.cdktNguoiMuaTraTruocDauNam) - num(i.bctc.cdktNguoiMuaTraTruocCuoiNam));
      return sl1 - num(i.bctc.lcttTienThuBanHang_MS01);
    },
    thresholdNote: "Chênh lệch lớn → rủi ro ghi nhận DT, lập hóa đơn, dòng tiền.",
    evaluate: (v, i) => {
      const sl1 = num(i.gtgt.doanhThuChiuThue) + num(i.gtgt.thueGTGTDauRa)
        + (num(i.bctc.cdktPhaiThuKHDauNam) - num(i.bctc.cdktPhaiThuKHCuoiNam))
        - (num(i.bctc.cdktNguoiMuaTraTruocDauNam) - num(i.bctc.cdktNguoiMuaTraTruocCuoiNam));
      return evalDelta(sl1, num(i.bctc.lcttTienThuBanHang_MS01), v, "Dòng tiền thu vs DT");
    },
  },
  {
    id: "R11",
    group: "BCTC-LCTT",
    name: "Chênh lệch dòng tiền chi trả người cung cấp",
    description: "([23]+[24]) + (PT người bán ĐN-CN) - (Trả trước cho NB ĐN-CN) so với -MS02.",
    riskCategory: "KT, CP, KH",
    tier: 1,
    formula: (i) => {
      const sl1 = num(i.gtgt.giaTriHHDVMuaVao) + num(i.gtgt.thueGTGTHHDVMuaVao)
        + (num(i.bctc.cdktPhaiTraNguoiBanDauNam) - num(i.bctc.cdktPhaiTraNguoiBanCuoiNam))
        - (num(i.bctc.cdktTraTruocCNBanDauNam) - num(i.bctc.cdktTraTruocCNBanCuoiNam));
      const sl2 = -num(i.bctc.lcttTienChiNCC_MS02);
      return sl1 - sl2;
    },
    thresholdNote: "Chênh lệch → rủi ro xác định đầu vào, chi phí.",
    evaluate: (v, i) => {
      const sl1 = num(i.gtgt.giaTriHHDVMuaVao) + num(i.gtgt.thueGTGTHHDVMuaVao)
        + (num(i.bctc.cdktPhaiTraNguoiBanDauNam) - num(i.bctc.cdktPhaiTraNguoiBanCuoiNam))
        - (num(i.bctc.cdktTraTruocCNBanDauNam) - num(i.bctc.cdktTraTruocCNBanCuoiNam));
      return evalDelta(sl1, -num(i.bctc.lcttTienChiNCC_MS02), v, "Dòng tiền chi vs mua vào");
    },
  },
  {
    id: "R12",
    group: "BCTC-CDKT",
    name: "Chênh lệch giá vốn và thành phẩm/hàng hóa xuất kho",
    description: "Có TK 154 + 155 + 156 vs Nợ TK 632.",
    riskCategory: "DT, CP",
    tier: 1,
    formula: (i) =>
      num(i.bctc.psCo154) + num(i.bctc.psCo155) + num(i.bctc.psCo156) - num(i.bctc.psNo632),
    thresholdNote: "Chênh lệch → có thể đã xuất kho nhưng chưa ghi nhận giá vốn/doanh thu (xuất nội bộ, tặng…).",
    evaluate: (v, i) =>
      evalDelta(
        num(i.bctc.psCo154) + num(i.bctc.psCo155) + num(i.bctc.psCo156),
        num(i.bctc.psNo632), v, "Giá vốn vs xuất kho"
      ),
  },

  // ── Nhóm II: Tờ khai TNDN (giá trị tuyệt đối) ─────────────────────────
  {
    id: "R13",
    group: "TNDN",
    name: "Các khoản giảm trừ doanh thu",
    description: "Chỉ tiêu [03]/[06] phụ lục KQHĐKD 03-1A.",
    riskCategory: "DT, ĐR, PN, UĐ",
    tier: 0,
    formula: (i) => num(i.tndn.giamTruDoanhThu),
    thresholdNote: "Có giá trị → cần soát xét thời điểm ghi nhận và lập hóa đơn.",
    evaluate: (v) => evalPositive(v, "Giảm trừ doanh thu"),
  },
  {
    id: "R14",
    group: "TNDN",
    name: "Thu nhập khác",
    description: "Chỉ tiêu [16]/[19] phụ lục KQHĐKD 03-1A.",
    riskCategory: "DT, MG",
    tier: 0,
    formula: (i) => num(i.tndn.thuNhapKhac),
    thresholdNote: "Cần kiểm tra bản chất khoản thu, áp dụng ưu đãi.",
    evaluate: (v) => evalPositive(v, "Thu nhập khác"),
  },
  {
    id: "R15",
    group: "TNDN",
    name: "Các khoản điều chỉnh tăng doanh thu (B2)",
    description: "Chỉ tiêu B2 — tờ khai 03/TNDN.",
    riskCategory: "DT",
    tier: 0,
    formula: (i) => num(i.tndn.dieuChinhTangDoanhThuB2),
    thresholdNote: "Giá trị lớn → soát xét thời điểm ghi nhận DT.",
    evaluate: (v) => evalPositive(v, "Điều chỉnh tăng DT (B2)"),
  },
  {
    id: "R16",
    group: "TNDN",
    name: "Giảm trừ doanh thu đã tính thuế năm trước (B9)",
    description: "Chỉ tiêu B9 — tờ khai 03/TNDN.",
    riskCategory: "DT",
    tier: 0,
    formula: (i) => num(i.tndn.giamTruDTNamTruocB9),
    thresholdNote: "Có giá trị → kiểm tra DT đã ghi nhận năm trước.",
    evaluate: (v) => evalPositive(v, "Giảm trừ DT năm trước (B9)"),
  },
  {
    id: "R17",
    group: "TNDN",
    name: "Các khoản chi không được trừ (B4)",
    description: "Chỉ tiêu B4 — tờ khai 03/TNDN.",
    riskCategory: "KT, CP",
    tier: 0,
    formula: (i) => num(i.tndn.chiKhongDuocTruB4),
    thresholdNote: "Cần kiểm tra GTGT đầu vào tương ứng có bị loại khấu trừ.",
    evaluate: (v) => evalPositive(v, "Chi không được trừ (B4)"),
  },
  {
    id: "R18",
    group: "TNDN",
    name: "Điều chỉnh tăng LN trước thuế khác (B7)",
    description: "Chỉ tiêu B7 — tờ khai 03/TNDN.",
    riskCategory: "DT, MG",
    tier: 0,
    formula: (i) => num(i.tndn.dieuChinhTangLNB7),
    thresholdNote: "Cần kiểm tra hoạt động kinh doanh và ưu đãi.",
    evaluate: (v) => evalPositive(v, "Điều chỉnh tăng LN (B7)"),
  },
  {
    id: "R19",
    group: "TNDN",
    name: "Điều chỉnh giảm LN trước thuế khác (B11/B12)",
    description: "Chỉ tiêu B11 (TT151) hoặc B12 (TT80).",
    riskCategory: "PN, MG",
    tier: 0,
    formula: (i) => num(i.tndn.dieuChinhGiamLNB11_B12),
    thresholdNote: "Cần kiểm tra ưu đãi/miễn giảm.",
    evaluate: (v) => evalPositive(v, "Điều chỉnh giảm LN (B11/B12)"),
  },
  {
    id: "R20",
    group: "TNDN",
    name: "Chuyển lỗ và bù trừ lãi/lỗ (C3)",
    description: "Chỉ tiêu C3 — tờ khai 03/TNDN.",
    riskCategory: "PN, MG",
    tier: 0,
    formula: (i) => num(i.tndn.chuyenLoC3),
    thresholdNote: "Cần kiểm tra điều kiện chuyển lỗ.",
    evaluate: (v) => evalPositive(v, "Chuyển lỗ (C3)"),
  },
  {
    id: "R21",
    group: "TNDN",
    name: "Thuế TNDN được miễn, giảm trong kỳ (C12 / C12+C13)",
    description: "Chỉ tiêu C12 (TT151) hoặc C12+C13 (TT80).",
    riskCategory: "PN, MG",
    tier: 0,
    formula: (i) => num(i.tndn.mienGiamThueC12_C13),
    thresholdNote: "Cần kiểm tra điều kiện ưu đãi.",
    evaluate: (v) => evalPositive(v, "Miễn giảm thuế TNDN"),
  },
  {
    id: "R22",
    group: "TNDN",
    name: "Có hoạt động bán HHDV thu ngoại tệ nhưng không có điều chỉnh tăng/giảm LN khác",
    description: "B7 - B11/B12.",
    riskCategory: "DT",
    tier: 1,
    formula: (i) => num(i.tndn.dieuChinhTangLNB7) - num(i.tndn.dieuChinhGiamLNB11_B12),
    thresholdNote: "Nếu có DT xuất khẩu mà chênh lệch=0 → có thể chưa đánh giá lại tỷ giá.",
    evaluate: (v, i) => {
      if (v === null) return { level: "gray", reason: "Thiếu dữ liệu" };
      const dtXK = num(i.gtgt.doanhThuThueSuat0);
      if (dtXK > 0 && Math.abs(v) < 1) {
        return {
          level: "red",
          reason: "Có DT xuất khẩu nhưng B7=B11/B12 — nghi ngờ chưa đánh giá lại CL tỷ giá",
          flag: { type: "tax_logic", message: "Thiếu điều chỉnh chênh lệch tỷ giá" },
        };
      }
      return evalDelta(num(i.tndn.dieuChinhTangLNB7), num(i.tndn.dieuChinhGiamLNB11_B12), v, "B7 vs B11/B12");
    },
  },

  // ── Nhóm III: Bảng cân đối kế toán (BCTC) — giá trị tuyệt đối ─────────
  {
    id: "R23",
    group: "BCTC-CDKT",
    name: "Phải thu ngắn hạn của khách hàng (MS131)",
    description: "Mã số 131 - BCDKT.",
    riskCategory: "KT",
    tier: 0,
    formula: (i) => num(i.bctc.cdktPhaiThuKHCuoiNam),
    thresholdNote: "Lớn → rủi ro điều kiện thanh toán cho hoàn/khấu trừ.",
    evaluate: (v) => evalPositive(v, "Phải thu KH ngắn hạn"),
  },
  {
    id: "R24",
    group: "BCTC-CDKT",
    name: "Phải thu ngắn hạn khác",
    description: "MS136 (TT200) / 134 (TT133a) / 133 (TT133b).",
    riskCategory: "DT",
    tier: 0,
    formula: (i) => num(i.bctc.cdktPhaiThuKhac),
    thresholdNote: "Có giá trị → kiểm tra ghi nhận DT, hóa đơn.",
    evaluate: (v) => evalPositive(v, "Phải thu khác"),
  },
  {
    id: "R25",
    group: "BCTC-CDKT",
    name: "Dự phòng phải thu ngắn hạn và dài hạn khó đòi",
    description: "MS137 + MS219 (TT200), MS136 (TT133a), MS135 (TT133b).",
    riskCategory: "CP",
    tier: 0,
    formula: (i) => num(i.bctc.cdktDuPhongPhaiThuNH) + num(i.bctc.cdktDuPhongPhaiThuDH),
    thresholdNote: "Có giá trị → kiểm tra điều kiện trích lập theo TT 48/2019.",
    evaluate: (v) => evalPositive(v, "Dự phòng phải thu khó đòi"),
  },
  {
    id: "R26",
    group: "BCTC-CDKT",
    name: "Tài sản dở dang dài hạn / XDCB dở dang",
    description: "MS240 (TT200), MS170 (TT133a), MS240 (TT133b).",
    riskCategory: "KT",
    tier: 0,
    formula: (i) => num(i.bctc.cdktTSDoDangDH),
    thresholdNote: "Có giá trị → kiểm tra DT chưa kê khai cho hoạt động xây dựng/sản xuất.",
    evaluate: (v) => evalPositive(v, "TS dở dang dài hạn"),
  },
  {
    id: "R27",
    group: "BCTC-CDKT",
    name: "Người mua trả tiền trước ngắn hạn và dài hạn",
    description: "MS312 + MS332 (TT200), MS312 (TT133a), MS412+422 (TT133b).",
    riskCategory: "DT",
    tier: 0,
    formula: (i) =>
      num(i.bctc.cdktNguoiMuaTraTruocCuoiNam) + num(i.bctc.cdktNguoiMuaTraTruocDH),
    thresholdNote: "Có giá trị lớn → rủi ro thời điểm ghi nhận DT cung cấp dịch vụ.",
    evaluate: (v) => evalPositive(v, "Người mua trả tiền trước"),
  },
  {
    id: "R28",
    group: "BCTC-CDKT",
    name: "Phải trả người lao động",
    description: "MS314.",
    riskCategory: "CP",
    tier: 0,
    formula: (i) => num(i.bctc.cdktPhaiTraNLD),
    thresholdNote: "Có giá trị → kiểm tra ghi nhận chi phí lương.",
    evaluate: (v) => evalPositive(v, "Phải trả người lao động"),
  },
  {
    id: "R29",
    group: "BCTC-CDKT",
    name: "Trích trước chi phí phải trả",
    description: "MS315 + MS333 (TT200), MS417+426 (TT133b).",
    riskCategory: "CP",
    tier: 0,
    formula: (i) => num(i.bctc.cdktChiPhiPhaiTraNH) + num(i.bctc.cdktChiPhiPhaiTraDH),
    thresholdNote: "Có giá trị → kiểm tra điều kiện trích trước.",
    evaluate: (v) => evalPositive(v, "Trích trước chi phí"),
  },
  {
    id: "R30",
    group: "BCTC-CDKT",
    name: "Doanh thu chưa thực hiện ngắn hạn và dài hạn",
    description: "MS318 + MS336 (TT200).",
    riskCategory: "DT",
    tier: 0,
    formula: (i) => num(i.bctc.cdktDTChuaThucHienNH) + num(i.bctc.cdktDTChuaThucHienDH),
    thresholdNote: "Có giá trị → soát xét thời điểm ghi nhận doanh thu.",
    evaluate: (v) => evalPositive(v, "Doanh thu chưa thực hiện"),
  },
  {
    id: "R31",
    group: "BCTC-CDKT",
    name: "Thuế TNDN hoãn lại phải trả (MS341)",
    description: "MS341 - TT200.",
    riskCategory: "MG",
    tier: 0,
    formula: (i) => num(i.bctc.cdktThueHoanLai),
    thresholdNote: "Cần kiểm tra cơ sở hoãn lại.",
    evaluate: (v) => evalPositive(v, "Thuế TNDN hoãn lại"),
  },
  {
    id: "R32",
    group: "BCTC-CDKT",
    name: "Trích lập dự phòng",
    description: "Tổng các tài khoản dự phòng theo TT200/TT133.",
    riskCategory: "CP",
    tier: 0,
    formula: (i) => num(i.bctc.cdktTongDuPhong),
    thresholdNote: "Cần kiểm tra điều kiện và mức trích lập.",
    evaluate: (v) => evalPositive(v, "Tổng dự phòng"),
  },
  {
    id: "R33",
    group: "BCTC-CDKT",
    name: "Trích lập Quỹ phát triển KH&CN",
    description: "MS343 (TT200), MS320 (TT133a), MS427 (TT133b).",
    riskCategory: "MG",
    tier: 0,
    formula: (i) => num(i.bctc.cdktQuyKHCN),
    thresholdNote: "Cần kiểm tra điều kiện và mục đích sử dụng quỹ.",
    evaluate: (v) => evalPositive(v, "Quỹ KH&CN"),
  },

  // ── Nhóm IV: LCTT trực tiếp (giá trị tuyệt đối) ───────────────────────
  {
    id: "R34",
    group: "BCTC-LCTT",
    name: "Tiền thu khác từ HĐSXKD (MS06)",
    description: "MS06 - LCTT.",
    riskCategory: "DT",
    tier: 0,
    formula: (i) => num(i.bctc.lcttTienThuKhac_MS06),
    thresholdNote: "Có giá trị → kiểm tra bản chất khoản thu.",
    evaluate: (v) => evalPositive(v, "Tiền thu khác (MS06)"),
  },
  {
    id: "R35",
    group: "BCTC-LCTT",
    name: "Tiền chi khác cho HĐSXKD (MS07)",
    description: "-MS07 - LCTT.",
    riskCategory: "DT",
    tier: 0,
    formula: (i) => -num(i.bctc.lcttTienChiKhac_MS07),
    thresholdNote: "Có chi nhưng chưa ghi nhận DT tương ứng → rủi ro.",
    evaluate: (v) => evalPositive(v, "Tiền chi khác (MS07)"),
  },
  {
    id: "R36",
    group: "BCTC-LCTT",
    name: "Tiền chi cho vay, mua công cụ nợ của đơn vị khác (MS23)",
    description: "MS23 - LCTT.",
    riskCategory: "DT",
    tier: 0,
    formula: (i) => num(i.bctc.lcttTienChiChoVay_MS23),
    thresholdNote: "Cần kiểm tra DT lãi cho vay và phân bổ GTGT đầu vào.",
    evaluate: (v) => evalPositive(v, "Tiền chi cho vay (MS23)"),
  },
  {
    id: "R37",
    group: "BCTC-LCTT",
    name: "Thu lãi tiền cho vay, cổ tức (MS27)",
    description: "MS27 - LCTT.",
    riskCategory: "DT",
    tier: 0,
    formula: (i) => num(i.bctc.lcttThuLaiCoTuc_MS27),
    thresholdNote: "Cần kiểm tra DT không chịu thuế GTGT.",
    evaluate: (v) => evalPositive(v, "Thu lãi/cổ tức (MS27)"),
  },
  {
    id: "R38",
    group: "BCTC-LCTT",
    name: "Tiền chi mua sắm, xây dựng TSCĐ (MS21)",
    description: "MS21 - LCTT.",
    riskCategory: "KT",
    tier: 0,
    formula: (i) => num(i.bctc.lcttTienChiMuaSamTSCD_MS21),
    thresholdNote: "Có Dự án đầu tư → kê khai trên 01/GTGT theo quy định.",
    evaluate: (v) => evalPositive(v, "Tiền chi TSCĐ (MS21)"),
  },
  {
    id: "R39",
    group: "BCTC-Khac",
    name: "Ý kiến của Kiểm toán độc lập trên BCTC",
    description: "Ngoại trừ / Từ chối / Không chấp nhận → đánh dấu X.",
    riskCategory: "Tổng hợp",
    tier: 0,
    formula: (i) => (i.bctc.yKienKiemToanCoNgoaiTru ? 1 : 0),
    thresholdNote: "Nếu có ngoại trừ → ảnh hưởng tin cậy BCTC và điều kiện hoàn thuế.",
    evaluate: (v, i) => {
      if (i.bctc.yKienKiemToanCoNgoaiTru) {
        return {
          level: "red",
          reason: "BCTC có ý kiến ngoại trừ/từ chối/không chấp nhận",
          flag: { type: "audit_qualified", message: "Kiểm toán có ngoại trừ" },
        };
      }
      return { level: "green", reason: "Không có ý kiến ngoại trừ" };
    },
  },
];

// ════════════════════════════════════════════════════════════════════════════
// MÔ HÌNH BENEISH M-SCORE
// Bám sát công thức trong sheet "Mo hinh Beneish":
//   M = -4.84 + 0.92*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI
//       + 0.115*DEPI - 0.172*SGAI + 4.679*TATA - 0.327*LVGI
// Nếu M > -2.22 → có dấu hiệu thao túng BCTC.
// ════════════════════════════════════════════════════════════════════════════
export function calculateBeneish(i: DeepCompanyInputs): BeneishResult {
  const ny = i.beneish.namNay;
  const nt = i.beneish.namTruoc;

  const e_dt = num(ny.doanhThuThuan);
  const e_gv = num(ny.giaVonHangBan);
  const e_pthu = num(ny.phaiThuNganHan);
  const e_ts_nh = num(ny.taiSanNganHan);
  const e_tscd = num(ny.taiSanCoDinhRong);
  const e_kh = num(ny.chiPhiKhauHao);
  const e_tts = num(ny.tongTaiSan);
  const e_cpbq = num(ny.chiPhiBHQLDN);
  const e_lnst = num(ny.lnSauThue);
  const e_dt_hdkd = num(ny.dongTienHDKD);
  const e_no_nh = num(ny.noPhaiTraNganHan);
  const e_no_dh = num(ny.noVayDaiHan);
  const e_dt_khac = e_tts - e_tscd - e_ts_nh; // BS = TA - (CA + PPE)

  const f_dt = num(nt.doanhThuThuan);
  const f_gv = num(nt.giaVonHangBan);
  const f_pthu = num(nt.phaiThuNganHan);
  const f_ts_nh = num(nt.taiSanNganHan);
  const f_tscd = num(nt.taiSanCoDinhRong);
  const f_kh = num(nt.chiPhiKhauHao);
  const f_tts = num(nt.tongTaiSan);
  const f_cpbq = num(nt.chiPhiBHQLDN);
  const f_dt_khac = f_tts - f_tscd - f_ts_nh;
  const f_no_nh = num(nt.noPhaiTraNganHan);
  const f_no_dh = num(nt.noVayDaiHan);

  const DSRI = div(div(e_pthu, e_dt), div(f_pthu, f_dt)) || 0;
  const GMI = div(div(f_dt - f_gv, f_dt), div(e_dt - e_gv, e_dt)) || 0;
  const AQI = div(div(e_dt_khac, e_tts), div(f_dt_khac, f_tts)) || 0;
  const SGI = div(e_dt, f_dt) || 0;
  const DEPI = div(div(f_kh, f_kh + f_tscd), div(e_kh, e_kh + e_tscd)) || 0;
  const SGAI = div(div(e_cpbq, e_dt), div(f_cpbq, f_dt)) || 0;
  const TATA = div(e_lnst - e_dt_hdkd, e_tts) || 0;
  const LVGI = div(div(e_no_nh + e_no_dh, e_tts), div(f_no_nh + f_no_dh, f_tts)) || 0;

  const M = -4.84 + 0.92 * DSRI + 0.528 * GMI + 0.404 * AQI + 0.892 * SGI
    + 0.115 * DEPI - 0.172 * SGAI + 4.679 * TATA - 0.327 * LVGI;

  return {
    DSRI, GMI, AQI, SGI, DEPI, SGAI, TATA, LVGI,
    mScore: M,
    flagged: M > -2.22,
    interpretation: M > -2.22
      ? "M-Score > -2.22 → có dấu hiệu thao túng BCTC."
      : "M-Score ≤ -2.22 → không có dấu hiệu thao túng BCTC theo mô hình Beneish.",
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Tính tất cả 39 chỉ số
// ════════════════════════════════════════════════════════════════════════════
export function calculateAllIndicators(inputs: DeepCompanyInputs): IndicatorResult[] {
  return INDICATORS.map((def) => {
    let value: number | null = null;
    let level: "green" | "yellow" | "red" | "gray" = "gray";
    let reason = "";
    let flag: RiskFlag | undefined;

    try {
      value = def.formula(inputs);
      const ev = def.evaluate(value, inputs);
      level = ev.level;
      reason = ev.reason;
      flag = ev.flag;
    } catch (e: any) {
      level = "gray";
      reason = `Lỗi tính toán: ${e?.message ?? e}`;
    }

    return {
      id: def.id,
      group: def.group,
      name: def.name,
      description: def.description,
      riskCategory: def.riskCategory,
      tier: def.tier,
      thresholdNote: def.thresholdNote,
      value,
      level,
      reason,
      flag,
    };
  });
}

export { isMissing };

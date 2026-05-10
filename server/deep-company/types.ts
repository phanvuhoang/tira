// ════════════════════════════════════════════════════════════════════════════
// TIRA Phase 2 — Module "Phân tích sâu Cty"
// Types & input schema cho 39 chỉ số rủi ro thuế + Beneish M-Score
//
// Cấu trúc bám sát file gốc:
//   - sheet "TKhai TNDN"      → input.tndn
//   - sheet "BCTC"            → input.bctc
//   - sheet "Bieu danh gia"   → 39 chỉ số R01–R39 (chấm điểm)
//   - sheet "Mo hinh Beneish" → input.beneish
//   - sheet "SPS GTGT"        → input.gtgt
// ════════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// Tờ khai GTGT (sheet "SPS GTGT" trong file gốc)
// ---------------------------------------------------------------------------
export interface GtgtInputs {
  /** Tổng doanh thu chịu thuế + không chịu thuế (cả năm) */
  tongDoanhThu: number;
  /** Tổng thuế GTGT đầu ra phát sinh trong kỳ */
  thueGTGTDauRa: number;
  /** Thuế GTGT đầu vào được khấu trừ trong kỳ */
  thueGTGTDuocKT: number;
  /** Giá trị thuế GTGT của HHDV mua vào trong kỳ */
  thueGTGTHHDVMuaVao: number;
  /** Doanh thu HHDV không chịu thuế GTGT */
  doanhThuKhongChiuThue: number;
  /** Thuế GTGT còn được khấu trừ kỳ trước chuyển sang */
  gtgtConKTKyTruocChuyenSang: number;
  /** Thuế GTGT còn được khấu trừ chuyển kỳ sau */
  gtgtConKTChuyenKySau: number;
  /** Doanh thu HHDV chịu thuế GTGT */
  doanhThuChiuThue: number;
  /** Giá trị HHDV mua vào trong kỳ (cả chịu thuế lẫn không chịu thuế) */
  giaTriHHDVMuaVao: number;
  /** Thuế GTGT đã được hoàn trong kỳ */
  thueGTGTDuocHoan: number;
  /** Doanh thu HHDV chịu thuế suất 0% */
  doanhThuThueSuat0: number;
}

// ---------------------------------------------------------------------------
// Tờ khai quyết toán TNDN (sheet "TKhai TNDN" + macro Sub TNDN())
// ---------------------------------------------------------------------------
export interface TndnInputs {
  /** B2 — Điều chỉnh tăng doanh thu */
  dieuChinhTangDoanhThuB2: number;
  /** B9 — Giảm trừ doanh thu năm trước hạch toán năm nay */
  giamTruDTNamTruocB9: number;
  /** Tổng các khoản giảm trừ doanh thu (B9 + B10 …) */
  giamTruDoanhThu: number;
  /** Thu nhập khác (mã 22) */
  thuNhapKhac: number;
  /** B4 — Các khoản chi không được trừ khi xác định TNCT */
  chiKhongDuocTruB4: number;
  /** B7 — Điều chỉnh tăng lợi nhuận khác */
  dieuChinhTangLNB7: number;
  /** B11 + B12 — Điều chỉnh giảm lợi nhuận */
  dieuChinhGiamLNB11_B12: number;
  /** C3 — Lỗ từ kỳ trước được chuyển sang */
  chuyenLoC3: number;
  /** C12 + C13 — Số thuế TNDN được miễn, giảm */
  mienGiamThueC12_C13: number;
}

// ---------------------------------------------------------------------------
// Báo cáo tài chính (sheet "BCTC" + macro Sub BCTC())
//   - psNo / psCo: phát sinh Nợ / phát sinh Có theo TK trong kỳ
//   - cdkt:        số dư đầu / cuối năm trên Cân đối kế toán
//   - kqkd:        số liệu Kết quả kinh doanh
//   - lctt:        số liệu Lưu chuyển tiền tệ
// ---------------------------------------------------------------------------
export interface BctcInputs {
  /** KQKD — Doanh thu bán hàng và cung cấp dịch vụ (mã 01) */
  kqkdDoanhThuBanHangCN: number;

  // ── Phát sinh trong kỳ ────────────────────────────────────────────────
  /** PS Nợ TK 131 — Phải thu khách hàng */
  psNo131: number;
  /** PS Có TK 331 — Phải trả người bán */
  psCo331: number;
  /** PS Có TK 33311 — Thuế GTGT đầu ra */
  psCo33311: number;
  /** PS Nợ TK 33311 */
  psNo33311: number;
  /** PS Có TK 1331 — Thuế GTGT được khấu trừ */
  psCo1331: number;
  /** PS Nợ TK 1331 */
  psNo1331: number;
  /** PS Nợ TK 632 — Giá vốn hàng bán */
  psNo632: number;
  /** PS Có TK 154 — Chi phí SXKD dở dang */
  psCo154: number;
  /** PS Có TK 155 — Thành phẩm */
  psCo155: number;
  /** PS Có TK 156 — Hàng hoá */
  psCo156: number;

  // ── Cân đối kế toán ───────────────────────────────────────────────────
  /** Mã 152 — Thuế GTGT được khấu trừ — đầu năm */
  gtgtDuocKTDauNam: number;
  /** Mã 152 — cuối năm */
  gtgtDuocKTCuoiNam: number;
  /** Phải thu khách hàng (mã 131) — đầu năm */
  cdktPhaiThuKHDauNam: number;
  cdktPhaiThuKHCuoiNam: number;
  /** Phải trả người bán (mã 311) — đầu năm */
  cdktPhaiTraNguoiBanDauNam: number;
  cdktPhaiTraNguoiBanCuoiNam: number;
  /** Trả trước cho người bán — đầu năm */
  cdktTraTruocCNBanDauNam: number;
  cdktTraTruocCNBanCuoiNam: number;
  /** Người mua trả tiền trước (NH) — đầu năm */
  cdktNguoiMuaTraTruocDauNam: number;
  cdktNguoiMuaTraTruocCuoiNam: number;
  /** Người mua trả tiền trước dài hạn (cuối năm) */
  cdktNguoiMuaTraTruocDH: number;

  /** Phải thu khác (mã 136 + 138 + 141) — cuối năm */
  cdktPhaiThuKhac: number;
  /** Dự phòng phải thu khó đòi ngắn hạn — cuối năm (số âm) */
  cdktDuPhongPhaiThuNH: number;
  /** Dự phòng phải thu khó đòi dài hạn — cuối năm (số âm) */
  cdktDuPhongPhaiThuDH: number;
  /** Tài sản dở dang dài hạn (mã 240) — cuối năm */
  cdktTSDoDangDH: number;

  /** Phải trả người lao động (mã 334) — cuối năm */
  cdktPhaiTraNLD: number;
  /** Chi phí phải trả ngắn hạn (mã 335) — cuối năm */
  cdktChiPhiPhaiTraNH: number;
  /** Chi phí phải trả dài hạn (mã 343) — cuối năm */
  cdktChiPhiPhaiTraDH: number;
  /** Doanh thu chưa thực hiện ngắn hạn — cuối năm */
  cdktDTChuaThucHienNH: number;
  /** Doanh thu chưa thực hiện dài hạn — cuối năm */
  cdktDTChuaThucHienDH: number;

  /** Tài sản thuế thu nhập hoãn lại — cuối năm */
  cdktThueHoanLai: number;
  /** Tổng dự phòng (PT khó đòi + giảm giá HTK + …) — cuối năm */
  cdktTongDuPhong: number;
  /** Quỹ khen thưởng phúc lợi — cuối năm */
  cdktQuyKHCN: number;

  // ── Lưu chuyển tiền tệ ────────────────────────────────────────────────
  /** MS01 — Tiền thu từ bán hàng, CCDV và doanh thu khác */
  lcttTienThuBanHang_MS01: number;
  /** MS02 — Tiền chi trả cho người cung cấp HHDV */
  lcttTienChiNCC_MS02: number;
  /** MS06 — Tiền thu khác từ HĐ kinh doanh */
  lcttTienThuKhac_MS06: number;
  /** MS07 — Tiền chi khác cho HĐ kinh doanh */
  lcttTienChiKhac_MS07: number;
  /** MS23 — Tiền chi cho vay, mua công cụ nợ */
  lcttTienChiChoVay_MS23: number;
  /** MS27 — Tiền thu lãi cho vay, cổ tức */
  lcttThuLaiCoTuc_MS27: number;
  /** MS21 — Tiền chi mua sắm, xây dựng TSCĐ */
  lcttTienChiMuaSamTSCD_MS21: number;

  // ── Ý kiến kiểm toán ──────────────────────────────────────────────────
  /** R39: BCTC có ý kiến kiểm toán ngoại trừ / từ chối / trái ngược */
  yKienKiemToanCoNgoaiTru: boolean;
}

// ---------------------------------------------------------------------------
// Mô hình Beneish M-Score (sheet "Mo hinh Beneish")
//   So sánh năm nay vs năm trước
// ---------------------------------------------------------------------------
export interface BeneishYearInputs {
  /** Doanh thu thuần (mã 10 — KQKD) */
  doanhThuThuan: number;
  /** Giá vốn hàng bán (mã 11) */
  giaVonHangBan: number;
  /** Phải thu ngắn hạn của KH (mã 131) — số dư cuối năm */
  phaiThuNganHan: number;
  /** Tổng tài sản ngắn hạn (mã 100) */
  taiSanNganHan: number;
  /** Tài sản cố định ròng (mã 220) */
  taiSanCoDinhRong: number;
  /** Chi phí khấu hao TSCĐ trong kỳ */
  chiPhiKhauHao: number;
  /** Tổng tài sản (mã 270) */
  tongTaiSan: number;
  /** Chi phí bán hàng + chi phí QLDN */
  chiPhiBHQLDN: number;
  /** Lợi nhuận sau thuế (mã 60) */
  lnSauThue: number;
  /** Lưu chuyển tiền thuần từ HĐKD (mã 20 — LCTT) */
  dongTienHDKD: number;
  /** Nợ phải trả ngắn hạn (mã 310) */
  noPhaiTraNganHan: number;
  /** Vay và nợ thuê tài chính dài hạn (mã 338) */
  noVayDaiHan: number;
}

export interface BeneishInputs {
  namNay: BeneishYearInputs;
  namTruoc: BeneishYearInputs;
}

// ---------------------------------------------------------------------------
// Toàn bộ input
// ---------------------------------------------------------------------------
export interface DeepCompanyInputs {
  /** Thông tin định danh (chỉ để hiển thị / lưu lịch sử) */
  meta?: {
    tenCty?: string;
    mst?: string;
    nam?: number;
    nguoiPhanTich?: string;
    ghiChu?: string;
  };
  gtgt: GtgtInputs;
  tndn: TndnInputs;
  bctc: BctcInputs;
  beneish: BeneishInputs;
}

// ---------------------------------------------------------------------------
// Output từ engine
// ---------------------------------------------------------------------------
export type RiskLevel = "green" | "yellow" | "red" | "gray";

export interface RiskFlag {
  /** Mã loại cờ — vd "audit_qualified", "negative_equity" */
  type: string;
  /** Thông điệp mô tả ngắn (tiếng Việt) */
  message: string;
}

export interface IndicatorResult {
  /** Mã chỉ số: R01–R39 */
  id: string;
  /** Nhóm: GTGT-TNDN-BCTC | TKhai TNDN | CDKT | LCTT | KiemToan */
  group: string;
  /** Tên chỉ số (tiếng Việt) */
  name: string;
  /** Mô tả ngắn về ý nghĩa rủi ro */
  description: string;
  /** Loại rủi ro: doanh-thu | chi-phi | thue-gtgt | tai-san | dong-tien | kiem-toan */
  riskCategory: string;
  /** Tier 0 = giá trị tuyệt đối, tier 1 = chênh lệch / tỷ lệ, tier 2 = boolean */
  tier: 0 | 1 | 2;
  /** Ghi chú ngưỡng đánh giá (tiếng Việt) */
  thresholdNote: string;
  /** Giá trị tính được (null nếu không tính được do thiếu dữ liệu) */
  value: number | null;
  /** Mức rủi ro */
  level: RiskLevel;
  /** Lý do mức rủi ro (tiếng Việt) — KHÔNG được rỗng nếu level !== gray */
  reason: string;
  /** Cờ rủi ro chuyên biệt (nếu có) — vd ý kiến kiểm toán ngoại trừ */
  flag?: RiskFlag;
}

export interface BeneishResult {
  DSRI: number;
  GMI: number;
  AQI: number;
  SGI: number;
  DEPI: number;
  SGAI: number;
  TATA: number;
  LVGI: number;
  /** M-Score = -4.84 + 0.92*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI
   *          + 0.115*DEPI - 0.172*SGAI + 4.679*TATA - 0.327*LVGI */
  mScore: number;
  /** true nếu M > -2.22 → có dấu hiệu thao túng BCTC */
  flagged: boolean;
  /** Diễn giải (tiếng Việt) */
  interpretation: string;
}

// ---------------------------------------------------------------------------
// Composite output
// ---------------------------------------------------------------------------
export interface DeepCompanyAnalysis {
  meta: NonNullable<DeepCompanyInputs["meta"]>;
  indicators: IndicatorResult[];
  beneish: BeneishResult;
  scoring: {
    /** Điểm rủi ro tổng (0–100) */
    composite: number;
    /** Điểm theo nhóm chỉ số */
    byGroup: Record<
      string,
      { score: number; count: number; red: number; yellow: number; green: number; gray: number }
    >;
    /** Tổng số đèn đỏ / vàng / xanh / xám */
    summary: { red: number; yellow: number; green: number; gray: number; total: number };
    /** Mức rủi ro tổng */
    overallLevel: RiskLevel;
    /** Liệt kê các cờ rủi ro đặc biệt */
    flags: RiskFlag[];
  };
  /** Cảnh báo conflict / xung đột giữa các chỉ số (vd doanh thu GTGT khác BCTC) */
  conflicts: string[];
  /** Danh sách field bị thiếu (UI có thể highlight) */
  missingFields: string[];
  /** Thời điểm phân tích (ISO) */
  analyzedAt: string;
}

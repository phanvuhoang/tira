// ════════════════════════════════════════════════════════════════════════════
// TIRA Phase 2 — Excel template generator cho module "Phân tích sâu Cty"
//
// Sinh file mẫu để user tải về, điền số liệu rồi upload lại.
// Một sheet duy nhất "Input" với 3 cột: Mã | Tên trường (tiếng Việt) | Giá trị
// User chỉ cần điền cột "Giá trị". Backend đọc theo Mã.
// ════════════════════════════════════════════════════════════════════════════

import * as XLSX from "xlsx";

interface Row {
  ma: string;
  ten: string;
  ghiChu?: string;
  defaultValue?: number | string;
}

/** Hàng 2 cột (đầu năm / cuối năm) — dùng cho phần CĐKT + Beneish gộp. */
interface DualRow {
  ten: string;
  /** Mã trường ứng với cột "Đầu năm" (= năm trước theo BCTC). Có thể là 1 hoặc nhiều mã (auto-sync). */
  dauPaths: string[];
  /** Mã trường ứng với cột "Cuối năm" (= năm nay theo BCTC). */
  cuoiPaths: string[];
  ghiChu?: string;
}

interface Section {
  title: string;
  rows?: Row[];
  /** Khi có dualRows, section render dạng 4 cột: Tên | Đầu năm | Cuối năm | Ghi chú. */
  dualRows?: DualRow[];
}

const SECTIONS: Section[] = [
  {
    title: "1. THÔNG TIN CÔNG TY",
    rows: [
      { ma: "meta.tenCty", ten: "Tên công ty" },
      { ma: "meta.mst", ten: "Mã số thuế" },
      { ma: "meta.nam", ten: "Năm phân tích (yyyy)" },
      { ma: "meta.nguoiPhanTich", ten: "Người phân tích" },
      { ma: "meta.ghiChu", ten: "Ghi chú" },
    ],
  },
  {
    title: "2. TỜ KHAI GTGT (cả năm — đơn vị: VND)",
    rows: [
      { ma: "gtgt.tongDoanhThu", ten: "Tổng doanh thu (chịu + không chịu thuế)" },
      { ma: "gtgt.thueGTGTDauRa", ten: "Thuế GTGT đầu ra phát sinh trong kỳ" },
      { ma: "gtgt.thueGTGTDuocKT", ten: "Thuế GTGT đầu vào được khấu trừ" },
      { ma: "gtgt.thueGTGTHHDVMuaVao", ten: "Thuế GTGT của HHDV mua vào" },
      { ma: "gtgt.doanhThuKhongChiuThue", ten: "Doanh thu HHDV không chịu thuế" },
      { ma: "gtgt.gtgtConKTKyTruocChuyenSang", ten: "GTGT còn được KT kỳ trước chuyển sang" },
      { ma: "gtgt.gtgtConKTChuyenKySau", ten: "GTGT còn được KT chuyển kỳ sau" },
      { ma: "gtgt.doanhThuChiuThue", ten: "Doanh thu HHDV chịu thuế GTGT" },
      { ma: "gtgt.giaTriHHDVMuaVao", ten: "Giá trị HHDV mua vào (cả chịu và không chịu)" },
      { ma: "gtgt.thueGTGTDuocHoan", ten: "Thuế GTGT đã được hoàn trong kỳ" },
      { ma: "gtgt.doanhThuThueSuat0", ten: "Doanh thu chịu thuế suất 0%" },
    ],
  },
  {
    title: "3. TỜ KHAI QUYẾT TOÁN TNDN",
    rows: [
      { ma: "tndn.dieuChinhTangDoanhThuB2", ten: "[B2] Điều chỉnh tăng doanh thu" },
      { ma: "tndn.giamTruDTNamTruocB9", ten: "[B9] Giảm trừ doanh thu năm trước hạch toán năm nay" },
      { ma: "tndn.giamTruDoanhThu", ten: "Tổng các khoản giảm trừ doanh thu" },
      { ma: "tndn.thuNhapKhac", ten: "Thu nhập khác (mã 22)" },
      { ma: "tndn.chiKhongDuocTruB4", ten: "[B4] Các khoản chi không được trừ" },
      { ma: "tndn.dieuChinhTangLNB7", ten: "[B7] Điều chỉnh tăng lợi nhuận khác" },
      { ma: "tndn.dieuChinhGiamLNB11_B12", ten: "[B11+B12] Điều chỉnh giảm lợi nhuận" },
      { ma: "tndn.chuyenLoC3", ten: "[C3] Lỗ kỳ trước chuyển sang" },
      { ma: "tndn.mienGiamThueC12_C13", ten: "[C12+C13] Số thuế TNDN được miễn, giảm" },
    ],
  },
  {
    title: "4. SỔ KẾ TOÁN — PHÁT SINH TRONG KỲ",
    rows: [
      { ma: "bctc.psNo131", ten: "PS Nợ TK 131 — Phải thu khách hàng" },
      { ma: "bctc.psCo331", ten: "PS Có TK 331 — Phải trả người bán" },
      { ma: "bctc.psCo33311", ten: "PS Có TK 33311 — Thuế GTGT đầu ra" },
      { ma: "bctc.psNo33311", ten: "PS Nợ TK 33311" },
      { ma: "bctc.psCo1331", ten: "PS Có TK 1331 — Thuế GTGT được khấu trừ" },
      { ma: "bctc.psNo1331", ten: "PS Nợ TK 1331" },
      { ma: "bctc.psNo632", ten: "PS Nợ TK 632 — Giá vốn hàng bán" },
      { ma: "bctc.psCo154", ten: "PS Có TK 154 — Chi phí SXKD dở dang" },
      { ma: "bctc.psCo155", ten: "PS Có TK 155 — Thành phẩm" },
      { ma: "bctc.psCo156", ten: "PS Có TK 156 — Hàng hoá" },
    ],
  },
  {
    title: "5. KQKD",
    rows: [
      { ma: "bctc.kqkdDoanhThuBanHangCN", ten: "Doanh thu bán hàng và CCDV (mã 01)" },
    ],
  },
  // Section 6 (CĐKT) + 9 (Beneish năm nay) + 10 (Beneish năm trước) — gộp thành 1 bảng 2 cột.
  // "Đầu năm" = beneish.namTruoc + cdkt*DauNam; "Cuối năm" = beneish.namNay + cdkt*CuoiNam.
  {
    title: "6. CÂN ĐỐI KẾ TOÁN & BENEISH M-SCORE — Đầu năm / Cuối năm",
    dualRows: [
      // ── Nhóm KQKD (Beneish) ──────────────────────────────────────────────
      { ten: "Doanh thu thuần (mã 10)", dauPaths: ["beneish.namTruoc.doanhThuThuan"], cuoiPaths: ["beneish.namNay.doanhThuThuan"] },
      { ten: "Giá vốn hàng bán (mã 11)", dauPaths: ["beneish.namTruoc.giaVonHangBan"], cuoiPaths: ["beneish.namNay.giaVonHangBan"] },
      { ten: "Chi phí bán hàng + QLDN", dauPaths: ["beneish.namTruoc.chiPhiBHQLDN"], cuoiPaths: ["beneish.namNay.chiPhiBHQLDN"] },
      { ten: "Chi phí khấu hao TSCĐ", dauPaths: ["beneish.namTruoc.chiPhiKhauHao"], cuoiPaths: ["beneish.namNay.chiPhiKhauHao"] },
      { ten: "Lợi nhuận sau thuế (mã 60)", dauPaths: ["beneish.namTruoc.lnSauThue"], cuoiPaths: ["beneish.namNay.lnSauThue"] },
      { ten: "Lưu chuyển tiền thuần HĐKD (mã 20 LCTT)", dauPaths: ["beneish.namTruoc.dongTienHDKD"], cuoiPaths: ["beneish.namNay.dongTienHDKD"] },
      // ── Tài sản (CĐKT + Beneish) ─────────────────────────────────────────
      { ten: "Tài sản ngắn hạn (mã 100)", dauPaths: ["beneish.namTruoc.taiSanNganHan"], cuoiPaths: ["beneish.namNay.taiSanNganHan"] },
      { ten: "Phải thu KH ngắn hạn (mã 131)", dauPaths: ["bctc.cdktPhaiThuKHDauNam", "beneish.namTruoc.phaiThuNganHan"], cuoiPaths: ["bctc.cdktPhaiThuKHCuoiNam", "beneish.namNay.phaiThuNganHan"] },
      { ten: "Trả trước cho người bán", dauPaths: ["bctc.cdktTraTruocCNBanDauNam"], cuoiPaths: ["bctc.cdktTraTruocCNBanCuoiNam"] },
      { ten: "Thuế GTGT được KT (mã 152)", dauPaths: ["bctc.gtgtDuocKTDauNam"], cuoiPaths: ["bctc.gtgtDuocKTCuoiNam"] },
      { ten: "Phải thu khác (136+138+141)", dauPaths: [], cuoiPaths: ["bctc.cdktPhaiThuKhac"] },
      { ten: "Dự phòng PT khó đòi NH (số âm)", dauPaths: [], cuoiPaths: ["bctc.cdktDuPhongPhaiThuNH"] },
      { ten: "Dự phòng PT khó đòi DH (số âm)", dauPaths: [], cuoiPaths: ["bctc.cdktDuPhongPhaiThuDH"] },
      { ten: "Tài sản cố định ròng (mã 220)", dauPaths: ["beneish.namTruoc.taiSanCoDinhRong"], cuoiPaths: ["beneish.namNay.taiSanCoDinhRong"] },
      { ten: "TS dở dang dài hạn (mã 240)", dauPaths: [], cuoiPaths: ["bctc.cdktTSDoDangDH"] },
      { ten: "Tài sản thuế thu nhập hoãn lại", dauPaths: [], cuoiPaths: ["bctc.cdktThueHoanLai"] },
      { ten: "Tổng tài sản (mã 270)", dauPaths: ["beneish.namTruoc.tongTaiSan"], cuoiPaths: ["beneish.namNay.tongTaiSan"] },
      // ── Nguồn vốn (CĐKT + Beneish) ───────────────────────────────────────
      { ten: "Nợ phải trả ngắn hạn (mã 310)", dauPaths: ["beneish.namTruoc.noPhaiTraNganHan"], cuoiPaths: ["beneish.namNay.noPhaiTraNganHan"] },
      { ten: "Phải trả người bán NH (mã 311)", dauPaths: ["bctc.cdktPhaiTraNguoiBanDauNam"], cuoiPaths: ["bctc.cdktPhaiTraNguoiBanCuoiNam"] },
      { ten: "Người mua trả trước NH (mã 312)", dauPaths: ["bctc.cdktNguoiMuaTraTruocDauNam"], cuoiPaths: ["bctc.cdktNguoiMuaTraTruocCuoiNam"] },
      { ten: "Người mua trả trước DH (mã 332)", dauPaths: [], cuoiPaths: ["bctc.cdktNguoiMuaTraTruocDH"] },
      { ten: "Phải trả người lao động (334)", dauPaths: [], cuoiPaths: ["bctc.cdktPhaiTraNLD"] },
      { ten: "Chi phí phải trả NH (335)", dauPaths: [], cuoiPaths: ["bctc.cdktChiPhiPhaiTraNH"] },
      { ten: "Chi phí phải trả DH (343)", dauPaths: [], cuoiPaths: ["bctc.cdktChiPhiPhaiTraDH"] },
      { ten: "Doanh thu chưa thực hiện NH", dauPaths: [], cuoiPaths: ["bctc.cdktDTChuaThucHienNH"] },
      { ten: "Doanh thu chưa thực hiện DH", dauPaths: [], cuoiPaths: ["bctc.cdktDTChuaThucHienDH"] },
      { ten: "Vay & nợ thuê tài chính DH (mã 338)", dauPaths: ["beneish.namTruoc.noVayDaiHan"], cuoiPaths: ["beneish.namNay.noVayDaiHan"] },
      { ten: "Tổng dự phòng", dauPaths: [], cuoiPaths: ["bctc.cdktTongDuPhong"] },
      { ten: "Quỹ khen thưởng phúc lợi", dauPaths: [], cuoiPaths: ["bctc.cdktQuyKHCN"] },
    ],
  },
  {
    title: "7. LƯU CHUYỂN TIỀN TỆ (riêng — không trùng với MS20 ở phần 6)",
    rows: [
      { ma: "bctc.lcttTienThuBanHang_MS01", ten: "MS01 — Tiền thu từ BH, CCDV và DT khác" },
      { ma: "bctc.lcttTienChiNCC_MS02", ten: "MS02 — Tiền chi cho người cung cấp HHDV" },
      { ma: "bctc.lcttTienThuKhac_MS06", ten: "MS06 — Tiền thu khác từ HĐKD" },
      { ma: "bctc.lcttTienChiKhac_MS07", ten: "MS07 — Tiền chi khác cho HĐKD" },
      { ma: "bctc.lcttTienChiChoVay_MS23", ten: "MS23 — Tiền chi cho vay, mua công cụ nợ" },
      { ma: "bctc.lcttThuLaiCoTuc_MS27", ten: "MS27 — Tiền thu lãi cho vay, cổ tức" },
      { ma: "bctc.lcttTienChiMuaSamTSCD_MS21", ten: "MS21 — Tiền chi mua sắm, xây dựng TSCĐ" },
    ],
  },
  {
    title: "8. KIỂM TOÁN",
    rows: [
      {
        ma: "bctc.yKienKiemToanCoNgoaiTru",
        ten: "BCTC có ý kiến kiểm toán ngoại trừ/từ chối/trái ngược (1=Có, 0=Không)",
        defaultValue: 0,
      },
    ],
  },
];

/**
 * Trả về Buffer chứa file .xlsx mẫu cho module "Phân tích sâu Cty".
 */
export function buildDeepCompanyTemplate(): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Input ─────────────────────────────────────────────────────
  // Format: 4 cột | Mã trường | Tên trường | Giá trị | Ghi chú |
  // Riêng section CĐKT+Beneish (có dualRows) sẽ in 2 dòng liên tiếp:
  //  • dòng "Đầu năm" cho tất cả mã ứng với cột đầu năm
  //  • dòng "Cuối năm" cho tất cả mã ứng với cột cuối năm
  // Cách bố trí 1-mã-1-dòng vẫn được giữ để parser cũ không hỏng.
  const aoa: any[][] = [];
  aoa.push([
    "Mã trường",
    "Tên trường (tiếng Việt)",
    "Giá trị (điền vào đây)",
    "Ghi chú",
  ]);
  for (const sec of SECTIONS) {
    aoa.push([sec.title, "", "", ""]);
    if (sec.rows) {
      for (const r of sec.rows) {
        aoa.push([r.ma, r.ten, r.defaultValue ?? "", r.ghiChu ?? ""]);
      }
    }
    if (sec.dualRows) {
      // Header phụ giúp user thấy cấu trúc 2 cột — không có dấu chấm trong cột A nên parser bỏ qua.
      aoa.push(["-- Đầu năm (= năm trước) --", "", "", ""]);
      for (const dr of sec.dualRows) {
        if (dr.dauPaths.length === 0) continue;
        // Mã đầu tiên là path "chính"; mã phụ ghi trong ghi chú để parser tự đọc thêm.
        const [head, ...extras] = dr.dauPaths;
        const note = extras.length
          ? `Đầu năm. Đồng bộ: ${extras.join(", ")}`
          : "Đầu năm";
        aoa.push([head, `${dr.ten} — đầu năm`, "", note]);
        for (const ex of extras) {
          aoa.push([ex, `${dr.ten} — đầu năm (đồng bộ)`, "", "= dòng trên"]);
        }
      }
      aoa.push(["-- Cuối năm (= năm nay) --", "", "", ""]);
      for (const dr of sec.dualRows) {
        if (dr.cuoiPaths.length === 0) continue;
        const [head, ...extras] = dr.cuoiPaths;
        const note = extras.length
          ? `Cuối năm. Đồng bộ: ${extras.join(", ")}`
          : "Cuối năm";
        aoa.push([head, `${dr.ten} — cuối năm`, "", note]);
        for (const ex of extras) {
          aoa.push([ex, `${dr.ten} — cuối năm (đồng bộ)`, "", "= dòng trên"]);
        }
      }
    }
    aoa.push(["", "", "", ""]); // dòng trống ngăn cách section
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 44 }, { wch: 60 }, { wch: 22 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws, "Input");

  // ── Sheet phụ "CĐKT & Beneish (2 cột)" — chỉ để user xem trực quan, KHÔNG dùng parse.
  //    Format: | Chỉ tiêu | Đầu năm | Cuối năm | Ghi chú |
  const cdktSection = SECTIONS.find((s) => s.dualRows);
  if (cdktSection?.dualRows) {
    const aoa2: any[][] = [];
    aoa2.push([cdktSection.title]);
    aoa2.push([""]);
    aoa2.push(["Chỉ tiêu", "Đầu năm (năm trước)", "Cuối năm (năm nay)", "Mã trường"]);
    for (const dr of cdktSection.dualRows) {
      const codes = [
        dr.dauPaths.length ? `Đầu: ${dr.dauPaths.join(" + ")}` : "",
        dr.cuoiPaths.length ? `Cuối: ${dr.cuoiPaths.join(" + ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      aoa2.push([dr.ten, dr.dauPaths.length ? "" : "—", dr.cuoiPaths.length ? "" : "—", codes]);
    }
    aoa2.push([""]);
    aoa2.push([
      "Lưu ý: Sheet này chỉ để TRỰC QUAN. Để nhập số, vui lòng dùng sheet 'Input'.",
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
    ws2["!cols"] = [{ wch: 50 }, { wch: 22 }, { wch: 22 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws2, "CĐKT-Beneish 2 cột");
  }

  // ── Sheet 2: Hướng dẫn ────────────────────────────────────────────────
  const huongDan = [
    ["TIRA — Phân tích sâu Cty: Hướng dẫn điền"],
    [""],
    [
      "1. Chỉ điền số liệu vào CỘT C (Giá trị). Không sửa cột A (Mã trường) — backend đọc theo mã này.",
    ],
    ["2. Đơn vị tính: VND (đồng) cho tất cả các trường tiền tệ."],
    ['3. Trường có nhãn (1=Có, 0=Không) → điền 1 hoặc 0.'],
    [
      '4. Nếu trường nào không có dữ liệu → để trống (sẽ được đánh giá mức "xám" và AI sẽ nói rõ thiếu dữ liệu).',
    ],
    [
      '5. Beneish M-Score CẦN SỐ LIỆU CẢ "Năm nay" và "Năm trước" — nếu thiếu, M-Score không tính được.',
    ],
    [""],
    ["NHÓM TRƯỜNG"],
    ["1. Thông tin công ty"],
    ["2. Tờ khai GTGT (cả năm)"],
    ["3. Tờ khai quyết toán TNDN"],
    ["4. Sổ kế toán — phát sinh trong kỳ"],
    ["5. KQKD"],
    ["6. CĐKT & Beneish M-Score — Đầu năm / Cuối năm (2 cột, gộp section 6+9+10 cũ)"],
    ["7. Lưu chuyển tiền tệ"],
    ["8. Kiểm toán"],
    [""],
    [
      "Mẹo: với công ty niêm yết, có thể bấm 'Tải số từ BCTC' ngay trên UI để auto-fill phần 6 (CĐKT + Beneish).",
    ],
    [""],
    [
      "Sau khi điền xong, vào module 'Phân tích sâu Cty' trên TIRA, bấm 'Tải file Excel lên' để chạy phân tích.",
    ],
  ];
  const wsH = XLSX.utils.aoa_to_sheet(huongDan);
  wsH["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsH, "Hướng dẫn");

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buf;
}

/**
 * Đọc file Excel user upload, trả về DeepCompanyInputs theo schema types.ts.
 * Nếu thiếu trường thì gán 0 (cho number) hoặc "" (cho string) — engine sẽ đánh giá "xám".
 */
export function parseDeepCompanyTemplate(fileBuffer: Buffer): {
  inputs: any;
  warnings: string[];
} {
  const wb = XLSX.read(fileBuffer, { type: "buffer" });
  const ws = wb.Sheets["Input"] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    throw new Error("Không tìm thấy sheet 'Input' trong file Excel.");
  }
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  const map: Record<string, any> = {};
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const ma = String(row[0] ?? "").trim();
    if (!ma || !ma.includes(".")) continue; // bỏ qua header / section title
    const v = row[2];
    map[ma] = v;
  }

  const warnings: string[] = [];
  const numAt = (key: string): number => {
    const raw = map[key];
    if (raw === undefined || raw === null || raw === "") return 0;
    if (typeof raw === "number") return raw;
    const cleaned = String(raw).replace(/[,\s]/g, "").replace(/\./g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n)) {
      warnings.push(`Trường '${key}' không phải số: '${raw}' → đã coi là 0.`);
      return 0;
    }
    return n;
  };
  const strAt = (key: string): string => {
    const raw = map[key];
    return raw === undefined || raw === null ? "" : String(raw);
  };
  const boolAt = (key: string): boolean => {
    const raw = map[key];
    if (raw === 1 || raw === "1" || raw === true) return true;
    const s = String(raw ?? "")
      .trim()
      .toLowerCase();
    return s === "true" || s === "có" || s === "co" || s === "yes" || s === "y";
  };

  const inputs = {
    meta: {
      tenCty: strAt("meta.tenCty"),
      mst: strAt("meta.mst"),
      nam: numAt("meta.nam") || undefined,
      nguoiPhanTich: strAt("meta.nguoiPhanTich"),
      ghiChu: strAt("meta.ghiChu"),
    },
    gtgt: {
      tongDoanhThu: numAt("gtgt.tongDoanhThu"),
      thueGTGTDauRa: numAt("gtgt.thueGTGTDauRa"),
      thueGTGTDuocKT: numAt("gtgt.thueGTGTDuocKT"),
      thueGTGTHHDVMuaVao: numAt("gtgt.thueGTGTHHDVMuaVao"),
      doanhThuKhongChiuThue: numAt("gtgt.doanhThuKhongChiuThue"),
      gtgtConKTKyTruocChuyenSang: numAt("gtgt.gtgtConKTKyTruocChuyenSang"),
      gtgtConKTChuyenKySau: numAt("gtgt.gtgtConKTChuyenKySau"),
      doanhThuChiuThue: numAt("gtgt.doanhThuChiuThue"),
      giaTriHHDVMuaVao: numAt("gtgt.giaTriHHDVMuaVao"),
      thueGTGTDuocHoan: numAt("gtgt.thueGTGTDuocHoan"),
      doanhThuThueSuat0: numAt("gtgt.doanhThuThueSuat0"),
    },
    tndn: {
      dieuChinhTangDoanhThuB2: numAt("tndn.dieuChinhTangDoanhThuB2"),
      giamTruDTNamTruocB9: numAt("tndn.giamTruDTNamTruocB9"),
      giamTruDoanhThu: numAt("tndn.giamTruDoanhThu"),
      thuNhapKhac: numAt("tndn.thuNhapKhac"),
      chiKhongDuocTruB4: numAt("tndn.chiKhongDuocTruB4"),
      dieuChinhTangLNB7: numAt("tndn.dieuChinhTangLNB7"),
      dieuChinhGiamLNB11_B12: numAt("tndn.dieuChinhGiamLNB11_B12"),
      chuyenLoC3: numAt("tndn.chuyenLoC3"),
      mienGiamThueC12_C13: numAt("tndn.mienGiamThueC12_C13"),
    },
    bctc: {
      kqkdDoanhThuBanHangCN: numAt("bctc.kqkdDoanhThuBanHangCN"),
      psNo131: numAt("bctc.psNo131"),
      psCo331: numAt("bctc.psCo331"),
      psCo33311: numAt("bctc.psCo33311"),
      psNo33311: numAt("bctc.psNo33311"),
      psCo1331: numAt("bctc.psCo1331"),
      psNo1331: numAt("bctc.psNo1331"),
      psNo632: numAt("bctc.psNo632"),
      psCo154: numAt("bctc.psCo154"),
      psCo155: numAt("bctc.psCo155"),
      psCo156: numAt("bctc.psCo156"),
      gtgtDuocKTDauNam: numAt("bctc.gtgtDuocKTDauNam"),
      gtgtDuocKTCuoiNam: numAt("bctc.gtgtDuocKTCuoiNam"),
      cdktPhaiThuKHDauNam: numAt("bctc.cdktPhaiThuKHDauNam"),
      cdktPhaiThuKHCuoiNam: numAt("bctc.cdktPhaiThuKHCuoiNam"),
      cdktPhaiTraNguoiBanDauNam: numAt("bctc.cdktPhaiTraNguoiBanDauNam"),
      cdktPhaiTraNguoiBanCuoiNam: numAt("bctc.cdktPhaiTraNguoiBanCuoiNam"),
      cdktTraTruocCNBanDauNam: numAt("bctc.cdktTraTruocCNBanDauNam"),
      cdktTraTruocCNBanCuoiNam: numAt("bctc.cdktTraTruocCNBanCuoiNam"),
      cdktNguoiMuaTraTruocDauNam: numAt("bctc.cdktNguoiMuaTraTruocDauNam"),
      cdktNguoiMuaTraTruocCuoiNam: numAt("bctc.cdktNguoiMuaTraTruocCuoiNam"),
      cdktNguoiMuaTraTruocDH: numAt("bctc.cdktNguoiMuaTraTruocDH"),
      cdktPhaiThuKhac: numAt("bctc.cdktPhaiThuKhac"),
      cdktDuPhongPhaiThuNH: numAt("bctc.cdktDuPhongPhaiThuNH"),
      cdktDuPhongPhaiThuDH: numAt("bctc.cdktDuPhongPhaiThuDH"),
      cdktTSDoDangDH: numAt("bctc.cdktTSDoDangDH"),
      cdktPhaiTraNLD: numAt("bctc.cdktPhaiTraNLD"),
      cdktChiPhiPhaiTraNH: numAt("bctc.cdktChiPhiPhaiTraNH"),
      cdktChiPhiPhaiTraDH: numAt("bctc.cdktChiPhiPhaiTraDH"),
      cdktDTChuaThucHienNH: numAt("bctc.cdktDTChuaThucHienNH"),
      cdktDTChuaThucHienDH: numAt("bctc.cdktDTChuaThucHienDH"),
      cdktThueHoanLai: numAt("bctc.cdktThueHoanLai"),
      cdktTongDuPhong: numAt("bctc.cdktTongDuPhong"),
      cdktQuyKHCN: numAt("bctc.cdktQuyKHCN"),
      lcttTienThuBanHang_MS01: numAt("bctc.lcttTienThuBanHang_MS01"),
      lcttTienChiNCC_MS02: numAt("bctc.lcttTienChiNCC_MS02"),
      lcttTienThuKhac_MS06: numAt("bctc.lcttTienThuKhac_MS06"),
      lcttTienChiKhac_MS07: numAt("bctc.lcttTienChiKhac_MS07"),
      lcttTienChiChoVay_MS23: numAt("bctc.lcttTienChiChoVay_MS23"),
      lcttThuLaiCoTuc_MS27: numAt("bctc.lcttThuLaiCoTuc_MS27"),
      lcttTienChiMuaSamTSCD_MS21: numAt("bctc.lcttTienChiMuaSamTSCD_MS21"),
      yKienKiemToanCoNgoaiTru: boolAt("bctc.yKienKiemToanCoNgoaiTru"),
    },
    beneish: {
      namNay: {
        doanhThuThuan: numAt("beneish.namNay.doanhThuThuan"),
        giaVonHangBan: numAt("beneish.namNay.giaVonHangBan"),
        phaiThuNganHan: numAt("beneish.namNay.phaiThuNganHan"),
        taiSanNganHan: numAt("beneish.namNay.taiSanNganHan"),
        taiSanCoDinhRong: numAt("beneish.namNay.taiSanCoDinhRong"),
        chiPhiKhauHao: numAt("beneish.namNay.chiPhiKhauHao"),
        tongTaiSan: numAt("beneish.namNay.tongTaiSan"),
        chiPhiBHQLDN: numAt("beneish.namNay.chiPhiBHQLDN"),
        lnSauThue: numAt("beneish.namNay.lnSauThue"),
        dongTienHDKD: numAt("beneish.namNay.dongTienHDKD"),
        noPhaiTraNganHan: numAt("beneish.namNay.noPhaiTraNganHan"),
        noVayDaiHan: numAt("beneish.namNay.noVayDaiHan"),
      },
      namTruoc: {
        doanhThuThuan: numAt("beneish.namTruoc.doanhThuThuan"),
        giaVonHangBan: numAt("beneish.namTruoc.giaVonHangBan"),
        phaiThuNganHan: numAt("beneish.namTruoc.phaiThuNganHan"),
        taiSanNganHan: numAt("beneish.namTruoc.taiSanNganHan"),
        taiSanCoDinhRong: numAt("beneish.namTruoc.taiSanCoDinhRong"),
        chiPhiKhauHao: numAt("beneish.namTruoc.chiPhiKhauHao"),
        tongTaiSan: numAt("beneish.namTruoc.tongTaiSan"),
        chiPhiBHQLDN: numAt("beneish.namTruoc.chiPhiBHQLDN"),
        lnSauThue: numAt("beneish.namTruoc.lnSauThue"),
        dongTienHDKD: numAt("beneish.namTruoc.dongTienHDKD"),
        noPhaiTraNganHan: numAt("beneish.namTruoc.noPhaiTraNganHan"),
        noVayDaiHan: numAt("beneish.namTruoc.noVayDaiHan"),
      },
    },
  };

  return { inputs, warnings };
}

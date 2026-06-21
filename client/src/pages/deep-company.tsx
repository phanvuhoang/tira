// ════════════════════════════════════════════════════════════════════════════
// TIRA Phase 2 — Trang "Phân tích sâu Cty"
// 4 bước: 1) Nhập dữ liệu (form hoặc upload Excel) 2) Phân tích
//          3) Xem kết quả 4) Tạo báo cáo AI
// ════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAiModels } from "@/hooks/use-ai-models";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Upload,
  Download,
  Calculator,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Save,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";

type Lvl = "red" | "yellow" | "green" | "gray";

const PRIMARY = "#028a39";

interface IndicatorResult {
  id: string;
  group: string;
  name: string;
  description: string;
  riskCategory: string;
  tier: 0 | 1 | 2;
  thresholdNote: string;
  value: number | null;
  level: Lvl;
  reason: string;
  flag?: { type: string; message: string };
}

interface Analysis {
  meta: any;
  indicators: IndicatorResult[];
  beneish: {
    DSRI: number; GMI: number; AQI: number; SGI: number;
    DEPI: number; SGAI: number; TATA: number; LVGI: number;
    mScore: number; flagged: boolean; interpretation: string;
  };
  scoring: {
    composite: number;
    byGroup: Record<string, { score: number; count: number; red: number; yellow: number; green: number; gray: number }>;
    summary: { red: number; yellow: number; green: number; gray: number; total: number };
    overallLevel: Lvl;
    flags: { type: string; message: string }[];
  };
  conflicts: string[];
  missingFields: string[];
  analyzedAt: string;
}

// ── Cấu trúc field cho form ────────────────────────────────────────────────
interface Field { ma: string; ten: string; }
interface Section { title: string; fields: Field[]; }

const SECTIONS: Section[] = [
  {
    title: "1. Thông tin công ty",
    fields: [
      { ma: "meta.tenCty", ten: "Tên công ty" },
      { ma: "meta.mst", ten: "Mã số thuế" },
      { ma: "meta.nam", ten: "Năm phân tích (yyyy)" },
      { ma: "meta.nguoiPhanTich", ten: "Người phân tích" },
      { ma: "meta.ghiChu", ten: "Ghi chú" },
    ],
  },
  {
    title: "2. Tờ khai GTGT (cả năm — VND)",
    fields: [
      { ma: "gtgt.tongDoanhThu", ten: "Tổng doanh thu" },
      { ma: "gtgt.thueGTGTDauRa", ten: "Thuế GTGT đầu ra" },
      { ma: "gtgt.thueGTGTDuocKT", ten: "Thuế GTGT đầu vào được KT" },
      { ma: "gtgt.thueGTGTHHDVMuaVao", ten: "Thuế GTGT của HHDV mua vào" },
      { ma: "gtgt.doanhThuKhongChiuThue", ten: "DT HHDV không chịu thuế" },
      { ma: "gtgt.gtgtConKTKyTruocChuyenSang", ten: "GTGT còn KT kỳ trước chuyển sang" },
      { ma: "gtgt.gtgtConKTChuyenKySau", ten: "GTGT còn KT chuyển kỳ sau" },
      { ma: "gtgt.doanhThuChiuThue", ten: "DT HHDV chịu thuế GTGT" },
      { ma: "gtgt.giaTriHHDVMuaVao", ten: "Giá trị HHDV mua vào" },
      { ma: "gtgt.thueGTGTDuocHoan", ten: "Thuế GTGT đã hoàn" },
      { ma: "gtgt.doanhThuThueSuat0", ten: "DT thuế suất 0%" },
    ],
  },
  {
    title: "3. Tờ khai TNDN",
    fields: [
      { ma: "tndn.dieuChinhTangDoanhThuB2", ten: "[B2] Điều chỉnh tăng DT" },
      { ma: "tndn.giamTruDTNamTruocB9", ten: "[B9] Giảm trừ DT năm trước" },
      { ma: "tndn.giamTruDoanhThu", ten: "Tổng giảm trừ DT" },
      { ma: "tndn.thuNhapKhac", ten: "Thu nhập khác (mã 22)" },
      { ma: "tndn.chiKhongDuocTruB4", ten: "[B4] Chi không được trừ" },
      { ma: "tndn.dieuChinhTangLNB7", ten: "[B7] ĐC tăng LN khác" },
      { ma: "tndn.dieuChinhGiamLNB11_B12", ten: "[B11+B12] ĐC giảm LN" },
      { ma: "tndn.chuyenLoC3", ten: "[C3] Lỗ chuyển kỳ" },
      { ma: "tndn.mienGiamThueC12_C13", ten: "[C12+C13] Miễn giảm thuế" },
    ],
  },
  {
    title: "4. Sổ kế toán — phát sinh trong kỳ",
    fields: [
      { ma: "bctc.psNo131", ten: "PS Nợ TK 131 (Phải thu KH)" },
      { ma: "bctc.psCo331", ten: "PS Có TK 331 (Phải trả NB)" },
      { ma: "bctc.psCo33311", ten: "PS Có TK 33311" },
      { ma: "bctc.psNo33311", ten: "PS Nợ TK 33311" },
      { ma: "bctc.psCo1331", ten: "PS Có TK 1331" },
      { ma: "bctc.psNo1331", ten: "PS Nợ TK 1331" },
      { ma: "bctc.psNo632", ten: "PS Nợ TK 632 (Giá vốn)" },
      { ma: "bctc.psCo154", ten: "PS Có TK 154" },
      { ma: "bctc.psCo155", ten: "PS Có TK 155" },
      { ma: "bctc.psCo156", ten: "PS Có TK 156" },
    ],
  },
  {
    title: "5. KQKD",
    fields: [
      { ma: "bctc.kqkdDoanhThuBanHangCN", ten: "DT bán hàng & CCDV (mã 01)" },
    ],
  },
  // Phần 6 (CĐKT) đã được chuyển sang bảng "CĐKT & Beneish" riêng phía dưới.

  {
    title: "7. Lưu chuyển tiền tệ",
    fields: [
      { ma: "bctc.lcttTienThuBanHang_MS01", ten: "MS01 — Tiền thu BH" },
      { ma: "bctc.lcttTienChiNCC_MS02", ten: "MS02 — Tiền chi NCC" },
      { ma: "bctc.lcttTienThuKhac_MS06", ten: "MS06 — Tiền thu khác" },
      { ma: "bctc.lcttTienChiKhac_MS07", ten: "MS07 — Tiền chi khác" },
      { ma: "bctc.lcttTienChiChoVay_MS23", ten: "MS23 — Tiền chi cho vay" },
      { ma: "bctc.lcttThuLaiCoTuc_MS27", ten: "MS27 — Thu lãi/cổ tức" },
      { ma: "bctc.lcttTienChiMuaSamTSCD_MS21", ten: "MS21 — Mua sắm TSCĐ" },
    ],
  },
  {
    title: "8. Kiểm toán",
    fields: [
      { ma: "bctc.yKienKiemToanCoNgoaiTru", ten: "Có ý kiến kiểm toán ngoại trừ? (1=Có, 0=Không)" },
    ],
  },
  // Phần 9 + 10 (Beneish) đã được gộp chung với CĐKT trong bảng "CĐKT & Beneish" riêng.
  /* removed sections 9 & 10 — fields rendered via BENEISH_CDKT_ROWS table
  {
    title: "9. Beneish — năm nay",
    fields: [
      { ma: "beneish.namNay.doanhThuThuan", ten: "Doanh thu thuần (10)" },
      { ma: "beneish.namNay.giaVonHangBan", ten: "Giá vốn hàng bán (11)" },
      { ma: "beneish.namNay.phaiThuNganHan", ten: "Phải thu NH KH (131)" },
      { ma: "beneish.namNay.taiSanNganHan", ten: "TS ngắn hạn (100)" },
      { ma: "beneish.namNay.taiSanCoDinhRong", ten: "TSCĐ ròng (220)" },
      { ma: "beneish.namNay.chiPhiKhauHao", ten: "Chi phí khấu hao" },
      { ma: "beneish.namNay.tongTaiSan", ten: "Tổng tài sản (270)" },
      { ma: "beneish.namNay.chiPhiBHQLDN", ten: "CP BH+QLDN" },
      { ma: "beneish.namNay.lnSauThue", ten: "LN sau thuế (60)" },
      { ma: "beneish.namNay.dongTienHDKD", ten: "Dòng tiền HĐKD (LCTT 20)" },
      { ma: "beneish.namNay.noPhaiTraNganHan", ten: "Nợ phải trả NH (310)" },
      { ma: "beneish.namNay.noVayDaiHan", ten: "Nợ vay DH (338)" },
    ],
  },
  {
    title: "10. Beneish — năm trước",
    fields: [
      { ma: "beneish.namTruoc.doanhThuThuan", ten: "Doanh thu thuần (10)" },
      { ma: "beneish.namTruoc.giaVonHangBan", ten: "Giá vốn hàng bán (11)" },
      { ma: "beneish.namTruoc.phaiThuNganHan", ten: "Phải thu NH KH (131)" },
      { ma: "beneish.namTruoc.taiSanNganHan", ten: "TS ngắn hạn (100)" },
      { ma: "beneish.namTruoc.taiSanCoDinhRong", ten: "TSCĐ ròng (220)" },
      { ma: "beneish.namTruoc.chiPhiKhauHao", ten: "Chi phí khấu hao" },
      { ma: "beneish.namTruoc.tongTaiSan", ten: "Tổng tài sản (270)" },
      { ma: "beneish.namTruoc.chiPhiBHQLDN", ten: "CP BH+QLDN" },
      { ma: "beneish.namTruoc.lnSauThue", ten: "LN sau thuế (60)" },
      { ma: "beneish.namTruoc.dongTienHDKD", ten: "Dòng tiền HĐKD (LCTT 20)" },
      { ma: "beneish.namTruoc.noPhaiTraNganHan", ten: "Nợ phải trả NH (310)" },
      { ma: "beneish.namTruoc.noVayDaiHan", ten: "Nợ vay DH (338)" },
    ],
  },
  */
];

// ══ Bảng "CĐKT & Beneish — Đầu năm / Cuối năm" ═══════════════════════════════════════════════════════════════════════
// Gộp phần 6 (CĐKT) + 9 (Beneish năm nay = cuối năm) + 10 (Beneish năm trước = đầu năm) thành 1 bảng 3 cột.
// Mỗi row map tới:
//   - dauPaths[]: 1–2 path được set khi user nhập cột "Đầu năm" (auto-sync cả cdkt + beneish.namTruoc).
//   - cuoiPaths[]: tương tự cho cột "Cuối năm" (cdkt + beneish.namNay).
// Khi 1 bên trống (một số mục chỉ có ở 1 bên) thì leave empty array — input sẽ bị disable.
interface BeneishCdktRow {
  ten: string;
  dauPaths: string[];
  cuoiPaths: string[];
  note?: string;
}
const BENEISH_CDKT_ROWS: BeneishCdktRow[] = [
  // ── Doanh thu / KQKD ─────────────────────────────────────────────────
  { ten: "Doanh thu thuần (KQKD mã 10)", dauPaths: ["beneish.namTruoc.doanhThuThuan"], cuoiPaths: ["beneish.namNay.doanhThuThuan"] },
  { ten: "Giá vốn hàng bán (KQKD mã 11)",  dauPaths: ["beneish.namTruoc.giaVonHangBan"], cuoiPaths: ["beneish.namNay.giaVonHangBan"] },
  { ten: "CP bán hàng + QLDN",               dauPaths: ["beneish.namTruoc.chiPhiBHQLDN"], cuoiPaths: ["beneish.namNay.chiPhiBHQLDN"] },
  { ten: "LN sau thuế (KQKD mã 60)",         dauPaths: ["beneish.namTruoc.lnSauThue"],   cuoiPaths: ["beneish.namNay.lnSauThue"] },
  // ── CĐKT — tài sản ngắn hạn ────────────────────────────────────────────
  { ten: "Thuế GTGT được khấu trừ (mã 152)", dauPaths: ["bctc.gtgtDuocKTDauNam"],         cuoiPaths: ["bctc.gtgtDuocKTCuoiNam"] },
  { ten: "Phải thu KH (mã 131)",              dauPaths: ["bctc.cdktPhaiThuKHDauNam", "beneish.namTruoc.phaiThuNganHan"], cuoiPaths: ["bctc.cdktPhaiThuKHCuoiNam", "beneish.namNay.phaiThuNganHan"] },
  { ten: "Trả trước cho người bán",          dauPaths: ["bctc.cdktTraTruocCNBanDauNam"], cuoiPaths: ["bctc.cdktTraTruocCNBanCuoiNam"] },
  { ten: "Phải thu khác (136+138+141)",        dauPaths: [],                              cuoiPaths: ["bctc.cdktPhaiThuKhac"] },
  { ten: "Dự phòng PT khó đòi NH (số âm)",      dauPaths: [],                              cuoiPaths: ["bctc.cdktDuPhongPhaiThuNH"] },
  { ten: "Dự phòng PT khó đòi DH (số âm)",      dauPaths: [],                              cuoiPaths: ["bctc.cdktDuPhongPhaiThuDH"] },
  { ten: "Tổng TS ngắn hạn (mã 100)",          dauPaths: ["beneish.namTruoc.taiSanNganHan"], cuoiPaths: ["beneish.namNay.taiSanNganHan"] },
  // ── CĐKT — tài sản dài hạn ──────────────────────────────────────────────
  { ten: "TSCĐ ròng (mã 220)",                  dauPaths: ["beneish.namTruoc.taiSanCoDinhRong"], cuoiPaths: ["beneish.namNay.taiSanCoDinhRong"] },
  { ten: "TS dở dang DH (mã 240)",             dauPaths: [],                              cuoiPaths: ["bctc.cdktTSDoDangDH"] },
  { ten: "TS thuế TN hoãn lại",                dauPaths: [],                              cuoiPaths: ["bctc.cdktThueHoanLai"] },
  { ten: "Chi phí khấu hao TSCĐ trong kỳ",     dauPaths: ["beneish.namTruoc.chiPhiKhauHao"], cuoiPaths: ["beneish.namNay.chiPhiKhauHao"] },
  { ten: "Tổng tài sản (mã 270)",               dauPaths: ["beneish.namTruoc.tongTaiSan"],  cuoiPaths: ["beneish.namNay.tongTaiSan"] },
  // ── CĐKT — nợ phải trả ─────────────────────────────────────────────────
  { ten: "Phải trả người bán (mã 311)",         dauPaths: ["bctc.cdktPhaiTraNguoiBanDauNam"], cuoiPaths: ["bctc.cdktPhaiTraNguoiBanCuoiNam"] },
  { ten: "Người mua trả trước NH",              dauPaths: ["bctc.cdktNguoiMuaTraTruocDauNam"], cuoiPaths: ["bctc.cdktNguoiMuaTraTruocCuoiNam"] },
  { ten: "Người mua trả trước DH",              dauPaths: [],                              cuoiPaths: ["bctc.cdktNguoiMuaTraTruocDH"] },
  { ten: "Phải trả NLĐ (mã 334)",              dauPaths: [],                              cuoiPaths: ["bctc.cdktPhaiTraNLD"] },
  { ten: "CP phải trả ngắn hạn (mã 335)",       dauPaths: [],                              cuoiPaths: ["bctc.cdktChiPhiPhaiTraNH"] },
  { ten: "CP phải trả dài hạn (mã 343)",        dauPaths: [],                              cuoiPaths: ["bctc.cdktChiPhiPhaiTraDH"] },
  { ten: "DT chưa thực hiện NH",                dauPaths: [],                              cuoiPaths: ["bctc.cdktDTChuaThucHienNH"] },
  { ten: "DT chưa thực hiện DH",                dauPaths: [],                              cuoiPaths: ["bctc.cdktDTChuaThucHienDH"] },
  { ten: "Tổng dự phòng",                       dauPaths: [],                              cuoiPaths: ["bctc.cdktTongDuPhong"] },
  { ten: "Quỹ khen thưởng phúc lợi",            dauPaths: [],                              cuoiPaths: ["bctc.cdktQuyKHCN"] },
  { ten: "Nợ phải trả NH (mã 310)",              dauPaths: ["beneish.namTruoc.noPhaiTraNganHan"], cuoiPaths: ["beneish.namNay.noPhaiTraNganHan"] },
  { ten: "Nợ vay/thuê TC dài hạn (mã 338)",    dauPaths: ["beneish.namTruoc.noVayDaiHan"], cuoiPaths: ["beneish.namNay.noVayDaiHan"] },
  // ── LCTT (1 cột — cả năm) ─────────────────────────────────────────────
  { ten: "Dòng tiền HĐKD (LCTT mã 20)",         dauPaths: ["beneish.namTruoc.dongTienHDKD"], cuoiPaths: ["beneish.namNay.dongTienHDKD"] },
];

// Helper: set value vào nested object theo dot-path
function setPath(obj: any, path: string, value: any) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}
function getPath(obj: any, path: string): any {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[k];
  }
  return cur;
}

// Khởi tạo input rỗng
function emptyInputs(): any {
  return {
    meta: {},
    gtgt: {},
    tndn: {},
    bctc: { yKienKiemToanCoNgoaiTru: false },
    beneish: { namNay: {}, namTruoc: {} },
  };
}

const LEVEL_COLORS: Record<Lvl, { bg: string; text: string; label: string }> = {
  red:    { bg: "#fee2e2", text: "#991b1b", label: "Đỏ" },
  yellow: { bg: "#fef3c7", text: "#92400e", label: "Vàng" },
  green:  { bg: "#dcfce7", text: "#166534", label: "Xanh" },
  gray:   { bg: "#f3f4f6", text: "#6b7280", label: "Xám" },
};

function fmt(n: number | null | undefined, d = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  return Number(n).toFixed(d);
}

export default function DeepCompanyPage() {
  const { toast } = useToast();
  const [inputs, setInputs] = useState<any>(emptyInputs());
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [report, setReport] = useState<string>("");
  // Mặc định DeepSeek (theo yêu cầu user).
  const [aiModel, setAiModel] = useState<string>("deepseek");
  const aiModels = useAiModels();
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [tab, setTab] = useState("input");

  const handleField = (path: string, raw: string) => {
    const next = { ...inputs };
    if (path.startsWith("meta.")) {
      setPath(next, path, raw);
    } else if (path === "bctc.yKienKiemToanCoNgoaiTru") {
      setPath(next, path, raw === "1" || raw === "true");
    } else {
      // numeric
      const cleaned = raw.replace(/[,\s]/g, "").replace(/\./g, "");
      const n = cleaned === "" ? "" : Number(cleaned);
      setPath(next, path, Number.isFinite(n as any) ? n : 0);
    }
    setInputs(next);
  };

  // Set NHIỀU paths cùng lúc (dùng cho bảng CĐKT/Beneish để sync cdkt + beneish)
  const handleMultiField = (paths: string[], raw: string) => {
    if (!paths.length) return;
    const next = { ...inputs };
    const cleaned = raw.replace(/[,\s]/g, "").replace(/\./g, "");
    const n = cleaned === "" ? "" : Number(cleaned);
    const val = Number.isFinite(n as any) ? n : 0;
    for (const p of paths) setPath(next, p, val);
    setInputs(next);
  };

  // Lấy giá trị cho một ô trong bảng CĐKT/Beneish — ưu tiên path đầu (cdkt là “canonical”).
  const multiFieldValue = (paths: string[]): string => {
    for (const p of paths) {
      const v = getPath(inputs, p);
      if (v !== undefined && v !== null && v !== "") return typeof v === "number" ? String(v) : String(v);
    }
    return "";
  };

  // ── Auto-fetch số từ BCTC công ty niêm yết (mã CK) ───────────────────────
  const [listedTicker, setListedTicker] = useState("");
  const [listedLoading, setListedLoading] = useState(false);
  const fetchListedFinancials = async () => {
    const tk = listedTicker.trim().toUpperCase();
    if (!tk) {
      toast({ title: "Nhập mã chứng khoán", variant: "destructive" });
      return;
    }
    setListedLoading(true);
    try {
      const res = await apiRequest("GET", `/api/deep-company/fetch-listed/${encodeURIComponent(tk)}`);
      const data = await res.json();
      if (data?.bctc || data?.beneish) {
        const next = { ...inputs };
        if (data.bctc) for (const [k, v] of Object.entries(data.bctc)) setPath(next, `bctc.${k}`, v);
        if (data.beneish?.namNay) for (const [k, v] of Object.entries(data.beneish.namNay)) setPath(next, `beneish.namNay.${k}`, v);
        if (data.beneish?.namTruoc) for (const [k, v] of Object.entries(data.beneish.namTruoc)) setPath(next, `beneish.namTruoc.${k}`, v);
        if (data.meta?.tenCty) setPath(next, "meta.tenCty", data.meta.tenCty);
        setInputs(next);
        toast({ title: `Đã tải số từ BCTC ${tk}`, description: data.note || "" });
      } else {
        toast({ title: "Không tìm thấy số liệu", description: data?.error || "Thử lại sau", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Lỗi tải BCTC", description: e?.message, variant: "destructive" });
    } finally {
      setListedLoading(false);
    }
  };

  const fieldValue = (path: string): string => {
    const v = getPath(inputs, path);
    if (v === undefined || v === null) return "";
    if (path === "bctc.yKienKiemToanCoNgoaiTru") return v ? "1" : "0";
    if (typeof v === "number") return String(v);
    return String(v);
  };

  const downloadTemplate = () => {
    window.open("/api/deep-company/template", "_blank");
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoadingUpload(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/deep-company/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setInputs(data.inputs);
      toast({ title: "Đã đọc file", description: data.warnings?.length ? `Có ${data.warnings.length} cảnh báo` : "OK" });
      setTab("input");
    } catch (err: any) {
      toast({ title: "Lỗi đọc file", description: err?.message, variant: "destructive" });
    } finally {
      setLoadingUpload(false);
      e.target.value = "";
    }
  };

  const runAnalyze = async () => {
    setLoadingAnalyze(true);
    try {
      const res = await apiRequest("POST", "/api/deep-company/analyze", { inputs });
      const data: Analysis = await res.json();
      setAnalysis(data);
      setReport("");
      setTab("results");
      toast({ title: "Phân tích thành công", description: `${data.scoring.summary.red} đỏ / ${data.scoring.summary.yellow} vàng / ${data.scoring.summary.green} xanh` });
    } catch (err: any) {
      toast({ title: "Lỗi phân tích", description: err?.message, variant: "destructive" });
    } finally {
      setLoadingAnalyze(false);
    }
  };

  const runReport = async () => {
    if (!analysis) return;
    setLoadingReport(true);
    try {
      const res = await apiRequest("POST", "/api/deep-company/report", { analysis, ai_model: aiModel });
      const data = await res.json();
      setReport(data.report);
      setTab("report");
      toast({ title: "Đã tạo báo cáo AI" });
    } catch (err: any) {
      toast({ title: "Lỗi AI", description: err?.message, variant: "destructive" });
    } finally {
      setLoadingReport(false);
    }
  };

  const [exportingHtml, setExportingHtml] = useState(false);
  const exportReportHtml = async () => {
    if (!report) return;
    setExportingHtml(true);
    try {
      // Light text → HTML so the report renders cleanly in the export
      const reportHtml =
        '<pre style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:14px;line-height:1.7">' +
        report.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
        "</pre>";
      const ticker = inputs?.meta?.mst || inputs?.meta?.tenCty || "report";
      const res = await apiRequest("POST", "/api/export/html-report", {
        ticker,
        company_name: inputs?.meta?.tenCty || ticker,
        report_html: reportHtml,
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TIRA_AI_Report_${ticker}_${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Không xuất được HTML", description: err?.message, variant: "destructive" });
    } finally {
      setExportingHtml(false);
    }
  };

  const saveAnalysis = async () => {
    if (!analysis) return;
    try {
      const res = await apiRequest("POST", "/api/deep-company/save", { inputs, analysis, report });
      const data = await res.json();
      toast({ title: "Đã lưu", description: `ID: ${data.id?.slice(0, 8)}` });
    } catch (err: any) {
      toast({ title: "Không lưu được", description: err?.message, variant: "destructive" });
    }
  };

  const groupedIndicators = useMemo(() => {
    if (!analysis) return {};
    const out: Record<string, IndicatorResult[]> = {};
    for (const i of analysis.indicators) {
      if (!out[i.group]) out[i.group] = [];
      out[i.group].push(i);
    }
    return out;
  }, [analysis]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: PRIMARY }}>
            Phân tích sâu Cty
          </h1>
          <p className="text-sm text-muted-foreground">
            39 chỉ số rủi ro thuế (R01–R39) + Beneish M-Score — phân tích nội tại một công ty đơn lẻ.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate} data-testid="btn-download-template">
            <Download className="w-4 h-4 mr-2" />
            Tải Excel mẫu
          </Button>
          <label>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onUpload} />
            <Button asChild variant="outline" disabled={loadingUpload} data-testid="btn-upload-excel">
              <span className="cursor-pointer">
                {loadingUpload ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Tải Excel lên
              </span>
            </Button>
          </label>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="input">1. Nhập dữ liệu</TabsTrigger>
          <TabsTrigger value="results" disabled={!analysis}>2. Kết quả</TabsTrigger>
          <TabsTrigger value="beneish" disabled={!analysis}>3. Beneish</TabsTrigger>
          <TabsTrigger value="report" disabled={!analysis}>4. Báo cáo AI</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: INPUT ───────────────────────────────────────────── */}
        <TabsContent value="input" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SECTIONS.map((sec) => (
              <Card key={sec.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm" style={{ color: PRIMARY }}>{sec.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sec.fields.map((f) => (
                    <div key={f.ma} className="grid grid-cols-5 gap-2 items-center">
                      <Label className="col-span-3 text-xs">{f.ten}</Label>
                      {f.ma === "meta.ghiChu" ? (
                        <Textarea
                          className="col-span-2 text-xs"
                          rows={2}
                          value={fieldValue(f.ma)}
                          onChange={(e) => handleField(f.ma, e.target.value)}
                        />
                      ) : (
                        <Input
                          className="col-span-2 text-xs h-8"
                          value={fieldValue(f.ma)}
                          onChange={(e) => handleField(f.ma, e.target.value)}
                          placeholder={f.ma.startsWith("meta.") ? "" : "0"}
                          data-testid={`field-${f.ma}`}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Bảng CĐKT & Beneish — Đầu năm / Cuối năm (gộp phần 6 + 9 + 10) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm" style={{ color: PRIMARY }}>
                  6. CĐKT & Beneish M-Score — Đầu năm / Cuối năm
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Công ty niêm yết:</span>
                  <Input
                    className="h-8 w-28 text-xs uppercase"
                    placeholder="Mã CK"
                    value={listedTicker}
                    onChange={(e) => setListedTicker(e.target.value)}
                    data-testid="input-listed-ticker"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchListedFinancials}
                    disabled={listedLoading}
                    data-testid="btn-fetch-listed"
                  >
                    {listedLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                    Tải số từ BCTC
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Đầu năm = số cuối năm trước trên BCTC. Khi nhập, hệ tự đồng bộ sang Beneish M-Score (mục 2.7).
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-2 font-semibold w-[55%]">Chỉ tiêu</th>
                      <th className="text-right p-2 font-semibold">Đầu năm</th>
                      <th className="text-right p-2 font-semibold">Cuối năm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BENEISH_CDKT_ROWS.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/20">
                        <td className="p-2">{row.ten}</td>
                        <td className="p-1">
                          <Input
                            className="h-8 text-xs text-right"
                            placeholder={row.dauPaths.length ? "0" : "—"}
                            disabled={row.dauPaths.length === 0}
                            value={multiFieldValue(row.dauPaths)}
                            onChange={(e) => handleMultiField(row.dauPaths, e.target.value)}
                            data-testid={`bn-dau-${idx}`}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-8 text-xs text-right"
                            placeholder={row.cuoiPaths.length ? "0" : "—"}
                            disabled={row.cuoiPaths.length === 0}
                            value={multiFieldValue(row.cuoiPaths)}
                            onChange={(e) => handleMultiField(row.cuoiPaths, e.target.value)}
                            data-testid={`bn-cuoi-${idx}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 sticky bottom-0 bg-background/90 backdrop-blur p-3 -mx-6 px-6 border-t">
            <Button variant="ghost" onClick={() => setInputs(emptyInputs())}>Xoá tất cả</Button>
            <Button
              onClick={runAnalyze}
              disabled={loadingAnalyze}
              style={{ background: PRIMARY }}
              data-testid="btn-analyze"
            >
              {loadingAnalyze ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
              Chạy phân tích
            </Button>
          </div>
        </TabsContent>

        {/* ── TAB 2: RESULTS ─────────────────────────────────────────── */}
        <TabsContent value="results" className="space-y-4">
          {analysis && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Điểm rủi ro</div>
                    <div className="text-2xl font-bold" style={{ color: PRIMARY }}>
                      {fmt(analysis.scoring.composite, 1)}<span className="text-sm">/100</span>
                    </div>
                    <Badge style={{ background: LEVEL_COLORS[analysis.scoring.overallLevel].bg, color: LEVEL_COLORS[analysis.scoring.overallLevel].text }}>
                      {LEVEL_COLORS[analysis.scoring.overallLevel].label}
                    </Badge>
                  </CardContent>
                </Card>
                {(["red","yellow","green","gray"] as Lvl[]).map((l) => (
                  <Card key={l}>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">{LEVEL_COLORS[l].label}</div>
                      <div className="text-2xl font-bold" style={{ color: LEVEL_COLORS[l].text }}>
                        {analysis.scoring.summary[l]}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Group breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Điểm theo nhóm</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analysis.scoring.byGroup).map(([g, v]) => (
                      <div key={g} className="grid grid-cols-12 gap-2 items-center text-xs">
                        <div className="col-span-3 font-medium">{g}</div>
                        <div className="col-span-7 bg-gray-100 rounded h-3 overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min(100, v.score)}%`,
                              background: v.score >= 50 ? "#dc2626" : v.score >= 25 ? "#f59e0b" : PRIMARY,
                            }}
                          />
                        </div>
                        <div className="col-span-2 text-right tabular-nums">
                          {fmt(v.score, 1)}/100
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Conflicts */}
              {analysis.conflicts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Cảnh báo mâu thuẫn dữ liệu ({analysis.conflicts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-900">
                      {analysis.conflicts.map((c, i) => (<li key={i}>{c}</li>))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Flags */}
              {analysis.scoring.flags.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Cờ rủi ro đặc biệt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-900">
                      {analysis.scoring.flags.map((f, i) => (<li key={i}><b>[{f.type}]</b> {f.message}</li>))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Indicators by group */}
              {Object.entries(groupedIndicators).map(([g, list]) => (
                <Card key={g}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{g} ({list.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="py-1 pr-2 w-14">Mã</th>
                            <th className="py-1 pr-2">Chỉ số</th>
                            <th className="py-1 pr-2 text-right w-32">Giá trị</th>
                            <th className="py-1 pr-2 w-20">Mức</th>
                            <th className="py-1">Lý do</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((i) => (
                            <tr key={i.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-1 pr-2 font-mono">{i.id}</td>
                              <td className="py-1 pr-2">{i.name}</td>
                              <td className="py-1 pr-2 text-right tabular-nums">{fmt(i.value, 4)}</td>
                              <td className="py-1 pr-2">
                                <Badge style={{ background: LEVEL_COLORS[i.level].bg, color: LEVEL_COLORS[i.level].text }}>
                                  {LEVEL_COLORS[i.level].label}
                                </Badge>
                              </td>
                              <td className="py-1 text-muted-foreground">{i.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Action bar */}
              <div className="flex flex-wrap gap-2 sticky bottom-0 bg-background/90 backdrop-blur p-3 -mx-6 px-6 border-t">
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aiModels.models.map((m) => (
                      <SelectItem key={m.id} value={m.id} disabled={!m.enabled}>
                        {m.label}{!m.enabled ? " (chưa cấu hình)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={runReport} disabled={loadingReport} style={{ background: PRIMARY }} data-testid="btn-ai-report">
                  {loadingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Tạo báo cáo AI
                </Button>
                <Button variant="outline" onClick={saveAnalysis} data-testid="btn-save">
                  <Save className="w-4 h-4 mr-2" />
                  Lưu
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── TAB 3: BENEISH ─────────────────────────────────────────── */}
        <TabsContent value="beneish">
          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Beneish M-Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold" style={{ color: analysis.beneish.flagged ? "#dc2626" : PRIMARY }}>
                  M = {fmt(analysis.beneish.mScore, 3)}
                  {analysis.beneish.flagged ? (
                    <Badge className="ml-3" style={{ background: "#fee2e2", color: "#991b1b" }}>
                      Có dấu hiệu thao túng
                    </Badge>
                  ) : (
                    <Badge className="ml-3" style={{ background: "#dcfce7", color: "#166534" }}>
                      <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                      Không có dấu hiệu
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{analysis.beneish.interpretation}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(["DSRI","GMI","AQI","SGI","DEPI","SGAI","TATA","LVGI"] as const).map((k) => (
                    <div key={k} className="border rounded p-2">
                      <div className="text-xs text-muted-foreground">{k}</div>
                      <div className="text-lg font-bold tabular-nums">{fmt(analysis.beneish[k], 3)}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground italic mt-3">
                  Công thức: M = -4.84 + 0.92·DSRI + 0.528·GMI + 0.404·AQI + 0.892·SGI + 0.115·DEPI − 0.172·SGAI + 4.679·TATA − 0.327·LVGI. Ngưỡng cảnh báo: M &gt; -2.22.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB 4: AI REPORT ───────────────────────────────────────── */}
        <TabsContent value="report">
          {report ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Báo cáo phân tích AI</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportReportHtml}
                  disabled={exportingHtml}
                  data-testid="btn-export-html"
                  className="gap-2"
                >
                  {exportingHtml ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
                  Export HTML
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{report}</pre>
              </CardContent>
            </Card>
          ) : (
            <div className="text-sm text-muted-foreground p-8 text-center">
              Chưa có báo cáo. Bấm <b>Tạo báo cáo AI</b> ở tab Kết quả.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

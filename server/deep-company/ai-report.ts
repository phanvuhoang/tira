// ════════════════════════════════════════════════════════════════════════════
// TIRA Phase 2 — AI report builder cho module "Phân tích sâu Cty"
//
// Tạo prompt CHỈ DỰA TRÊN số liệu đã tính, không cho AI bịa.
// Caller (routes.ts) sẽ truyền prompt này vào generateReportText() hiện có.
// ════════════════════════════════════════════════════════════════════════════

import type {
  DeepCompanyAnalysis,
  IndicatorResult,
  BeneishResult,
} from "./types";

const fmt = (n: number | null | undefined, digits = 2): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  return n.toFixed(digits);
};

const levelLabel = (lv: string) => {
  switch (lv) {
    case "red":
      return "ĐỎ";
    case "yellow":
      return "VÀNG";
    case "green":
      return "XANH";
    default:
      return "XÁM (thiếu dữ liệu)";
  }
};

function indicatorBlock(ind: IndicatorResult): string {
  return `- [${ind.id}] ${ind.name} — Giá trị: ${fmt(
    ind.value
  )} — Mức: ${levelLabel(ind.level)}\n  • Lý do: ${ind.reason || "(không có ghi chú)"}\n  • Ngưỡng: ${ind.thresholdNote}`;
}

function beneishBlock(b: BeneishResult): string {
  return [
    `Mô hình Beneish M-Score = ${fmt(b.mScore, 3)} → ${
      b.flagged ? "CÓ DẤU HIỆU thao túng BCTC" : "Không có dấu hiệu thao túng"
    }`,
    `  • DSRI = ${fmt(b.DSRI, 3)}  • GMI = ${fmt(b.GMI, 3)}  • AQI = ${fmt(b.AQI, 3)}  • SGI = ${fmt(
      b.SGI,
      3
    )}`,
    `  • DEPI = ${fmt(b.DEPI, 3)}  • SGAI = ${fmt(b.SGAI, 3)}  • TATA = ${fmt(
      b.TATA,
      3
    )}  • LVGI = ${fmt(b.LVGI, 3)}`,
    `  • Diễn giải: ${b.interpretation}`,
  ].join("\n");
}

export function buildDeepCompanyPrompt(analysis: DeepCompanyAnalysis): string {
  const meta = analysis.meta || {};
  const reds = analysis.indicators.filter((i) => i.level === "red");
  const yellows = analysis.indicators.filter((i) => i.level === "yellow");
  const greens = analysis.indicators.filter((i) => i.level === "green");
  const grays = analysis.indicators.filter((i) => i.level === "gray");

  const groupLines = Object.entries(analysis.scoring.byGroup)
    .map(
      ([g, v]) =>
        `  • ${g}: ${fmt(v.score, 1)}/100 (đỏ=${v.red}, vàng=${v.yellow}, xanh=${v.green}, xám=${v.gray})`
    )
    .join("\n");

  return `Bạn là chuyên gia thanh tra thuế Việt Nam. Hãy viết báo cáo phân tích rủi ro thuế cho MỘT công ty đơn lẻ dựa trên số liệu dưới đây.

YÊU CẦU TUYỆT ĐỐI:
1. CHỈ SỬ DỤNG các con số được cung cấp trong phần "DỮ LIỆU PHÂN TÍCH" dưới đây. KHÔNG được bịa số.
2. Nếu chỉ số có mức "XÁM (thiếu dữ liệu)", phải nói rõ "thiếu dữ liệu" và KHÔNG được suy đoán giá trị.
3. KHÔNG so sánh với công ty cùng ngành hay benchmark ngành. Chỉ phân tích nội tại công ty này.
4. Văn phong nghiệp vụ thuế Việt Nam, viết bằng tiếng Việt.
5. Trích dẫn mã chỉ số (R01–R39) khi đề cập.

═══════════════════════════════════════════════════
DỮ LIỆU PHÂN TÍCH
═══════════════════════════════════════════════════

▶ Thông tin công ty
  • Tên: ${meta.tenCty || "(chưa nhập)"}
  • MST: ${meta.mst || "(chưa nhập)"}
  • Năm phân tích: ${meta.nam ?? "(chưa nhập)"}
  • Ghi chú: ${meta.ghiChu || "(không có)"}

▶ Tổng quan rủi ro
  • Điểm rủi ro tổng: ${fmt(analysis.scoring.composite, 1)}/100 — Mức: ${levelLabel(
    analysis.scoring.overallLevel
  )}
  • Số đèn đỏ: ${analysis.scoring.summary.red} / vàng: ${analysis.scoring.summary.yellow} / xanh: ${
    analysis.scoring.summary.green
  } / xám: ${analysis.scoring.summary.gray}

▶ Điểm theo nhóm chỉ số
${groupLines || "  (không có)"}

▶ ${reds.length} chỉ số ĐỎ
${reds.length === 0 ? "  (không có)" : reds.map(indicatorBlock).join("\n")}

▶ ${yellows.length} chỉ số VÀNG
${yellows.length === 0 ? "  (không có)" : yellows.map(indicatorBlock).join("\n")}

▶ ${greens.length} chỉ số XANH
${greens.length === 0 ? "  (không có)" : greens.map((i) => `- [${i.id}] ${i.name}`).join("\n")}

▶ ${grays.length} chỉ số XÁM (thiếu dữ liệu)
${grays.length === 0 ? "  (không có)" : grays.map((i) => `- [${i.id}] ${i.name} — ${i.reason}`).join("\n")}

▶ Beneish M-Score
${beneishBlock(analysis.beneish)}

▶ Cờ rủi ro đặc biệt
${
  analysis.scoring.flags.length === 0
    ? "  (không có)"
    : analysis.scoring.flags.map((f) => `  • [${f.type}] ${f.message}`).join("\n")
}

▶ Cảnh báo mâu thuẫn dữ liệu
${
  analysis.conflicts.length === 0
    ? "  (không phát hiện)"
    : analysis.conflicts.map((c) => `  • ${c}`).join("\n")
}

▶ Trường dữ liệu thiếu (nếu có)
${
  analysis.missingFields.length === 0
    ? "  (đầy đủ)"
    : analysis.missingFields.map((m) => `  • ${m}`).join("\n")
}

═══════════════════════════════════════════════════
NHIỆM VỤ
═══════════════════════════════════════════════════

Viết báo cáo theo cấu trúc sau (Markdown):

# Báo cáo phân tích sâu rủi ro thuế — ${meta.tenCty || "(công ty)"}

## 1. Tóm tắt điều hành
(3–5 dòng: mức rủi ro tổng, các nhóm rủi ro nổi bật, có cờ Beneish/kiểm toán không)

## 2. Phân tích nhóm rủi ro
(Phân tích từng nhóm có chỉ số đỏ/vàng — nêu mã chỉ số, giá trị, ý nghĩa nghiệp vụ)

## 3. Mô hình Beneish M-Score
(Diễn giải M-Score và 8 thành phần — nói rõ thao túng hay không)

## 4. Mâu thuẫn / dấu hiệu bất thường
(Liệt kê conflicts đã phát hiện, gợi ý bút toán/hồ sơ cần kiểm tra)

## 5. Khuyến nghị thanh tra
(Đề xuất nội dung kiểm tra trọng tâm, hồ sơ tài liệu cần thu thập, theo thứ tự ưu tiên)

## 6. Hạn chế
(Nếu có chỉ số xám — phải nêu rõ; nếu thiếu dữ liệu trọng yếu — phải khuyến nghị bổ sung)

LƯU Ý: Không tự đặt giả định nếu thiếu dữ liệu. Không viết "có thể là", "khoảng", "ước tính" về số liệu định lượng. Chỉ dùng số đã có.`;
}

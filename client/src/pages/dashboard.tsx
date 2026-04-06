import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { getHashParams } from "@/lib/hashLocation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  HelpCircle,
  Info,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  X,
  Loader2,
  Sparkles,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  Cell,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

/* ========== HELPER: Markdown to HTML ========== */
function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

/* ========== HELPER: Export AI report to Word ========== */
function exportAiReportToWord(content: string, ticker: string) {
  // Convert markdown to HTML for Word export
  const html = content
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  const fullHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>TIRA Report - ${ticker}</title>
    <style>
      body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.6; color: #333; }
      h1 { font-size: 18pt; color: #028a39; border-bottom: 2px solid #028a39; padding-bottom: 6pt; }
      h2 { font-size: 14pt; color: #1a2332; margin-top: 12pt; }
      h3 { font-size: 12pt; color: #333; }
      li { margin-left: 20pt; }
      strong { color: #1a2332; }
    </style></head>
    <body><p>${html}</p></body></html>`;

  const blob = new Blob([fullHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TIRA_Report_${ticker}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

interface TiraIndicator {
  id: string;
  group: string;
  name: string;
  risk_factor: string;
  company_value: number | null;
  industry_range: string | null;
  industry_p35: number | null;
  industry_p65: number | null;
  risk_level: "green" | "yellow" | "red" | "gray";
  risk_level_1: "green" | "red" | "gray";
  risk_level_2: "green" | "red" | "gray";
  industry_median: number | null;
  industry_p_low: number | null;
  industry_p_high: number | null;
}

interface AnalysisResult {
  target: {
    company: { ma_ck: string; ten_tv: string; nganh_2?: string };
    report_type: string;
    years: string[];
    indicators: Record<string, TiraIndicator[]>;
  };
  comparisons: Record<
    string,
    {
      company: { ma_ck: string; ten_tv: string };
      indicators: Record<string, TiraIndicator[]>;
    }
  >;
}

const GROUP_SHORT: Record<string, string> = {
  "CRITICAL RED LINES": "Lằn ranh đỏ",
  "DOANH THU - LỢI NHUẬN - THUẾ": "DT-LN-Thuế",
  "RỦI RO NỢ THUẾ - HÓA ĐƠN": "Nợ thuế/HĐ",
  "VẬN HÀNH - HIỆU QUẢ": "Vận hành",
};

const RISK_COLORS = {
  green: "hsl(142, 55%, 40%)",
  yellow: "hsl(45, 90%, 50%)",
  red: "hsl(0, 72%, 48%)",
  gray: "hsl(214, 10%, 70%)",
};

const RISK_BG_COLORS = {
  green: "hsl(142, 55%, 40%, 0.15)",
  yellow: "hsl(45, 90%, 50%, 0.15)",
  red: "hsl(0, 72%, 48%, 0.15)",
  gray: "hsl(214, 10%, 70%, 0.1)",
};

// Dual risk color system
// Box background = risk_level_1 (absolute threshold)
function getDualBgColor(risk1: string | undefined): string {
  if (risk1 === "red") return "hsl(25, 100%, 95%)";
  if (risk1 === "gray") return "hsl(214, 10%, 95%)";
  return "transparent"; // green or undefined = white/transparent
}

// Font color = risk_level_2 (IQR comparison)
function getDualFontColor(risk2: string | undefined): string {
  if (risk2 === "red") return "hsl(0, 72%, 48%)";
  if (risk2 === "gray") return "hsl(214, 10%, 60%)";
  return "hsl(215, 20%, 20%)"; // green or undefined = dark
}

const INDICATOR_ANALYSIS: Record<string, { formula: string; objective: string; risk_meaning: string; interpretations: string[] }> = {
  "0.1": {
    formula: "Chi phí thuế hiện hành / Doanh thu thuần",
    objective: "Kiểm tra nhanh sức khỏe thuế, theo dõi gánh nặng thuế so với doanh thu bán hàng.",
    risk_meaning: "Yếu tố rủi ro 1: Thấp hơn thuế suất hộ kinh doanh ngành → dấu hiệu bất thường, ví dụ khai thiếu thuế. Yếu tố rủi ro 2: Không nằm trong ngưỡng phân vị (IQR) của các công ty so sánh. Thấp hơn → rủi ro nộp thiếu thuế. Cao hơn → rủi ro nộp thừa thuế.",
    interpretations: [
      "Rủi ro doanh thu kê khai thấp hơn thực tế hoặc chi phí được trừ ghi nhận quá cao",
      "Tận dụng ưu đãi thuế hoặc chuyển lỗ",
      "Rủi ro nếu dưới ngưỡng thuế suất của hộ kinh doanh",
      "Cần đối chiếu với biến động lợi nhuận và doanh thu qua các giai đoạn",
    ],
  },
  "0.2": {
    formula: "LN kế toán trước thuế / Doanh thu thuần",
    objective: "Đo lường bao nhiêu lợi nhuận tạo ra từ một đồng doanh thu, cho thấy mức độ kiểm soát chi phí, cơ chế giá và tổng quan hoạt động kinh doanh.",
    risk_meaning: "Yếu tố rủi ro 1: Giảm từ 10% trở lên so với năm trước → lợi nhuận sụt giảm mạnh dẫn đến rủi ro thuế cao. Yếu tố rủi ro 2: Thấp hơn ngưỡng phân vị dưới (IQR) → rủi ro khai thiếu lợi nhuận và thuế, hoặc bị CQT điều chỉnh tăng lợi nhuận do GDLK.",
    interpretations: [
      "Chỉ số càng cao → lợi nhuận càng lớn; chỉ số càng thấp → biên lợi nhuận càng mỏng",
      "Giảm ≥10%: ghi nhận thiếu doanh thu/thừa chi phí, rủi ro chuyển giá, yếu tố kinh tế/thị trường",
      "Cần xem xét chéo với các chỉ số doanh thu và chi phí thuế",
    ],
  },
  "0.3": {
    formula: "(DT thuần_Y1 - DT thuần_Y0) / DT thuần_Y0",
    objective: "Đánh giá sức khỏe kinh doanh, tiềm năng phát triển và các rủi ro thuế tiềm tàng.",
    risk_meaning: "Yếu tố rủi ro 1: Giảm từ 10% trở lên so với năm trước → doanh thu sụt giảm mạnh dẫn đến rủi ro thuế cao. Yếu tố rủi ro 2: Thấp hơn ngưỡng phân vị dưới (IQR) → doanh thu giảm bất thường so với ngành, có thể khai thiếu doanh thu (thiếu thuế GTGT và TNDN), hoặc bị CQT điều chỉnh tăng lợi nhuận do GDLK.",
    interpretations: [
      "Tăng trưởng đều cho thấy kết quả kinh doanh bình ổn",
      "Biến động dương đột biến: mở rộng kinh doanh? Chiến lược giá?",
      "Biến động âm đột biến: lượng cung giảm? Tăng cạnh tranh? Thách thức vận hành?",
      "Cần đối chiếu với số liệu thuế GTGT đầu ra và hóa đơn phát hành",
    ],
  },
  "1.1": {
    formula: "Chi phí thuế hiện hành / LNKT trước thuế",
    objective: "So sánh với thuế suất CIT chuẩn 20% và thuế suất hiệu quả của ngành.",
    risk_meaning: "Yếu tố rủi ro 1: Thấp dưới mức 15% → thuế suất hiệu quả nằm dưới mức standard có thể là dấu hiệu bất thường, nếu doanh nghiệp không có ưu đãi thuế. Yếu tố rủi ro 2: Không nằm trong ngưỡng phân vị (IQR). Thấp hơn → rủi ro nộp thiếu thuế. Cao hơn → rủi ro nộp thừa thuế.",
    interpretations: [
      "ETR gần 20%: tuân thủ tốt, ít có dấu hiệu bất thường",
      "ETR thấp hơn nhiều: có thể hưởng ưu đãi thuế hoặc chuyển lỗ",
      "ETR cao hơn nhiều: chi phí không được trừ, GDLK, sai sót kê khai",
      "Cơ hội cải thiện thông qua các công cụ tối ưu hóa thuế",
    ],
  },
  "1.2": {
    formula: "(Thuế hiện hành + Thuế hoãn lại) / LNKT trước thuế",
    objective: "So sánh ETR gộp với thuế suất 20%.",
    risk_meaning: "Yếu tố rủi ro 1: Thấp dưới mức 15% → dấu hiệu bất thường nếu không có ưu đãi thuế. Yếu tố rủi ro 2: Không nằm trong ngưỡng phân vị (IQR). Thấp hơn → rủi ro nộp thiếu thuế. Cao hơn → rủi ro nộp thừa thuế.",
    interpretations: [
      "Có ưu đãi thuế không? Ưu đãi giảm ETR đến mức nào?",
      "Các điều chỉnh thuế? VD: chia cổ tức, trích trước, dự phòng",
      "Cơ hội cải thiện thông qua các công cụ tối ưu hóa thuế",
    ],
  },
  "1.3": {
    formula: "(LNKT trước thuế_Y1 - LNKT trước thuế_Y0) / LNKT trước thuế_Y0",
    objective: "Xem xét sức khỏe tài chính, phát hiện nguyên nhân tiềm tàng và chiến lược hành động để cải thiện.",
    risk_meaning: "Yếu tố rủi ro 1: Giảm từ 10% trở lên so với năm trước → lợi nhuận sụt giảm mạnh dẫn đến rủi ro thuế cao. Yếu tố rủi ro 2: Thấp hơn ngưỡng phân vị dưới (IQR) → lợi nhuận giảm bất thường so với ngành, có thể khai thiếu lợi nhuận chịu thuế (thiếu thuế TNDN), hoặc bị CQT điều chỉnh tăng lợi nhuận do GDLK.",
    interpretations: [
      "Tăng trưởng đều: kế hoạch thuế ổn định, tối ưu thuế qua thời gian",
      "Biến động dương: hiệu quả hoạt động cải thiện, có thể tăng nghĩa vụ thuế nhưng tạo cơ hội tận dụng tài sản thuế hoãn lại",
      "Biến động âm: vấn đề vận hành, chi phí tăng, doanh thu giảm → rà soát nghĩa vụ thuế tạm tính",
    ],
  },
  "1.4": {
    formula: "(CP thuế hiện hành_Y1 - CP thuế hiện hành_Y0) / CP thuế hiện hành_Y0",
    objective: "Xem xét tương quan giữa chi phí thuế thực nộp với biến động doanh thu/lợi nhuận.",
    risk_meaning: "Yếu tố rủi ro 1: Giảm từ 10% trở lên → chi phí thuế sụt giảm mạnh, nhất là nếu lợi nhuận hoặc doanh thu tăng. Yếu tố rủi ro 2: Không nằm trong ngưỡng phân vị (IQR). Thấp hơn → rủi ro nộp thiếu thuế. Cao hơn → rủi ro nộp thừa thuế.",
    interpretations: [
      "Nếu PBT tăng mà CP thuế giảm: rủi ro kê khai thiếu thu nhập chịu thuế",
      "Biến động lớn bất thường: cần kiểm tra điều chỉnh thuế, thay đổi chính sách",
      "Cần xem xét tính đầy đủ của hồ sơ chứng từ",
    ],
  },
  "1.5": {
    formula: "Lợi nhuận gộp / Doanh thu thuần",
    objective: "Cơ quan thuế thường sử dụng chỉ số này để đánh giá việc tuân thủ quy định về GDLK, tính hợp lý của các khoản giảm trừ doanh thu, tăng giá vốn hàng bán.",
    risk_meaning: "Yếu tố rủi ro 1: Giảm từ 10% trở lên → lợi nhuận sụt giảm mạnh dẫn đến rủi ro thuế cao. Yếu tố rủi ro 2: Thấp hơn ngưỡng phân vị dưới (IQR) → rủi ro khai thiếu lợi nhuận và thuế, hoặc bị CQT điều chỉnh tăng lợi nhuận do GDLK.",
    interpretations: [
      "Tuân thủ các quy định về giá chuyển nhượng",
      "Việc giảm doanh thu và tăng giá vốn (chiết khấu, khuyến mãi, trích lập dự phòng) được trừ",
      "Hạch toán kế toán không chính xác (ví dụ: không hạch toán riêng các khoản giảm trừ doanh thu)",
    ],
  },
  "1.6": {
    formula: "(Lợi nhuận gộp - SGA) / Doanh thu thuần",
    objective: "Cơ quan thuế thường sử dụng chỉ số này để đánh giá việc tuân thủ quy định về GDLK, tính hợp lý của các khoản chi phí bán hàng và quản lý doanh nghiệp (SG&A) lớn.",
    risk_meaning: "Yếu tố rủi ro 1: Giảm từ 10% trở lên → lợi nhuận sụt giảm mạnh. Yếu tố rủi ro 2: Thấp hơn ngưỡng phân vị dưới (IQR) → rủi ro khai thiếu lợi nhuận và thuế, hoặc bị CQT điều chỉnh do GDLK.",
    interpretations: [
      "Tuân thủ các quy định về GDLK",
      "Các GDLK trọng yếu (doanh thu, chi phí, khoản giảm trừ doanh thu)",
      "Sự phục hồi biên lợi nhuận có thể làm tăng nghĩa vụ thuế TNDN",
    ],
  },
  "1.7": {
    formula: "Lợi nhuận sau thuế / Doanh thu thuần",
    objective: "Đo lường lợi nhuận ròng còn lại trên mỗi đồng doanh thu thuần sau khi đã trừ toàn bộ chi phí và thuế. Phản ánh hiệu quả hoạt động, chi phí tài chính và mức độ quản trị thuế.",
    risk_meaning: "Yếu tố rủi ro 1: Lỗ 2 năm liên tục → rủi ro không trả được nợ thuế. Yếu tố rủi ro 2: Thấp hơn ngưỡng phân vị dưới (IQR) → rủi ro khai thiếu lợi nhuận và thuế, hoặc bị CQT điều chỉnh do GDLK.",
    interpretations: [
      "Doanh thu bị ghi nhận thiếu hoặc chi phí bị thổi phồng nhằm giảm thuế TNDN",
      "Thực hiện GDLK để chuyển lợi nhuận sang các bên liên kết",
      "Nguy cơ về khả năng hoạt động liên tục, cơ quan thuế có thể kiểm tra sâu hơn",
      "Có thể bị truy vấn nếu doanh nghiệp liên tục báo lỗ trong khi vẫn duy trì hoạt động bình thường",
    ],
  },
  "2.1": {
    formula: "Thuế phải nộp / Nợ phải trả",
    objective: "Đo lường tỷ trọng nghĩa vụ thuế phải nộp ngân sách Nhà nước trong tổng nợ phải trả.",
    risk_meaning: "Yếu tố rủi ro 1: Tăng từ 10% trở lên → tỷ lệ nợ thuế tăng cao bất thường so với nợ phải trả, rủi ro về khả năng trả nợ thuế tăng. Yếu tố rủi ro 2: Cao hơn ngưỡng phân vị trên (IQR) → rủi ro nợ đọng thuế cao, không trả được nợ thuế và thành nợ xấu với cơ quan thuế.",
    interpretations: [
      "Tỷ lệ nợ thuế 5-10% là mức tham chiếu hợp lý cho đa số ngành",
      "Tỷ lệ nợ thuế tăng dần: vấn đề tuân thủ thuế, chiến lược thuế quá rủi ro, hoặc chậm nộp thuế",
      "Tỷ lệ thấp: lập kế hoạch thuế hiệu quả, được hưởng ưu đãi thuế",
      "Cần cân nhắc thông lệ ngành, chính sách pháp lý và cấu trúc thuế của từng doanh nghiệp",
    ],
  },
  "2.2": {
    formula: "(Thuế GTGT đầu vào_Y1 - Thuế GTGT đầu vào_Y0) / Thuế GTGT đầu vào_Y0",
    objective: "Liệu số thuế GTGT đầu vào mà doanh nghiệp kê khai có phù hợp với quy mô hoạt động và thuế GTGT đầu ra hay không?",
    risk_meaning: "Yếu tố rủi ro 1: Tăng từ 10% trở lên → thuế đầu vào tăng cao đột biến. Nếu thuế đầu ra và doanh thu không tăng tương ứng → rủi ro không được trừ đầu vào, khó được hoàn thuế. Yếu tố rủi ro 2: Không nằm trong ngưỡng phân vị (IQR). Thấp hơn → rủi ro khai thiếu thuế GTGT đầu vào. Cao hơn → rủi ro đọng quá nhiều thuế GTGT đầu vào không được trừ/hoàn.",
    interpretations: [
      "Khấu trừ thuế GTGT đầu vào cao hơn thực tế (hóa đơn giả hoặc không hợp lệ)",
      "Sự lệch pha giữa thuế GTGT đầu vào và đầu ra, hoàn thuế không đúng quy định",
      "Cơ cấu dòng tiền/hoạt động mua sắm nhằm tối đa hóa khấu trừ một cách không tự nhiên",
      "So sánh tốc độ tăng thuế GTGT đầu vào với biến động doanh thu thuần và thuế GTGT đầu ra",
    ],
  },
  "2.3": {
    formula: "Doanh thu thuần / Tổng vốn chủ sở hữu",
    objective: "Một tỷ lệ cân bằng cho thấy quy mô doanh thu phù hợp với mức vốn đầu tư, giúp nhận diện các dấu hiệu đòn bẩy bất thường hoặc kê khai thiếu doanh thu.",
    risk_meaning: "Yếu tố rủi ro 1: Thấp hơn 1 hoặc cao hơn 10. Yếu tố rủi ro 2: Nằm ngoài ngưỡng phân vị (IQR). Thấp hơn → hiệu quả sử dụng vốn quá thấp, CQT có thể cho rằng công ty khai thiếu doanh thu. Cao hơn → vốn quá mỏng, doanh thu bất thường, vốn vay cao.",
    interpretations: [
      "< 1: doanh thu bị ghi nhận thiếu hoặc vốn bị nhàn rỗi, không hiệu quả",
      "> 10: doanh thu rất cao so với vốn, vốn chủ sở hữu mỏng hoặc ghi nhận doanh thu quá tích cực",
      "So sánh tỷ lệ với chuẩn ngành và các năm trước để phát hiện biến động bất thường",
    ],
  },
  "2.4": {
    formula: "Lợi nhuận chưa phân phối / Tổng vốn chủ sở hữu",
    objective: "Tỷ trọng lợi nhuận (hoặc lỗ) lũy kế trong tổng vốn chủ sở hữu.",
    risk_meaning: "Yếu tố rủi ro 1: Âm trên 50% → rủi ro mất khả năng hoạt động, phá sản, không trả được nghĩa vụ thuế và nợ thuế. Yếu tố rủi ro 2: Bị âm và thấp hơn ngưỡng phân vị dưới (IQR) → rủi ro cao mất khả năng hoạt động.",
    interpretations: [
      "Tỷ lệ dương: lợi nhuận tích lũy củng cố vốn; tỷ lệ âm: lỗ lũy kế làm suy giảm vốn",
      "Doanh nghiệp có nguy cơ mất khả năng hoạt động liên tục hoặc phá sản",
      "Có thể không đủ khả năng thực hiện nghĩa vụ thuế, rủi ro nộp chậm hoặc nợ thuế",
      "Yêu cầu tăng vốn hoặc hạn chế chia cổ tức",
    ],
  },
  "2.5": {
    formula: "Tổng nợ phải trả / Tổng vốn chủ sở hữu",
    objective: "Đo lường mức độ đòn bẩy tài chính của doanh nghiệp.",
    risk_meaning: "Yếu tố rủi ro 1: Lớn hơn 1 → khả năng trả nợ có vấn đề, không đủ khả năng trả nghĩa vụ thuế và nợ thuế. Yếu tố rủi ro 2: Cao hơn ngưỡng phân vị trên (IQR) → rủi ro không trả được nợ thuế và thành nợ xấu với CQT.",
    interpretations: [
      "Rủi ro tài chính cao, nguy cơ không thể thanh toán thuế đúng hạn",
      "Khả năng che giấu doanh thu: chuyển hướng dòng tiền hoặc không xuất hóa đơn GTGT",
      "Bị CQT truy vấn chặt chẽ hơn nếu đi kèm chậm nộp thuế hoặc khoản vay bất thường từ bên liên kết",
    ],
  },
  "2.6": {
    formula: "Doanh thu thuần / (COGS + Dư cuối kì HTK)",
    objective: "Nhằm phát hiện và xử lý các trường hợp NNT cố ý lợi dụng chính sách hoặc có hành vi gian lận hóa đơn.",
    risk_meaning: "Yếu tố rủi ro 1: Lớn hơn 1, nếu liên tục lớn hơn 1 → rủi ro doanh nghiệp xuất khống hóa đơn. Yếu tố rủi ro 2: Nằm ngoài ngưỡng phân vị (IQR). Thấp hơn → khả năng bán hàng chưa xuất hóa đơn hoặc chậm xuất. Cao hơn → khả năng phát hành hóa đơn khống hoặc bán hóa đơn.",
    interpretations: [
      "Nếu liên tục > 1: khả năng cao doanh nghiệp phát hành hóa đơn không hợp pháp hoặc bán hóa đơn",
      "Nếu < 1: khả năng bán hàng mà không xuất hóa đơn hoặc chậm xuất hóa đơn",
      "So sánh với chuẩn ngành để xác nhận dấu hiệu bất thường",
    ],
  },
  "2.7": {
    formula: "M = -4.84 + 0.920×DSR + 0.528×GMI + 0.404×AQI + 0.892×SGI + 0.115×DEPI - 0.172×SGAI + 4.679×Accruals - 0.327×LEVI",
    objective: "Đánh giá mức độ tin cậy của báo cáo tài chính, phát hiện khả năng gian lận.",
    risk_meaning: "Khi M-Score > -2.22, có dấu hiệu cho thấy báo cáo tài chính có thể đã bị thao túng hoặc không phản ánh đúng thực tế.",
    interpretations: [
      "M > -2.22: rủi ro cao về thao túng BCTC",
      "M < -2.22: BCTC có độ tin cậy cao hơn",
      "Cần xem xét chi tiết các thành phần (DSR, GMI, AQI, SGI, DEPI, SGAI, Accruals, LEVI)",
    ],
  },
  "3.1": {
    formula: "Các khoản giảm trừ DT / Doanh thu thuần",
    objective: "Phát hiện bất thường trong chính sách giảm trừ doanh thu, chiết khấu, giảm giá.",
    risk_meaning: "Khi tăng ≥10% YoY, có thể do chính sách chiết khấu/giảm giá bất thường, hàng trả lại tăng, hoặc gian lận doanh thu. Yếu tố rủi ro 2: Cao hơn ngưỡng phân vị trên (IQR) → giảm trừ doanh thu cao bất thường so với ngành.",
    interpretations: [
      "Tăng đột biến: chính sách chiết khấu bất thường? hàng trả lại tăng?",
      "Cần đối chiếu với biến động doanh thu gộp và doanh thu thuần",
      "Giảm trừ lớn có thể là dấu hiệu gian lận doanh thu",
    ],
  },
  "3.2": {
    formula: "Chi phí bán hàng / Doanh thu thuần",
    objective: "Đánh giá hiệu quả hoạt động bán hàng so với doanh thu.",
    risk_meaning: "Khi tăng ≥10% YoY, chi phí bán hàng tăng nhanh hơn doanh thu, cho thấy hiệu quả bán hàng giảm hoặc chi phí marketing/phân phối tăng bất thường. Yếu tố rủi ro 2: Cao hơn ngưỡng phân vị trên (IQR) → chi phí bán hàng cao bất thường so với ngành.",
    interpretations: [
      "Tăng liên tục: hiệu quả bán hàng suy giảm",
      "Cần so sánh với ngành để đánh giá mức hợp lý",
      "Chi phí bán hàng cao bất thường: cần kiểm tra chi tiết khoản mục",
    ],
  },
  "3.3": {
    formula: "Chi phí quản lý DN / Doanh thu thuần",
    objective: "Đánh giá hiệu quả quản lý so với quy mô doanh thu.",
    risk_meaning: "Khi tăng ≥10% YoY, chi phí quản lý tăng nhanh hơn doanh thu, có thể do bộ máy phình to hoặc chi phí quản lý không hợp lý. Yếu tố rủi ro 2: Cao hơn ngưỡng phân vị trên (IQR) → chi phí quản lý cao bất thường.",
    interpretations: [
      "Tăng đột biến: bộ máy quản lý phình to? chi phí không hợp lý?",
      "Cần kiểm tra chi tiết: lương, thuê văn phòng, tư vấn, v.v.",
      "So sánh với ngành để đánh giá mức cạnh tranh",
    ],
  },
  "3.4": {
    formula: "Lãi vay / EBITDA",
    objective: "Đo lường khả năng trả lãi vay từ lợi nhuận hoạt động.",
    risk_meaning: "Khi >30%, gánh nặng lãi vay chiếm tỷ trọng lớn trong EBITDA, cho thấy rủi ro tài chính cao và áp lực dòng tiền.",
    interpretations: [
      ">30%: gánh nặng lãi vay quá lớn, rủi ro thanh khoản",
      "Tăng liên tục: cần xem xét tái cấu trúc nợ",
      "Cần kết hợp với tỷ lệ nợ/VCSH để đánh giá toàn diện",
    ],
  },
  "3.5": {
    formula: "Hàng tồn kho / Giá vốn × 365",
    objective: "Đo lường thời gian quay vòng hàng tồn kho, phản ánh hiệu quả quản lý kho.",
    risk_meaning: "Khi tăng ≥10% YoY, hàng tồn kho quay chậm hơn, có thể do ứ đọng hàng, chất lượng sản phẩm, hoặc suy giảm nhu cầu. Yếu tố rủi ro 2: Cao hơn ngưỡng phân vị trên (IQR) → hàng tồn kho quay chậm bất thường.",
    interpretations: [
      "Tăng mạnh: hàng ứ đọng? chất lượng giảm? nhu cầu suy giảm?",
      "Giảm đột biến: có thể do xả hàng hoặc thay đổi phương pháp kế toán",
      "Cần so sánh với ngành và xu hướng qua các năm",
    ],
  },
  "3.6": {
    formula: "Phải thu KH / DT thuần × 365",
    objective: "Đo lường thời gian thu hồi công nợ, phản ánh chính sách tín dụng và khả năng thu hồi nợ.",
    risk_meaning: "Khi tăng ≥10% YoY, thời gian thu hồi nợ kéo dài, có thể do chính sách bán chịu nới lỏng hoặc khách hàng gặp khó khăn. Yếu tố rủi ro 2: Cao hơn ngưỡng phân vị trên (IQR) → thời gian thu hồi nợ kéo dài bất thường.",
    interpretations: [
      "Tăng mạnh: rủi ro nợ xấu, chính sách bán chịu quá rộng rãi",
      "Giảm đột biến: thu hồi nợ tốt hoặc thay đổi chính sách tín dụng",
      "Cần so sánh với ngành và kiểm tra chi tiết tuổi nợ",
    ],
  },
  "3.7": {
    formula: "Tốc độ tăng DT / Tốc độ tăng Giá vốn",
    objective: "So sánh tốc độ tăng trưởng doanh thu với giá vốn, phản ánh hiệu quả kinh doanh.",
    risk_meaning: "Khi <1, giá vốn tăng nhanh hơn doanh thu, cho thấy biên lợi nhuận bị thu hẹp và hiệu quả kinh doanh suy giảm.",
    interpretations: [
      "<1: giá vốn tăng nhanh hơn doanh thu → biên gộp thu hẹp",
      ">1: doanh thu tăng nhanh hơn giá vốn → hiệu quả cải thiện",
      "Cần xem xét nguyên nhân: chiến lược giá, chi phí nguyên liệu, hiệu suất sản xuất",
    ],
  },
};

function RiskDot({ level }: { level: string }) {
  const color = RISK_COLORS[level as keyof typeof RISK_COLORS] || RISK_COLORS.gray;
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function formatValue(val: number | null): string {
  if (val === null) return "N/A";
  if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(1) + "B";
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + "M";
  if (Math.abs(val) < 0.0001 && val !== 0) return val.toExponential(2);
  if (Math.abs(val) < 100) return val.toFixed(2);
  return val.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function formatPercent(val: number | null): string {
  if (val === null) return "N/A";
  return (val * 100).toFixed(1) + "%";
}

function isPercentIndicator(id: string): boolean {
  const percentIds = [
    "0.1", "0.2", "0.3", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7",
    "2.1", "2.2", "2.3", "2.4", "2.5", "3.1", "3.2", "3.3", "3.4", "3.7",
  ];
  return percentIds.includes(id);
}

function riskLabel(level: string): string {
  if (level === "green") return "An toàn";
  if (level === "yellow") return "Chú ý";
  if (level === "red") return "Rủi ro";
  return "N/A";
}

function fmtVal(id: string, val: number | null): string {
  if (val === null) return "N/A";
  return isPercentIndicator(id) ? formatPercent(val) : formatValue(val);
}

// Multi-select year picker component
function YearMultiSelect({ allYears, selectedYears, onChange }: { allYears: string[]; selectedYears: string[]; onChange: (years: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = (year: string) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length > 1) {
        onChange(selectedYears.filter((y) => y !== year));
      }
    } else {
      onChange([...selectedYears, year].sort((a, b) => Number(b) - Number(a)));
    }
  };

  const selectAll = () => {
    onChange([...allYears].sort((a, b) => Number(b) - Number(a)));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-sm hover:bg-accent/50 transition-colors"
        data-testid="btn-year-multiselect"
      >
        <span className="text-muted-foreground">Năm:</span>
        <span className="font-medium">{selectedYears.join(", ")}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 min-w-[160px]">
          <div className="p-1">
            <button
              onClick={selectAll}
              className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-accent/50 rounded"
            >
              Chọn tất cả
            </button>
            {allYears.map((year) => (
              <label
                key={year}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 cursor-pointer rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedYears.includes(year)}
                  onChange={() => toggle(year)}
                  className="rounded border-border"
                />
                <span className="text-sm">{year}</span>
              </label>
            ))}
          </div>
          <div className="border-t border-border p-1">
            <button
              onClick={() => setOpen(false)}
              className="w-full text-center px-3 py-1 text-xs text-muted-foreground hover:bg-accent/50 rounded"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Compute median from comparison companies for a given indicator and year
function computeMedian(result: AnalysisResult, indicatorId: string, year: string): number | null {
  const values: number[] = [];
  for (const [, compData] of Object.entries(result.comparisons)) {
    const ind = compData.indicators[year]?.find((i) => i.id === indicatorId);
    if (ind?.company_value !== null && ind?.company_value !== undefined) {
      values.push(ind.company_value);
    }
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("heatmap");
  const [isExporting, setIsExporting] = useState(false);
  const [aiReportOpen, setAiReportOpen] = useState(false);
  const [aiReportTypes, setAiReportTypes] = useState<string[]>(["financial", "tax"]);
  const [aiModel, setAiModel] = useState("anthropic");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiReportContent, setAiReportContent] = useState<string | null>(null);
  const [aiReportError, setAiReportError] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [scoringPanelOpen, setScoringPanelOpen] = useState(false);
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
  const [isSavingAnalysis, setIsSavingAnalysis] = useState(false);

  // Load default weights from API
  const { data: defaultWeights } = useQuery({
    queryKey: ["/api/risk-weights"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/risk-weights");
      return res.json();
    },
  });

  // Initialize weights from defaults when available
  useEffect(() => {
    if (defaultWeights && Array.isArray(defaultWeights)) {
      const map: Record<string, number> = {};
      for (const w of defaultWeights) {
        map[w.indicator_id] = w.weight;
      }
      setCustomWeights(map);
    }
  }, [defaultWeights]);

  const params = useMemo(() => {
    return getHashParams();
  }, []);

  const isCustom = params.get("custom") === "true";
  const ticker = params.get("ticker") || "";
  const reportType = params.get("report_type") || "Parent";
  const years = params.get("years")?.split(",").filter(Boolean) || [];
  const comparisons = params.get("comparisons")?.split(",").filter(Boolean) || [];
  const percentileLow = Number(params.get("p_low")) || 25;
  const percentileHigh = Number(params.get("p_high")) || 75;

  const customResult = isCustom ? (window as any).__customResult as AnalysisResult | undefined : undefined;

  const { data: fetchedResult, isLoading } = useQuery<AnalysisResult>({
    queryKey: ["/api/analyze", ticker, reportType, years.join(","), comparisons.join(","), percentileLow, percentileHigh],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/analyze", {
        target_ticker: ticker,
        report_type: reportType,
        comparison_tickers: comparisons,
        years: years.length > 0 ? years : undefined,
        percentile_low: percentileLow,
        percentile_high: percentileHigh,
      });
      return res.json();
    },
    enabled: !!ticker && !isCustom,
  });

  const result = isCustom ? customResult : fetchedResult;

  const summaryStats = useMemo(() => {
    if (!result) return null;
    const allYears = result.target.years;

    // Calculate per-year scores
    const yearScores = allYears.map((year) => {
      const indicators = result.target.indicators[year] || [];
      const score = calcCompositeScore(indicators, customWeights);
      return { year, score };
    });

    // Weighted average: nearest year (index 0) gets highest weight
    const n = yearScores.length;
    let totalW = 0, totalWS = 0;
    yearScores.forEach((ys, idx) => {
      const recencyWeight = n - idx; // first year (newest) gets n, last gets 1
      totalW += recencyWeight;
      totalWS += ys.score * recencyWeight;
    });
    const avgScore = totalW > 0 ? Math.round(totalWS / totalW) : 0;

    // Count risks across ALL years
    let totalReds1 = 0, totalReds2 = 0, totalGreens = 0, totalGrays = 0;
    for (const year of allYears) {
      const inds = result.target.indicators[year] || [];
      for (const i of inds) {
        if ((i as any).risk_level_1 === "red") totalReds1++;
        if ((i as any).risk_level_2 === "red") totalReds2++;
        if (i.risk_level === "green" || (i as any).risk_level_1 === "green") totalGreens++;
        if (i.risk_level === "gray") totalGrays++;
      }
    }

    const firstYearInds = result.target.indicators[allYears[0]] || [];
    return {
      risk1Reds: totalReds1, risk2Reds: totalReds2,
      reds: totalReds1 + totalReds2, greens: totalGreens, grays: totalGrays,
      yellows: 0,
      total: allYears.length * firstYearInds.length,
      riskScore: avgScore,
      yearScores,
      allYears,
    };
  }, [result, customWeights]);

  // Export handler
  const handleExport = useCallback(async () => {
    if (!result) return;
    setIsExporting(true);
    try {
      const pptxgenjs = await import("pptxgenjs");
      const PptxGenJS = pptxgenjs.default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";

      const { target, comparisons: comps } = result;
      const latestYear = target.years[0];
      const indicators = target.indicators[latestYear] || [];
      const compEntries = Object.entries(comps);

      // --- Slide 1: Title ---
      const slide1 = pptx.addSlide();
      slide1.background = { color: "1A2332" };
      slide1.addText("TIRA - Tax Index Risk Analysis", { x: 0.8, y: 1.0, w: 8.5, h: 1, fontSize: 28, color: "FFFFFF", fontFace: "Arial", bold: true });
      slide1.addText(`${target.company.ma_ck} - ${target.company.ten_tv}`, { x: 0.8, y: 2.0, w: 8.5, h: 0.6, fontSize: 20, color: "2DD4BF" });
      slide1.addText(`Báo cáo: ${target.report_type === "Parent" ? "Công ty mẹ" : "Hợp nhất"} | Năm: ${target.years.join(", ")}`, { x: 0.8, y: 2.7, w: 8.5, h: 0.5, fontSize: 14, color: "94A3B8" });
      if (compEntries.length > 0) {
        slide1.addText(`So sánh: ${compEntries.map(([, v]) => v.company.ma_ck).join(", ")}`, { x: 0.8, y: 3.2, w: 8.5, h: 0.5, fontSize: 14, color: "94A3B8" });
      }

      // --- Slide 2: KPI Summary ---
      if (summaryStats) {
        const slide2 = pptx.addSlide();
        slide2.addText("Tổng quan rủi ro", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, color: "1A2332", bold: true });
        const kpiData = [
          ["Rủi ro cao", String(summaryStats.reds), "E53935"],
          ["Cần chú ý", String(summaryStats.yellows), "F59E0B"],
          ["An toàn", String(summaryStats.greens), "2E7D32"],
          ["Thiếu dữ liệu", String(summaryStats.grays), "94A3B8"],
          ["Điểm rủi ro", `${summaryStats.riskScore.toFixed(0)}/100`, "1A2332"],
        ];
        kpiData.forEach(([label, val, color], i) => {
          const xPos = 0.5 + i * 1.8;
          slide2.addShape(pptxgenjs.default ? "rect" : ("rect" as any), { x: xPos, y: 1.0, w: 1.6, h: 1.2, fill: { color: "F1F5F9" }, rectRadius: 0.1 });
          slide2.addText(val, { x: xPos, y: 1.0, w: 1.6, h: 0.8, fontSize: 24, color, bold: true, align: "center", valign: "bottom" });
          slide2.addText(label, { x: xPos, y: 1.7, w: 1.6, h: 0.4, fontSize: 10, color: "64748B", align: "center" });
        });
      }

      // --- Slide 3: Heatmap ---
      const slide3 = pptx.addSlide();
      slide3.addText(`Bảng nhiệt - ${target.company.ma_ck} (${latestYear})`, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 18, color: "1A2332", bold: true });
      const heatmapRows: any[][] = [];
      const heatmapHeader = [
        { text: "Chỉ số", options: { bold: true, fill: { color: "1A2332" }, color: "FFFFFF", fontSize: 8 } },
        { text: target.company.ma_ck, options: { bold: true, fill: { color: "1A2332" }, color: "FFFFFF", fontSize: 8 } },
      ];
      if (compEntries.length > 0) {
        heatmapHeader.push({ text: "Trung vị", options: { bold: true, fill: { color: "1A2332" }, color: "FFFFFF", fontSize: 8 } });
      }
      heatmapRows.push(heatmapHeader);
      for (const ind of indicators) {
        const colorMap: Record<string, string> = { green: "E8F5E9", yellow: "FFF8E1", red: "FFEBEE", gray: "F5F5F5" };
        const textColorMap: Record<string, string> = { green: "2E7D32", yellow: "F57F17", red: "C62828", gray: "9E9E9E" };
        const row: any[] = [
          { text: ind.name, options: { fontSize: 7, color: "1A2332" } },
          { text: fmtVal(ind.id, ind.company_value), options: { fontSize: 7, color: textColorMap[ind.risk_level] || "9E9E9E", fill: { color: colorMap[ind.risk_level] || "F5F5F5" }, align: "center" } },
        ];
        if (compEntries.length > 0) {
          const med = computeMedian(result, ind.id, latestYear);
          row.push({ text: fmtVal(ind.id, med), options: { fontSize: 7, color: "546E7A", align: "center" } });
        }
        heatmapRows.push(row);
      }
      const colW = compEntries.length > 0 ? [3.5, 1.5, 1.5] : [4.0, 2.0];
      slide3.addTable(heatmapRows, { x: 0.5, y: 1.0, w: 9, colW, fontSize: 7, rowH: 0.22, border: { pt: 0.5, color: "E0E0E0" } });

      // --- Slide 4: Comparison ---
      if (compEntries.length > 0) {
        const slide4 = pptx.addSlide();
        slide4.addText(`So sánh các công ty - ${latestYear}`, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 18, color: "1A2332", bold: true });
        const allTickers = [target.company.ma_ck, ...compEntries.map(([, v]) => v.company.ma_ck)];
        const compRows: any[][] = [];
        const compHeader: any[] = [{ text: "Chỉ số", options: { bold: true, fill: { color: "1A2332" }, color: "FFFFFF", fontSize: 7 } }];
        for (const tk of allTickers) {
          compHeader.push({ text: tk, options: { bold: true, fill: { color: "1A2332" }, color: "FFFFFF", fontSize: 7 } });
        }
        compRows.push(compHeader);
        for (const ind of indicators) {
          const row: any[] = [{ text: ind.name, options: { fontSize: 6 } }];
          // Target
          row.push({ text: fmtVal(ind.id, ind.company_value), options: { fontSize: 6, align: "center" } });
          // Comparisons
          for (const [, compData] of compEntries) {
            const compInd = compData.indicators[latestYear]?.find((i) => i.id === ind.id);
            row.push({ text: fmtVal(ind.id, compInd?.company_value ?? null), options: { fontSize: 6, align: "center" } });
          }
          compRows.push(row);
        }
        const compColW = [2.5, ...allTickers.map(() => (9 - 2.5) / allTickers.length)];
        slide4.addTable(compRows, { x: 0.5, y: 1.0, w: 9, colW: compColW, fontSize: 6, rowH: 0.2, border: { pt: 0.5, color: "E0E0E0" } });
      }

      // --- Slide 5: Analysis ---
      const slide5 = pptx.addSlide();
      slide5.addText("Phân tích chỉ số rủi ro", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 18, color: "1A2332", bold: true });
      const riskInds = indicators.filter((i) => (i.risk_level_1 ?? i.risk_level) === "red" || (i.risk_level_2 ?? i.risk_level) === "red" || i.risk_level === "yellow");
      let yPos = 1.0;
      for (const ind of riskInds.slice(0, 8)) {
        const analysis = INDICATOR_ANALYSIS[ind.id];
        const isRr1 = (ind.risk_level_1 ?? ind.risk_level) === "red";
        const isRr2 = (ind.risk_level_2 ?? ind.risk_level) === "red";
        const riskText = isRr1 && isRr2 ? "RR1+RR2" : isRr1 ? "RR1 (ngưỡng cố định)" : isRr2 ? "RR2 (ngoài phân vị)" : "CHÚ Ý";
        const riskColor = isRr1 ? "E65100" : isRr2 ? "C62828" : "F57F17";
        slide5.addText(`${ind.id} ${ind.name} [${riskText}]`, { x: 0.5, y: yPos, w: 9, h: 0.25, fontSize: 9, color: riskColor, bold: true });
        const meaning = analysis ? analysis.risk_meaning : ind.risk_factor;
        slide5.addText(meaning, { x: 0.5, y: yPos + 0.25, w: 9, h: 0.3, fontSize: 7, color: "546E7A" });
        yPos += 0.6;
        if (yPos > 6.5) break;
      }

      // Save
      const blob = await pptx.write({ outputType: "blob" }) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TIRA_${target.company.ma_ck}_${latestYear}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [result, summaryStats]);

  const handleGenerateAiReport = useCallback(async () => {
    if (!result) return;
    setAiGenerating(true);
    setAiReportContent(null);
    setAiReportError(null);
    setAiSaved(false);
    try {
      const res = await fetch(`${("__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__")}/api/generate-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          report_type: reportType,
          years,
          comparisons,
          percentile_low: percentileLow,
          percentile_high: percentileHigh,
          report_types: aiReportTypes,
          ai_model: aiModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || "Lỗi tạo báo cáo";
        if (errMsg.toLowerCase().includes("api_key") || errMsg.toLowerCase().includes("api key")) {
          setAiReportError(
            "Vui lòng cấu hình ANTHROPIC_API_KEY hoặc DEEPSEEK_API_KEY trong environment variables để sử dụng tính năng này."
          );
        } else {
          setAiReportError(errMsg);
        }
      } else {
        // Backend returns { reports: { financial: "...", tax: "..." } }
        const reports = data.reports || {};
        const parts: string[] = [];
        if (reports.financial) parts.push("# Báo cáo Phân tích Tài chính\n\n" + reports.financial);
        if (reports.tax) parts.push("# Báo cáo Phân tích Rủi ro Thuế\n\n" + reports.tax);
        setAiReportContent(parts.join("\n\n---\n\n") || data.content || JSON.stringify(data));
      }
    } catch (err: any) {
      console.error("AI Report error:", err);
      setAiReportError(`Lỗi: ${err.message || "Không thể kết nối đến server. Vui lòng thử lại."}`);
    } finally {
      setAiGenerating(false);
    }
  }, [result, ticker, reportType, years, comparisons, percentileLow, percentileHigh, aiReportTypes, aiModel]);

  const handleSaveAiReport = useCallback(async () => {
    if (!result || !aiReportContent) return;
    setAiSaving(true);
    try {
      const res = await apiRequest("POST", "/api/reports/save", {
        ticker,
        report_type: aiReportTypes.join(","),
        name: `Báo cáo AI - ${ticker} (${new Date().toLocaleDateString("vi-VN")})`,
        content: aiReportContent,
      });
      if (res.ok) {
        setAiSaved(true);
      }
    } catch (err) {
      // silent fail
    } finally {
      setAiSaving(false);
    }
  }, [result, ticker, aiReportContent, aiReportTypes]);

  const handleSaveAnalysis = useCallback(async () => {
    if (!result) return;
    setIsSavingAnalysis(true);
    try {
      await apiRequest("POST", "/api/analyses/save", {
        ticker,
        report_type: reportType,
        years,
        comparisons,
        percentile_low: percentileLow,
        percentile_high: percentileHigh,
      });
    } catch (err) {
      // silent fail
    } finally {
      setIsSavingAnalysis(false);
    }
  }, [result, ticker, reportType, years, comparisons, percentileLow, percentileHigh]);

  if (!ticker && !isCustom) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Vui lòng chọn công ty để phân tích</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
      </div>
    );
  }

  if (isLoading && !isCustom) {
    return (
      <div className="p-4 lg:p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Không tìm thấy dữ liệu</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
      </div>
    );
  }

  const { target } = result;
  const allYears = target.years;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-company-name">
              {target.company.ma_ck} - {target.company.ten_tv}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs">
                {target.report_type === "Parent" ? "Công ty mẹ" : "Hợp nhất"}
              </Badge>
              {target.company.nganh_2 && (
                <Badge variant="secondary" className="text-xs">
                  {target.company.nganh_2}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {allYears.join(", ")}
              </span>
            </div>
          </div>
        </div>
        {/* Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-export"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {isExporting ? "Đang xuất..." : "Tải báo cáo (PPTX)"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAiReportOpen(true); setAiReportContent(null); setAiReportError(null); setAiSaved(false); }}
            data-testid="button-ai-report"
            className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
          >
            <Sparkles className="w-4 h-4" />
            Tạo báo cáo AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAnalysis}
            disabled={isSavingAnalysis}
            data-testid="button-save-analysis"
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isSavingAnalysis ? "Đang lưu..." : "Lưu phân tích"}
          </Button>
        </div>
      </div>

      {/* AI Report Dialog */}
      <Dialog open={aiReportOpen} onOpenChange={setAiReportOpen}>
        <DialogContent className="max-w-2xl w-full" data-testid="dialog-ai-report">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Tạo báo cáo AI
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Report type checkboxes */}
            <div>
              <p className="text-sm font-semibold mb-2">Loại báo cáo</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id="ai-financial"
                    checked={aiReportTypes.includes("financial")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setAiReportTypes((prev) => [...prev.filter((t) => t !== "financial"), "financial"]);
                      } else {
                        setAiReportTypes((prev) => prev.filter((t) => t !== "financial"));
                      }
                    }}
                    data-testid="checkbox-financial"
                  />
                  <Label htmlFor="ai-financial" className="cursor-pointer">Báo cáo tài chính</Label>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id="ai-tax"
                    checked={aiReportTypes.includes("tax")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setAiReportTypes((prev) => [...prev.filter((t) => t !== "tax"), "tax"]);
                      } else {
                        setAiReportTypes((prev) => prev.filter((t) => t !== "tax"));
                      }
                    }}
                    data-testid="checkbox-tax"
                  />
                  <Label htmlFor="ai-tax" className="cursor-pointer">Báo cáo rủi ro thuế</Label>
                </label>
              </div>
            </div>

            {/* AI Model selector */}
            <div>
              <p className="text-sm font-semibold mb-2">Mô hình AI</p>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger className="w-full" data-testid="select-ai-model">
                  <SelectValue placeholder="Chọn AI Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="openai">ChatGPT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate button */}
            <Button
              className="w-full gap-2"
              onClick={handleGenerateAiReport}
              disabled={aiGenerating || aiReportTypes.length === 0}
              data-testid="button-generate-report"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tạo báo cáo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Tạo báo cáo
                </>
              )}
            </Button>

            {/* Error message */}
            {aiReportError && (
              <div
                className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                data-testid="ai-report-error"
              >
                {aiReportError}
              </div>
            )}

            {/* Report content */}
            {aiReportContent && (
              <div className="space-y-3">
                <div
                  className="overflow-y-auto max-h-64 bg-accent/20 rounded-lg p-4 text-sm prose prose-sm max-w-none"
                  data-testid="ai-report-content"
                  dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(aiReportContent) }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveAiReport}
                    disabled={aiSaving || aiSaved}
                    data-testid="button-save-report"
                    className="gap-2"
                  >
                    {aiSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {aiSaved ? "Đã lưu" : "Lưu báo cáo"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAiReportToWord(aiReportContent, ticker)}
                    data-testid="button-export-ai-word"
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Xuất Word
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* KPI Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Card className="border-l-4" style={{ borderLeftColor: "hsl(25, 100%, 60%)" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "hsl(25, 100%, 50%)" }} />
                <span className="text-xs font-medium text-muted-foreground">RR1 (ngưỡng cố định)</span>
              </div>
              <p className="text-2xl font-bold tabular-nums mt-1" data-testid="text-risk1-reds" style={{ color: "hsl(25, 100%, 45%)" }}>
                {summaryStats.risk1Reds}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4" style={{ borderLeftColor: RISK_COLORS.red }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: RISK_COLORS.red }} />
                <span className="text-xs font-medium text-muted-foreground">RR2 (ngoài phân vị)</span>
              </div>
              <p className="text-2xl font-bold tabular-nums mt-1" data-testid="text-risk2-reds" style={{ color: RISK_COLORS.red }}>
                {summaryStats.risk2Reds}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4" style={{ borderLeftColor: RISK_COLORS.red }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: RISK_COLORS.red }} />
                <span className="text-xs font-medium text-muted-foreground">Rủi ro cao</span>
              </div>
              <p className="text-2xl font-bold tabular-nums mt-1" data-testid="text-reds">
                {summaryStats.reds}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4" style={{ borderLeftColor: RISK_COLORS.green }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: RISK_COLORS.green }} />
                <span className="text-xs font-medium text-muted-foreground">An toàn</span>
              </div>
              <p className="text-2xl font-bold tabular-nums mt-1" data-testid="text-greens">
                {summaryStats.greens}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4" style={{ borderLeftColor: RISK_COLORS.gray }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" style={{ color: RISK_COLORS.gray }} />
                <span className="text-xs font-medium text-muted-foreground">Thiếu dữ liệu</span>
              </div>
              <p className="text-2xl font-bold tabular-nums mt-1" data-testid="text-grays">
                {summaryStats.grays}
              </p>
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1 border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  Điểm rủi ro (BQ)
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums mt-1" data-testid="text-risk-score">
                {summaryStats.riskScore.toFixed(0)}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dual Risk Legend */}
      <Card className="border border-border/60">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Chú thích hệ thống rủi ro kép</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-5 rounded border" style={{ backgroundColor: "hsl(25, 100%, 95%)", borderColor: "hsl(25, 80%, 80%)" }} />
                <span><strong>Nền cam:</strong> Yếu tố rủi ro 1 – Vượt ngưỡng cố định (góc nhìn cơ quan thuế)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-5 rounded border" style={{ backgroundColor: "white", borderColor: "hsl(214, 10%, 85%)" }} />
                <span><strong>Nền trắng:</strong> Không có rủi ro ngưỡng cố định</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-5 rounded border flex items-center justify-center text-[10px] font-bold" style={{ color: "hsl(0, 72%, 48%)", borderColor: "hsl(214, 10%, 85%)" }}>A</span>
                <span><strong>Chữ đỏ:</strong> Yếu tố rủi ro 2 – Ngoài khoảng phân vị [P{percentileLow}–P{percentileHigh}] của ngành</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-5 rounded border flex items-center justify-center text-[10px] font-bold" style={{ color: "hsl(215, 20%, 20%)", borderColor: "hsl(214, 10%, 85%)" }}>A</span>
                <span><strong>Chữ đen:</strong> Nằm trong khoảng phân vị ngành</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="heatmap" data-testid="tab-heatmap">Bảng nhiệt</TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-charts">Biểu đồ</TabsTrigger>
          <TabsTrigger value="comparison" data-testid="tab-comparison">So sánh</TabsTrigger>
          <TabsTrigger value="detail" data-testid="tab-detail">Chi tiết</TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">Phân tích</TabsTrigger>
          <TabsTrigger value="risk-heatmap" data-testid="tab-risk-heatmap">Biểu đồ nhiệt</TabsTrigger>
          <TabsTrigger value="risk-diagram" data-testid="tab-risk-diagram">Risk Diagram</TabsTrigger>
          <TabsTrigger value="giai-thich" data-testid="tab-giai-thich">Giải thích</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="mt-4">
          <HeatmapView result={result} percentileLow={percentileLow} percentileHigh={percentileHigh} />
        </TabsContent>

        <TabsContent value="charts" className="mt-4">
          <ChartsView result={result} />
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          <ComparisonView result={result} />
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          <DetailView result={result} />
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <AnalysisView result={result} />
        </TabsContent>

        <TabsContent value="risk-heatmap" className="mt-4">
          <RiskHeatmapView result={result} />
        </TabsContent>

        <TabsContent value="risk-diagram" className="mt-4">
          <RiskDiagramView result={result} weights={customWeights} />
        </TabsContent>

        <TabsContent value="giai-thich" className="mt-4">
          <CompositeScoreExplanation result={result} weights={customWeights} />
        </TabsContent>
      </Tabs>

      {/* Risk Scoring Editor Panel */}
      <div className="mt-6">
        <button
          data-testid="btn-toggle-scoring-panel"
          onClick={() => setScoringPanelOpen(!scoringPanelOpen)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors w-full"
          style={{
            background: scoringPanelOpen ? "hsl(144, 50%, 12%)" : "hsl(214, 10%, 97%)",
            borderColor: scoringPanelOpen ? "hsl(144, 97%, 27%)" : "hsl(214, 10%, 85%)",
            color: scoringPanelOpen ? "hsl(144, 77%, 50%)" : "hsl(215, 20%, 40%)",
          }}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Risk Weighting - Tầm quan trọng chỉ số
          {scoringPanelOpen ? (
            <ChevronUp className="w-4 h-4 ml-auto" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-auto" />
          )}
        </button>

        {scoringPanelOpen && (
          <RiskScoringEditor
            result={result}
            weights={customWeights}
            onWeightsChange={setCustomWeights}
          />
        )}
      </div>
    </div>
  );
}

/* ========== HEATMAP VIEW (enhanced with median + charts) ========== */
function HeatmapView({ result, percentileLow, percentileHigh }: { result: AnalysisResult; percentileLow: number; percentileHigh: number }) {
  const { target, comparisons } = result;
  const latestYear = target.years[0];
  const indicators = target.indicators[latestYear] || [];
  const compEntries = Object.entries(comparisons);
  const hasComparisons = compEntries.length > 0;

  const groups = useMemo(() => {
    const map = new Map<string, TiraIndicator[]>();
    for (const ind of indicators) {
      const list = map.get(ind.group) || [];
      list.push(ind);
      map.set(ind.group, list);
    }
    return Array.from(map.entries());
  }, [indicators]);

  // Compute medians: prefer industry_median from API, fallback to computed median from comparisons
  const medians = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const ind of indicators) {
      m[ind.id] = ind.industry_median !== undefined ? ind.industry_median : computeMedian(result, ind.id, latestYear);
    }
    return m;
  }, [indicators, result, latestYear]);

  // Chart data: % difference from median for each indicator
  const chartData = useMemo(() => {
    return indicators.map((ind) => {
      const med = medians[ind.id] ?? ind.industry_median;
      let pctDiff: number | null = null;
      if (ind.company_value !== null && med !== null && med !== 0) {
        pctDiff = ((ind.company_value - med) / Math.abs(med)) * 100;
      }
      return {
        id: ind.id,
        name: ind.name.length > 25 ? ind.name.substring(0, 23) + "..." : ind.name,
        fullName: ind.name,
        pctDiff,
        risk: ind.risk_level,
      };
    }).filter(d => d.pctDiff !== null);
  }, [indicators, medians]);

  return (
    <div className="space-y-6">
      {/* Year-over-year heatmap with median column */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Bảng nhiệt theo năm - {target.company.ma_ck}
            {hasComparisons && " (có trung vị so sánh)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-heatmap-years">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[200px] sticky left-0 bg-card z-10">
                    Chỉ số
                  </th>
                  {target.years.map((year) => (
                    <>
                      <th
                        key={year}
                        className="text-center py-2 px-3 font-medium text-muted-foreground min-w-[100px]"
                      >
                        {year}
                      </th>
                      <th
                        key={`${year}-median`}
                        className="text-center py-2 px-2 font-medium min-w-[80px] text-xs"
                        style={{ color: "hsl(144, 97%, 27%)" }}
                      >
                        Trung vị
                      </th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([groupName, groupInds]) => (
                  <>
                    <tr key={`group-${groupName}`}>
                      <td
                        colSpan={target.years.length * 2 + 1}
                        className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/5 sticky left-0"
                      >
                        {groupName}
                      </td>
                    </tr>
                    {groupInds.map((ind) => (
                      <tr key={ind.id} className="border-b border-border/50 hover:bg-accent/30">
                        <td className="py-1.5 px-3 text-xs font-medium sticky left-0 bg-card z-10">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dashed decoration-muted-foreground/30">
                                {ind.name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="text-xs">{ind.risk_factor}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        {target.years.map((year) => {
                          const yearInd = target.indicators[year]?.find(
                            (i) => i.id === ind.id
                          );
                          // Use industry_median from the indicator if available, else fall back to computed
                          const yearMedian = yearInd?.industry_median !== undefined
                            ? yearInd.industry_median
                            : computeMedian(result, ind.id, year);
                          return (
                            <>
                              <td key={year} className="py-1.5 px-2 text-center">
                                <span
                                  className="heatmap-cell inline-block"
                                  style={{
                                    backgroundColor: getDualBgColor(yearInd?.risk_level_1 ?? yearInd?.risk_level),
                                    color: getDualFontColor(yearInd?.risk_level_2 ?? yearInd?.risk_level),
                                  }}
                                >
                                  {yearInd
                                    ? fmtVal(ind.id, yearInd.company_value)
                                    : "N/A"}
                                </span>
                              </td>
                              <td key={`${year}-median`} className="py-1.5 px-1 text-center">
                                <span className="heatmap-cell inline-block text-xs font-medium" style={{ backgroundColor: "hsl(183, 85%, 30%, 0.08)", color: "hsl(144, 97%, 27%)" }}>
                                  {fmtVal(ind.id, yearMedian)}
                                </span>
                              </td>
                            </>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Per-indicator diverging bar chart: % difference from median */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              % Lệch so với Trung vị ngành – {target.company.ma_ck} ({latestYear})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dương (+) = cao hơn trung vị ngành, âm (−) = thấp hơn trung vị ngành
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[480px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 10, right: 40 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 10%, 85%)" horizontal={false} />
                  <XAxis
                    type="number"
                    fontSize={10}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    fontSize={9}
                    tick={{ fill: "hsl(215, 10%, 45%)" }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 14%, 89%)",
                      fontSize: "12px",
                    }}
                    formatter={(value: any, _name: string, props: any) => [
                      typeof value === "number" ? `${value.toFixed(1)}%` : value,
                      `${props.payload.fullName} vs trung vị`,
                    ]}
                  />
                  <ReferenceLine x={0} stroke="hsl(215, 20%, 50%)" strokeWidth={1.5} />
                  <Bar dataKey="pctDiff" name="% lệch trung vị" radius={[0, 2, 2, 0]} barSize={10}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.id}
                        fill={
                          entry.risk === "red"
                            ? "hsl(0, 72%, 48%)"
                            : entry.risk === "yellow"
                            ? "hsl(45, 90%, 45%)"
                            : (entry.pctDiff ?? 0) >= 0
                            ? "hsl(144, 55%, 40%)"
                            : "hsl(215, 60%, 55%)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: "hsl(25, 100%, 95%)", borderColor: "hsl(25, 80%, 80%)" }} />
          Nền cam = RR1 (ngưỡng cố định)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: "white", borderColor: "hsl(214, 10%, 85%)" }} />
          Nền trắng = OK
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: "hsl(0, 72%, 48%)" }}>A</span> Chữ đỏ = RR2 (ngoài phân vị P{percentileLow}–P{percentileHigh})
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: "hsl(215, 20%, 20%)" }}>A</span> Chữ đen = trong phân vị
        </div>
      </div>
    </div>
  );
}

/* ========== CHARTS VIEW ========== */
function ChartsView({ result }: { result: AnalysisResult }) {
  const { target } = result;
  const latestYear = target.years[0];
  const indicators = target.indicators[latestYear] || [];

  const riskDistribution = useMemo(() => {
    return target.years.map((year) => {
      const yearInds = target.indicators[year] || [];
      return {
        year,
        "Rủi ro cao": yearInds.filter((i) => i.risk_level === "red").length,
        "Cần chú ý": yearInds.filter((i) => i.risk_level === "yellow").length,
        "An toàn": yearInds.filter((i) => i.risk_level === "green").length,
        "N/A": yearInds.filter((i) => i.risk_level === "gray").length,
      };
    }).reverse();
  }, [target]);

  const radarData = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const ind of indicators) {
      const list = groups.get(ind.group) || [];
      if (ind.risk_level === "red") list.push(3);
      else if (ind.risk_level === "yellow") list.push(1);
      else if (ind.risk_level === "green") list.push(0);
      groups.set(ind.group, list);
    }
    return Array.from(groups.entries()).map(([group, scores]) => ({
      group: GROUP_SHORT[group] || group,
      score: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / (scores.length * 3)) * 100 : 0,
    }));
  }, [indicators]);

  const trendData = useMemo(() => {
    const keyIds = ["0.1", "1.1", "1.5", "2.1", "2.5"];
    return keyIds.map((id) => {
      const indicator = indicators.find((i) => i.id === id);
      const values = target.years
        .map((year) => {
          const yearInd = target.indicators[year]?.find((i) => i.id === id);
          return {
            year,
            value: yearInd?.company_value ?? null,
          };
        })
        .reverse();
      return {
        id,
        name: indicator?.name || id,
        values,
      };
    });
  }, [target, indicators]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Phân bố rủi ro theo năm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistribution} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 10%, 85%)" />
                <XAxis dataKey="year" fontSize={12} />
                <YAxis fontSize={12} />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(214, 14%, 89%)",
                    fontSize: "12px",
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Rủi ro cao" fill={RISK_COLORS.red} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Cần chú ý" fill={RISK_COLORS.yellow} radius={[2, 2, 0, 0]} />
                <Bar dataKey="An toàn" fill={RISK_COLORS.green} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Hồ sơ rủi ro - {target.company.ma_ck}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(214, 10%, 85%)" />
                  <PolarAngleAxis
                    dataKey="group"
                    fontSize={10}
                    tick={{ fill: "hsl(215, 10%, 45%)" }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    fontSize={10}
                    tick={{ fill: "hsl(215, 10%, 45%)" }}
                  />
                  <Radar
                    name="Điểm rủi ro"
                    dataKey="score"
                    stroke="hsl(144, 97%, 27%)"
                    fill="hsl(144, 97%, 27%)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Xu hướng chỉ số chính
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 10%, 85%)" />
                  <XAxis
                    dataKey="year"
                    allowDuplicatedCategory={false}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 14%, 89%)",
                      fontSize: "12px",
                    }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
                  {trendData.map((trend, i) => (
                    <Line
                      key={trend.id}
                      data={trend.values.filter((v) => v.value !== null)}
                      type="monotone"
                      dataKey="value"
                      name={trend.name}
                      stroke={
                        [
                          "hsl(144, 97%, 27%)",
                          "hsl(25, 90%, 50%)",
                          "hsl(142, 55%, 40%)",
                          "hsl(262, 55%, 50%)",
                          "hsl(45, 90%, 50%)",
                        ][i]
                      }
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ========== COMPARISON VIEW (enhanced with multi-year) ========== */
function ComparisonView({ result }: { result: AnalysisResult }) {
  const { target, comparisons } = result;
  const compEntries = Object.entries(comparisons);
  const [selectedYears, setSelectedYears] = useState<string[]>(() => [target.years[0]]);

  if (compEntries.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Chưa chọn công ty so sánh. Quay lại trang chính để thêm.</p>
        </CardContent>
      </Card>
    );
  }

  const allTickers = [
    target.company.ma_ck,
    ...compEntries.map(([, v]) => v.company.ma_ck),
  ];

  const colors = [
    "hsl(144, 97%, 27%)",
    "hsl(25, 90%, 50%)",
    "hsl(262, 55%, 50%)",
    "hsl(142, 55%, 40%)",
    "hsl(45, 90%, 50%)",
  ];

  // Sort selected years newest first
  const sortedYears = [...selectedYears].sort((a, b) => Number(b) - Number(a));

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <YearMultiSelect
          allYears={target.years}
          selectedYears={selectedYears}
          onChange={setSelectedYears}
        />
        <span className="text-xs text-muted-foreground">
          {selectedYears.length} năm đã chọn
        </span>
      </div>

      {/* Table for each selected year */}
      {sortedYears.map((year) => {
        const targetInds = target.indicators[year] || [];
        const comparisonData = targetInds.map((ind) => {
          const row: Record<string, any> = {
            name: ind.name,
            id: ind.id,
            [target.company.ma_ck]: ind.company_value,
            [`${target.company.ma_ck}_risk1`]: ind.risk_level_1 ?? ind.risk_level,
            [`${target.company.ma_ck}_risk2`]: ind.risk_level_2 ?? ind.risk_level,
          };
          for (const [, compData] of compEntries) {
            const compInd = compData.indicators[year]?.find((i) => i.id === ind.id);
            row[compData.company.ma_ck] = compInd?.company_value ?? null;
            row[`${compData.company.ma_ck}_risk1`] = compInd?.risk_level_1 ?? compInd?.risk_level ?? "gray";
            row[`${compData.company.ma_ck}_risk2`] = compInd?.risk_level_2 ?? compInd?.risk_level ?? "gray";
          }
          return row;
        });

        return (
          <Card key={year}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                So sánh các công ty - Năm {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid={`table-comparison-${year}`}>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[180px] sticky left-0 bg-card z-10">
                        Chỉ số
                      </th>
                      {allTickers.map((tk, i) => (
                        <th
                          key={tk}
                          className="text-center py-2 px-3 font-semibold min-w-[100px]"
                          style={{ color: colors[i % colors.length] }}
                        >
                          {tk}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-accent/30">
                        <td className="py-1.5 px-3 text-xs font-medium sticky left-0 bg-card z-10">
                          {row.name}
                        </td>
                        {allTickers.map((tk) => {
                          const risk1 = row[`${tk}_risk1`] as string;
                          const risk2 = row[`${tk}_risk2`] as string;
                          const value = row[tk];
                          return (
                            <td key={tk} className="py-1.5 px-2 text-center">
                              <span
                                className="heatmap-cell inline-block"
                                style={{
                                  backgroundColor: getDualBgColor(risk1),
                                  color: getDualFontColor(risk2),
                                }}
                              >
                                {value !== null && value !== undefined
                                  ? fmtVal(row.id, value)
                                  : "N/A"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Comparison chart (key indicators for latest selected year) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Biểu đồ so sánh - Chỉ số chính ({sortedYears[0]})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(target.indicators[sortedYears[0]] || [])
                  .filter((ind) => ["0.1", "1.1", "1.5", "2.5", "3.4"].includes(ind.id))
                  .map((ind) => {
                    const row: Record<string, any> = {
                      name: ind.name,
                      [target.company.ma_ck]: ind.company_value,
                    };
                    for (const [, compData] of compEntries) {
                      const compInd = compData.indicators[sortedYears[0]]?.find((i) => i.id === ind.id);
                      row[compData.company.ma_ck] = compInd?.company_value ?? null;
                    }
                    return row;
                  })}
                barCategoryGap="15%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 10%, 85%)" />
                <XAxis dataKey="name" fontSize={10} angle={-15} textAnchor="end" height={60} />
                <YAxis fontSize={12} />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(214, 14%, 89%)",
                    fontSize: "12px",
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
                {allTickers.map((tk, i) => (
                  <Bar
                    key={tk}
                    dataKey={tk}
                    fill={colors[i % colors.length]}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ========== DETAIL VIEW (enhanced with year + company selectors) ========== */
function DetailView({ result }: { result: AnalysisResult }) {
  const { target, comparisons } = result;
  const compEntries = Object.entries(comparisons);
  const [selectedYears, setSelectedYears] = useState<string[]>(() => [target.years[0]]);
  const [selectedComp, setSelectedComp] = useState<string>("none");

  const sortedYears = [...selectedYears].sort((a, b) => Number(b) - Number(a));

  const compOptions = compEntries.map(([, v]) => ({
    value: v.company.ma_ck,
    label: v.company.ma_ck + " - " + v.company.ten_tv,
  }));

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div className="flex items-center gap-4 flex-wrap">
        <YearMultiSelect
          allYears={target.years}
          selectedYears={selectedYears}
          onChange={setSelectedYears}
        />
        {compEntries.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">So sánh với:</span>
            <Select value={selectedComp} onValueChange={setSelectedComp}>
              <SelectTrigger className="w-[200px] h-8 text-sm" data-testid="select-comp-detail">
                <SelectValue placeholder="Không so sánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không so sánh</SelectItem>
                {compOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Detail cards for each year */}
      {sortedYears.map((year) => {
        const indicators = target.indicators[year] || [];
        const groups = new Map<string, TiraIndicator[]>();
        for (const ind of indicators) {
          const list = groups.get(ind.group) || [];
          list.push(ind);
          groups.set(ind.group, list);
        }
        const groupEntries = Array.from(groups.entries());

        // Get comparison data
        const compData = selectedComp !== "none"
          ? compEntries.find(([, v]) => v.company.ma_ck === selectedComp)?.[1]
          : null;

        return (
          <div key={year} className="space-y-4">
            <h3 className="text-lg font-bold text-primary border-b border-primary/20 pb-2">
              Năm {year}
            </h3>
            {groupEntries.map(([groupName, groupInds]) => (
              <Card key={`${year}-${groupName}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-primary uppercase tracking-wider">
                    {groupName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {groupInds.map((ind) => {
                      const compInd = compData?.indicators[year]?.find((i) => i.id === ind.id);
                      return (
                        <div
                          key={ind.id}
                          className="rounded-lg p-3 border"
                          style={{
                            backgroundColor: getDualBgColor(ind.risk_level_1 ?? ind.risk_level),
                            borderColor: ind.risk_level_1 === "red" ? "hsl(25, 80%, 80%)" : "hsl(214, 10%, 90%)",
                          }}
                          data-testid={`detail-indicator-${ind.id}-${year}`}
                        >
                          {/* Side by side layout when comparison selected */}
                          <div className={compData ? "grid grid-cols-2 gap-4" : ""}>
                            {/* Target company */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono px-1.5 py-0"
                                >
                                  {ind.id}
                                </Badge>
                                <span className="text-sm font-semibold">{ind.name}</span>
                                {ind.risk_level_1 === "red" && (
                                  <Badge className="text-[9px] px-1 py-0" style={{ backgroundColor: "hsl(25, 100%, 95%)", color: "hsl(25, 100%, 40%)", border: "1px solid hsl(25, 80%, 75%)" }}>RR1</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{ind.risk_factor}</p>
                              {ind.industry_range && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Phân vị ngành: {ind.industry_range}
                                </p>
                              )}
                              {ind.industry_median !== null && ind.industry_median !== undefined && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Trung vị ngành: <span className="font-medium" style={{ color: "hsl(144, 97%, 27%)" }}>{fmtVal(ind.id, ind.industry_median)}</span>
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs font-medium text-muted-foreground">{target.company.ma_ck}:</span>
                                <span
                                  className="text-lg font-bold tabular-nums"
                                  style={{
                                    color: getDualFontColor(ind.risk_level_2 ?? ind.risk_level),
                                  }}
                                >
                                  {fmtVal(ind.id, ind.company_value)}
                                </span>
                                {ind.risk_level_2 === "red" && (
                                  <Badge className="text-[9px] px-1 py-0" style={{ backgroundColor: "hsl(0, 72%, 95%)", color: "hsl(0, 72%, 48%)", border: "1px solid hsl(0, 60%, 80%)" }}>RR2</Badge>
                                )}
                              </div>
                            </div>

                            {/* Comparison company */}
                            {compData && compInd && (
                              <div className="border-l border-border/50 pl-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-muted-foreground">
                                    {selectedComp}
                                  </span>
                                  {compInd.risk_level_1 === "red" && (
                                    <Badge className="text-[9px] px-1 py-0" style={{ backgroundColor: "hsl(25, 100%, 95%)", color: "hsl(25, 100%, 40%)", border: "1px solid hsl(25, 80%, 75%)" }}>RR1</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span
                                    className="text-lg font-bold tabular-nums"
                                    style={{
                                      color: getDualFontColor(compInd.risk_level_2 ?? compInd.risk_level),
                                    }}
                                  >
                                    {fmtVal(compInd.id, compInd.company_value)}
                                  </span>
                                  {compInd.risk_level_2 === "red" && (
                                    <Badge className="text-[9px] px-1 py-0" style={{ backgroundColor: "hsl(0, 72%, 95%)", color: "hsl(0, 72%, 48%)", border: "1px solid hsl(0, 60%, 80%)" }}>RR2</Badge>
                                  )}
                                </div>
                                {compInd.industry_range && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Phân vị ngành: {compInd.industry_range}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ========== ANALYSIS VIEW (new tab) ========== */
function AnalysisView({ result }: { result: AnalysisResult }) {
  const { target } = result;
  const latestYear = target.years[0];
  const indicators = target.indicators[latestYear] || [];
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(indicators.map((i) => i.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Separate risk and non-risk (consider both risk_level_1 and risk_level_2)
  const riskIndicators = indicators.filter((i) =>
    i.risk_level === "red" || i.risk_level === "yellow" ||
    (i.risk_level_1 ?? "") === "red" || (i.risk_level_2 ?? "") === "red"
  );
  const safeIndicators = indicators.filter((i) =>
    (i.risk_level === "green" || i.risk_level_1 === "green") &&
    (i.risk_level_2 ?? "green") === "green" &&
    !riskIndicators.includes(i)
  );
  const naIndicators = indicators.filter((i) => i.risk_level === "gray" && !riskIndicators.includes(i));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Phân tích ý nghĩa cảnh báo - {target.company.ma_ck} ({latestYear})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">
                Mở tất cả
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">
                Thu gọn
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dưới đây là phân tích chi tiết cho từng chỉ số, giải thích tại sao một chỉ số được đánh giá
            ở mức "Rủi ro" hoặc "Chú ý", cùng với các gợi ý diễn giải từ hướng dẫn của TIRA.
          </p>
        </CardContent>
      </Card>

      {/* Risk indicators */}
      {riskIndicators.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="w-4 h-4" style={{ color: RISK_COLORS.red }} />
            Chỉ số cần lưu ý ({riskIndicators.length})
          </h3>
          {riskIndicators.map((ind) => {
            const analysis = INDICATOR_ANALYSIS[ind.id];
            const isExpanded = expandedIds.has(ind.id);
            const isRr1 = (ind.risk_level_1 ?? ind.risk_level) === "red";
            const isRr2 = (ind.risk_level_2 ?? ind.risk_level) === "red";
            return (
              <Card
                key={ind.id}
                className="border-l-4 cursor-pointer hover:shadow-md transition-shadow"
                style={{
                  borderLeftColor: isRr1 ? "hsl(25, 100%, 55%)" : RISK_COLORS[ind.risk_level as keyof typeof RISK_COLORS],
                }}
                onClick={() => toggle(ind.id)}
                data-testid={`analysis-card-${ind.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono px-1.5 py-0"
                        >
                          {ind.id}
                        </Badge>
                        <span className="text-sm font-semibold">{ind.name}</span>
                        {isRr1 && (
                          <Badge
                            className="text-[10px] px-1.5 py-0"
                            style={{ backgroundColor: "hsl(25, 100%, 95%)", color: "hsl(25, 100%, 40%)", border: "1px solid hsl(25, 80%, 75%)" }}
                          >
                            RR1
                          </Badge>
                        )}
                        {isRr2 && (
                          <Badge
                            className="text-[10px] px-1.5 py-0"
                            style={{ backgroundColor: RISK_BG_COLORS.red, color: RISK_COLORS.red }}
                          >
                            RR2
                          </Badge>
                        )}
                        {!isRr1 && !isRr2 && (
                          <Badge
                            className="text-[10px] px-1.5 py-0"
                            style={{
                              backgroundColor: RISK_BG_COLORS[ind.risk_level as keyof typeof RISK_BG_COLORS],
                              color: RISK_COLORS[ind.risk_level as keyof typeof RISK_COLORS],
                            }}
                          >
                            {riskLabel(ind.risk_level)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Giá trị: <strong style={{ color: getDualFontColor(ind.risk_level_2 ?? ind.risk_level) }}>{fmtVal(ind.id, ind.company_value)}</strong></span>
                        {ind.industry_range && <span>Ngành: {ind.industry_range}</span>}
                        {ind.industry_median !== null && ind.industry_median !== undefined && (
                          <span>Trung vị: <strong style={{ color: "hsl(144, 97%, 27%)" }}>{fmtVal(ind.id, ind.industry_median)}</strong></span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 pt-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && analysis && (
                    <div className="mt-4 space-y-3 border-t border-border/50 pt-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Công thức</p>
                        <p className="text-xs font-mono bg-accent/30 p-2 rounded">{analysis.formula}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mục tiêu</p>
                        <p className="text-xs">{analysis.objective}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Yếu tố rủi ro</p>
                        <p className="text-xs" style={{ color: getDualFontColor(ind.risk_level_2 ?? ind.risk_level) }}>
                          {analysis.risk_meaning}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Gợi ý diễn giải</p>
                        <ul className="space-y-1">
                          {analysis.interpretations.map((interp, i) => (
                            <li key={i} className="text-xs flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{interp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Yếu tố rủi ro từ TIRA</p>
                        <p className="text-xs italic">{ind.risk_factor}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Safe indicators */}
      {safeIndicators.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="w-4 h-4" style={{ color: RISK_COLORS.green }} />
            Chỉ số an toàn ({safeIndicators.length})
          </h3>
          {safeIndicators.map((ind) => {
            const analysis = INDICATOR_ANALYSIS[ind.id];
            const isExpanded = expandedIds.has(ind.id);
            return (
              <Card
                key={ind.id}
                className="border-l-4 cursor-pointer hover:shadow-md transition-shadow"
                style={{ borderLeftColor: RISK_COLORS.green }}
                onClick={() => toggle(ind.id)}
                data-testid={`analysis-card-${ind.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{ind.id}</Badge>
                        <span className="text-sm font-semibold">{ind.name}</span>
                        <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: RISK_BG_COLORS.green, color: RISK_COLORS.green }}>An toàn</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Giá trị: <strong style={{ color: RISK_COLORS.green }}>{fmtVal(ind.id, ind.company_value)}</strong></span>
                        {ind.industry_range && <span>Ngành: {ind.industry_range}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 pt-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  {isExpanded && analysis && (
                    <div className="mt-4 space-y-3 border-t border-border/50 pt-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Công thức</p>
                        <p className="text-xs font-mono bg-accent/30 p-2 rounded">{analysis.formula}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mục tiêu</p>
                        <p className="text-xs">{analysis.objective}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Gợi ý diễn giải</p>
                        <ul className="space-y-1">
                          {analysis.interpretations.map((interp, i) => (
                            <li key={i} className="text-xs flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{interp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* N/A indicators */}
      {naIndicators.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <HelpCircle className="w-4 h-4" style={{ color: RISK_COLORS.gray }} />
            Thiếu dữ liệu ({naIndicators.length})
          </h3>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {naIndicators.map((ind) => (
                  <Badge key={ind.id} variant="outline" className="text-xs">
                    {ind.id} {ind.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ========== RISK HEATMAP VIEW ========== */
function riskIntensity(indicator: TiraIndicator): number {
  let score = 0;
  if (indicator.risk_level_1 === "red") score += 0.5;
  if (indicator.risk_level_2 === "red") score += 0.5;
  return score;
}

function intensityColor(score: number): string {
  if (score === 0) return "hsl(142, 55%, 90%)"; // light green
  if (score <= 0.25) return "hsl(80, 60%, 85%)"; // yellow-green
  if (score <= 0.5) return "hsl(45, 90%, 80%)"; // yellow
  if (score <= 0.75) return "hsl(25, 90%, 75%)"; // orange
  return "hsl(0, 72%, 70%)"; // red
}

// Enhanced deviation calculation for heatmap
// rr1Dev: how many standard deviations beyond the threshold (0 = safe, >0 = risky)
// rr2Dev: how many IQR units away from median (0 = within range, >0 = outside)
function calculateDeviation(indicator: TiraIndicator): { rr1Dev: number; rr2Dev: number; rr1Explain: string; rr2Explain: string } {
  let rr1Dev = 0;
  let rr1Explain = "An toàn: trong ngưỡng cho phép";
  let rr2Dev = 0;
  let rr2Explain = "An toàn: trong khoảng phân vị ngành";

  // RR1: deviation from threshold, normalized 0-1
  if (indicator.risk_level_1 === "red" && indicator.company_value !== null) {
    // Use severity as proxy for deviation magnitude
    const sev = calcRiskSeverity("red", indicator.company_value, indicator.industry_median, indicator.industry_p_low, indicator.industry_p_high);
    rr1Dev = Math.min(sev / 5, 1); // normalize 0-1
    const sevLabels = ["", "nhẹ", "vừa", "đáng kể", "cao", "rất cao"];
    rr1Explain = `Rủi ro: vượt ngưỡng CQT, mức độ ${sevLabels[sev] || ""} (severity ${sev}/5)`;
  }

  // RR2: distance from median/IQR in standard deviation units
  if (indicator.company_value !== null && indicator.industry_median !== null) {
    const median = indicator.industry_median;
    const pLow = indicator.industry_p_low;
    const pHigh = indicator.industry_p_high;
    if (pLow !== null && pHigh !== null && (pHigh - pLow) > 0) {
      const iqr = pHigh - pLow;
      // IQR ≈ 1.35 standard deviations for normal distribution
      const approxStdDev = iqr / 1.35;
      const distFromMedian = Math.abs(indicator.company_value - median);
      const stdDevs = approxStdDev > 0 ? distFromMedian / approxStdDev : 0;
      rr2Dev = Math.min(stdDevs / 3, 1); // 3 std devs = max bar (100%)
      if (indicator.risk_level_2 === "red") {
        const direction = indicator.company_value < median ? "thấp hơn" : "cao hơn";
        rr2Explain = `Rủi ro: ${direction} trung vị ${stdDevs.toFixed(1)} độ lệch chuẩn (${((distFromMedian / Math.abs(median || 1)) * 100).toFixed(0)}% so với trung vị)`;
      } else {
        rr2Explain = `An toàn: lệch ${stdDevs.toFixed(1)} std dev so với trung vị, trong phân vị ngành`;
      }
    } else if (indicator.risk_level_2 === "red") {
      rr2Dev = 0.6;
      rr2Explain = "Rủi ro: ngoài khoảng phân vị ngành (IQR không xác định)";
    }
  }

  return { rr1Dev, rr2Dev, rr1Explain, rr2Explain };
}

function RiskHeatmapView({ result }: { result: AnalysisResult }) {
  const { target } = result;
  const years = target.years;

  // Build grouped structure across all years
  const groupedIndicators = useMemo(() => {
    const groupMap = new Map<string, string[]>(); // group -> indicator IDs
    const firstYear = years[0];
    if (!firstYear) return [];
    const firstYearInds = target.indicators[firstYear] || [];
    for (const ind of firstYearInds) {
      const ids = groupMap.get(ind.group) || [];
      if (!ids.includes(ind.id)) ids.push(ind.id);
      groupMap.set(ind.group, ids);
    }
    return Array.from(groupMap.entries());
  }, [target, years]);

  // Build a lookup: indicatorId -> name
  const indicatorNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const yr of years) {
      for (const ind of (target.indicators[yr] || [])) {
        m[ind.id] = ind.name;
      }
    }
    return m;
  }, [target, years]);

  // Build lookup: year -> indicatorId -> TiraIndicator
  const indicatorByYearId = useMemo(() => {
    const m: Record<string, Record<string, TiraIndicator>> = {};
    for (const yr of years) {
      m[yr] = {};
      for (const ind of (target.indicators[yr] || [])) {
        m[yr][ind.id] = ind;
      }
    }
    return m;
  }, [target, years]);

  return (
    <div className="space-y-4" data-testid="risk-heatmap-view">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Biểu đồ nhiệt rủi ro - {target.company.ma_ck}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Màu sắc thể hiện mức độ rủi ro tổng hợp: xanh = an toàn, đỏ = rủi ro cao theo RR1 và RR2.
          </p>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Chú thích thanh màu:</span>
            <div className="flex items-center gap-1.5">
              <div className="flex w-10 h-4 rounded overflow-hidden border border-border/30">
                <div className="w-1/2 h-full" style={{ background: "hsl(25, 90%, 60%)" }} />
                <div className="w-1/2 h-full" style={{ background: "hsl(214, 10%, 90%)" }} />
              </div>
              <span className="text-xs text-muted-foreground">Trái (cam) = RR1 – Ngưỡng tuyệt đối</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex w-10 h-4 rounded overflow-hidden border border-border/30">
                <div className="w-1/2 h-full" style={{ background: "hsl(214, 10%, 90%)" }} />
                <div className="w-1/2 h-full" style={{ background: "hsl(0, 72%, 55%)" }} />
              </div>
              <span className="text-xs text-muted-foreground">Phải (đỏ) = RR2 – Lệch IQR ngành</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded border border-border/30" style={{ background: "hsl(142, 55%, 88%)" }} />
              <span className="text-xs text-muted-foreground">Xanh = An toàn</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-risk-heatmap">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[220px] sticky left-0 bg-card z-10">
                    Chỉ số
                  </th>
                  {years.map((year) => (
                    <th
                      key={year}
                      className="text-center py-2 px-3 font-medium text-muted-foreground min-w-[100px]"
                    >
                      {year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedIndicators.map(([groupName, indicatorIds]) => (
                  <>
                    <tr key={`group-${groupName}`}>
                      <td
                        colSpan={years.length + 1}
                        className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/5 sticky left-0"
                      >
                        {groupName}
                      </td>
                    </tr>
                    {indicatorIds.map((indId) => (
                      <tr key={indId} className="border-b border-border/40 hover:bg-accent/20">
                        <td className="py-1.5 px-3 sticky left-0 bg-card z-10">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 shrink-0">
                              {indId}
                            </Badge>
                            <span className="truncate max-w-[160px]" title={indicatorNames[indId]}>
                              {indicatorNames[indId]}
                            </span>
                          </div>
                        </td>
                        {years.map((year) => {
                          const ind = indicatorByYearId[year]?.[indId];
                          if (!ind) {
                            return (
                              <td
                                key={year}
                                className="py-1.5 px-3 text-center"
                                style={{ backgroundColor: "hsl(214, 10%, 96%)" }}
                              >
                                <span className="text-muted-foreground/40 text-[10px]">N/A</span>
                              </td>
                            );
                          }
                          const { rr1Dev, rr2Dev, rr1Explain, rr2Explain } = calculateDeviation(ind);
                          const bothSafe = rr1Dev === 0 && rr2Dev < 0.2;
                          const cellBg = bothSafe
                            ? "hsl(142, 55%, 94%)"
                            : "hsl(214, 10%, 98%)";
                          // RR1 bar: orange gradient based on rr1Dev
                          const rr1Alpha = Math.round(rr1Dev * 100);
                          // RR2 bar: red gradient based on rr2Dev
                          const rr2Alpha = Math.round(rr2Dev * 100);
                          return (
                            <td
                              key={year}
                              className="py-1 px-2 text-center"
                              style={{ backgroundColor: cellBg }}
                              data-testid={`heatmap-cell-${indId}-${year}`}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">
                                    {/* Value */}
                                    <div
                                      className="text-[11px] font-semibold mb-1"
                                      style={{
                                        color:
                                          rr1Dev > 0 && rr2Dev > 0.5
                                            ? "hsl(0, 60%, 30%)"
                                            : rr1Dev > 0 || rr2Dev > 0.3
                                            ? "hsl(25, 70%, 30%)"
                                            : "hsl(142, 55%, 30%)",
                                      }}
                                    >
                                      {fmtVal(indId, ind.company_value)}
                                    </div>
                                    {/* Dual bar */}
                                    <div className="flex h-2 rounded overflow-hidden w-full gap-px">
                                      {/* Left bar = RR1 (orange) */}
                                      <div
                                        className="w-1/2 rounded-l"
                                        style={{
                                          background:
                                            rr1Alpha > 0
                                              ? `hsl(25, 90%, ${Math.max(45, 90 - rr1Alpha * 0.4)}%)`
                                              : "hsl(214, 10%, 88%)",
                                          opacity: rr1Alpha > 0 ? 1 : 0.4,
                                        }}
                                        title={`RR1: ${rr1Dev > 0 ? "Rủi ro" : "An toàn"}`}
                                      />
                                      {/* Right bar = RR2 (red) */}
                                      <div
                                        className="w-1/2 rounded-r"
                                        style={{
                                          background:
                                            rr2Alpha > 20
                                              ? `hsl(0, 72%, ${Math.max(40, 90 - rr2Alpha * 0.5)}%)`
                                              : "hsl(214, 10%, 88%)",
                                          opacity: rr2Alpha > 20 ? 1 : 0.4,
                                        }}
                                        title={`RR2: ${rr2Dev > 0.3 ? "Lệch IQR" : "Trong IQR"}`}
                                      />
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-[220px]">
                                  <p className="font-semibold">{ind.name}</p>
                                  <p>Năm: {year}</p>
                                  <p>Giá trị: {fmtVal(indId, ind.company_value)}</p>
                                  <p>Trung vị ngành: {fmtVal(indId, ind.industry_median)}</p>
                                  <p style={{ color: ind.risk_level_1 === "red" ? "hsl(25,90%,45%)" : "hsl(142,55%,40%)" }}>
                                    RR1: {rr1Explain}
                                  </p>
                                  <p style={{ color: ind.risk_level_2 === "red" ? "hsl(0,72%,48%)" : "hsl(142,55%,40%)" }}>
                                    RR2: {rr2Explain}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expandable Giải thích */}
          <details className="mt-4 border-t border-border/50 pt-3">
            <summary className="text-xs font-semibold text-primary cursor-pointer hover:underline">
              Giải thích biểu đồ nhiệt
            </summary>
            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Ý nghĩa thanh màu:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <span style={{color: "hsl(25, 90%, 50%)"}}>Thanh cam (trái) = RR1</span>: Mức độ lệch so với ngưỡng của cơ quan thuế.
                  Độ dài thanh tỉ lệ với mức độ rủi ro (severity 0-5). Thanh đầy = severity 5 (lệch rất xa ngưỡng).
                  Thanh mờ/xám = an toàn (trong ngưỡng).
                </li>
                <li>
                  <span style={{color: "hsl(0, 72%, 48%)"}}>Thanh đỏ (phải) = RR2</span>: Mức độ lệch so với trung vị ngành, tính bằng độ lệch chuẩn (σ).
                  Độ dài thanh = khoảng cách từ giá trị công ty đến trung vị ngành / độ lệch chuẩn ước tính.
                  Công thức: σ ≈ IQR / 1.35. Thanh đầy = lệch 3σ (rất xa trung vị).
                  Thanh mờ/xám = trong khoảng phân vị ngành.
                </li>
                <li>
                  <span style={{color: "hsl(142, 55%, 40%)"}}>Nền xanh</span>: Chỉ số an toàn cả hai chiều (không có RR1 và RR2).
                </li>
              </ul>
              <p className="font-medium text-foreground mt-2">Cách đọc:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Hover vào từng ô để xem giải thích chi tiết về mức độ rủi ro, hướng lệch (cao/thấp hơn trung vị), và số độ lệch chuẩn.</li>
                <li>Ô có cả hai thanh đậm = rủi ro kép (vượt ngưỡng CQT và lệch xa ngành).</li>
                <li>Ô chỉ có một thanh đậm = rủi ro đơn chiều.</li>
              </ul>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

/* ========== RISK DIAGRAM VIEW (BUBBLE CHART) ========== */
/* ========== COMPOSITE SCORE EXPLANATION ========== */
function CompositeScoreExplanation({
  result,
  weights,
}: {
  result: AnalysisResult;
  weights: Record<string, number>;
}) {
  const { target } = result;
  const allYears = target.years;
  const [selectedYear, setSelectedYear] = useState<string>(allYears[0] || "");

  const indicators = target.indicators[selectedYear] || [];

  const rows = indicators.map((ind) => {
    const w = weights[ind.id] ?? 5;
    const r1 = (ind as any).risk_level_1 || ind.risk_level || "gray";
    const r2 = (ind as any).risk_level_2 || "gray";
    const sev1 = calcRiskSeverity(r1, ind.company_value, (ind as any).industry_median, (ind as any).industry_p_low, (ind as any).industry_p_high);
    const sev2 = calcRiskSeverity(r2, ind.company_value, (ind as any).industry_median, (ind as any).industry_p_low, (ind as any).industry_p_high);
    const totalSev = sev1 + sev2;
    const weightedContrib = totalSev * w;
    const maxContrib = 10 * w;
    return { ind, w, r1, r2, sev1, sev2, totalSev, weightedContrib, maxContrib };
  });

  const totalWeightedRisk = rows.reduce((sum, r) => sum + r.weightedContrib, 0);
  const totalWeightedMax = rows.reduce((sum, r) => sum + r.maxContrib, 0);
  const compositeScore = totalWeightedMax > 0 ? Math.round((totalWeightedRisk / totalWeightedMax) * 100) : 0;

  // Per-year scores
  const yearScores = allYears.map((year, idx) => {
    const inds = target.indicators[year] || [];
    const score = calcCompositeScore(inds, weights);
    const n = allYears.length;
    const recencyWeight = n - idx;
    return { year, score, recencyWeight };
  });
  const totalW = yearScores.reduce((s, ys) => s + ys.recencyWeight, 0);
  const avgScore = totalW > 0 ? Math.round(yearScores.reduce((s, ys) => s + ys.score * ys.recencyWeight, 0) / totalW) : 0;

  const scoreColor = (s: number) =>
    s >= 60 ? "hsl(0, 72%, 48%)" : s >= 35 ? "hsl(45, 90%, 45%)" : "hsl(142, 55%, 40%)";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Giải thích cách tính điểm rủi ro tổng hợp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formula */}
          <div className="rounded-xl p-4 border" style={{ background: "hsl(214, 10%, 97%)", borderColor: "hsl(144, 97%, 27%)" }}>
            <p className="text-sm font-bold mb-2" style={{ color: "hsl(144, 77%, 35%)" }}>Công thức:</p>
            <p className="text-sm font-mono">Điểm = Σ(Mức độ rủi ro × Trọng số) / Σ(10 × Trọng số) × 100</p>
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <p>• Mỗi chỉ số có mức độ rủi ro tối đa = 10 (5 cho RR1 + 5 cho RR2)</p>
              <p>• Mức độ rủi ro (0-5): 0 = an toàn, 1-2 = nhẹ, 3 = trung bình, 4-5 = cao</p>
              <p>• Trọng số từ 1 (ít quan trọng) đến 10 (rất quan trọng)</p>
              <p>• Điểm BQ = Trung bình có trọng số theo năm (năm gần nhất = trọng số cao nhất)</p>
            </div>
          </div>

          {/* Per-year scores */}
          <div>
            <p className="text-sm font-semibold mb-2">Theo từng năm:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {yearScores.map(({ year, score, recencyWeight }) => {
                const sc = scoreColor(score);
                return (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className="px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                    style={{
                      background: selectedYear === year ? "hsl(144, 50%, 8%)" : "hsl(214, 10%, 97%)",
                      borderColor: selectedYear === year ? "hsl(144, 97%, 27%)" : `${sc}40`,
                      color: selectedYear === year ? "hsl(144, 77%, 50%)" : sc,
                    }}
                  >
                    <span className="font-mono">{year}</span>
                    <span className="ml-2 font-bold">{score}/100</span>
                    <span className="ml-1 text-muted-foreground">(w={recencyWeight})</span>
                  </button>
                );
              })}
            </div>

            {/* Weighted average */}
            <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: `${scoreColor(avgScore)}40` }}>
              <div className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(avgScore) }}>{avgScore}</div>
              <div>
                <p className="text-sm font-semibold" style={{ color: scoreColor(avgScore) }}>Điểm rủi ro BQ: {avgScore}/100</p>
                <p className="text-xs text-muted-foreground">
                  Trung bình có trọng số theo từng năm (năm gần nhất = trọng số cao nhất)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {avgScore >= 60 ? "Rủi ro cao – cần kiểm tra ngay" : avgScore >= 35 ? "Rủi ro trung bình – theo dõi chặt chẽ" : "Rủi ro thấp – tương đối an toàn"}
                </p>
              </div>
            </div>
          </div>

          {/* Year selector for detail table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Chi tiết chỉ số năm {selectedYear}:</p>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allYears.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Score for selected year */}
            <p className="text-xs text-muted-foreground mb-2">
              Điểm năm {selectedYear}: <strong style={{ color: scoreColor(compositeScore) }}>{compositeScore}/100</strong>
            </p>

            {/* Detailed table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: "hsl(214, 10%, 95%)" }}>
                    <th className="text-left px-3 py-2 font-semibold border-b border-border">Chỉ số</th>
                    <th className="text-center px-3 py-2 font-semibold border-b border-border">Trọng số</th>
                    <th className="text-center px-3 py-2 font-semibold border-b border-border">RR1 Mức độ (0-5)</th>
                    <th className="text-center px-3 py-2 font-semibold border-b border-border">RR2 Mức độ (0-5)</th>
                    <th className="text-center px-3 py-2 font-semibold border-b border-border">Tổng (0-10)</th>
                    <th className="text-center px-3 py-2 font-semibold border-b border-border">Đóng góp có trọng số</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ ind, w, r1, r2, sev1, sev2, totalSev, weightedContrib, maxContrib }) => (
                    <tr
                      key={ind.id}
                      className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                      style={{
                        background: totalSev >= 8 ? "hsl(0, 72%, 98%)" : totalSev > 0 ? "hsl(25, 100%, 98%)" : undefined,
                      }}
                    >
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{ind.id}</span>
                        <span>{ind.name}</span>
                      </td>
                      <td className="text-center px-3 py-2">
                        <span className="font-semibold" style={{ color: WEIGHT_COLORS_SCORING[w] }}>
                          {w} – {WEIGHT_LABELS_SCORING[w]}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2">
                        <span style={{ color: sev1 > 0 ? "hsl(0, 72%, 45%)" : "hsl(142, 55%, 40%)" }}>
                          {sev1} {r1 === "red" ? "⚠️" : r1 === "green" ? "✅" : ""}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2">
                        <span style={{ color: sev2 > 0 ? "hsl(0, 72%, 45%)" : "hsl(142, 55%, 40%)" }}>
                          {sev2} {r2 === "red" ? "⚠️" : r2 === "green" ? "✅" : ""}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2 font-semibold">
                        <span style={{ color: totalSev >= 8 ? "hsl(0, 72%, 45%)" : totalSev > 0 ? "hsl(25, 90%, 45%)" : "hsl(142, 55%, 40%)" }}>
                          {totalSev}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2">
                        <span className="font-mono">{weightedContrib} / {maxContrib}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "hsl(214, 10%, 93%)" }}>
                    <td className="px-3 py-2 font-bold" colSpan={5}>Tổng cộng</td>
                    <td className="text-center px-3 py-2 font-bold">
                      {totalWeightedRisk} / {totalWeightedMax}
                    </td>
                  </tr>
                  <tr style={{ background: "hsl(144, 50%, 8%)", color: "hsl(144, 77%, 50%)" }}>
                    <td className="px-3 py-2 font-bold" colSpan={5}>Điểm rủi ro năm {selectedYear}</td>
                    <td className="text-center px-3 py-2 font-bold text-lg">
                      {compositeScore} / 100
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


function RiskDiagramView({
  result,
  weights,
}: {
  result: AnalysisResult;
  weights: Record<string, number>;
}) {
  const { target } = result;
  const allYears = target.years;
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<"both" | "rr1only" | "rr2only" | "all">("all");

  const DIAGRAM_GROUPS = [
    "CRITICAL RED LINES",
    "DOANH THU - LỢI NBUẬN - THUế",
    "RỦI RO NỢ THUế - HÓA ĐƠN",
    "VẬN HÀNH - HIỆU QUẢ",
  ];

  function toggleGroup(group: string) {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  // Build base indicator list from first year
  const baseIndicators = useMemo(() => {
    const firstYear = allYears[0];
    if (!firstYear) return [];
    return target.indicators[firstYear] || [];
  }, [target, allYears]);

  // Build diagram data: Probability x Impact
  const diagramData = useMemo(() => {
    const n = allYears.length;
    return baseIndicators
      .filter((ind) => !hiddenIds.has(ind.id) && !hiddenGroups.has(ind.group))
      .map((ind) => {
        const w = weights[ind.id] ?? 5;

        // Calculate probability: recency-weighted frequency of risk across years
        let probNumerator = 0;
        let probDenominator = 0;
        let hasRR1 = false;
        let hasRR2 = false;

        allYears.forEach((year, idx) => {
          const recencyW = n - idx; // newest year = n, oldest = 1
          probDenominator += recencyW;
          const yearInd = (target.indicators[year] || []).find((i) => i.id === ind.id);
          if (!yearInd) return;
          const r1 = (yearInd as any).risk_level_1 || yearInd.risk_level || "gray";
          const r2 = (yearInd as any).risk_level_2 || "gray";
          const isRisky = r1 === "red" || r2 === "red" ? 1 : 0;
          if (r1 === "red") hasRR1 = true;
          if (r2 === "red") hasRR2 = true;
          probNumerator += isRisky * recencyW;
        });

        const probability = probDenominator > 0 ? probNumerator / probDenominator : 0;

        // Impact: (sev1 + sev2) * weight / (10 * 10)
        const latestInd = (target.indicators[allYears[0]] || []).find((i) => i.id === ind.id) || ind;
        const r1Latest = (latestInd as any).risk_level_1 || latestInd.risk_level || "gray";
        const r2Latest = (latestInd as any).risk_level_2 || "gray";
        const sev1 = calcRiskSeverity(r1Latest, latestInd.company_value, (latestInd as any).industry_median, (latestInd as any).industry_p_low, (latestInd as any).industry_p_high);
        const sev2 = calcRiskSeverity(r2Latest, latestInd.company_value, (latestInd as any).industry_median, (latestInd as any).industry_p_low, (latestInd as any).industry_p_high);
        const impact = (sev1 + sev2) * w / (10 * 10);

        // Z: bubble size = weight importance (1-10)
        const z = w * 50;

        // Color: orange = only RR1, dark/black = only RR2, red = both
        let color = "hsl(142, 55%, 45%)";
        if (hasRR1 && hasRR2) color = "hsl(0, 72%, 48%)";
        else if (hasRR1 && !hasRR2) color = "hsl(25, 90%, 50%)";
        else if (!hasRR1 && hasRR2) color = "hsl(215, 20%, 20%)";

        return {
          id: ind.id,
          name: ind.name,
          x: probability,
          y: impact,
          z,
          risk1: r1Latest,
          risk2: r2Latest,
          value: latestInd.company_value,
          weight: w,
          color,
          hasRR1,
          hasRR2,
          sev1,
          sev2,
          probability,
          impact,
        };
      })
      .filter((d) => {
        // Only show indicators where probability > 0 (has risk in at least one year)
        if (filterMode === "all") return d.probability > 0;
        if (filterMode === "rr1only") return d.hasRR1 && !d.hasRR2;
        if (filterMode === "rr2only") return !d.hasRR1 && d.hasRR2;
        if (filterMode === "both") return d.hasRR1 && d.hasRR2;
        return d.probability > 0;
      });
  }, [baseIndicators, allYears, target, weights, hiddenIds, hiddenGroups, filterMode]);

  const allIndicatorIds = useMemo(() => {
    return baseIndicators.map((i) => ({ id: i.id, name: i.name, group: i.group }));
  }, [baseIndicators]);

  const allGroups = useMemo(() => {
    const groups = Array.from(new Set(baseIndicators.map((i) => i.group)));
    return groups.length > 0 ? groups : DIAGRAM_GROUPS;
  }, [baseIndicators]);

  function toggleHide(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg max-w-[240px]">
        <p className="font-bold text-sm mb-1">{d.id} – {d.name}</p>
        <p>Giá trị: {d.value !== null && d.value !== undefined ? Number(d.value).toFixed(3) : "N/A"}</p>
        <p>Trọng số: {d.weight} – {WEIGHT_LABELS_SCORING[d.weight] || ""}</p>
        <p>Xác suất rủi ro: {(d.probability * 100).toFixed(0)}%</p>
        <p>Mức độ tác động: {(d.impact * 100).toFixed(1)}%</p>
        <p style={{ color: d.risk1 === "red" ? "hsl(0,72%,48%)" : "hsl(142,55%,40%)" }}>
          RR1 (Ngưỡng CQT): {d.risk1 === "red" ? "⚠️ Rủi ro" : d.risk1 === "green" ? "✅ An toàn" : "Không xác định"} (Sev {d.sev1})
        </p>
        <p style={{ color: d.risk2 === "red" ? "hsl(0,72%,48%)" : "hsl(142,55%,40%)" }}>
          RR2 (Phân vị ngành): {d.risk2 === "red" ? "⚠️ Rủi ro" : d.risk2 === "green" ? "✅ An toàn" : "Không xác định"} (Sev {d.sev2})
        </p>
      </div>
    );
  };

  // Custom dot with label
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    const size = Math.sqrt(payload.z) * 1.2;
    return (
      <g>
        <circle cx={cx} cy={cy} r={size / 2} fill={payload.color} fillOpacity={0.75} stroke={payload.color} strokeWidth={1.5} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white" pointerEvents="none">
          {payload.id}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-4" data-testid="risk-diagram-view">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Risk Diagram – {target.company.ma_ck}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chỉ hiển thị các chỉ số có rủi ro trong ít nhất 1 năm. X = Xác suất rủi ro (tần suất, có trọng số gần nhất). Y = Mức độ tác động (mức độ rủi ro × trọng số). Kích thước bong bóng = tầm quan trọng (trọng số 1-10).
          </p>
        </CardHeader>
        <CardContent>
          {/* Filter controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium">Lọc:</label>
              <div className="flex gap-1">
                {([
                  { key: "all", label: "Tất cả có rủi ro" },
                  { key: "rr1only", label: "Chỉ RR1" },
                  { key: "rr2only", label: "Chỉ RR2" },
                  { key: "both", label: "Cả hai" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilterMode(key)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border transition-all"
                    style={{
                      background: filterMode === key ? "hsl(144, 50%, 12%)" : "hsl(214, 10%, 97%)",
                      borderColor: filterMode === key ? "hsl(144, 97%, 27%)" : "hsl(214, 10%, 80%)",
                      color: filterMode === key ? "hsl(144, 77%, 50%)" : "hsl(215, 20%, 50%)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Group toggles */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Nhóm chỉ số:</p>
            <div className="flex flex-wrap gap-2">
              {allGroups.map((group) => {
                const isHidden = hiddenGroups.has(group);
                return (
                  <button
                    key={group}
                    onClick={() => toggleGroup(group)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border transition-all"
                    style={{
                      background: isHidden ? "hsl(214, 10%, 97%)" : "hsl(144, 50%, 12%)",
                      borderColor: isHidden ? "hsl(214, 10%, 80%)" : "hsl(144, 97%, 27%)",
                      color: isHidden ? "hsl(215, 20%, 50%)" : "hsl(144, 77%, 50%)",
                      opacity: isHidden ? 0.6 : 1,
                    }}
                  >
                    {isHidden ? "☐" : "☑"} {group}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color legend */}
          <div className="flex flex-wrap gap-3 mb-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-full" style={{ background: "hsl(25, 90%, 50%)" }} />
              <span>Chỉ có RR1 (vượt ngưỡng CQT)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-full" style={{ background: "hsl(215, 20%, 20%)" }} />
              <span>Chỉ có RR2 (ngoài phân vị ngành)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-full" style={{ background: "hsl(0, 72%, 48%)" }} />
              <span>Có cả RR1 và RR2</span>
            </div>
          </div>

          {/* Chart */}
          {diagramData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Không có chỉ số nào thỏa bộ lọc đã chọn.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 10%, 90%)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 1]}
                  tickCount={6}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  label={{
                    value: "Xác suất rủi ro (Probability)",
                    position: "insideBottom",
                    offset: -20,
                    fontSize: 11,
                    fill: "hsl(215, 20%, 50%)",
                  }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 1]}
                  tickCount={6}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  label={{
                    value: "Mức độ tác động (Impact)",
                    angle: -90,
                    position: "insideLeft",
                    offset: 15,
                    fontSize: 11,
                    fill: "hsl(215, 20%, 50%)",
                  }}
                  tick={{ fontSize: 10 }}
                />
                <ZAxis type="number" dataKey="z" range={[40, 500]} />
                <ReferenceLine x={0.5} stroke="hsl(215, 20%, 60%)" strokeWidth={1.5} strokeDasharray="4 2" />
                <ReferenceLine y={0.5} stroke="hsl(215, 20%, 60%)" strokeWidth={1.5} strokeDasharray="4 2" />
                <RechartsTooltip content={<CustomTooltip />} />
                <Scatter
                  data={diagramData}
                  shape={<CustomDot />}
                >
                  {diagramData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}

          {/* Explanation */}
          <div className="mt-4 rounded-lg p-3 border text-xs space-y-1" style={{ background: "hsl(214, 10%, 97%)", borderColor: "hsl(214, 10%, 85%)" }}>
            <p className="font-semibold text-muted-foreground mb-1">Giải thích:</p>
            <p>• <strong>Probability (trục X):</strong> Tần suất xuất hiện rủi ro trong các năm đã chọn, trọng số cao hơn cho năm gần nhất</p>
            <p>• <strong>Impact (trục Y):</strong> Mức độ tác động = Mức độ rủi ro (0-5) × Trọng số chỉ số / Thang tối đa</p>
            <p>• <strong>Kích thước:</strong> Tầm quan trọng của chỉ số (trọng số 1-10)</p>
            <p>• <span style={{ color: "hsl(25, 90%, 45%)" }}><strong>Màu cam:</strong></span> Chỉ có RR1 (vượt ngưỡng CQT)</p>
            <p>• <span style={{ color: "hsl(215, 20%, 20%)" }}><strong>Màu đen:</strong></span> Chỉ có RR2 (ngoài phân vị ngành)</p>
            <p>• <span style={{ color: "hsl(0, 72%, 48%)" }}><strong>Màu đỏ:</strong></span> Có cả RR1 và RR2</p>
          </div>

          {/* Indicator toggle checkboxes */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Hiển thị chỉ số:</p>
            <div className="flex flex-wrap gap-2">
              {allIndicatorIds.map(({ id, name }) => (
                <label
                  key={id}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenIds.has(id)}
                    onChange={() => toggleHide(id)}
                    className="w-3 h-3"
                  />
                  <span className="text-xs font-mono">{id}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={name}>
                    {name.length > 18 ? name.substring(0, 16) + "…" : name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ========== RISK SCORING EDITOR ========== */
const WEIGHT_FACTORS: Record<number, number> = { 1: 0.1, 2: 0.2, 3: 0.3, 4: 0.4, 5: 0.5, 6: 0.6, 7: 0.7, 8: 0.8, 9: 0.9, 10: 1.0 };
const WEIGHT_LABELS_SCORING: Record<number, string> = {
  10: "Rất cao", 9: "Rất cao", 8: "Cao", 7: "Cao",
  6: "Trung bình", 5: "Trung bình", 4: "Thấp", 3: "Thấp",
  2: "Rất thấp", 1: "Rất thấp",
};
const WEIGHT_COLORS_SCORING: Record<number, string> = {
  1: "hsl(215, 20%, 60%)",
  2: "hsl(215, 20%, 55%)",
  3: "hsl(142, 55%, 40%)",
  4: "hsl(142, 55%, 35%)",
  5: "hsl(45, 90%, 50%)",
  6: "hsl(45, 90%, 45%)",
  7: "hsl(25, 90%, 50%)",
  8: "hsl(25, 90%, 45%)",
  9: "hsl(0, 72%, 48%)",
  10: "hsl(0, 72%, 40%)",
};

const INDICATOR_NAMES_SCORING: Record<string, string> = {
  "0.1": "Chi phí thuế / Doanh thu",
  "0.2": "Biến động LN trước thuế / Doanh thu",
  "0.3": "Biến động doanh thu thuần",
  "1.1": "Thuế suất hiệu quả (ETR)",
  "1.2": "Thuế suất hiệu quả gộp",
  "1.3": "Biến động LN kế toán trước thuế",
  "1.4": "Biến động chi phí thuế hiện hành",
  "1.5": "Biên lợi nhuận gộp",
  "1.6": "Biên lợi nhuận hoạt động",
  "1.7": "Biên lợi nhuận sau thuế",
  "2.1": "Tỷ lệ nợ thuế",
  "2.2": "Biến động thuế đầu vào",
  "2.3": "Doanh thu / Vốn Chủ Sở Hữu",
  "2.4": "Lợi nhuận chưa phân phối / Vốn CSH",
  "2.5": "Nợ phải trả / Vốn Chủ Sở Hữu",
  "2.6": "Modified K Co-efficient",
  "2.7": "Beneish M-Score",
  "3.1": "Tỷ trọng giảm trừ DT / DT thuần",
  "3.2": "Tỷ trọng CP bán hàng / DT thuần",
  "3.3": "Tỷ trọng CP quản lý / DT thuần",
  "3.4": "Lãi vay / EBITDA",
  "3.5": "Số ngày tồn kho",
  "3.6": "Số ngày phải thu",
  "3.7": "Tốc độ tăng DT / Tốc độ tăng Giá vốn",
};

function calcRiskSeverity(
  riskLevel: string,
  companyValue: number | null,
  median: number | null,
  pLow: number | null,
  pHigh: number | null
): number {
  if (riskLevel === "gray" || riskLevel === "green" || companyValue === null) return 0;
  // red
  if (median !== null && pLow !== null && pHigh !== null) {
    const iqr = Math.abs(pHigh - pLow);
    if (iqr === 0) return 3;
    let deviation = 0;
    if (companyValue < pLow) deviation = Math.abs(pLow - companyValue) / iqr;
    else if (companyValue > pHigh) deviation = Math.abs(companyValue - pHigh) / iqr;
    if (deviation <= 0.25) return 1;
    if (deviation <= 0.5) return 2;
    if (deviation <= 1.0) return 3;
    if (deviation <= 2.0) return 4;
    return 5;
  }
  return 3; // default moderate
}

function calcCompositeScore(
  indicators: TiraIndicator[],
  weights: Record<string, number>
): number {
  let totalWeighted = 0;
  let maxWeighted = 0;
  for (const ind of indicators) {
    const w = weights[ind.id] ?? 5;
    const r1 = (ind as any).risk_level_1 || ind.risk_level || "gray";
    const r2 = (ind as any).risk_level_2 || "gray";
    const sev1 = calcRiskSeverity(r1, ind.company_value, (ind as any).industry_median, (ind as any).industry_p_low, (ind as any).industry_p_high);
    const sev2 = calcRiskSeverity(r2, ind.company_value, (ind as any).industry_median, (ind as any).industry_p_low, (ind as any).industry_p_high);
    // Only count indicators that have risk (sev > 0)
    if (sev1 === 0 && sev2 === 0) continue;
    const totalSev = sev1 + sev2; // 0-10
    totalWeighted += totalSev * w;
    maxWeighted += 10 * w;
  }
  return maxWeighted > 0 ? Math.round((totalWeighted / maxWeighted) * 100) : 0;
}

function RiskScoringEditor({
  result,
  weights,
  onWeightsChange,
}: {
  result: AnalysisResult;
  weights: Record<string, number>;
  onWeightsChange: (w: Record<string, number>) => void;
}) {
  const latestYear = result.target.years[0];
  const indicators = result.target.indicators[latestYear] || [];

  const compositeScore = useMemo(
    () => calcCompositeScore(indicators, weights),
    [indicators, weights]
  );

  const scoreColor =
    compositeScore >= 60
      ? "hsl(0, 72%, 48%)"
      : compositeScore >= 35
      ? "hsl(45, 90%, 45%)"
      : "hsl(142, 55%, 40%)";

  const groups = useMemo(() => {
    const map = new Map<string, TiraIndicator[]>();
    for (const ind of indicators) {
      const list = map.get(ind.group) || [];
      list.push(ind);
      map.set(ind.group, list);
    }
    return Array.from(map.entries());
  }, [indicators]);

  function handleWeight(id: string, val: number) {
    onWeightsChange({ ...weights, [id]: val });
  }

  return (
    <Card className="mt-4" data-testid="risk-scoring-editor">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" style={{ color: "hsl(144, 77%, 35%)" }} />
          Điểm rủi ro tổng hợp
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Điều chỉnh trọng số từng chỉ số để tính điểm rủi ro theo mức ưu tiên riêng.
          Mức 10 = quan trọng nhất, Mức 1 = ít quan trọng nhất.
        </p>
      </CardHeader>
      <CardContent>
        {/* Composite score gauge */}
        <div
          className="flex items-center gap-6 p-4 rounded-xl mb-6 border"
          style={{
            background: "hsl(214, 10%, 97%)",
            borderColor: `${scoreColor}40`,
          }}
          data-testid="composite-score-display"
        >
          {/* Circular progress */}
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="hsl(214, 10%, 88%)"
                strokeWidth="8"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - compositeScore / 100)}`}
                style={{ transition: "stroke-dashoffset 0.4s ease" }}
              />
            </svg>
            <div
              className="absolute inset-0 flex items-center justify-center text-xl font-bold"
              style={{ color: scoreColor }}
            >
              {compositeScore}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: scoreColor }}>
              Điểm rủi ro: {compositeScore}/100
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {compositeScore >= 60
                ? "Rủi ro cao – cần kiểm tra ngay"
                : compositeScore >= 35
                ? "Rủi ro trung bình – theo dõi chặt chẽ"
                : "Rủi ro thấp – tương đối an toàn"}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Dựa trên {indicators.length} chỉ số năm {latestYear}
            </p>
          </div>
        </div>

        {/* Per-indicator weight sliders */}
        <div className="space-y-4">
          {groups.map(([groupName, groupInds]) => (
            <div key={groupName}>
              <div
                className="text-[11px] font-bold uppercase tracking-wider px-2 py-1.5 rounded mb-2"
                style={{ background: "hsl(144, 50%, 8%)", color: "hsl(144, 77%, 50%)" }}
              >
                {groupName}
              </div>
              <div className="space-y-2">
                {groupInds.map((ind) => {
                  const w = weights[ind.id] ?? 3;
                  const hasRisk =
                    ind.risk_level_1 === "red" || ind.risk_level_2 === "red";
                  return (
                    <div
                      key={ind.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border"
                      style={{
                        borderColor: hasRisk ? `${WEIGHT_COLORS_SCORING[w]}40` : "hsl(214, 10%, 90%)",
                        background: hasRisk ? `${WEIGHT_COLORS_SCORING[w]}08` : "hsl(214, 10%, 98%)",
                      }}
                      data-testid={`scoring-row-${ind.id}`}
                    >
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] shrink-0 w-10 justify-center"
                      >
                        {ind.id}
                      </Badge>
                      <span
                        className="text-xs flex-1 min-w-0 truncate"
                        title={INDICATOR_NAMES_SCORING[ind.id] || ind.name}
                      >
                        {INDICATOR_NAMES_SCORING[ind.id] || ind.name}
                      </span>
                      {/* Risk badge */}
                      {hasRisk ? (
                        <Badge
                          className="text-[9px] shrink-0"
                          style={{
                            background: "hsl(0, 72%, 92%)",
                            color: "hsl(0, 72%, 40%)",
                            border: "none",
                          }}
                        >
                          Rủi ro
                        </Badge>
                      ) : (
                        <Badge
                          className="text-[9px] shrink-0"
                          style={{
                            background: "hsl(142, 55%, 92%)",
                            color: "hsl(142, 55%, 35%)",
                            border: "none",
                          }}
                        >
                          An toàn
                        </Badge>
                      )}
                      {/* Weight slider */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Slider
                          value={[w]}
                          min={1}
                          max={10}
                          step={1}
                          className="w-24"
                          onValueChange={([val]) => handleWeight(ind.id, val)}
                          data-testid={`scoring-slider-${ind.id}`}
                        />
                        <span
                          className="text-xs font-semibold w-20 text-right"
                          style={{ color: WEIGHT_COLORS_SCORING[w] }}
                        >
                          {WEIGHT_LABELS_SCORING[w]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

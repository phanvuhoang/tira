import { useState, useMemo, useRef, useCallback } from "react";
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
} from "lucide-react";
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
} from "recharts";

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
    const latestYear = result.target.years[0];
    const indicators = result.target.indicators[latestYear] || [];
    const reds = indicators.filter((i) => i.risk_level === "red").length;
    const yellows = indicators.filter((i) => i.risk_level === "yellow").length;
    const greens = indicators.filter((i) => i.risk_level === "green").length;
    const grays = indicators.filter((i) => i.risk_level === "gray").length;
    const total = indicators.length;
    const riskScore = total > 0 ? ((reds * 3 + yellows * 1) / (total * 3)) * 100 : 0;
    // Dual risk counts
    const risk1Reds = indicators.filter((i) => (i.risk_level_1 ?? i.risk_level) === "red").length;
    const risk2Reds = indicators.filter((i) => (i.risk_level_2 ?? i.risk_level) === "red").length;
    return { reds, yellows, greens, grays, total, riskScore, latestYear, risk1Reds, risk2Reds };
  }, [result]);

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
        {/* Export Button */}
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
      </div>

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
                  Điểm rủi ro
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
      </Tabs>
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

  // Chart data: target vs median for each indicator
  const chartData = useMemo(() => {
    return indicators.map((ind) => ({
      id: ind.id,
      name: ind.name.length > 20 ? ind.name.substring(0, 18) + "..." : ind.name,
      fullName: ind.name,
      target: ind.company_value,
      median: medians[ind.id],
      risk: ind.risk_level,
    }));
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
                        style={{ color: "hsl(183, 85%, 30%)" }}
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
                                <span className="heatmap-cell inline-block text-xs font-medium" style={{ backgroundColor: "hsl(183, 85%, 30%, 0.08)", color: "hsl(183, 85%, 30%)" }}>
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

      {/* Per-indicator bar chart: Target vs Median */}
      {hasComparisons && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              So sánh {target.company.ma_ck} vs Trung vị ({latestYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData.filter((d) => d.target !== null && d.median !== null)}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 10%, 85%)" horizontal={false} />
                  <XAxis type="number" fontSize={10} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    fontSize={9}
                    tick={{ fill: "hsl(215, 10%, 45%)" }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 14%, 89%)",
                      fontSize: "12px",
                    }}
                    formatter={(value: any, name: string) => [
                      typeof value === "number" ? value.toFixed(4) : value,
                      name,
                    ]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="target" name={target.company.ma_ck} fill="hsl(183, 85%, 30%)" radius={[0, 2, 2, 0]} barSize={10} />
                  <Bar dataKey="median" name="Trung vị" fill="hsl(25, 90%, 50%)" radius={[0, 2, 2, 0]} barSize={10} />
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
                    stroke="hsl(183, 85%, 30%)"
                    fill="hsl(183, 85%, 30%)"
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
                          "hsl(183, 85%, 30%)",
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
    "hsl(183, 85%, 30%)",
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
                                  Trung vị ngành: <span className="font-medium" style={{ color: "hsl(183, 85%, 30%)" }}>{fmtVal(ind.id, ind.industry_median)}</span>
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
            ở mức "Rủi ro" hoặc "Chú ý", cùng với các gợi ý diễn giải từ hướng dẫn của Deloitte.
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
                          <span>Trung vị: <strong style={{ color: "hsl(183, 85%, 30%)" }}>{fmtVal(ind.id, ind.industry_median)}</strong></span>
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

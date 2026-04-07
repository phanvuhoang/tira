export type Lang = "vi" | "en";

// Simple global language state
let currentLang: Lang = "vi";

export function getLang(): Lang { return currentLang; }
export function setLang(lang: Lang) { currentLang = lang; }

// Simple hook - components that need reactivity should use this with their own state
export function useLang(): [Lang, (lang: Lang) => void] {
  // This is a simple wrapper - for reactivity, consuming components
  // should manage their own re-render triggers
  return [currentLang, (lang: Lang) => { currentLang = lang; }];
}

// Translation dictionary
const translations: Record<string, Record<Lang, string>> = {
  "nav.analysis": { vi: "Phân tích", en: "Analysis" },
  "nav.dashboard": { vi: "Dashboard", en: "Dashboard" },
  "nav.newCompany": { vi: "Công ty mới", en: "New Company" },
  "nav.upload": { vi: "Tải dữ liệu", en: "Upload Data" },
  "nav.history": { vi: "Lịch sử", en: "History" },
  "nav.admin": { vi: "Quản trị", en: "Admin" },
  "home.title": { vi: "Phân tích rủi ro thuế", en: "Tax Risk Analysis" },
  "home.subtitle": { vi: "Chọn công ty niêm yết để phân tích các chỉ số rủi ro TIRA", en: "Select a listed company to analyze TIRA tax risk indicators" },
  "home.search": { vi: "Tìm kiếm công ty", en: "Search company" },
  "home.searchPlaceholder": { vi: "Nhập mã CK hoặc tên công ty...", en: "Enter ticker or company name..." },
  "home.selectedCompany": { vi: "Công ty đã chọn", en: "Selected Company" },
  "home.reportType": { vi: "Loại báo cáo", en: "Report Type" },
  "home.parent": { vi: "Công ty mẹ", en: "Parent" },
  "home.consolidated": { vi: "Hợp nhất", en: "Consolidated" },
  "home.years": { vi: "Năm phân tích", en: "Analysis Years" },
  "home.percentile": { vi: "Cài đặt phân vị", en: "Percentile Settings" },
  "home.percentileLow": { vi: "Phân vị dưới (%)", en: "Lower Percentile (%)" },
  "home.percentileHigh": { vi: "Phân vị trên (%)", en: "Upper Percentile (%)" },
  "home.comparisons": { vi: "Công ty so sánh", en: "Comparison Companies" },
  "home.suggestedComps": { vi: "Đề xuất cùng ngành", en: "Industry Suggestions" },
  "home.aiSuggest": { vi: "AI đề xuất", en: "AI Suggest" },
  "home.aiSuggestions": { vi: "AI đề xuất so sánh", en: "AI Suggested Comparisons" },
  "home.analyze": { vi: "Phân tích TIRA", en: "Run TIRA Analysis" },
  "dash.back": { vi: "Quay lại", en: "Back" },
  "dash.exportPptx": { vi: "Tải báo cáo (PPTX)", en: "Export (PPTX)" },
  "dash.aiReport": { vi: "Tạo báo cáo AI", en: "AI Report" },
  "dash.riskScore": { vi: "Điểm rủi ro (BQ)", en: "Risk Score (Avg)" },
  "tab.heatmap": { vi: "Bảng nhiệt", en: "Heatmap" },
  "tab.charts": { vi: "Biểu đồ", en: "Charts" },
  "tab.comparison": { vi: "So sánh", en: "Comparison" },
  "tab.detail": { vi: "Chi tiết", en: "Detail" },
  "tab.analysis": { vi: "Phân tích", en: "Analysis" },
  "tab.riskHeatmap": { vi: "Biểu đồ nhiệt", en: "Risk Heatmap" },
  "tab.riskDiagram": { vi: "Risk Diagram", en: "Risk Diagram" },
  "tab.scoring": { vi: "Tính điểm RR", en: "Risk Scoring" },
  "tab.financials": { vi: "Báo cáo TC", en: "Financials" },
  "tab.fsAnalysis": { vi: "Phân tích BCTC", en: "FS Analysis" },
  "common.year": { vi: "Năm", en: "Year" },
  "common.all": { vi: "Tất cả", en: "All" },
  "common.risk": { vi: "Rủi ro", en: "Risk" },
  "common.safe": { vi: "An toàn", en: "Safe" },
  "common.median": { vi: "Trung vị", en: "Median" },
  "common.weight": { vi: "Trọng số", en: "Weight" },
  "common.indicator": { vi: "Chỉ số", en: "Indicator" },
  "common.value": { vi: "Giá trị", en: "Value" },
  "common.company": { vi: "Công ty", en: "Company" },
  "common.login": { vi: "Đăng nhập", en: "Login" },
  "common.register": { vi: "Đăng ký", en: "Register" },
  "common.logout": { vi: "Đăng xuất", en: "Logout" },
};

export function t(key: string): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[currentLang] || entry["vi"] || key;
}

export const FS_LABELS: Record<string, Record<Lang, string>> = {
  "210": { vi: "Doanh thu thuần", en: "Net Revenue" },
  "211": { vi: "Giá vốn hàng bán", en: "COGS" },
  "220": { vi: "Lợi nhuận gộp", en: "Gross Profit" },
  "221": { vi: "Doanh thu tài chính", en: "Financial Revenue" },
  "222": { vi: "Chi phí tài chính", en: "Financial Expenses" },
  "223": { vi: "Chi phí lãi vay", en: "Interest Expense" },
  "225": { vi: "Chi phí bán hàng", en: "Selling Expenses" },
  "226": { vi: "Chi phí QLDN", en: "Admin Expenses" },
  "230": { vi: "LN thuần từ HĐKD", en: "Operating Profit" },
  "250": { vi: "LNKT trước thuế", en: "Profit Before Tax" },
  "251": { vi: "CP thuế TNDN hiện hành", en: "Current Income Tax" },
  "252": { vi: "CP thuế TNDN hoãn lại", en: "Deferred Income Tax" },
  "260": { vi: "Lợi nhuận sau thuế", en: "Net Profit" },
  "21": { vi: "Doanh thu bán hàng và CCDV", en: "Gross Revenue" },
  "22": { vi: "Các khoản giảm trừ DT", en: "Revenue Deductions" },
  "1100": { vi: "Tài sản ngắn hạn", en: "Current Assets" },
  "1140": { vi: "Hàng tồn kho", en: "Inventory" },
  "1131": { vi: "Phải thu KH ngắn hạn", en: "Accounts Receivable" },
  "1152": { vi: "Thuế GTGT được khấu trừ", en: "VAT Deductible" },
  "1200": { vi: "Tài sản dài hạn", en: "Non-current Assets" },
  "1270": { vi: "Tổng tài sản", en: "Total Assets" },
  "1300": { vi: "Nợ phải trả", en: "Total Liabilities" },
  "1310": { vi: "Nợ ngắn hạn", en: "Current Liabilities" },
  "1313": { vi: "Thuế phải nộp NN", en: "Tax Payable" },
  "1330": { vi: "Nợ dài hạn", en: "Long-term Debt" },
  "1400": { vi: "Vốn chủ sở hữu", en: "Equity" },
  "1411": { vi: "Vốn góp CSH", en: "Paid-in Capital" },
  "1418": { vi: "LN chưa phân phối", en: "Retained Earnings" },
};

export const IS_KEYS = ["21", "22", "210", "211", "220", "221", "222", "223", "225", "226", "230", "250", "251", "252", "260"];
export const BS_KEYS = ["1100", "1131", "1140", "1152", "1200", "1270", "1300", "1310", "1313", "1330", "1400", "1411", "1418"];

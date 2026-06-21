# BRIEF: Export Interactive HTML Reports

## Tổng quan

Bổ sung tính năng **Export báo cáo ra file HTML tương tác** (self-contained) cho TIRA. Hiện tại app chỉ export PPTX và Word — người dùng cần một file HTML duy nhất có thể mở bằng browser, chứa đầy đủ dữ liệu phân tích, biểu đồ tương tác, và báo cáo AI với diagram minh họa.

---

## Yêu cầu chức năng

### 1. Export Dashboard Phân tích → Interactive HTML
- **Dữ liệu đầu vào:** Kết quả từ `POST /api/analyze` (target indicators + comparisons)
- **Nội dung HTML gồm các tab:**
  - 📊 **Tổng quan** — Company info, composite risk score, summary stats
  - 🔥 **Bảng nhiệt** (Heatmap) — Multi-year indicator table với màu RR1/RR2
  - ⚠️ **Biểu đồ nhiệt rủi ro** (Risk Heatmap) — Deviation heatmap
  - 📋 **So sánh** (Comparison) — Side-by-side với peer companies
  - 📈 **Biểu đồ** (Charts) — Revenue trend, ratio charts (Chart.js)
  - 🤖 **Báo cáo AI** — Nội dung AI report nếu có

### 2. Export Báo cáo AI → HTML có Diagram
- **Dữ liệu đầu vào:** Nội dung HTML từ `POST /api/generate-report` + chart data từ `POST /api/report-charts`
- Layout báo cáo chuyên nghiệp, có header TIRA branding
- Biểu đồ SVG/Chart.js nhúng vào giữa nội dung báo cáo
- Print-friendly CSS (@media print)

### 3. Yêu cầu kỹ thuật
- **Self-contained:** 1 file `.html` duy nhất, không cần server
- **Chart.js:** Load từ CDN (`https://cdn.jsdelivr.net/npm/chart.js`)
- **CSS:** Inline trong `<style>`, dùng CSS variables cho theme
- **JS:** Vanilla JS (không React), tất cả inline trong `<script>`
- **Data:** Nhúng dưới dạng JSON trong `<script type="application/json">`
- **Responsive:** Hoạt động trên desktop + tablet
- **Print:** CSS print stylesheet để in đẹp

---

## Thiết kế kỹ thuật

### Backend: 2 endpoints mới

#### `POST /api/export/html`
Tạo HTML dashboard từ kết quả phân tích.

**Input:**
```json
{
  "ticker": "VNM",
  "report_type": "Parent",
  "years": ["2024", "2023", "2022"],
  "percentile_low": 25,
  "percentile_high": 75,
  "comparisons": ["VNM", "MCM"],
  "include_ai_report": true,
  "ai_report_html": "<h2>...</h2>...",
  "chart_data": { "charts": [...] }
}
```

**Output:** `text/html` — file HTML hoàn chỉnh, response header `Content-Disposition: attachment; filename="TIRA_VNM_2024.html"`

**Logic:**
1. Server gọi `runAnalysis()` (hàm có sẵn) để lấy indicator data
2. Build HTML template với tất cả data nhúng JSON
3. Tabs navigation dùng vanilla JS
4. Bảng dùng `<table>` với sort capability (click header → sort)
5. Biểu đồ dùng Chart.js, khởi tạo từ data JSON khi page load

#### `POST /api/export/html-report`
Tạo HTML báo cáo AI (đơn giản hơn — chỉ 1 tab).

**Input:**
```json
{
  "ticker": "VNM",
  "company_name": "Vinamilk",
  "report_html": "<h2>1. Tóm tắt...</h2>...",
  "chart_data": { "charts": [...] }
}
```

**Output:** `text/html` — file HTML hoàn chỉnh

### Frontend: Nút Export HTML

#### Vị trí: Dashboard page (`client/src/pages/dashboard.tsx`)
- Thêm nút **"Export HTML"** cạnh nút Export PPTX/Word hiện tại
- Icon: `FileCode` (lucide-react)
- Dialog cho phép chọn:
  - ☑ Bao gồm báo cáo AI (nếu đã generate)
  - ☑ Bao gồm biểu đồ

#### Vị trí: Deep Company page (`client/src/pages/deep-company.tsx`)
- Thêm nút **"Export HTML"** trong tab "Báo cáo AI"
- Xuất report kèm indicator table

### HTML Template Structure

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TIRA Report — VNM (2022–2024)</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>/* all CSS inline */</style>
</head>
<body>
  <header class="tira-header">...</header>
  
  <nav class="tabs">
    <button class="tab active" data-tab="overview">Tổng quan</button>
    <button class="tab" data-tab="heatmap">Bảng nhiệt</button>
    <button class="tab" data-tab="risk-heatmap">Biểu đồ nhiệt</button>
    <button class="tab" data-tab="comparison">So sánh</button>
    <button class="tab" data-tab="charts">Biểu đồ</button>
    <button class="tab" data-tab="ai-report">Báo cáo AI</button>
  </nav>
  
  <main>
    <section id="tab-overview" class="tab-content active">...</section>
    <section id="tab-heatmap" class="tab-content">...</section>
    <!-- etc -->
  </main>
  
  <script type="application/json" id="tira-data">
    { /* all analysis data */ }
  </script>
  <script>
    // Vanilla JS: tab switching, table sorting, chart rendering
  </script>
</body>
</html>
```

### CSS / Design System

Theme kế thừa từ TIRA app (màu `#028a39`):
```css
:root {
  --tira-green: #028a39;
  --tira-dark: #1A2332;
  --risk-red: #dc2626;
  --risk-yellow: #eab308;
  --risk-green: #16a34a;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --text: #1e293b;
  --text-muted: #64748b;
  --border: #e2e8f0;
}
```

### Tính năng tương tác (Vanilla JS)

1. **Tab switching:** Click tab → ẩn/hiện section tương ứng
2. **Table sorting:** Click header → sort ascending/descending (có indicator ▲▼)
3. **Tooltip:** Hover vào cell heatmap → hiện tooltip chi tiết (value, RR1, RR2, median)
4. **Chart.js charts:**
   - Bar chart: Revenue/Profit/Tax trend
   - Line chart: Gross margin, Net margin, ETR
   - Radar chart: Risk indicators profile
5. **Print button:** Ẩn tabs nav, hiển thị tất cả sections
6. **Back to top:** Nút floating

---

## File cần tạo mới

```
server/
  export-html.ts          ← HTML template builder (hàm buildHtmlReport, buildHtmlAiReport)

client/src/
  components/
    ExportHtmlDialog.tsx   ← Dialog chọn options export
```

## File cần sửa

```
server/
  routes.ts               ← Thêm 2 endpoints: POST /api/export/html, POST /api/export/html-report
  index.ts                ← Import export-html.ts (nếu cần)

client/src/
  pages/
    dashboard.tsx          ← Thêm nút "Export HTML" + dialog
    deep-company.tsx       ← Thêm nút "Export HTML" 
  lib/
    i18n.ts                ← Thêm key: exportHtml, exportHtmlDesc
```

---

## Code mẫu: `server/export-html.ts`

```typescript
// ── HTML Template Builder cho TIRA Export ──

interface ExportOptions {
  ticker: string;
  companyName: string;
  reportType: string;
  years: string[];
  analysisData: any;        // kết quả từ runAnalysis()
  chartData?: any;          // từ /api/report-charts
  aiReportHtml?: string;    // từ /api/generate-report
  percentileLow: number;
  percentileHigh: number;
}

export function buildHtmlReport(opts: ExportOptions): string {
  const dataJson = JSON.stringify({
    ticker: opts.ticker,
    companyName: opts.companyName,
    years: opts.years,
    analysis: opts.analysisData,
    charts: opts.chartData?.charts || [],
    aiReport: opts.aiReportHtml || null,
    pLow: opts.percentileLow,
    pHigh: opts.percentileHigh,
  });

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TIRA Report — ${opts.ticker} (${opts.years.join('–')})</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>${getStyles()}</style>
</head>
<body>
  ${getHeader(opts)}
  ${getTabNav(opts)}
  <main>
    ${getOverviewTab(opts)}
    ${getHeatmapTab(opts)}
    ${getRiskHeatmapTab(opts)}
    ${getComparisonTab(opts)}
    ${getChartsTab(opts)}
    ${opts.aiReportHtml ? getAiReportTab(opts) : ''}
  </main>
  <button class="btn-print" onclick="window.print()" title="In báo cáo">🖨️</button>
  <button class="btn-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Lên đầu">⬆️</button>
  <script type="application/json" id="tira-data">${dataJson}</script>
  <script>${getClientJs()}</script>
</body>
</html>`;
}
```

---

## Code mẫu: Endpoint trong `server/routes.ts`

```typescript
import { buildHtmlReport, buildHtmlAiReport } from "./export-html";

// POST /api/export/html — Export dashboard ra interactive HTML
app.post("/api/export/html", async (req: Request, res: Response) => {
  try {
    const {
      ticker, report_type = "Parent", years = [],
      comparisons = [], percentile_low = 25, percentile_high = 75,
      include_ai_report = false, ai_report_html = "",
      include_charts = true,
    } = req.body;

    if (!ticker) return res.status(400).json({ error: "Missing ticker" });

    // Run analysis (reuse existing logic)
    const analysis = runAnalysis(ticker, report_type, years, comparisons, percentile_low, percentile_high);
    if (!analysis) return res.status(404).json({ error: "Company not found" });

    // Get chart data if requested
    let chartData = null;
    if (include_charts) {
      chartData = getChartData(ticker, report_type, years);
    }

    const html = buildHtmlReport({
      ticker,
      companyName: analysis.company.ten_tv || ticker,
      reportType: report_type,
      years: analysis.selectedYears,
      analysisData: { target: analysis.targetIndicators, comparisons: analysis.compResults },
      chartData,
      aiReportHtml: include_ai_report ? ai_report_html : undefined,
      percentileLow: percentile_low,
      percentileHigh: percentile_high,
    });

    const filename = `TIRA_${ticker}_${report_type}_${new Date().toISOString().slice(0,10)}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/export/html-report — Export AI report ra HTML
app.post("/api/export/html-report", async (req: Request, res: Response) => {
  try {
    const { ticker, company_name, report_html, chart_data } = req.body;
    if (!ticker || !report_html) return res.status(400).json({ error: "Missing data" });

    const html = buildHtmlAiReport({ ticker, companyName: company_name || ticker, reportHtml: report_html, chartData: chart_data });
    const filename = `TIRA_AI_Report_${ticker}_${new Date().toISOString().slice(0,10)}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## Code mẫu: Nút Export trong Dashboard (`dashboard.tsx`)

Thêm vào sau các nút export hiện tại (~line 1317):

```tsx
// State cho export dialog
const [showExportHtml, setShowExportHtml] = useState(false);
const [exportIncludeAi, setExportIncludeAi] = useState(!!aiReportContent);
const [exportIncludeCharts, setExportIncludeCharts] = useState(true);

// Handler
async function handleExportHtml() {
  const res = await apiRequest("/api/export/html", {
    method: "POST",
    body: JSON.stringify({
      ticker,
      report_type: reportType,
      years: selectedYears,
      comparisons: comparisons.map(c => c.ma_ck),
      percentile_low: percentileLow,
      percentile_high: percentileHigh,
      include_ai_report: exportIncludeAi && !!aiReportContent,
      ai_report_html: exportIncludeAi ? aiReportContent : "",
      include_charts: exportIncludeCharts,
    }),
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TIRA_${ticker}_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
```

```tsx
{/* Nút Export HTML */}
<Button variant="outline" size="sm" onClick={() => setShowExportHtml(true)}>
  <FileCode className="h-4 w-4 mr-1" /> HTML
</Button>

{/* Dialog */}
<Dialog open={showExportHtml} onOpenChange={setShowExportHtml}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Export Interactive HTML</DialogTitle>
      <DialogDescription>
        Tải về file HTML tương tác để xem trên browser
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-3 py-4">
      <label className="flex items-center gap-2">
        <Checkbox checked={exportIncludeAi} onCheckedChange={(v) => setExportIncludeAi(!!v)} disabled={!aiReportContent} />
        Bao gồm báo cáo AI
      </label>
      <label className="flex items-center gap-2">
        <Checkbox checked={exportIncludeCharts} onCheckedChange={(v) => setExportIncludeCharts(!!v)} />
        Bao gồm biểu đồ tương tác
      </label>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowExportHtml(false)}>Huỷ</Button>
      <Button onClick={handleExportHtml}>
        <Download className="h-4 w-4 mr-1" /> Tải HTML
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Checklist cho Claude Code

- [ ] Tạo `server/export-html.ts` — HTML template builder
  - [ ] `buildHtmlReport()` — full dashboard HTML
  - [ ] `buildHtmlAiReport()` — AI report HTML
  - [ ] `getStyles()` — CSS inline
  - [ ] `getClientJs()` — vanilla JS cho tabs, sort, charts, tooltips
  - [ ] Helper functions: `getHeader()`, `getTabNav()`, `getOverviewTab()`, `getHeatmapTab()`, `getRiskHeatmapTab()`, `getComparisonTab()`, `getChartsTab()`, `getAiReportTab()`
- [ ] Sửa `server/routes.ts` — thêm 2 endpoints
- [ ] Sửa `client/src/pages/dashboard.tsx` — thêm nút Export HTML
- [ ] Sửa `client/src/pages/deep-company.tsx` — thêm nút Export HTML 
- [ ] Sửa `client/src/lib/i18n.ts` — thêm i18n keys
- [ ] Test: export file → mở bằng browser → verify tất cả tabs hoạt động
- [ ] Verify: CSS print stylesheet hoạt động
- [ ] Verify: Chart.js charts render đúng
- [ ] Verify: file tự chứa (self-contained), không gọi API ngoài trừ Chart.js CDN

---

## Lưu ý quan trọng ⚠️

1. **Không xoá/sửa logic cũ** — tất cả thay đổi là additive. Export PPTX/Word vẫn hoạt động bình thường.
2. **Không thêm npm dependencies mới** — dùng Chart.js CDN trong HTML output.
3. **File HTML phải self-contained** — tất cả CSS/JS/data trong 1 file, chỉ Chart.js load từ CDN.
4. **Giữ nguyên coding style** của dự án (TypeScript strict, React functional components, shadcn/ui).
5. **Dùng `runAnalysis()` có sẵn** trong `routes.ts` — không viết lại logic phân tích.
6. **Theme màu `#028a39`** (TIRA green) — đồng nhất với app.
7. **Bảng nhiệt cell màu:** green=`#16a34a`, yellow=`#eab308`, red=`#dc2626`, gray=`#94a3b8`.
8. **Sau khi hoàn thành:** push lên GitHub, commit message: `feat: export interactive HTML reports`.

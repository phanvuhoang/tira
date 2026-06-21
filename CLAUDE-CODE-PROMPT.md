# CLAUDE CODE PROMPT — TIRA: Export Interactive HTML Reports

Đọc file `BRIEF-export-interactive-html.md` trong repo này trước khi làm.

Tóm tắt công việc:

## Việc cần làm

### 1. Tạo file mới: `server/export-html.ts`
- `buildHtmlReport(opts)` — tạo HTML self-contained dashboard (6 tabs: Tổng quan, Bảng nhiệt, Biểu đồ nhiệt, So sánh, Biểu đồ Chart.js, Báo cáo AI)
- `buildHtmlAiReport(opts)` — tạo HTML báo cáo AI có diagram
- Tất cả CSS inline (theme #028a39), JS vanilla, Chart.js CDN
- Data nhúng dạng `<script type="application/json">`

### 2. Sửa `server/routes.ts` — thêm 2 endpoints:
- `POST /api/export/html` — nhận ticker, years, comparisons, chart_data, ai_report_html → gọi `runAnalysis()` có sẵn → trả HTML
- `POST /api/export/html-report` — nhận report_html, chart_data → trả HTML báo cáo AI

### 3. Sửa `client/src/pages/dashboard.tsx`
- Thêm nút "Export HTML" cạnh export PPTX/Word
- Dialog cho phép chọn: ☑ bao gồm AI report, ☑ bao gồm biểu đồ
- Icon: `FileCode` (lucide-react)

### 4. Sửa `client/src/pages/deep-company.tsx`
- Thêm nút "Export HTML" trong tab Báo cáo AI

### 5. Sửa `client/src/lib/i18n.ts` — thêm keys: exportHtml, exportHtmlDesc

## Yêu cầu quan trọng
- **Additive only** — không sửa/xoá logic cũ (PPTX/Word vẫn chạy)
- **Không thêm npm packages** — Chart.js dùng CDN
- **Self-contained HTML** — 1 file .html mở bằng browser là chạy, không cần server
- **Giữ coding style** dự án (TypeScript, shadcn/ui, React functional components)
- **Chart.js v4.4** CDN: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`
- **Màu theme:** `#028a39` (TIRA green), risk red `#dc2626`, risk yellow `#eab308`

Sau khi xong: commit với message `feat: export interactive HTML reports` rồi push.

# TIRA Changelog

## v5.0 - Module "Phân tích sâu Cty" (2026-05-11)

### Tính năng mới (additive — không ảnh hưởng module hiện có)

#### Module "Phân tích sâu Cty" — phân tích một công ty đơn lẻ
- **39 chỉ số rủi ro thuế (R01–R39)** tái hiện đúng logic file Excel "Tong-hop-rui-ro.xlsx" của Cục thuế:
  - **R01–R12**: Đối chiếu GTGT / TNDN / BCTC (chênh lệch tier 1)
  - **R13–R22**: Tờ khai TNDN (giá trị tuyệt đối tier 0)
  - **R23–R33**: Bảng cân đối kế toán
  - **R34–R38**: Lưu chuyển tiền tệ
  - **R39**: Ý kiến kiểm toán có ngoại trừ (boolean tier 2)
- **Mô hình Beneish M-Score**: 8 component (DSRI/GMI/AQI/SGI/DEPI/SGAI/TATA/LVGI), so sánh năm nay vs năm trước, cảnh báo khi M > -2.22.
- **Risk scoring engine**: điểm tổng hợp (composite 0–100), điểm theo nhóm, phát hiện mâu thuẫn dữ liệu.
- **Excel template**: tải về file mẫu, điền số liệu, upload trở lại → backend tự đọc theo mã trường.
- **Báo cáo AI single-company**: prompt nghiêm ngặt "không bịa số" — AI chỉ được dùng số đã tính, nếu thiếu dữ liệu phải nói rõ; KHÔNG so sánh ngành / KHÔNG benchmark / KHÔNG peer comparison.
- **Lưu trữ**: lịch sử phân tích được lưu vào `data/deep_company_analyses.json`.

### API endpoints mới (không xóa/sửa endpoint cũ)
- `GET  /api/deep-company/template` — tải Excel mẫu
- `POST /api/deep-company/upload`   — upload Excel đã điền
- `POST /api/deep-company/analyze`  — chạy 39 chỉ số + Beneish + scoring
- `POST /api/deep-company/report`   — tạo báo cáo AI
- `POST /api/deep-company/save`     — lưu phân tích
- `GET  /api/deep-company/list`     — danh sách đã lưu
- `GET  /api/deep-company/:id`      — chi tiết 1 phân tích

### File mới (additive)
- `server/deep-company/types.ts`        — schema input + output
- `server/deep-company/indicators.ts`   — 39 chỉ số + Beneish (đúng công thức file gốc)
- `server/deep-company/risk-scoring.ts` — tính điểm + phát hiện conflict
- `server/deep-company/ai-report.ts`    — build prompt cho AI
- `server/deep-company/template.ts`     — sinh + parse Excel template
- `server/deep-company/routes.ts`       — đăng ký 7 endpoints
- `client/src/pages/deep-company.tsx`   — UI 4 tab (Input/Kết quả/Beneish/Báo cáo AI)

### Thay đổi nhỏ (không phá vỡ BC)
- `server/routes.ts`: thêm 1 dòng `registerDeepCompanyRoutes(app, generateReportText)`.
- `client/src/App.tsx`: thêm route `/deep-company` vào sidebar.
- `client/src/lib/i18n.ts`: thêm key `nav.deepCompany`.

## v4.0 - AI Report Generation & Advanced Features (2026-04-01)

### Tính năng mới

#### 1. Báo cáo AI tự động
- **Báo cáo phân tích tài chính**: AI tự động phân tích tình hình tài chính, highlight vấn đề và rủi ro
- **Báo cáo rủi ro thuế**: AI phân tích chỉ số TIRA, liên kết các chỉ số, đề xuất hành động
- Hỗ trợ 2 model AI: **Claude Haiku** (Anthropic) và **DeepSeek Reasoner**
- Có thể chọn tạo 1 hoặc cả 2 báo cáo
- Xuất báo cáo ra PPTX
- Cấu hình qua env: `ANTHROPIC_API_KEY` hoặc `DEEPSEEK_API_KEY`

#### 2. Biểu đồ nhiệt rủi ro (Risk Deviation Heatmap)
- Tab mới trên dashboard hiển thị mức độ rủi ro theo cường độ màu sắc
- Kết hợp cả 2 loại rủi ro (RR1 + RR2) thành điểm rủi ro tổng hợp
- Gradient từ xanh (an toàn) → vàng → cam → đỏ (rủi ro cao)
- Tooltip hiển thị chi tiết khi hover

#### 3. Template Excel cho công ty mới
- Download template Excel có sẵn cấu trúc để nhập dữ liệu 5 năm
- Template bao gồm 35+ khoản mục tài chính quan trọng
- Có sheet hướng dẫn nhập liệu
- Upload template → tự động parse và thêm vào hệ thống

#### 4. Lịch sử báo cáo
- Lưu báo cáo AI và phân tích vào hệ thống
- Xem lại, mở rộng nội dung, xóa báo cáo cũ
- Trang "Lịch sử" trên sidebar
- Tự động đặt tên theo ngày tạo và tên công ty

#### 5. Tính năng bổ sung đề xuất
- **Risk Score tổng hợp**: Điểm rủi ro 0-100 kết hợp cả 2 yếu tố rủi ro
- **Liên kết chỉ số chéo**: AI tự động phát hiện mâu thuẫn (VD: DT tăng nhưng ETR giảm)
- **So sánh xu hướng**: Biểu đồ trend cho từng nhóm chỉ số qua các năm

---

## v3.0 - Dual Risk System (2026-03-31)

### Thay đổi lớn
- **Hệ thống 2 loại rủi ro**: RR1 (ngưỡng cố định/CQT) + RR2 (phân vị ngành/IQR)
- **Phân vị tuỳ chỉnh**: Người dùng chọn P25-P75 hoặc bất kỳ khoảng nào
- **Modified K formula**: Cập nhật công thức mới theo v2 PDF
- **ETR threshold**: Thay đổi từ ±3% → dưới 15%
- **Trung vị theo năm**: Hiển thị trung vị ngành cho từng năm
- **Legend dual risk**: Chú thích nền cam (RR1) + chữ đỏ (RR2)

### DevOps
- Docker + PostgreSQL support cho Coolify
- Push lên GitHub: github.com/phanvuhoang/tira

---

## v2.0 - Enhanced Dashboard (2026-03-16)

### Tính năng mới
- Tab "Phân tích" với diễn giải chi tiết từng chỉ số
- Multi-select năm trong So sánh và Chi tiết
- So sánh side-by-side trong Chi tiết
- Trung vị công ty so sánh trong Bảng nhiệt
- Xuất báo cáo PPTX
- Upload dữ liệu mới

---

## v1.0 - Initial Release (2026-03-16)

### Tính năng
- Phân tích 24+ chỉ số TIRA
- Bảng nhiệt, biểu đồ, so sánh, chi tiết
- 1,656 công ty niêm yết
- Nhập công ty tùy chỉnh
- Tải dữ liệu Excel

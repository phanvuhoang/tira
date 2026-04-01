# TIRA Changelog

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

# Hướng dẫn Upload Dữ liệu TIRA

## Tổng quan

App TIRA cho phép cập nhật dữ liệu tài chính bằng cách upload file Excel (.xlsx/.xls) hoặc CSV qua giao diện web (menu "Tải dữ liệu" trên thanh bên trái).

## Cấu trúc file upload

File upload cần tuân thủ đúng cấu trúc của file `raw_data_value.xlsx` gốc. App xử lý **3 sheet chính**:

---

### 1. Sheet `financial_full` (Dữ liệu tài chính Công ty mẹ)

Đây là sheet chứa dữ liệu báo cáo tài chính của các công ty (dạng báo cáo Công ty mẹ / Parent).

**Cấu trúc:**

| Hàng | Cột A (Key) | Cột B | Cột C | Cột D | ... |
|------|-------------|-------|-------|-------|-----|
| 1 | `Key` | `Kiểu thời gian` | `Năm` | `Năm` | ... |
| 2 | `Ngày` | `Ngày` | `2024-12-31` | `2023-12-31` | ... |
| 3 | `Mã CK` | `Mã CK` | `VNM` | `VNM` | ... |
| 4+ | Mã khoản mục (số) | Tên khoản mục | Giá trị | Giá trị | ... |

**Giải thích:**
- **Hàng 1**: Header (cố định)
- **Hàng 2**: Ngày báo cáo dạng `YYYY-12-31` (chỉ lấy 4 ký tự đầu làm năm)
- **Hàng 3**: Mã chứng khoán (VNM, SAB, MCH, ...)
- **Hàng 4 trở đi**: Mỗi hàng là một khoản mục tài chính
  - Cột A: Mã khoản mục (key số: 1100, 1270, 210, 251, ...)
  - Cột B: Tên khoản mục
  - Các cột tiếp theo: Giá trị tài chính (đơn vị: đồng)

**Lưu ý quan trọng:**
- Mỗi cột (từ C trở đi) đại diện cho 1 công ty × 1 năm
- Nhiều năm của cùng 1 công ty sẽ nằm ở các cột liền kề
- Nhiều công ty khác nhau sẽ tiếp tục sang các cột bên phải
- App tự động thêm hậu tố ` - Parent` vào mã CK khi lưu

---

### 2. Sheet `financial_pc` (Dữ liệu tài chính Hợp nhất / Consolidated)

Đây là sheet chứa dữ liệu báo cáo tài chính **hợp nhất** (Consolidated) của các công ty. Cấu trúc **hoàn toàn giống** sheet `financial_full`.

**Cấu trúc:**

| Hàng | Cột A (Key) | Cột B | Cột C | Cột D | ... |
|------|-------------|-------|-------|-------|-----|
| 1 | `Key` | `Kiểu thời gian` | `Năm` | `Năm` | ... |
| 2 | `Ngày` | `Ngày` | `2024-12-31` | `2023-12-31` | ... |
| 3 | `Mã CK` | `Mã CK` | `VNM` | `VNM` | ... |
| 4+ | Mã khoản mục (số) | Tên khoản mục | Giá trị | Giá trị | ... |

**Lưu ý:**
- Cấu trúc hàng và cột giống hệt `financial_full`
- App tự động thêm hậu tố ` - Consolidated` vào mã CK khi lưu
- Khi phân tích, chọn loại báo cáo "Consolidated" để dùng dữ liệu từ sheet này

---

### Các mã khoản mục quan trọng (Key)

| Key | Tên khoản mục | Loại |
|-----|---------------|------|
| 1100 | Tài sản ngắn hạn | Bảng CĐKT |
| 1130 | Các khoản phải thu ngắn hạn | Bảng CĐKT |
| 1131 | Phải thu ngắn hạn của khách hàng | Bảng CĐKT |
| 1140 | Hàng tồn kho | Bảng CĐKT |
| 1152 | Thuế GTGT được khấu trừ | Bảng CĐKT |
| 1200 | Tài sản dài hạn | Bảng CĐKT |
| 1220 | Tài sản cố định | Bảng CĐKT |
| 1221 | TSCĐ hữu hình | Bảng CĐKT |
| 1222 | Nguyên giá TSCĐ hữu hình | Bảng CĐKT |
| 1223 | Hao mòn lũy kế TSCĐ hữu hình | Bảng CĐKT |
| 1270 | Tổng tài sản | Bảng CĐKT |
| 1300 | Nợ phải trả | Bảng CĐKT |
| 1310 | Nợ ngắn hạn | Bảng CĐKT |
| 1313 | Thuế và các khoản phải nộp NN | Bảng CĐKT |
| 1330 | Nợ dài hạn | Bảng CĐKT |
| 1400 | Vốn chủ sở hữu | Bảng CĐKT |
| 1410 | Vốn chủ sở hữu (chi tiết) | Bảng CĐKT |
| 1411 | Vốn góp của chủ sở hữu | Bảng CĐKT |
| 1418 | Lợi nhuận sau thuế chưa phân phối | Bảng CĐKT |
| 21 | Doanh thu bán hàng và CCDV | Kết quả KD |
| 22 | Các khoản giảm trừ doanh thu | Kết quả KD |
| 210 | Doanh thu thuần | Kết quả KD |
| 211 | Giá vốn hàng bán | Kết quả KD |
| 220 | Lợi nhuận gộp | Kết quả KD |
| 221 | Doanh thu hoạt động tài chính | Kết quả KD |
| 222 | Chi phí tài chính | Kết quả KD |
| 223 | Chi phí lãi vay | Kết quả KD |
| 225 | Chi phí bán hàng | Kết quả KD |
| 226 | Chi phí quản lý doanh nghiệp | Kết quả KD |
| 230 | Lợi nhuận thuần từ HĐKD | Kết quả KD |
| 250 | LNKT trước thuế | Kết quả KD |
| 251 | Chi phí thuế TNDN hiện hành | Kết quả KD |
| 252 | Chi phí thuế TNDN hoãn lại | Kết quả KD |
| 260 | Lợi nhuận sau thuế | Kết quả KD |
| 5121 | Khấu hao TSCĐ và BĐSĐT | Lưu chuyển tiền |

---

### 3. Sheet `general_data` (Tùy chọn - Thêm công ty mới)

Nếu upload dữ liệu cho công ty mới chưa có trong hệ thống, cần thêm sheet này.

**Cấu trúc:**

| Cột | Tên | Mô tả |
|-----|-----|-------|
| A | Name | Tên đầy đủ (tự tạo) |
| B | Mã CK | Mã chứng khoán (VD: VNM) |
| C | Sàn | HOSE / HNX / UPCOM |
| D | Tên tiếng Việt | Tên công ty tiếng Việt |
| E | Ngành cấp 1 | Ngành cấp 1 |
| F | Ngành cấp 2 | Ngành cấp 2 (dùng cho benchmarking) |
| G | Ngành cấp 3 | Ngành cấp 3 |
| H | Ngành cấp 4 | Ngành cấp 4 |
| I | Loại doanh nghiệp | VD: Phi tài chính |
| J | Vốn điều lệ (đồng) | Số nguyên |

**Lưu ý:** Chỉ thêm công ty mới. Công ty đã có trong hệ thống sẽ bị bỏ qua (không cập nhật).

---

## Quy trình upload

1. Mở app TIRA → Menu bên trái → **Tải dữ liệu**
2. Chọn file `.xlsx` hoặc `.xls` từ máy tính
3. Nhấn **Upload**
4. Hệ thống sẽ thông báo số công ty mới và số dòng dữ liệu đã thêm
5. Quay lại trang **Phân tích** để sử dụng dữ liệu mới

## Lưu ý quan trọng

- Dữ liệu upload được lưu **trong bộ nhớ** (in-memory). Nếu server khởi động lại, dữ liệu upload sẽ mất
- Để dữ liệu lâu dài, hãy cập nhật trực tiếp các file JSON trong thư mục `data/`
- Đảm bảo file upload có đúng tên sheet (`financial_full`, `financial_pc`, `general_data`)
- Có thể upload file chỉ có `financial_full`, chỉ có `financial_pc`, hoặc cả hai cùng lúc
- Giá trị tài chính phải là số (không có dấu phẩy hoặc ký hiệu tiền tệ)
- Năm dữ liệu phải ở dạng ngày `YYYY-12-31` trên hàng 2

## Cập nhật dữ liệu vĩnh viễn (cho admin)

Nếu muốn dữ liệu được lưu vĩnh viễn (không mất khi restart):

1. Chuẩn bị file Excel theo cấu trúc trên
2. Chạy script chuyển đổi sang JSON:
   ```bash
   # Ví dụ: chuyển từ Excel sang JSON
   node -e "
   const XLSX = require('xlsx');
   const fs = require('fs');
   const wb = XLSX.readFile('new_data.xlsx');
   // ... xử lý và merge vào data/data_financial_full.json
   "
   ```
3. Thay thế file JSON trong thư mục `data/`
4. Restart server hoặc rebuild Docker image

## Hỗ trợ dạng CSV

Hiện tại app chỉ hỗ trợ upload file Excel (.xlsx/.xls). Nếu dữ liệu ở dạng CSV:
1. Mở file CSV bằng Excel hoặc LibreOffice
2. Sắp xếp dữ liệu theo cấu trúc sheet `financial_full` như mô tả ở trên
3. Lưu lại dưới dạng `.xlsx`
4. Upload bình thường

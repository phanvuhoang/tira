# TIRA - Tax Index Risk Analysis

Ứng dụng phân tích rủi ro thuế cho các công ty niêm yết tại Việt Nam, dựa trên 24+ chỉ số TIRA.

## Tính năng chính

- **Phân tích rủi ro thuế**: Tính toán 24+ chỉ số TIRA cho bất kỳ công ty niêm yết nào
- **So sánh ngành**: Benchmark với các công ty cùng ngành thông qua phân vị (P35-P65)
- **Dashboard trực quan**: Bảng nhiệt, biểu đồ radar, trend lines, so sánh side-by-side
- **Phân tích chi tiết**: Giải thích ý nghĩa từng chỉ số rủi ro dựa trên hướng dẫn TIRA
- **Công ty tùy chỉnh**: Nhập dữ liệu thủ công cho công ty không niêm yết
- **Upload dữ liệu**: Cập nhật dữ liệu mới bằng file Excel/CSV
- **Xuất báo cáo**: Tải kết quả phân tích dưới dạng PPTX

## Công nghệ

- **Backend**: Express.js + TypeScript
- **Frontend**: React + Tailwind CSS + shadcn/ui + Recharts
- **Data**: In-memory storage, loaded from JSON files

## Cài đặt & Chạy

### Development

```bash
npm install
npm run dev
```

App chạy tại `http://localhost:5000`

### Production (Docker)

```bash
docker build -t tira .
docker run -p 5000:5000 -v ./data:/app/data tira
```

Hoặc dùng docker-compose:

```bash
docker-compose up -d
```

## Deploy trên Coolify

1. Tạo project mới trên Coolify
2. Kết nối GitHub repo `phanvuhoang/tira`
3. Chọn **Docker** build method
4. Cấu hình:
   - **Dockerfile**: `Dockerfile` (mặc định)
   - **Port**: `5000`
   - **Health check path**: `/api/companies/search?q=VNM`
5. Nếu muốn dữ liệu persist qua các lần deploy, mount volume:
   - Source: `/data/tira` (trên VPS)
   - Target: `/app/data`
6. Deploy

### Environment Variables

| Biến | Mô tả | Mặc định |
|------|--------|----------|
| `PORT` | Port server | `5000` |
| `NODE_ENV` | Environment | `production` |

Không cần thêm biến nào khác. App hoạt động hoàn toàn với dữ liệu local trong thư mục `data/`.

## Cập nhật dữ liệu

Xem file [HUONG_DAN_UPLOAD.md](./HUONG_DAN_UPLOAD.md) để biết cách upload dữ liệu mới.

## Cấu trúc dự án

```
tira-app/
├── client/           # React frontend
│   └── src/
│       ├── pages/    # Trang: home, dashboard, upload, custom-company
│       ├── components/
│       └── lib/
├── server/           # Express backend
│   ├── routes.ts     # API endpoints
│   ├── storage.ts    # Data storage
│   └── tira-engine.ts# TIRA calculation engine
├── shared/           # Shared types
├── data/             # JSON data files
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## License

Private - All rights reserved.

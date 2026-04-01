import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
} from "lucide-react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
        toast({
          title: "Lỗi",
          description: "Chỉ hỗ trợ file Excel (.xlsx, .xls)",
          variant: "destructive",
        });
        return;
      }
      setFile(f);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message });
        toast({
          title: "Thành công",
          description: data.message,
        });
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setResult({ success: false, message: data.error || "Lỗi không xác định" });
        toast({
          title: "Lỗi",
          description: data.error || "Lỗi xử lý file",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message });
      toast({
        title: "Lỗi",
        description: "Không thể kết nối đến server",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="pt-8 lg:pt-4">
          <h1 className="text-xl font-bold" data-testid="text-upload-title">
            Tải dữ liệu mới
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload file Excel (.xlsx) có cấu trúc tương tự file dữ liệu gốc
          </p>
        </div>

        {/* Template download */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              Tải template nhập liệu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tải file Excel mẫu để nhập dữ liệu đúng định dạng yêu cầu. File template bao gồm các sheet
              <strong> financial_full</strong> và <strong>general_data</strong> với cấu trúc cột chuẩn.
            </p>
            <a
              href="/api/template/download"
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-download-template"
            >
              <Download className="w-4 h-4" />
              Tải template Excel
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Tải lên file dữ liệu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
              onClick={() => fileRef.current?.click()}
              data-testid="dropzone"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file"
              />
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              {file ? (
                <div>
                  <p className="text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">
                    Nhấn để chọn file hoặc kéo thả vào đây
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hỗ trợ: .xlsx, .xls
                  </p>
                </div>
              )}
            </div>

            {/* Upload button */}
            <Button
              className="w-full"
              disabled={!file || uploading}
              onClick={handleUpload}
              data-testid="button-upload"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Tải lên và xử lý
                </>
              )}
            </Button>

            {/* Result */}
            {result && (
              <div
                className={`flex items-start gap-3 p-4 rounded-lg ${
                  result.success
                    ? "bg-[hsl(142,55%,40%,0.1)] text-[hsl(142,55%,35%)]"
                    : "bg-[hsl(0,72%,48%,0.1)] text-[hsl(0,72%,42%)]"
                }`}
                data-testid="upload-result"
              >
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{result.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Hướng dẫn định dạng file
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>File Excel cần có các sheet sau:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>
                <span className="font-medium text-foreground">financial_full</span>: Dữ liệu tài chính
                công ty mẹ. Hàng 1: tiêu đề, Hàng 2: ngày/năm, Hàng 3: mã CK, Hàng 4+: giá trị
                theo mã chỉ tiêu BCTC.
              </li>
              <li>
                <span className="font-medium text-foreground">general_data</span> (tuỳ chọn): Thông
                tin công ty mới. Cột bao gồm: Mã CK, Name, Tên tiếng Việt, Sàn, Ngành cấp 1-4,
                Loại doanh nghiệp, Vốn điều lệ.
              </li>
            </ul>
            <p>
              Dữ liệu mới sẽ được cộng gộp vào dữ liệu hiện có. Các mã CK đã tồn tại
              sẽ được cập nhật thêm dữ liệu năm mới.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

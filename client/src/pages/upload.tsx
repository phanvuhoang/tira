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
  Building2,
  BarChart3,
  Info,
} from "lucide-react";

// ─── UploadSection ─────────────────────────────────────────────────────────────

interface UploadSectionProps {
  title: string;
  description: string;
  uploadType: "parent" | "consolidated" | "general";
  icon: React.ReactNode;
}

function UploadSection({ title, description, uploadType, icon }: UploadSectionProps) {
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const res = await fetch(`${API_BASE}/api/upload?type=${uploadType}`, {
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-5 sm:p-7 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          data-testid={`dropzone-${uploadType}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            data-testid={`input-file-${uploadType}`}
          />
          <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          {file ? (
            <div>
              <p className="text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">Nhấn để chọn file hoặc kéo thả vào đây</p>
              <p className="text-xs text-muted-foreground mt-0.5">Hỗ trợ: .xlsx, .xls</p>
            </div>
          )}
        </div>

        {/* Upload button */}
        <Button
          className="w-full"
          disabled={!file || uploading}
          onClick={handleUpload}
          data-testid={`button-upload-${uploadType}`}
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
            className={`flex items-start gap-3 p-3 rounded-lg ${
              result.success
                ? "bg-[hsl(142,55%,40%,0.1)] text-[hsl(142,55%,35%)]"
                : "bg-[hsl(0,72%,48%,0.1)] text-[hsl(0,72%,42%)]"
            }`}
            data-testid={`upload-result-${uploadType}`}
          >
            {result.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{result.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── UploadPage ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="pt-8 lg:pt-4">
          <h1 className="text-xl font-bold" data-testid="text-upload-title">
            Tải dữ liệu mới
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload file Excel (.xlsx) cho từng loại dữ liệu. Không cần đặt tên sheet cụ thể — hệ thống sẽ tự nhận diện sheet đầu tiên.
          </p>
        </div>

        {/* Template download */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Download className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">Tải template nhập liệu</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Template Excel mẫu với cấu trúc cột chuẩn
                  </p>
                </div>
              </div>
              <a
                href="/api/template/download"
                download
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto"
                data-testid="btn-download-template"
              >
                <Download className="w-4 h-4" />
                Tải template Excel
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Info notice */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-accent/40 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Mỗi file chỉ cần có <strong className="text-foreground">1 sheet dữ liệu</strong> — hệ thống đọc sheet đầu tiên. Dữ liệu mới sẽ được cộng gộp vào dữ liệu hiện có.
          </span>
        </div>

        {/* 3 Upload sections */}
        <UploadSection
          title="Dữ liệu tài chính – Công ty mẹ"
          description="File Excel chứa dữ liệu BCTC riêng của công ty mẹ. Dùng cho phân tích loại báo cáo 'Công ty mẹ'. Sheet đầu tiên sẽ được dùng làm nguồn dữ liệu."
          uploadType="parent"
          icon={<Building2 className="w-4 h-4 text-primary" />}
        />

        <UploadSection
          title="Dữ liệu tài chính – Hợp nhất"
          description="File Excel chứa dữ liệu BCTC hợp nhất. Dùng cho phân tích loại báo cáo 'Hợp nhất'. Sheet đầu tiên sẽ được dùng làm nguồn dữ liệu."
          uploadType="consolidated"
          icon={<BarChart3 className="w-4 h-4 text-primary" />}
        />

        <UploadSection
          title="Thông tin công ty"
          description="File Excel chứa thông tin công ty (mã CK, tên, ngành, vốn điều lệ). Dùng để thêm công ty mới vào hệ thống."
          uploadType="general"
          icon={<FileSpreadsheet className="w-4 h-4 text-primary" />}
        />
      </div>
    </div>
  );
}

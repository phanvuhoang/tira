import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle,
  Building2,
  Calculator,
  Loader2,
  ArrowRight,
  Trash2,
} from "lucide-react";

interface FinancialEntry {
  year: string;
  data: Record<string, string>;
}

const FINANCIAL_FIELDS = [
  { key: "210", label: "Doanh thu thuần", placeholder: "VND" },
  { key: "211", label: "Giá vốn hàng bán", placeholder: "VND" },
  { key: "220", label: "Lợi nhuận gộp", placeholder: "VND" },
  { key: "250", label: "LNKT trước thuế", placeholder: "VND" },
  { key: "251", label: "CP thuế TNDN hiện hành", placeholder: "VND" },
  { key: "252", label: "CP thuế TNDN hoãn lại", placeholder: "VND" },
  { key: "260", label: "Lợi nhuận sau thuế", placeholder: "VND" },
  { key: "1270", label: "Tổng tài sản", placeholder: "VND" },
  { key: "1300", label: "Nợ phải trả", placeholder: "VND" },
  { key: "1400", label: "Vốn chủ sở hữu", placeholder: "VND" },
  { key: "1313", label: "Thuế phải nộp Nhà nước", placeholder: "VND" },
  { key: "1152", label: "Thuế GTGT được khấu trừ", placeholder: "VND" },
  { key: "225", label: "Chi phí bán hàng", placeholder: "VND" },
  { key: "226", label: "Chi phí QLDN", placeholder: "VND" },
  { key: "223", label: "Chi phí lãi vay", placeholder: "VND" },
  { key: "1140", label: "Hàng tồn kho", placeholder: "VND" },
  { key: "1131", label: "Phải thu KH ngắn hạn", placeholder: "VND" },
  { key: "5121", label: "Khấu hao TSCĐ", placeholder: "VND" },
  { key: "1418", label: "LNST chưa phân phối", placeholder: "VND" },
  { key: "21", label: "Doanh thu bán hàng (tổng)", placeholder: "VND" },
  { key: "22", label: "Các khoản giảm trừ DT", placeholder: "VND" },
];

export default function CustomCompany() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [yearEntries, setYearEntries] = useState<FinancialEntry[]>([
    { year: "2024", data: {} },
    { year: "2023", data: {} },
  ]);

  // Get industries
  const { data: industries } = useQuery<string[]>({
    queryKey: ["/api/industries"],
  });

  const addYear = () => {
    const lastYear = yearEntries.length > 0
      ? parseInt(yearEntries[yearEntries.length - 1].year) - 1
      : 2024;
    setYearEntries((prev) => [...prev, { year: String(lastYear), data: {} }]);
  };

  const removeYear = (index: number) => {
    setYearEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateYearData = (yearIndex: number, key: string, value: string) => {
    setYearEntries((prev) =>
      prev.map((entry, i) =>
        i === yearIndex
          ? { ...entry, data: { ...entry.data, [key]: value } }
          : entry
      )
    );
  };

  const updateYear = (yearIndex: number, year: string) => {
    setYearEntries((prev) =>
      prev.map((entry, i) => (i === yearIndex ? { ...entry, year } : entry))
    );
  };

  const analyseMutation = useMutation({
    mutationFn: async () => {
      // Convert string values to numbers
      const financialData: Record<string, Record<string, number>> = {};
      for (const entry of yearEntries) {
        const yearData: Record<string, number> = {};
        for (const [key, val] of Object.entries(entry.data)) {
          const num = parseFloat(val.replace(/,/g, ""));
          if (!isNaN(num)) {
            yearData[key] = num;
          }
        }
        if (Object.keys(yearData).length > 0) {
          financialData[entry.year] = yearData;
        }
      }

      const res = await apiRequest("POST", "/api/analyze-custom", {
        company_name: companyName,
        nganh_2: selectedIndustry,
        financial_data: financialData,
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Store in session and navigate to dashboard-like view
      // Since we get the result directly, we encode it in state
      const encodedResult = encodeURIComponent(JSON.stringify(data));
      // Store result in a global for the dashboard to read
      (window as any).__customResult = data;
      navigate("/dashboard?custom=true");
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi phân tích",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (!companyName.trim()) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên công ty",
        variant: "destructive",
      });
      return;
    }
    if (!selectedIndustry) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng chọn ngành",
        variant: "destructive",
      });
      return;
    }
    analyseMutation.mutate();
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="pt-8 lg:pt-4">
          <h1 className="text-xl font-bold" data-testid="text-custom-title">
            Phân tích công ty không niêm yết
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nhập thông tin tài chính để phân tích chỉ số rủi ro thuế TIRA
          </p>
        </div>

        {/* Company Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Thông tin công ty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="company-name">Tên công ty</Label>
              <Input
                id="company-name"
                data-testid="input-company-name"
                placeholder="Nhập tên công ty..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Ngành (cấp 2)</Label>
              <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                <SelectTrigger data-testid="select-industry" className="mt-1.5">
                  <SelectValue placeholder="Chọn ngành..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {industries?.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Financial Data by Year */}
        {yearEntries.map((entry, yearIndex) => (
          <Card key={yearIndex}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  Dữ liệu tài chính
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-24 h-8 text-sm"
                    value={entry.year}
                    onChange={(e) => updateYear(yearIndex, e.target.value)}
                    data-testid={`input-year-${yearIndex}`}
                  />
                  {yearEntries.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => removeYear(yearIndex)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FINANCIAL_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <Label className="text-xs min-w-[160px] text-muted-foreground">
                      {field.label} ({field.key})
                    </Label>
                    <Input
                      type="text"
                      className="h-8 text-sm tabular-nums"
                      placeholder={field.placeholder}
                      value={entry.data[field.key] || ""}
                      onChange={(e) =>
                        updateYearData(yearIndex, field.key, e.target.value)
                      }
                      data-testid={`input-field-${yearIndex}-${field.key}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Year */}
        <Button
          variant="outline"
          className="w-full"
          onClick={addYear}
          data-testid="button-add-year"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Thêm năm
        </Button>

        {/* Analyze */}
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleAnalyze}
          disabled={analyseMutation.isPending}
          data-testid="button-analyze-custom"
        >
          {analyseMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Đang phân tích...
            </>
          ) : (
            <>
              <Calculator className="w-5 h-5 mr-2" />
              Phân tích rủi ro thuế
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

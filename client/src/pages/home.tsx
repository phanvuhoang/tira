import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Building2,
  ArrowRight,
  X,
  Plus,
  BarChart3,
  ChevronRight,
} from "lucide-react";

interface Company {
  ma_ck: string;
  ten_tv: string;
  san?: string;
  nganh_2?: string;
  von_dieu_le?: number;
  name?: string;
}

interface CompanyDetails extends Company {
  hasParent: boolean;
  hasConsolidated: boolean;
  availableYears: string[];
}

export default function Home() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [reportType, setReportType] = useState<"Parent" | "Consolidated">("Parent");
  const [comparisonTickers, setComparisonTickers] = useState<Company[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [compSearchQuery, setCompSearchQuery] = useState("");
  const [showCompSearch, setShowCompSearch] = useState(false);
  const [percentileLow, setPercentileLow] = useState(25);
  const [percentileHigh, setPercentileHigh] = useState(75);

  // Search companies
  const { data: searchResults, isLoading: isSearching } = useQuery<Company[]>({
    queryKey: ["/api/companies/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 1) return [];
      const res = await apiRequest("GET", `/api/companies/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length >= 1,
  });

  // Get company details
  const { data: companyDetails, isLoading: isLoadingDetails } = useQuery<CompanyDetails>({
    queryKey: ["/api/companies", selectedCompany?.ma_ck],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/companies/${selectedCompany!.ma_ck}`);
      return res.json();
    },
    enabled: !!selectedCompany,
  });

  // Get comparables
  const { data: comparables } = useQuery<Company[]>({
    queryKey: ["/api/companies", selectedCompany?.ma_ck, "comparables", reportType],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/companies/${selectedCompany!.ma_ck}/comparables?report_type=${reportType}`
      );
      return res.json();
    },
    enabled: !!selectedCompany,
  });

  // Search for comparison companies
  const { data: compSearchResults } = useQuery<Company[]>({
    queryKey: ["/api/companies/search", compSearchQuery, "comp"],
    queryFn: async () => {
      if (!compSearchQuery || compSearchQuery.length < 1) return [];
      const res = await apiRequest("GET", `/api/companies/search?q=${encodeURIComponent(compSearchQuery)}`);
      return res.json();
    },
    enabled: compSearchQuery.length >= 1 && showCompSearch,
  });

  const handleSelectCompany = useCallback((company: Company) => {
    setSelectedCompany(company);
    setSearchQuery("");
    setComparisonTickers([]);
    setSelectedYears([]);
  }, []);

  const handleAddComparison = useCallback(
    (company: Company) => {
      if (
        !comparisonTickers.find((c) => c.ma_ck === company.ma_ck) &&
        company.ma_ck !== selectedCompany?.ma_ck
      ) {
        setComparisonTickers((prev) => [...prev, company]);
      }
      setCompSearchQuery("");
      setShowCompSearch(false);
    },
    [comparisonTickers, selectedCompany]
  );

  const handleRemoveComparison = useCallback((ticker: string) => {
    setComparisonTickers((prev) => prev.filter((c) => c.ma_ck !== ticker));
  }, []);

  const handleAnalyze = () => {
    if (!selectedCompany) return;
    const yrs =
      selectedYears.length > 0
        ? selectedYears
        : companyDetails?.availableYears?.slice(0, 3) || [];
    const qs = new URLSearchParams({
      ticker: selectedCompany.ma_ck,
      report_type: reportType,
      years: yrs.join(","),
      comparisons: comparisonTickers.map((c) => c.ma_ck).join(","),
      p_low: String(percentileLow),
      p_high: String(percentileHigh),
    });
    // With hash routing, embed params in the hash fragment
    window.location.hash = `/dashboard?${qs.toString()}`;
  };

  const toggleYear = (year: string) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="pt-8 lg:pt-4">
          <h1 className="text-xl font-bold" data-testid="text-page-title">
            Phân tích rủi ro thuế
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chọn công ty niêm yết để phân tích các chỉ số rủi ro thuế TIRA
          </p>
        </div>

        {/* Company Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Tìm kiếm công ty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                data-testid="input-company-search"
                placeholder="Nhập mã CK hoặc tên công ty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>

            {/* Search results */}
            {searchQuery && (searchResults?.length || 0) > 0 && (
              <div className="mt-2 border border-border rounded-lg max-h-64 overflow-y-auto divide-y divide-border">
                {searchResults?.map((company) => (
                  <button
                    key={company.ma_ck}
                    data-testid={`search-result-${company.ma_ck}`}
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-center justify-between"
                    onClick={() => handleSelectCompany(company)}
                  >
                    <div>
                      <span className="font-semibold text-sm">{company.ma_ck}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {company.ten_tv}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {company.san && <Badge variant="secondary">{company.san}</Badge>}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && isSearching && (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Company */}
        {selectedCompany && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Công ty đã chọn
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCompany(null);
                      setComparisonTickers([]);
                    }}
                    data-testid="button-clear-company"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDetails ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  companyDetails && (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg">{companyDetails.ma_ck}</h3>
                          <p className="text-sm text-muted-foreground">
                            {companyDetails.ten_tv}
                          </p>
                          {companyDetails.nganh_2 && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {companyDetails.nganh_2}
                            </Badge>
                          )}
                        </div>
                        {companyDetails.san && (
                          <Badge>{companyDetails.san}</Badge>
                        )}
                      </div>

                      {/* Report Type */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Loại báo cáo
                        </label>
                        <Select
                          value={reportType}
                          onValueChange={(v) => setReportType(v as "Parent" | "Consolidated")}
                        >
                          <SelectTrigger data-testid="select-report-type" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {companyDetails.hasParent && (
                              <SelectItem value="Parent">Công ty mẹ</SelectItem>
                            )}
                            {companyDetails.hasConsolidated && (
                              <SelectItem value="Consolidated">Hợp nhất</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Years */}
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Năm phân tích
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {companyDetails.availableYears.map((year) => (
                            <Button
                              key={year}
                              variant={
                                selectedYears.length === 0
                                  ? companyDetails.availableYears.indexOf(year) < 3
                                    ? "default"
                                    : "outline"
                                  : selectedYears.includes(year)
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => toggleYear(year)}
                              data-testid={`button-year-${year}`}
                            >
                              {year}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedYears.length === 0
                            ? "Mặc định: 3 năm gần nhất"
                            : `Đã chọn ${selectedYears.length} năm`}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Percentile Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Cài đặt phân vị
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Phân vị dưới (%)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={49}
                      value={percentileLow}
                      onChange={(e) => setPercentileLow(Number(e.target.value))}
                      data-testid="input-percentile-low"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Phân vị trên (%)
                    </label>
                    <Input
                      type="number"
                      min={51}
                      max={100}
                      value={percentileHigh}
                      onChange={(e) => setPercentileHigh(Number(e.target.value))}
                      data-testid="input-percentile-high"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Khoảng phân vị ngành để so sánh rủi ro tương đối (mặc định P25–P75)
                </p>
              </CardContent>
            </Card>

            {/* Comparison Companies */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Công ty so sánh
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Selected comparisons */}
                {comparisonTickers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {comparisonTickers.map((c) => (
                      <Badge
                        key={c.ma_ck}
                        variant="secondary"
                        className="px-3 py-1.5 text-sm gap-2"
                      >
                        <span className="font-semibold">{c.ma_ck}</span>
                        <span className="text-muted-foreground text-xs truncate max-w-[150px]">
                          {c.ten_tv}
                        </span>
                        <button
                          onClick={() => handleRemoveComparison(c.ma_ck)}
                          data-testid={`button-remove-comp-${c.ma_ck}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Search to add */}
                {showCompSearch ? (
                  <div className="relative">
                    <Input
                      data-testid="input-comp-search"
                      placeholder="Tìm công ty so sánh..."
                      value={compSearchQuery}
                      onChange={(e) => setCompSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {compSearchQuery && compSearchResults && compSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg bg-popover shadow-lg max-h-48 overflow-y-auto z-10 divide-y divide-border">
                        {compSearchResults
                          .filter(
                            (c) =>
                              c.ma_ck !== selectedCompany?.ma_ck &&
                              !comparisonTickers.find((ct) => ct.ma_ck === c.ma_ck)
                          )
                          .map((c) => (
                            <button
                              key={c.ma_ck}
                              className="w-full text-left px-3 py-2 hover:bg-accent/50 text-sm"
                              onClick={() => handleAddComparison(c)}
                              data-testid={`comp-result-${c.ma_ck}`}
                            >
                              <span className="font-semibold">{c.ma_ck}</span>{" "}
                              <span className="text-muted-foreground">{c.ten_tv}</span>
                            </button>
                          ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1"
                      onClick={() => {
                        setShowCompSearch(false);
                        setCompSearchQuery("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompSearch(true)}
                    data-testid="button-add-comparison"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm công ty so sánh
                  </Button>
                )}

                {/* Suggested comparables */}
                {comparables && comparables.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Đề xuất cùng ngành:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {comparables.slice(0, 10).map((c) => (
                        <Button
                          key={c.ma_ck}
                          variant="ghost"
                          size="sm"
                          className="h-auto text-xs px-2 py-1"
                          onClick={() => handleAddComparison(c)}
                          disabled={!!comparisonTickers.find((ct) => ct.ma_ck === c.ma_ck)}
                          data-testid={`suggest-${c.ma_ck}`}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          <span className="font-semibold">{c.ma_ck}</span>
                          <span className="text-muted-foreground ml-1 truncate max-w-[100px]">{c.ten_tv}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analyze Button */}
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleAnalyze}
              data-testid="button-analyze"
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              Phân tích rủi ro thuế
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Clock,
  Building2,
  AlertCircle,
  BarChart2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SavedReport {
  id: number | string;
  name: string;
  ticker: string;
  report_type: string;
  created_at: string;
  content?: string;
}

interface SavedAnalysis {
  id: number | string;
  name: string;
  ticker: string;
  report_type: string;
  years: string[];
  comparisons: string[];
  created_at: string;
  percentile_low?: number;
  percentile_high?: number;
}

export default function ReportHistory() {
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
  const [activeTab, setActiveTab] = useState("reports");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useLocation(); // available for future navigation use

  const { data: reports, isLoading, error } = useQuery<SavedReport[]>({
    queryKey: ["/api/reports"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reports");
      return res.json();
    },
  });

  const { data: analyses, isLoading: analysesLoading, error: analysesError } = useQuery<SavedAnalysis[]>({
    queryKey: ["/api/analyses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/analyses");
      return res.json();
    },
  });

  function openAnalysis(analysis: SavedAnalysis) {
    const yearsStr = (analysis.years || []).join(",");
    const comparisonsStr = (analysis.comparisons || []).join(",");
    const pLow = analysis.percentile_low ?? 25;
    const pHigh = analysis.percentile_high ?? 75;
    const hash = `#/dashboard?ticker=${encodeURIComponent(analysis.ticker)}&report_type=${encodeURIComponent(analysis.report_type)}&years=${encodeURIComponent(yearsStr)}&comparisons=${encodeURIComponent(comparisonsStr)}&p_low=${pLow}&p_high=${pHigh}`;
    window.location.href = hash;
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      const res = await apiRequest("DELETE", `/api/reports/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({
        title: "Đã xóa",
        description: "Báo cáo đã được xóa thành công.",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa báo cáo. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const toggleExpand = (id: number | string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getReportTypeLabel = (type: string) => {
    if (type === "financial") return "Tài chính";
    if (type === "tax") return "Rủi ro thuế";
    if (type === "both" || type === "all") return "Đầy đủ";
    return type;
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="pt-8 lg:pt-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold" data-testid="text-history-title">
                Lịch sử
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Báo cáo AI và phân tích đã lưu
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Báo cáo AI
            </TabsTrigger>
            <TabsTrigger value="analyses" className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" />
              Phân tích đã lưu
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-4 space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Không thể tải danh sách báo cáo. Vui lòng thử lại.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && (!reports || reports.length === 0) && (
          <Card data-testid="history-empty-state">
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-base font-semibold mb-2">Chưa có báo cáo nào</h3>
              <p className="text-sm text-muted-foreground">
                Hãy tạo báo cáo AI từ trang Dashboard để lưu và xem lại ở đây.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && reports && reports.length > 0 && (
          <div className="space-y-3" data-testid="history-list">
            {reports.map((report) => {
              const isExpanded = expandedIds.has(report.id);
              return (
                <Card
                  key={report.id}
                  className="border border-border hover:shadow-md transition-shadow"
                  data-testid={`history-card-${report.id}`}
                >
                  <CardContent className="p-4">
                    {/* Card header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => toggleExpand(report.id)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">
                            {report.name || `Báo cáo ${report.ticker}`}
                          </span>
                          <Badge variant="outline" className="text-xs font-mono">
                            {report.ticker}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {getReportTypeLabel(report.report_type)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(report.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {report.ticker}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(report.id)}
                          className="h-8 w-8 p-0"
                          data-testid={`btn-expand-${report.id}`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(report.id)}
                          disabled={deleteMutation.isPending}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`btn-delete-${report.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && report.content && (
                      <div className="mt-4 border-t border-border/50 pt-4">
                        <div
                          className="prose prose-sm max-w-none text-sm text-foreground/90 overflow-y-auto max-h-[500px] bg-accent/20 rounded-lg p-4"
                          data-testid={`report-content-${report.id}`}
                        >
                          <MarkdownContent content={report.content} />
                        </div>
                      </div>
                    )}

                    {isExpanded && !report.content && (
                      <div className="mt-4 border-t border-border/50 pt-4">
                        <p className="text-sm text-muted-foreground italic">
                          Không có nội dung để hiển thị.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </TabsContent>

          <TabsContent value="analyses" className="mt-4 space-y-4">
            {analysesLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            )}

            {analysesError && (
              <Card>
                <CardContent className="p-6 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Không thể tải danh sách phân tích. Vui lòng thử lại.
                  </p>
                </CardContent>
              </Card>
            )}

            {!analysesLoading && !analysesError && (!analyses || analyses.length === 0) && (
              <Card>
                <CardContent className="p-12 text-center">
                  <BarChart2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                  <h3 className="text-base font-semibold mb-2">Chưa có phân tích nào được lưu</h3>
                  <p className="text-sm text-muted-foreground">
                    Hãy nhấn "Lưu phân tích" từ trang Dashboard để lưu và xem lại ở đây.
                  </p>
                </CardContent>
              </Card>
            )}

            {!analysesLoading && analyses && analyses.length > 0 && (
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <Card
                    key={analysis.id}
                    className="border border-border hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">
                              {analysis.name || `Phân tích ${analysis.ticker}`}
                            </span>
                            <Badge variant="outline" className="text-xs font-mono">
                              {analysis.ticker}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {analysis.report_type === "Parent" ? "Công ty mẹ" : "Hợp nhất"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(analysis.created_at)}
                            </span>
                            {analysis.years && analysis.years.length > 0 && (
                              <span className="flex items-center gap-1">
                                Năm: {analysis.years.join(", ")}
                              </span>
                            )}
                            {analysis.comparisons && analysis.comparisons.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                So sánh: {analysis.comparisons.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAnalysis(analysis)}
                          className="shrink-0 gap-1.5 h-8"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Mở phân tích
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Simple markdown renderer (no external library needed)
function MarkdownContent({ content }: { content: string }) {
  // Process basic markdown: headings, bold, lists, line breaks
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-foreground">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-bold mt-4 mb-1 text-foreground">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-lg font-bold mt-4 mb-2 text-foreground">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 text-xs list-disc">
          {renderInline(line.slice(2))}
        </li>
      );
    } else if (line.match(/^\d+\. /)) {
      elements.push(
        <li key={i} className="ml-4 text-xs list-decimal">
          {renderInline(line.replace(/^\d+\. /, ""))}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<br key={i} />);
    } else {
      elements.push(
        <p key={i} className="text-xs leading-relaxed mb-1">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Handle bold (**text**)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

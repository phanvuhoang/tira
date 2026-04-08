import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
  Download,
} from "lucide-react";

/* ========== HELPER: Markdown to HTML ========== */
function simpleMarkdownToHtml(md: string): string {
  if (!md) return "";
  if (md.trim().startsWith("<")) {
    return md
      .replace(/\n{3,}/g, '\n\n')
      .replace(/<p>\s*<\/p>/g, '')
      .trim();
  }
  return md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, ' ')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p>\s*(<h[123]>)/g, '$1')
    .replace(/(<\/h[123]>)\s*<\/p>/g, '$1')
    .trim();
}

/* ========== HELPER: Export HTML report to DOCX ========== */
function exportToDocx(htmlContent: string, filename: string) {
  const fullHtml = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; margin: 2.5cm; }
  h1 { font-size: 18pt; color: #028a39; border-bottom: 2pt solid #028a39; padding-bottom: 6pt; margin-top: 24pt; }
  h2 { font-size: 14pt; color: #1a2332; margin-top: 18pt; margin-bottom: 6pt; }
  h3 { font-size: 12pt; color: #333; margin-top: 12pt; }
  p { margin: 6pt 0; }
  ul { margin: 6pt 0 6pt 20pt; }
  li { margin: 3pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
  th { border: 1pt solid #ccc; padding: 6pt 8pt; background-color: #f0f0f0; text-align: left; font-weight: bold; }
  td { border: 1pt solid #ccc; padding: 6pt 8pt; }
  strong { color: #1a2332; }
  em { color: #666; }
</style>
</head>
<body>
${simpleMarkdownToHtml(htmlContent)}
</body>
</html>`;

  const blob = new Blob(['\ufeff' + fullHtml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : filename + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}

/* ========== HELPER: Export HTML report to PPTX ========== */
async function exportReportToPptx(htmlContent: string, ticker: string) {
  const pptxgenjs = await import("pptxgenjs");
  const PptxGenJS = pptxgenjs.default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${simpleMarkdownToHtml(htmlContent)}</div>`, 'text/html');
  const sections = doc.querySelectorAll('h2');

  // Title slide
  const s1 = pptx.addSlide();
  s1.background = { color: "1A2332" };
  s1.addText("TIRA - Báo cáo Phân tích Rủi ro Thuế", { x: 0.8, y: 1.5, w: 8.5, h: 0.8, fontSize: 24, color: "FFFFFF", bold: true });
  s1.addText(ticker, { x: 0.8, y: 2.5, w: 8.5, h: 0.5, fontSize: 18, color: "028A39" });

  // One slide per H2 section
  sections.forEach((h2) => {
    const slide = pptx.addSlide();
    const title = h2.textContent || "";
    slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 18, bold: true, color: "1A2332" });

    let content = "";
    let el = h2.nextElementSibling;
    while (el && el.tagName !== "H2") {
      content += el.textContent + "\n";
      el = el.nextElementSibling;
    }

    if (content.trim()) {
      slide.addText(content.trim(), { x: 0.5, y: 1.0, w: 9, h: 5.5, fontSize: 11, color: "333333", valign: "top", wrap: true });
    }
  });

  const blob = await pptx.write({ outputType: "blob" }) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TIRA_AI_Report_${ticker}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
}

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
                        <div className="flex gap-2 mb-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportToDocx(report.content!, report.name || `TIRA_Report_${report.ticker}`)}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Xuất Word
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportReportToPptx(report.content!, report.ticker)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Xuất PPTX
                          </Button>
                        </div>
                        <div
                          className="prose prose-sm max-w-none text-sm text-foreground/90 overflow-y-auto max-h-[500px] bg-accent/20 rounded-lg p-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:my-2 [&_li]:mb-1 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-accent [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:p-2 [&_strong]:text-foreground"
                          data-testid={`report-content-${report.id}`}
                          dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(report.content) }}
                        />
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

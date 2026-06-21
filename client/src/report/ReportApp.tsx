// ─────────────────────────────────────────────────────────────
// Standalone, fully-interactive report app for the "full" HTML export.
//
// Reuses the exact dashboard view components, hydrated from embedded
// data. Bundled at export time into a single self-contained .html that
// runs offline. All tabs are included EXCEPT "Tính điểm rủi ro".
// ─────────────────────────────────────────────────────────────
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HeatmapView,
  ChartsView,
  ComparisonView,
  DetailView,
  AnalysisView,
  RiskHeatmapView,
  RiskDiagramView,
  FinancialsView,
  FSAnalysisView,
  type AnalysisResult,
} from "@/pages/dashboard";

export interface ReportPayload {
  result: AnalysisResult;
  weights: Record<string, number>;
  percentileLow: number;
  percentileHigh: number;
  aiReportHtml?: string | null;
  // financial data for offline use: { ticker: { year: data } }
  finData?: Record<string, Record<string, any>>;
}

export function ReportApp({ payload }: { payload: ReportPayload }) {
  const { result, weights, percentileLow, percentileHigh, aiReportHtml } = payload;
  const company = result?.target?.company;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="p-2 sm:p-4 lg:p-8 space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-extrabold text-white"
              style={{ background: "#028a39" }}
            >
              T
            </div>
            <div>
              <h1 className="text-xl font-bold">TIRA — Phân tích rủi ro thuế</h1>
              <p className="text-sm text-muted-foreground">
                {company?.ten_tv} ({company?.ma_ck}) · {result?.target?.report_type} ·{" "}
                {(result?.target?.years || []).join(", ")}
              </p>
            </div>
          </div>

          <Tabs defaultValue="heatmap">
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 overflow-x-auto">
              <TabsTrigger value="heatmap">Bảng nhiệt</TabsTrigger>
              <TabsTrigger value="charts">Biểu đồ</TabsTrigger>
              <TabsTrigger value="comparison">So sánh</TabsTrigger>
              <TabsTrigger value="detail">Chi tiết</TabsTrigger>
              <TabsTrigger value="analysis">Phân tích</TabsTrigger>
              <TabsTrigger value="risk-heatmap">Biểu đồ nhiệt</TabsTrigger>
              <TabsTrigger value="risk-diagram">Risk Diagram</TabsTrigger>
              <TabsTrigger value="financials">Báo cáo TC</TabsTrigger>
              <TabsTrigger value="fs-analysis">Phân tích BCTC</TabsTrigger>
              {aiReportHtml ? <TabsTrigger value="ai-report">Báo cáo AI</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="heatmap" className="mt-4">
              <HeatmapView result={result} percentileLow={percentileLow} percentileHigh={percentileHigh} />
            </TabsContent>
            <TabsContent value="charts" className="mt-4">
              <ChartsView result={result} />
            </TabsContent>
            <TabsContent value="comparison" className="mt-4">
              <ComparisonView result={result} />
            </TabsContent>
            <TabsContent value="detail" className="mt-4">
              <DetailView result={result} />
            </TabsContent>
            <TabsContent value="analysis" className="mt-4">
              <AnalysisView result={result} />
            </TabsContent>
            <TabsContent value="risk-heatmap" className="mt-4">
              <RiskHeatmapView result={result} />
            </TabsContent>
            <TabsContent value="risk-diagram" className="mt-4">
              <RiskDiagramView result={result} weights={weights} />
            </TabsContent>
            <TabsContent value="financials" className="mt-4">
              <FinancialsView result={result} />
            </TabsContent>
            <TabsContent value="fs-analysis" className="mt-4">
              <FSAnalysisView result={result} />
            </TabsContent>
            {aiReportHtml ? (
              <TabsContent value="ai-report" className="mt-4">
                <div
                  className="prose prose-sm max-w-none rounded-xl border bg-card p-6"
                  dangerouslySetInnerHTML={{ __html: aiReportHtml }}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

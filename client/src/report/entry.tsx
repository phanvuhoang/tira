// ─────────────────────────────────────────────────────────────
// Bundle entry for the "full" interactive HTML export.
//
// Bundled (esbuild) into a single IIFE that is inlined into the exported
// .html. Exposes window.TIRAReport.render(rootEl, payload). All server
// API calls are intercepted and served from embedded data so the page
// is fully interactive OFFLINE.
// ─────────────────────────────────────────────────────────────
import { createRoot } from "react-dom/client";
import { queryClient } from "@/lib/queryClient";
import { ReportApp, type ReportPayload } from "./ReportApp";

// Intercept fetch so the bundled views work offline. The only server
// dependency the views have is POST /api/financial-data/batch, which we
// reconstruct from embedded finData. Any other /api/ call returns {}.
function installOfflineApi(finData: Record<string, Record<string, any>>) {
  const orig = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();
    if (url.indexOf("/api/financial-data/batch") >= 0 && method === "POST") {
      let body: any = {};
      try {
        body = JSON.parse(init?.body || "{}");
      } catch {
        /* ignore */
      }
      const out: Record<string, Record<string, any>> = {};
      for (const t of body.tickers || []) {
        out[t] = {};
        const d = finData[t] || {};
        for (const y of body.years || []) if (d[y]) out[t][y] = d[y];
      }
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.indexOf("/api/") >= 0) {
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return orig(input, init);
  };
}

(window as any).TIRAReport = {
  render(rootEl: HTMLElement, payload: ReportPayload) {
    installOfflineApi(payload.finData || {});
    queryClient.setDefaultOptions({
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
    });
    createRoot(rootEl).render(<ReportApp payload={payload} />);
  },
};

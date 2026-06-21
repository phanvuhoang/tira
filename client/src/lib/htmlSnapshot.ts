// ─────────────────────────────────────────────────────────────
// Client-side HTML snapshot builder.
//
// Captures the already-rendered DOM of each dashboard tab (recharts
// SVGs serialize with their measured dimensions) and inlines the app's
// own CSS so the exported file looks exactly like the app — a single
// self-contained .html with vanilla-JS tab switching.
//
// The "So sánh" and "Chi tiết" tabs are additionally re-rendered from
// embedded analysis data by a small vanilla runtime, so their year /
// comparison-company selectors actually work offline.
// ─────────────────────────────────────────────────────────────

export type SnapshotKind = "static" | "comparison" | "detail";

export interface SnapshotSection {
  id: string;
  label: string;
  html?: string;
  kind?: SnapshotKind;
}

export interface InteractivePayload {
  // result.target / result.comparisons (AnalysisResult shape)
  result: any;
  // captured per-year comparison chart HTML, keyed by year
  comparisonCharts: Record<string, string>;
}

export interface SnapshotDocOptions {
  title: string;
  headerTitle: string;
  headerSub: string;
  sections: SnapshotSection[];
  fontsHref?: string;
  interactive?: InteractivePayload;
}

// Wait for React to commit + recharts (ResponsiveContainer + animations)
// to lay out before reading the DOM.
export function waitForRender(ms = 600): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(resolve, ms))
    );
  });
}

// Open the visible year multi-select inside the capture root and click
// "Chọn tất cả" so a captured snapshot contains every year's content.
export async function expandAllYears(): Promise<void> {
  const root = document.getElementById("export-capture-root");
  if (!root) return;
  const trigger = root.querySelector(
    '[data-testid="btn-year-multiselect"]'
  ) as HTMLElement | null;
  if (!trigger) return;
  trigger.click();
  await waitForRender(80);
  const selectAll = Array.from(root.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Chọn tất cả"
  ) as HTMLElement | undefined;
  if (selectAll) selectAll.click();
  await waitForRender(80);
  // close the popover so it isn't captured
  trigger.click();
  await waitForRender(80);
}

// Extract per-year comparison charts (the .h-72 chart containers, in
// newest-first order) from a captured Comparison panel.
export function extractComparisonCharts(
  panelHtml: string,
  allYears: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const doc = new DOMParser().parseFromString(panelHtml, "text/html");
    const charts = Array.from(doc.querySelectorAll(".h-72"));
    const yearsDesc = [...allYears].sort((a, b) => Number(b) - Number(a));
    yearsDesc.forEach((y, i) => {
      out[y] = charts[i] ? (charts[i] as HTMLElement).outerHTML : "";
    });
  } catch {
    /* ignore */
  }
  return out;
}

// Collect every accessible CSS rule from the current document.
export function collectDocumentCss(): string {
  let css = "";
  const sheets = Array.from(document.styleSheets);
  for (const sheet of sheets) {
    try {
      const rules = (sheet as CSSStyleSheet).cssRules;
      if (!rules) continue;
      for (let i = 0; i < rules.length; i++) css += rules[i].cssText + "\n";
    } catch {
      /* cross-origin stylesheet — ignore */
    }
  }
  return css;
}

export function getFontsHref(): string | undefined {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  const fontLink = links.find((l) =>
    (l as HTMLLinkElement).href.includes("fonts.googleapis.com")
  );
  return fontLink ? (fontLink as HTMLLinkElement).href : undefined;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Embed JSON safely inside <script type="application/json"> (the SVG
// payloads contain '<'); JSON.parse restores the escaped characters.
function embedJson(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

const EXPORT_CHROME_CSS = `
.tira-export-header {
  background: linear-gradient(135deg, #028a39, #016b2c);
  color: #fff; padding: 18px 26px; display: flex; align-items: center; gap: 14px;
}
.tira-export-header .logo {
  width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,.18);
  display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px;
}
.tira-export-header h1 { margin: 0; font-size: 19px; }
.tira-export-header .sub { opacity: .9; font-size: 13px; margin-top: 2px; }
nav.tira-export-tabs {
  display: flex; gap: 4px; padding: 0 16px; background: #fff;
  border-bottom: 1px solid #e2e8f0; overflow-x: auto; position: sticky; top: 0; z-index: 40;
}
nav.tira-export-tabs .etab {
  border: none; background: none; padding: 13px 14px; cursor: pointer; font-size: 13.5px;
  color: #64748b; border-bottom: 3px solid transparent; white-space: nowrap; font-weight: 500;
}
nav.tira-export-tabs .etab:hover { color: #1e293b; }
nav.tira-export-tabs .etab.active { color: #028a39; border-bottom-color: #028a39; font-weight: 600; }
.tira-export-section { display: none; }
.tira-export-section.active { display: block; }
.tira-ybtn { padding: 6px 12px; border-radius: 6px; border: 1px solid hsl(214,10%,85%);
  background: #fff; color: hsl(215,20%,40%); font-size: 13px; cursor: pointer; }
.tira-ybtn.active { background: hsl(144,97%,27%); color: #fff; border-color: hsl(144,97%,27%); }
.tira-csel { border: 1px solid hsl(214,10%,85%); border-radius: 6px; height: 32px;
  font-size: 13px; padding: 0 8px; background: #fff; color: hsl(215,25%,12%); }
.tira-export-btn {
  position: fixed; right: 22px; width: 46px; height: 46px; border-radius: 50%;
  border: none; background: #028a39; color: #fff; font-size: 18px; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,.2); z-index: 50;
}
.tira-export-print { bottom: 80px; }
.tira-export-top { bottom: 22px; }
@media print {
  nav.tira-export-tabs, .tira-export-btn { display: none !important; }
  .tira-export-section { display: block !important; page-break-before: always; }
  .tira-export-section:first-of-type { page-break-before: avoid; }
}
`;

// ── Vanilla interactive runtime (So sánh + Chi tiết) ──────────────
// Reads embedded analysis data and re-renders on selector change.
const INTERACTIVE_RUNTIME = `
(function () {
  var el = document.getElementById('tira-iv-data');
  if (!el) return;
  var DATA = JSON.parse(el.textContent);
  var result = DATA.result, charts = DATA.comparisonCharts || {};
  if (!result || !result.target) return;
  var target = result.target, comparisons = result.comparisons || {};
  var compEntries = Object.keys(comparisons).map(function (k) { return [k, comparisons[k]]; });
  var allYears = target.years || [];
  var COLORS = ["hsl(144, 97%, 27%)","hsl(25, 90%, 50%)","hsl(262, 55%, 50%)","hsl(142, 55%, 40%)","hsl(45, 90%, 50%)"];
  var PERCENT_IDS = ["0.1","0.2","0.3","1.1","1.2","1.3","1.4","1.5","1.6","1.7","2.1","2.2","2.3","2.4","2.5","3.1","3.2","3.3","3.4","3.7"];
  var CARD = 'shadcn-card rounded-xl border bg-card border-card-border text-card-foreground shadow-sm';
  var BADGE = 'whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors hover-elevate';

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function isPct(id){ return PERCENT_IDS.indexOf(id) >= 0; }
  function fmtNum(v){ if(v===null||v===undefined) return 'N/A'; var a=Math.abs(v);
    if(a>=1e9) return (v/1e9).toFixed(1)+'B'; if(a>=1e6) return (v/1e6).toFixed(1)+'M';
    if(a<0.0001&&v!==0) return v.toExponential(2); if(a<100) return v.toFixed(2);
    return v.toLocaleString('vi-VN',{maximumFractionDigits:2}); }
  function fmtPct(v){ return (v===null||v===undefined)?'N/A':(v*100).toFixed(1)+'%'; }
  function fmtVal(id,v){ if(v===null||v===undefined) return 'N/A'; return isPct(id)?fmtPct(v):fmtNum(v); }
  function bg1(r){ if(r==='red') return 'hsl(25, 100%, 95%)'; if(r==='gray') return 'hsl(214, 10%, 95%)'; return 'transparent'; }
  function fc2(r){ if(r==='red') return 'hsl(0, 72%, 48%)'; if(r==='gray') return 'hsl(214, 10%, 60%)'; return 'hsl(215, 20%, 20%)'; }
  function sortDesc(ys){ return ys.slice().sort(function(a,b){ return Number(b)-Number(a); }); }

  function yearControls(containerId, selected) {
    return allYears.map(function (y) {
      var on = selected.indexOf(y) >= 0;
      return '<button class="tira-ybtn' + (on ? ' active' : '') + '" data-year="' + y + '">' + y + '</button>';
    }).join('');
  }

  // ── So sánh ──
  var cmpYears = [allYears[0]];
  function renderComparison() {
    var host = document.getElementById('iv-comparison');
    if (!host) return;
    if (!compEntries.length) {
      host.innerHTML = '<div class="' + CARD + '"><div class="p-8 text-center text-muted-foreground"><p>Chưa chọn công ty so sánh. Quay lại trang chính để thêm.</p></div></div>';
      return;
    }
    var allTickers = [target.company.ma_ck].concat(compEntries.map(function (e) { return e[1].company.ma_ck; }));
    var years = sortDesc(cmpYears);
    var h = '<div class="space-y-6">';
    h += '<div class="flex items-center gap-3 flex-wrap"><div class="flex items-center gap-2 flex-wrap" id="cmp-years"><span class="text-sm text-muted-foreground mr-1">Năm:</span>' +
         yearControls('cmp-years', cmpYears) + '</div><span class="text-xs text-muted-foreground">' + cmpYears.length + ' năm đã chọn</span></div>';
    years.forEach(function (year) {
      var inds = target.indicators[year] || [];
      h += '<div class="' + CARD + '"><div class="flex flex-col space-y-1.5 p-6 pb-3"><div class="text-2xl font-semibold leading-none tracking-tight text-base font-semibold">So sánh các công ty - Năm ' + year + '</div></div>' +
           '<div class="p-6 pt-0"><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-border">' +
           '<th class="text-left py-2 px-3 font-medium text-muted-foreground min-w-[180px] sticky left-0 bg-card z-10">Chỉ số</th>';
      allTickers.forEach(function (tk, i) {
        h += '<th class="text-center py-2 px-3 font-semibold min-w-[100px]" style="color:' + COLORS[i % COLORS.length] + '">' + esc(tk) + '</th>';
      });
      h += '</tr></thead><tbody>';
      inds.forEach(function (ind) {
        h += '<tr class="border-b border-border/50 hover:bg-accent/30"><td class="py-1.5 px-3 text-xs font-medium sticky left-0 bg-card z-10">' + esc(ind.name) + '</td>';
        allTickers.forEach(function (tk) {
          var rec = ind, r1 = ind.risk_level_1 || ind.risk_level, r2 = ind.risk_level_2 || ind.risk_level, val = ind.company_value;
          if (tk !== target.company.ma_ck) {
            var ce = compEntries.find(function (e) { return e[1].company.ma_ck === tk; });
            var ci = ce ? (ce[1].indicators[year] || []).find(function (x) { return x.id === ind.id; }) : null;
            val = ci ? ci.company_value : null;
            r1 = ci ? (ci.risk_level_1 || ci.risk_level) : 'gray';
            r2 = ci ? (ci.risk_level_2 || ci.risk_level) : 'gray';
          }
          h += '<td class="py-1.5 px-2 text-center"><span class="heatmap-cell inline-block" style="background-color:' + bg1(r1) + ';color:' + fc2(r2) + '">' +
               (val !== null && val !== undefined ? fmtVal(ind.id, val) : 'N/A') + '</span></td>';
        });
        h += '</tr>';
      });
      h += '</tbody></table></div></div></div>';
    });
    years.forEach(function (year) {
      var chart = charts[year] || '';
      h += '<div class="' + CARD + '"><div class="flex flex-col space-y-1.5 p-6 pb-3"><div class="text-2xl font-semibold leading-none tracking-tight text-base font-semibold">Biểu đồ so sánh - Chỉ số chính (' + year + ')</div></div>' +
           '<div class="p-6 pt-0">' + (chart || '<p class="text-xs text-muted-foreground">(Không có biểu đồ)</p>') + '</div></div>';
    });
    h += '</div>';
    host.innerHTML = h;
    host.querySelectorAll('#cmp-years .tira-ybtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var y = b.dataset.year;
        if (cmpYears.indexOf(y) >= 0) { if (cmpYears.length > 1) cmpYears = cmpYears.filter(function (x) { return x !== y; }); }
        else cmpYears = cmpYears.concat([y]);
        renderComparison();
      });
    });
  }

  // ── Chi tiết ──
  var dtlYears = [allYears[0]];
  var dtlComp = 'none';
  function badgeSolid(text, bgc, color, border) {
    return '<div class="' + BADGE + ' text-[9px] px-1 py-0 border-transparent" style="background-color:' + bgc + ';color:' + color + ';border:1px solid ' + border + '">' + text + '</div>';
  }
  function renderDetail() {
    var host = document.getElementById('iv-detail');
    if (!host) return;
    var years = sortDesc(dtlYears);
    var compData = dtlComp !== 'none' ? (compEntries.find(function (e) { return e[1].company.ma_ck === dtlComp; }) || [])[1] : null;
    var h = '<div class="space-y-6">';
    h += '<div class="flex items-center gap-4 flex-wrap"><div class="flex items-center gap-2 flex-wrap" id="dtl-years"><span class="text-sm text-muted-foreground mr-1">Năm:</span>' + yearControls('dtl-years', dtlYears) + '</div>';
    if (compEntries.length) {
      h += '<div class="flex items-center gap-2"><span class="text-sm text-muted-foreground">So sánh với:</span><select id="dtl-comp" class="tira-csel"><option value="none">Không so sánh</option>' +
           compEntries.map(function (e) { var c = e[1].company; var v = c.ma_ck; return '<option value="' + esc(v) + '"' + (v === dtlComp ? ' selected' : '') + '>' + esc(c.ma_ck + ' - ' + c.ten_tv) + '</option>'; }).join('') +
           '</select></div>';
    }
    h += '</div>';
    years.forEach(function (year) {
      var inds = target.indicators[year] || [];
      var groups = {}; var order = [];
      inds.forEach(function (ind) { if (!groups[ind.group]) { groups[ind.group] = []; order.push(ind.group); } groups[ind.group].push(ind); });
      h += '<div class="space-y-4"><h3 class="text-lg font-bold text-primary border-b border-primary/20 pb-2">Năm ' + year + '</h3>';
      order.forEach(function (gname) {
        h += '<div class="' + CARD + '"><div class="flex flex-col space-y-1.5 p-6 pb-2"><div class="text-2xl font-semibold leading-none tracking-tight text-sm font-bold text-primary uppercase tracking-wider">' + esc(gname) + '</div></div><div class="p-6 pt-0"><div class="space-y-3">';
        groups[gname].forEach(function (ind) {
          var compInd = compData ? (compData.indicators[year] || []).find(function (x) { return x.id === ind.id; }) : null;
          var r1 = ind.risk_level_1 || ind.risk_level;
          h += '<div class="rounded-lg p-3 border" style="background-color:' + bg1(r1) + ';border-color:' + (ind.risk_level_1 === 'red' ? 'hsl(25, 80%, 80%)' : 'hsl(214, 10%, 90%)') + '">' +
               '<div class="' + (compData ? 'grid grid-cols-2 gap-4' : '') + '"><div>' +
               '<div class="flex items-center gap-2 mb-1"><div class="' + BADGE + ' text-[10px] font-mono px-1.5 py-0" style="border-color:var(--badge-outline)">' + esc(ind.id) + '</div><span class="text-sm font-semibold">' + esc(ind.name) + '</span>' +
               (ind.risk_level_1 === 'red' ? badgeSolid('RR1', 'hsl(25, 100%, 95%)', 'hsl(25, 100%, 40%)', 'hsl(25, 80%, 75%)') : '') + '</div>' +
               '<p class="text-xs text-muted-foreground">' + esc(ind.risk_factor) + '</p>' +
               (ind.industry_range ? '<p class="text-xs text-muted-foreground mt-1">Phân vị ngành: ' + esc(ind.industry_range) + '</p>' : '') +
               (ind.industry_median !== null && ind.industry_median !== undefined ? '<p class="text-xs text-muted-foreground mt-0.5">Trung vị ngành: <span class="font-medium" style="color:hsl(144, 97%, 27%)">' + fmtVal(ind.id, ind.industry_median) + '</span></p>' : '') +
               '<div class="flex items-center gap-2 mt-2"><span class="text-xs font-medium text-muted-foreground">' + esc(target.company.ma_ck) + ':</span>' +
               '<span class="text-lg font-bold tabular-nums" style="color:' + fc2(ind.risk_level_2 || ind.risk_level) + '">' + fmtVal(ind.id, ind.company_value) + '</span>' +
               (ind.risk_level_2 === 'red' ? badgeSolid('RR2', 'hsl(0, 72%, 95%)', 'hsl(0, 72%, 48%)', 'hsl(0, 60%, 80%)') : '') + '</div></div>';
          if (compData && compInd) {
            h += '<div class="border-l border-border/50 pl-4"><div class="flex items-center gap-2 mb-1"><span class="text-sm font-semibold text-muted-foreground">' + esc(dtlComp) + '</span>' +
                 (compInd.risk_level_1 === 'red' ? badgeSolid('RR1', 'hsl(25, 100%, 95%)', 'hsl(25, 100%, 40%)', 'hsl(25, 80%, 75%)') : '') + '</div>' +
                 '<div class="flex items-center gap-2 mt-2"><span class="text-lg font-bold tabular-nums" style="color:' + fc2(compInd.risk_level_2 || compInd.risk_level) + '">' + fmtVal(compInd.id, compInd.company_value) + '</span>' +
                 (compInd.risk_level_2 === 'red' ? badgeSolid('RR2', 'hsl(0, 72%, 95%)', 'hsl(0, 72%, 48%)', 'hsl(0, 60%, 80%)') : '') + '</div>' +
                 (compInd.industry_range ? '<p class="text-xs text-muted-foreground mt-1">Phân vị ngành: ' + esc(compInd.industry_range) + '</p>' : '') + '</div>';
          }
          h += '</div></div>';
        });
        h += '</div></div></div>';
      });
      h += '</div>';
    });
    h += '</div>';
    host.innerHTML = h;
    host.querySelectorAll('#dtl-years .tira-ybtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var y = b.dataset.year;
        if (dtlYears.indexOf(y) >= 0) { if (dtlYears.length > 1) dtlYears = dtlYears.filter(function (x) { return x !== y; }); }
        else dtlYears = dtlYears.concat([y]);
        renderDetail();
      });
    });
    var sel = host.querySelector('#dtl-comp');
    if (sel) sel.addEventListener('change', function () { dtlComp = sel.value; renderDetail(); });
  }

  renderComparison();
  renderDetail();
})();
`;

export function buildSnapshotDocument(opts: SnapshotDocOptions): string {
  const { title, headerTitle, headerSub, sections, fontsHref, interactive } = opts;
  const appCss = collectDocumentCss();

  const nav = sections
    .map(
      (s, i) =>
        `<button class="etab${i === 0 ? " active" : ""}" data-target="${s.id}">${esc(s.label)}</button>`
    )
    .join("");

  const body = sections
    .map((s, i) => {
      const active = i === 0 ? " active" : "";
      let inner: string;
      if (s.kind === "comparison") inner = `<div id="iv-comparison"></div>`;
      else if (s.kind === "detail") inner = `<div id="iv-detail"></div>`;
      else inner = s.html || "";
      return (
        `<section id="sec-${s.id}" class="tira-export-section${active}">` +
        `<div class="p-2 sm:p-4 lg:p-8 space-y-4 sm:space-y-6">${inner}</div>` +
        `</section>`
      );
    })
    .join("\n");

  const tabSwitchJs = `
(function(){
  var tabs = document.querySelectorAll('nav.tira-export-tabs .etab');
  var secs = document.querySelectorAll('.tira-export-section');
  tabs.forEach(function(t){
    t.addEventListener('click', function(){
      tabs.forEach(function(x){ x.classList.remove('active'); });
      secs.forEach(function(x){ x.classList.remove('active'); });
      t.classList.add('active');
      var s = document.getElementById('sec-' + t.dataset.target);
      if (s) s.classList.add('active');
      window.scrollTo({ top: 0 });
    });
  });
})();
`;

  const dataScript = interactive
    ? `<script type="application/json" id="tira-iv-data">${embedJson(interactive)}</script>`
    : "";
  const interactiveScript = interactive ? `<script>${INTERACTIVE_RUNTIME}</script>` : "";

  return `<!DOCTYPE html>
<html lang="vi" class="">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${fontsHref ? `<link rel="stylesheet" href="${esc(fontsHref)}">` : ""}
<style>${appCss}</style>
<style>${EXPORT_CHROME_CSS}</style>
</head>
<body class="bg-background text-foreground">
<header class="tira-export-header">
  <div class="logo">T</div>
  <div>
    <h1>TIRA — Phân tích rủi ro thuế</h1>
    <div class="sub">${esc(headerTitle)} · ${esc(headerSub)}</div>
  </div>
</header>
<nav class="tira-export-tabs">${nav}</nav>
<main>
${body}
</main>
<button class="tira-export-btn tira-export-print" onclick="window.print()" title="In báo cáo">🖨️</button>
<button class="tira-export-btn tira-export-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Lên đầu">⬆️</button>
${dataScript}
<script>${tabSwitchJs}</script>
${interactiveScript}
</body>
</html>`;
}

// ── Option 2: full interactive report (inlined React runtime) ──────
export interface FullReportDocOptions {
  title: string;
  headerTitle: string;
  headerSub: string;
  fontsHref?: string;
  bundleJs: string; // IIFE from /api/export/report-bundle
  payload: unknown; // ReportPayload (embedded as JSON)
}

export function buildFullReportDocument(opts: FullReportDocOptions): string {
  const { title, fontsHref, bundleJs, payload } = opts;
  const appCss = collectDocumentCss();
  return `<!DOCTYPE html>
<html lang="vi" class="">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${fontsHref ? `<link rel="stylesheet" href="${esc(fontsHref)}">` : ""}
<style>${appCss}</style>
<style>
.tira-export-btn{position:fixed;right:22px;width:46px;height:46px;border-radius:50%;border:none;background:#028a39;color:#fff;font-size:18px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:50}
.tira-export-print{bottom:80px}.tira-export-top{bottom:22px}
@media print{.tira-export-btn{display:none!important}[role=tabpanel]{display:block!important}}
</style>
</head>
<body class="bg-background text-foreground">
<div id="tira-root"></div>
<button class="tira-export-btn tira-export-print" onclick="window.print()" title="In báo cáo">🖨️</button>
<button class="tira-export-btn tira-export-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Lên đầu">⬆️</button>
<script type="application/json" id="tira-payload">${embedJson(payload)}</script>
<script>${bundleJs}</script>
<script>
(function(){
  var data = JSON.parse(document.getElementById('tira-payload').textContent);
  if (window.TIRAReport) window.TIRAReport.render(document.getElementById('tira-root'), data);
  else document.getElementById('tira-root').innerHTML = '<p style="padding:24px">Không tải được runtime.</p>';
})();
</script>
</body>
</html>`;
}

export function downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

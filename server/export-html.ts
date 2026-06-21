// ─────────────────────────────────────────────────────────────
// TIRA — Interactive HTML Report Builder (self-contained export)
//
// Produces a single .html file (only Chart.js loaded from CDN) that
// renders the full analysis dashboard with vanilla JS. Additive only:
// does not touch the existing PPTX/Word export paths.
// ─────────────────────────────────────────────────────────────

export interface ExportHtmlOptions {
  ticker: string;
  companyName: string;
  reportType: string;
  years: string[];
  analysisData: any; // { target: Record<year, indicator[]>, comparisons: Record<ticker, {company, indicators}> }
  chartData?: any; // { charts: [{ type, title, data }] }
  aiReportHtml?: string; // pre-rendered HTML (from /api/generate-report)
  percentileLow: number;
  percentileHigh: number;
}

export interface ExportHtmlAiReportOptions {
  ticker: string;
  companyName: string;
  reportHtml: string;
  chartData?: any;
}

// Escape a value for safe embedding inside <script type="application/json">.
// The closing-tag break is the only real XSS vector for JSON in a script tag.
function safeJson(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────
// CSS (theme #028a39)
// ─────────────────────────────────────────────────────────────
function getStyles(): string {
  return `
:root {
  --tira-green: #028a39;
  --tira-dark: #1A2332;
  --risk-red: #dc2626;
  --risk-yellow: #eab308;
  --risk-green: #16a34a;
  --risk-gray: #94a3b8;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --text: #1e293b;
  --text-muted: #64748b;
  --border: #e2e8f0;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px; line-height: 1.5;
}
.tira-header {
  background: linear-gradient(135deg, var(--tira-green), #016b2c);
  color: #fff; padding: 20px 28px; display: flex; align-items: center; gap: 16px;
}
.tira-header .logo {
  width: 44px; height: 44px; border-radius: 10px; background: rgba(255,255,255,.18);
  display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px;
}
.tira-header h1 { margin: 0; font-size: 20px; }
.tira-header .sub { opacity: .85; font-size: 13px; margin-top: 2px; }
nav.tabs {
  display: flex; gap: 4px; padding: 0 20px; background: var(--card-bg);
  border-bottom: 1px solid var(--border); overflow-x: auto; position: sticky; top: 0; z-index: 10;
}
nav.tabs .tab {
  border: none; background: none; padding: 14px 16px; cursor: pointer; font-size: 14px;
  color: var(--text-muted); border-bottom: 3px solid transparent; white-space: nowrap; font-weight: 500;
}
nav.tabs .tab:hover { color: var(--text); }
nav.tabs .tab.active { color: var(--tira-green); border-bottom-color: var(--tira-green); font-weight: 600; }
main { max-width: 1200px; margin: 0 auto; padding: 24px 20px 80px; }
.tab-content { display: none; }
.tab-content.active { display: block; }
.card {
  background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px;
  padding: 20px; margin-bottom: 20px;
}
.card h2 { margin: 0 0 16px; font-size: 17px; color: var(--tira-dark); }
.grid { display: grid; gap: 14px; }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.stat {
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px;
}
.stat .label { font-size: 12px; color: var(--text-muted); }
.stat .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { border: 1px solid var(--border); padding: 7px 9px; text-align: center; }
th { background: var(--bg); color: var(--tira-dark); font-weight: 600; cursor: pointer; user-select: none; white-space: nowrap; }
th.sortable:hover { background: #eef2f6; }
td.name, th.name { text-align: left; min-width: 220px; }
.group-row td { background: #eef6ef; color: var(--tira-green); font-weight: 700; text-align: left; }
.cell-green { background: rgba(22,163,74,.14); }
.cell-yellow { background: rgba(234,179,8,.16); }
.cell-red { background: rgba(220,38,38,.14); }
.cell-gray { background: rgba(148,163,184,.10); color: var(--text-muted); }
.fc-green { color: var(--risk-green); font-weight: 600; }
.fc-red { color: var(--risk-red); font-weight: 600; }
.fc-gray { color: var(--risk-gray); }
.heat-cell { font-weight: 600; color: #fff; cursor: default; }
.legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; margin-top: 12px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
.chart-box { position: relative; height: 340px; }
.report-body { line-height: 1.7; }
.report-body h1, .report-body h2, .report-body h3 { color: var(--tira-dark); }
.report-body table { margin: 12px 0; }
.muted { color: var(--text-muted); }
.btn-print, .btn-top {
  position: fixed; right: 22px; width: 46px; height: 46px; border-radius: 50%;
  border: none; background: var(--tira-green); color: #fff; font-size: 18px; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,.2); z-index: 50;
}
.btn-print { bottom: 80px; }
.btn-top { bottom: 22px; }
#tooltip {
  position: fixed; z-index: 100; background: var(--tira-dark); color: #fff; padding: 8px 11px;
  border-radius: 8px; font-size: 12px; pointer-events: none; display: none; max-width: 280px;
  box-shadow: 0 4px 16px rgba(0,0,0,.25);
}
@media (max-width: 720px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
@media print {
  nav.tabs, .btn-print, .btn-top { display: none !important; }
  .tab-content { display: block !important; page-break-inside: avoid; }
  .card { break-inside: avoid; }
  body { background: #fff; }
}
`;
}

// ─────────────────────────────────────────────────────────────
// Client-side vanilla JS (tabs, sorting, tooltips, Chart.js)
// ─────────────────────────────────────────────────────────────
function getClientJs(): string {
  return `
(function () {
  var DATA = JSON.parse(document.getElementById('tira-data').textContent);
  var PERCENT_IDS = ["0.1","0.2","0.3","1.1","1.2","1.3","1.4","1.5","1.6","1.7","2.1","2.2","2.3","2.4","2.5","3.1","3.2","3.3","3.4","3.7"];

  function fmtNum(v) {
    if (v === null || v === undefined) return 'N/A';
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (a < 0.0001 && v !== 0) return v.toExponential(2);
    if (a < 100) return v.toFixed(2);
    return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  }
  function fmtPct(v) { return (v === null || v === undefined) ? 'N/A' : (v * 100).toFixed(1) + '%'; }
  function fmtVal(id, v) { return (v === null || v === undefined) ? 'N/A' : (PERCENT_IDS.indexOf(id) >= 0 ? fmtPct(v) : fmtNum(v)); }
  function riskClass(level) { return 'cell-' + (level || 'gray'); }
  function riskLabel(level) {
    return level === 'green' ? 'An toàn' : level === 'yellow' ? 'Chú ý' : level === 'red' ? 'Rủi ro' : 'N/A';
  }

  // Indicators are an array per year; build a unified row list keyed by id.
  var years = DATA.years || [];
  var target = (DATA.analysis && DATA.analysis.target) || {};
  var comparisons = (DATA.analysis && DATA.analysis.comparisons) || {};
  var latestYear = years[0];

  // Master indicator list from the latest year (fallback: first year with data)
  function masterList() {
    for (var i = 0; i < years.length; i++) {
      if (Array.isArray(target[years[i]]) && target[years[i]].length) return target[years[i]];
    }
    return [];
  }
  function indById(arr, id) {
    if (!Array.isArray(arr)) return null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  // ── Tabs ──
  function initTabs() {
    var tabs = document.querySelectorAll('nav.tabs .tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
        t.classList.add('active');
        var sec = document.getElementById('tab-' + t.dataset.tab);
        if (sec) sec.classList.add('active');
      });
    });
  }

  // ── Overview ──
  function renderOverview() {
    var inds = masterList();
    var reds = 0, yellows = 0, greens = 0, grays = 0;
    inds.forEach(function (i) {
      var r1 = i.risk_level_1 || i.risk_level;
      var r2 = i.risk_level_2 || 'gray';
      if (r1 === 'red' || r2 === 'red') reds++;
      else if (r1 === 'yellow') yellows++;
      else if (r1 === 'green') greens++;
      else grays++;
    });
    var total = inds.length || 1;
    var score = Math.round((reds / total) * 100);
    var scoreColor = score >= 50 ? 'var(--risk-red)' : score >= 25 ? 'var(--risk-yellow)' : 'var(--risk-green)';
    var el = document.getElementById('ov-content');
    el.innerHTML =
      '<div class="card"><h2>Thông tin doanh nghiệp</h2><div class="grid grid-2">' +
        statBox('Mã chứng khoán', DATA.ticker) +
        statBox('Tên công ty', DATA.companyName) +
        statBox('Loại báo cáo', DATA.reportType || '—') +
        statBox('Năm phân tích', years.join(', ')) +
      '</div></div>' +
      '<div class="card"><h2>Điểm rủi ro tổng hợp (' + (latestYear || '') + ')</h2>' +
        '<div class="grid grid-4">' +
          '<div class="stat"><div class="label">Điểm rủi ro</div><div class="value" style="color:' + scoreColor + '">' + score + '</div></div>' +
          '<div class="stat"><div class="label">Chỉ số rủi ro (Đỏ)</div><div class="value fc-red">' + reds + '</div></div>' +
          '<div class="stat"><div class="label">Cần chú ý (Vàng)</div><div class="value" style="color:var(--risk-yellow)">' + yellows + '</div></div>' +
          '<div class="stat"><div class="label">An toàn (Xanh)</div><div class="value fc-green">' + greens + '</div></div>' +
        '</div></div>';
  }
  function statBox(label, val) {
    return '<div class="stat"><div class="label">' + label + '</div><div class="value" style="font-size:16px">' + (val || '—') + '</div></div>';
  }

  // ── Heatmap (indicator × year) ──
  function renderHeatmap() {
    var inds = masterList();
    var groups = {};
    var order = [];
    inds.forEach(function (i) {
      if (!groups[i.group]) { groups[i.group] = []; order.push(i.group); }
      groups[i.group].push(i);
    });
    var html = '<table id="heatmap-table"><thead><tr>' +
      '<th class="name sortable" data-col="0">Chỉ số</th>';
    years.forEach(function (y, idx) { html += '<th class="sortable" data-col="' + (idx + 1) + '">' + y + '</th>'; });
    html += '</tr></thead><tbody>';
    order.forEach(function (g) {
      html += '<tr class="group-row"><td colspan="' + (years.length + 1) + '">' + g + '</td></tr>';
      groups[g].forEach(function (ind) {
        html += '<tr><td class="name" title="' + (ind.risk_factor || '') + '"><b>' + ind.id + '</b> ' + ind.name + '</td>';
        years.forEach(function (y) {
          var yi = indById(target[y], ind.id);
          if (!yi) { html += '<td class="cell-gray">N/A</td>'; return; }
          var r1 = yi.risk_level_1 || yi.risk_level;
          var r2 = yi.risk_level_2 || 'gray';
          var tip = ind.name + ' (' + y + ')\\nGiá trị: ' + fmtVal(ind.id, yi.company_value) +
            '\\nTrung vị ngành: ' + fmtVal(ind.id, yi.industry_median) +
            '\\nRR1: ' + riskLabel(r1) + ' | RR2: ' + riskLabel(r2);
          html += '<td class="' + riskClass(r1) + '" data-tip="' + tip.replace(/"/g, '&quot;') + '">' +
            '<span class="fc-' + (r2 === 'red' ? 'red' : r2 === 'green' ? 'green' : 'gray') + '">' +
            fmtVal(ind.id, yi.company_value) + '</span></td>';
        });
        html += '</tr>';
      });
    });
    html += '</tbody></table>';
    document.getElementById('hm-content').innerHTML =
      '<div class="card"><h2>Bảng nhiệt chỉ số đa năm</h2>' + html + legendHtml() + '</div>';
    enableSort('heatmap-table');
    enableTooltips();
  }

  // ── Risk heatmap (deviation vs industry median) ──
  function renderRiskHeatmap() {
    var inds = masterList();
    var html = '<table><thead><tr><th class="name">Chỉ số</th>';
    years.forEach(function (y) { html += '<th>' + y + '</th>'; });
    html += '</tr></thead><tbody>';
    inds.forEach(function (ind) {
      html += '<tr><td class="name"><b>' + ind.id + '</b> ' + ind.name + '</td>';
      years.forEach(function (y) {
        var yi = indById(target[y], ind.id);
        if (!yi || yi.company_value === null || yi.industry_median === null || yi.industry_median === 0) {
          html += '<td class="cell-gray">—</td>'; return;
        }
        var dev = ((yi.company_value - yi.industry_median) / Math.abs(yi.industry_median)) * 100;
        var bg = deviationColor(dev);
        var tip = ind.name + ' (' + y + ')\\nLệch so với trung vị: ' + dev.toFixed(1) + '%';
        html += '<td class="heat-cell" style="background:' + bg + '" data-tip="' + tip.replace(/"/g, '&quot;') + '">' +
          (dev > 0 ? '+' : '') + dev.toFixed(0) + '%</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('rh-content').innerHTML =
      '<div class="card"><h2>Biểu đồ nhiệt rủi ro — Độ lệch so với trung vị ngành</h2>' + html +
      '<div class="legend"><span><i style="background:' + deviationColor(-60) + '"></i> Thấp hơn ngành</span>' +
      '<span><i style="background:' + deviationColor(0) + '"></i> Ngang ngành</span>' +
      '<span><i style="background:' + deviationColor(60) + '"></i> Cao hơn ngành</span></div></div>';
    enableTooltips();
  }
  function deviationColor(dev) {
    var d = Math.max(-100, Math.min(100, dev));
    // negative -> red, positive -> green, midpoint -> yellow-ish
    var t = (d + 100) / 200; // 0..1
    var r = Math.round(220 + (22 - 220) * t);
    var g = Math.round(38 + (163 - 38) * t);
    var b = Math.round(38 + (74 - 38) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ── Comparison ──
  function renderComparison() {
    var compKeys = Object.keys(comparisons);
    if (!compKeys.length) {
      document.getElementById('cmp-content').innerHTML =
        '<div class="card"><h2>So sánh</h2><p class="muted">Không có công ty so sánh.</p></div>';
      return;
    }
    var inds = masterList();
    var yr = latestYear;
    var html = '<table><thead><tr><th class="name">Chỉ số (' + yr + ')</th><th>' + DATA.ticker + '</th>';
    compKeys.forEach(function (k) {
      var nm = (comparisons[k].company && comparisons[k].company.ma_ck) || k;
      html += '<th>' + nm + '</th>';
    });
    html += '</tr></thead><tbody>';
    inds.forEach(function (ind) {
      var ti = indById(target[yr], ind.id);
      html += '<tr><td class="name"><b>' + ind.id + '</b> ' + ind.name + '</td>';
      var tr1 = ti ? (ti.risk_level_1 || ti.risk_level) : 'gray';
      html += '<td class="' + riskClass(tr1) + '">' + (ti ? fmtVal(ind.id, ti.company_value) : 'N/A') + '</td>';
      compKeys.forEach(function (k) {
        var ci = indById(comparisons[k].indicators && comparisons[k].indicators[yr], ind.id);
        var cr1 = ci ? (ci.risk_level_1 || ci.risk_level) : 'gray';
        html += '<td class="' + riskClass(cr1) + '">' + (ci ? fmtVal(ind.id, ci.company_value) : 'N/A') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('cmp-content').innerHTML =
      '<div class="card"><h2>So sánh với công ty cùng ngành</h2>' + html + legendHtml() + '</div>';
  }

  // ── Charts (Chart.js) ──
  function renderCharts() {
    var box = document.getElementById('ch-content');
    if (typeof Chart === 'undefined') {
      box.innerHTML = '<div class="card"><p class="muted">Không tải được Chart.js (cần kết nối internet).</p></div>';
      return;
    }
    var charts = DATA.charts || [];
    var html = '';
    var revenue = findChart(charts, 'revenue_trend');
    var ratios = findChart(charts, 'ratios');
    if (revenue) html += '<div class="card"><h2>' + (revenue.title || 'Xu hướng') + '</h2><div class="chart-box"><canvas id="c-revenue"></canvas></div></div>';
    if (ratios) html += '<div class="card"><h2>' + (ratios.title || 'Biên lợi nhuận') + '</h2><div class="chart-box"><canvas id="c-ratios"></canvas></div></div>';
    html += '<div class="card"><h2>Hồ sơ rủi ro (' + (latestYear || '') + ')</h2><div class="chart-box"><canvas id="c-radar"></canvas></div></div>';
    if (!revenue && !ratios) html = '<div class="card"><p class="muted">Không có dữ liệu biểu đồ. Hồ sơ rủi ro hiển thị bên dưới.</p></div>' + html;
    box.innerHTML = html;

    if (revenue) {
      new Chart(document.getElementById('c-revenue'), {
        type: 'bar',
        data: {
          labels: revenue.data.map(function (d) { return d.year; }),
          datasets: [
            { label: 'Doanh thu', data: revenue.data.map(function (d) { return d.revenue; }), backgroundColor: '#028a39' },
            { label: 'Lợi nhuận', data: revenue.data.map(function (d) { return d.profit; }), backgroundColor: '#16a34a' },
            { label: 'Thuế', data: revenue.data.map(function (d) { return d.tax; }), backgroundColor: '#eab308' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
    if (ratios) {
      new Chart(document.getElementById('c-ratios'), {
        type: 'line',
        data: {
          labels: ratios.data.map(function (d) { return d.year; }),
          datasets: [
            { label: 'Biên gộp (%)', data: ratios.data.map(function (d) { return +d.gross_margin; }), borderColor: '#028a39', tension: .3 },
            { label: 'Biên ròng (%)', data: ratios.data.map(function (d) { return +d.net_margin; }), borderColor: '#16a34a', tension: .3 },
            { label: 'ETR (%)', data: ratios.data.map(function (d) { return +d.etr; }), borderColor: '#dc2626', tension: .3 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
    // Radar of risk indicators (red=2, yellow=1, green/gray=0)
    var inds = masterList().slice(0, 12);
    new Chart(document.getElementById('c-radar'), {
      type: 'radar',
      data: {
        labels: inds.map(function (i) { return i.id; }),
        datasets: [{
          label: 'Mức rủi ro',
          data: inds.map(function (i) {
            var r = i.risk_level_1 || i.risk_level;
            return r === 'red' ? 2 : r === 'yellow' ? 1 : 0;
          }),
          backgroundColor: 'rgba(220,38,38,.18)', borderColor: '#dc2626', pointBackgroundColor: '#dc2626'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { suggestedMin: 0, suggestedMax: 2, ticks: { stepSize: 1 } } } }
    });
  }
  function findChart(charts, type) {
    for (var i = 0; i < charts.length; i++) if (charts[i].type === type) return charts[i];
    return null;
  }

  // ── Helpers ──
  function legendHtml() {
    return '<div class="legend">' +
      '<span><i style="background:rgba(22,163,74,.5)"></i> An toàn</span>' +
      '<span><i style="background:rgba(234,179,8,.6)"></i> Chú ý</span>' +
      '<span><i style="background:rgba(220,38,38,.5)"></i> Rủi ro</span>' +
      '<span><i style="background:rgba(148,163,184,.4)"></i> Không có dữ liệu</span>' +
      '<span class="muted">(Nền = RR1 ngưỡng tuyệt đối, màu chữ = RR2 so ngành)</span></div>';
  }
  function enableSort(tableId) {
    var table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var col = +th.dataset.col;
        var tbody = table.querySelector('tbody');
        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr:not(.group-row)'));
        var asc = th.dataset.asc !== 'true';
        th.dataset.asc = asc ? 'true' : 'false';
        rows.sort(function (a, b) {
          var av = a.children[col] ? a.children[col].textContent.trim() : '';
          var bv = b.children[col] ? b.children[col].textContent.trim() : '';
          var an = parseFloat(av.replace(/[^0-9.\\-]/g, ''));
          var bn = parseFloat(bv.replace(/[^0-9.\\-]/g, ''));
          if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
          return asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        // Re-append (drops group rows visually for sorted view)
        rows.forEach(function (r) { tbody.appendChild(r); });
        table.querySelectorAll('th.sortable').forEach(function (x) { x.textContent = x.textContent.replace(/[ ▲▼]+$/, ''); });
        th.textContent = th.textContent.replace(/[ ▲▼]+$/, '') + (asc ? ' ▲' : ' ▼');
      });
    });
  }
  var tooltip;
  function enableTooltips() {
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'tooltip';
      document.body.appendChild(tooltip);
    }
    document.querySelectorAll('[data-tip]').forEach(function (cell) {
      cell.addEventListener('mousemove', function (e) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY + 14) + 'px';
        tooltip.textContent = cell.dataset.tip;
      });
      cell.addEventListener('mouseleave', function () { tooltip.style.display = 'none'; });
    });
  }

  // ── Boot ──
  initTabs();
  renderOverview();
  renderHeatmap();
  renderRiskHeatmap();
  renderComparison();
  renderCharts();
})();
`;
}

// ─────────────────────────────────────────────────────────────
// buildHtmlReport — full interactive dashboard
// ─────────────────────────────────────────────────────────────
export function buildHtmlReport(opts: ExportHtmlOptions): string {
  const dataJson = safeJson({
    ticker: opts.ticker,
    companyName: opts.companyName,
    reportType: opts.reportType,
    years: opts.years,
    analysis: opts.analysisData,
    charts: opts.chartData?.charts || [],
    aiReport: opts.aiReportHtml || null,
    pLow: opts.percentileLow,
    pHigh: opts.percentileHigh,
  });

  const hasAi = !!opts.aiReportHtml;
  const title = `TIRA Report — ${escapeHtml(opts.ticker)} (${opts.years.join("–")})`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>${getStyles()}</style>
</head>
<body>
  <header class="tira-header">
    <div class="logo">T</div>
    <div>
      <h1>TIRA — Phân tích rủi ro thuế</h1>
      <div class="sub">${escapeHtml(opts.companyName)} (${escapeHtml(opts.ticker)}) · ${escapeHtml(opts.reportType)} · ${opts.years.join(", ")}</div>
    </div>
  </header>

  <nav class="tabs">
    <button class="tab active" data-tab="overview">📊 Tổng quan</button>
    <button class="tab" data-tab="heatmap">🔥 Bảng nhiệt</button>
    <button class="tab" data-tab="risk-heatmap">⚠️ Biểu đồ nhiệt</button>
    <button class="tab" data-tab="comparison">📋 So sánh</button>
    <button class="tab" data-tab="charts">📈 Biểu đồ</button>
    ${hasAi ? '<button class="tab" data-tab="ai-report">🤖 Báo cáo AI</button>' : ""}
  </nav>

  <main>
    <section id="tab-overview" class="tab-content active"><div id="ov-content"></div></section>
    <section id="tab-heatmap" class="tab-content"><div id="hm-content"></div></section>
    <section id="tab-risk-heatmap" class="tab-content"><div id="rh-content"></div></section>
    <section id="tab-comparison" class="tab-content"><div id="cmp-content"></div></section>
    <section id="tab-charts" class="tab-content"><div id="ch-content"></div></section>
    ${hasAi ? `<section id="tab-ai-report" class="tab-content"><div class="card report-body">${opts.aiReportHtml}</div></section>` : ""}
  </main>

  <button class="btn-print" onclick="window.print()" title="In báo cáo">🖨️</button>
  <button class="btn-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Lên đầu">⬆️</button>

  <script type="application/json" id="tira-data">${dataJson}</script>
  <script>${getClientJs()}</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// buildHtmlAiReport — standalone AI report (single section + charts)
// ─────────────────────────────────────────────────────────────
export function buildHtmlAiReport(opts: ExportHtmlAiReportOptions): string {
  const charts = opts.chartData?.charts || [];
  const chartsJson = safeJson(charts);
  const title = `TIRA — Báo cáo AI · ${escapeHtml(opts.ticker)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>${getStyles()}</style>
</head>
<body>
  <header class="tira-header">
    <div class="logo">T</div>
    <div>
      <h1>TIRA — Báo cáo phân tích AI</h1>
      <div class="sub">${escapeHtml(opts.companyName)} (${escapeHtml(opts.ticker)})</div>
    </div>
  </header>

  <main>
    ${charts.length ? '<div class="card"><h2>Biểu đồ minh hoạ</h2><div class="grid grid-2"><div class="chart-box"><canvas id="c-revenue"></canvas></div><div class="chart-box"><canvas id="c-ratios"></canvas></div></div></div>' : ""}
    <div class="card report-body">${opts.reportHtml}</div>
  </main>

  <button class="btn-print" onclick="window.print()" title="In báo cáo">🖨️</button>
  <button class="btn-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Lên đầu">⬆️</button>

  <script type="application/json" id="tira-charts">${chartsJson}</script>
  <script>
  (function () {
    if (typeof Chart === 'undefined') return;
    var charts = JSON.parse(document.getElementById('tira-charts').textContent);
    function findChart(t) { for (var i = 0; i < charts.length; i++) if (charts[i].type === t) return charts[i]; return null; }
    var revenue = findChart('revenue_trend');
    var ratios = findChart('ratios');
    if (revenue && document.getElementById('c-revenue')) {
      new Chart(document.getElementById('c-revenue'), {
        type: 'bar',
        data: { labels: revenue.data.map(function (d) { return d.year; }),
          datasets: [
            { label: 'Doanh thu', data: revenue.data.map(function (d) { return d.revenue; }), backgroundColor: '#028a39' },
            { label: 'Lợi nhuận', data: revenue.data.map(function (d) { return d.profit; }), backgroundColor: '#16a34a' },
            { label: 'Thuế', data: revenue.data.map(function (d) { return d.tax; }), backgroundColor: '#eab308' }
          ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: revenue.title } } }
      });
    }
    if (ratios && document.getElementById('c-ratios')) {
      new Chart(document.getElementById('c-ratios'), {
        type: 'line',
        data: { labels: ratios.data.map(function (d) { return d.year; }),
          datasets: [
            { label: 'Biên gộp (%)', data: ratios.data.map(function (d) { return +d.gross_margin; }), borderColor: '#028a39', tension: .3 },
            { label: 'Biên ròng (%)', data: ratios.data.map(function (d) { return +d.net_margin; }), borderColor: '#16a34a', tension: .3 },
            { label: 'ETR (%)', data: ratios.data.map(function (d) { return +d.etr; }), borderColor: '#dc2626', tension: .3 }
          ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: ratios.title } } }
      });
    }
  })();
  </script>
</body>
</html>`;
}

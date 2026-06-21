// ─────────────────────────────────────────────────────────────
// Client-side HTML snapshot builder.
//
// Captures the already-rendered DOM of each dashboard tab (recharts
// SVGs serialize with their measured dimensions) and inlines the app's
// own CSS so the exported file looks exactly like the app — a single
// self-contained .html with vanilla-JS tab switching.
// ─────────────────────────────────────────────────────────────

export interface SnapshotSection {
  id: string;
  label: string;
  html: string;
}

export interface SnapshotDocOptions {
  title: string;
  headerTitle: string;
  headerSub: string;
  sections: SnapshotSection[];
  fontsHref?: string;
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

// Collect every accessible CSS rule from the current document.
// Cross-origin sheets (e.g. Google Fonts) throw on .cssRules — skipped
// here and re-linked in the exported <head> instead.
export function collectDocumentCss(): string {
  let css = "";
  const sheets = Array.from(document.styleSheets);
  for (const sheet of sheets) {
    try {
      const rules = (sheet as CSSStyleSheet).cssRules;
      if (!rules) continue;
      for (let i = 0; i < rules.length; i++) {
        css += rules[i].cssText + "\n";
      }
    } catch {
      // cross-origin stylesheet — ignore
    }
  }
  return css;
}

// Grab the Google Fonts <link> the app uses so typography matches.
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

export function buildSnapshotDocument(opts: SnapshotDocOptions): string {
  const { title, headerTitle, headerSub, sections, fontsHref } = opts;
  const appCss = collectDocumentCss();

  const nav = sections
    .map(
      (s, i) =>
        `<button class="etab${i === 0 ? " active" : ""}" data-target="${s.id}">${esc(s.label)}</button>`
    )
    .join("");

  const body = sections
    .map(
      (s, i) =>
        `<section id="sec-${s.id}" class="tira-export-section${i === 0 ? " active" : ""}">` +
        `<div class="p-2 sm:p-4 lg:p-8 space-y-4 sm:space-y-6">${s.html}</div>` +
        `</section>`
    )
    .join("\n");

  const clientJs = `
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
<script>${clientJs}</script>
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

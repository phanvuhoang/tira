// ─────────────────────────────────────────────────────────────
// Builds the standalone interactive report runtime (React + all
// dashboard view components) into a single IIFE bundle, on demand.
//
// Used by the "full" HTML export (Option 2): the client fetches this
// bundle and inlines it into the exported .html so the report is fully
// interactive offline. Bundled with esbuild (already a dependency).
// ─────────────────────────────────────────────────────────────
import path from "path";
import fs from "fs";

let cached: string | null = null;
let building: Promise<string> | null = null;

const ROOT = process.cwd();
const ENTRY = path.resolve(ROOT, "client", "src", "report", "entry.tsx");
const PREBUILT = path.resolve(ROOT, "dist", "report-runtime.js");

// Shared esbuild options so the dev (on-demand) and prod (build step)
// outputs are identical.
export function reportBundleOptions() {
  return {
    entryPoints: [ENTRY],
    bundle: true,
    write: false as const,
    format: "iife" as const,
    platform: "browser" as const,
    target: "es2020",
    jsx: "automatic" as const,
    minify: true,
    legalComments: "none" as const,
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "empty" } as Record<string, any>,
    alias: {
      "@": path.resolve(ROOT, "client", "src"),
      "@shared": path.resolve(ROOT, "shared"),
      "@assets": path.resolve(ROOT, "attached_assets"),
    },
  };
}

export async function buildReportBundle(): Promise<string> {
  if (cached) return cached;
  // Prefer a prebuilt artifact (produced during `npm run build`) so the
  // export works even where source isn't shipped.
  if (fs.existsSync(PREBUILT)) {
    cached = fs.readFileSync(PREBUILT, "utf-8");
    return cached;
  }
  if (building) return building;
  building = (async () => {
    const esbuild = await import("esbuild");
    const out = await esbuild.build(reportBundleOptions());
    const js = out.outputFiles?.[0]?.text || "";
    cached = js;
    building = null;
    return js;
  })();
  return building;
}

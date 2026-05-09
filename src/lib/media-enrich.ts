// Enrich chapter content with real images and charts.
// - [VISUAL] → AI image OR stock photo (per type rule)
// - [CHART] → QuickChart (free, open-source) — only if type needs charts
import { generateImage, ruleFor } from "./ebook-api";
import { getStockPhoto } from "./stock-photos";

const VISUAL_RE = /^\[VISUAL\b([\s\S]*?)\]\s*(?:→|->)?\s*(.*)$/im;
const CHART_RE = /^\[CHART\b([\s\S]*?)\]\s*(?:→|->)?\s*(.*)$/im;

function parseKv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of raw.split("|").map((s) => s.trim()).filter(Boolean)) {
    const i = p.indexOf(":");
    if (i <= 0) continue;
    out[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function fetchAsDataUrl(url: string, timeoutMs = 30000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const blob = await resp.blob();
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  } finally { clearTimeout(t); }
}

function buildQuickChartUrl(kv: Record<string, string>): string {
  const type = (kv.type || "bar").toLowerCase();
  const title = kv.title || "";
  const labels: string[] = []; const data: number[] = [];
  for (const pair of (kv.data || "").split(",")) {
    const m = pair.split(":");
    if (m.length < 2) continue;
    const label = m[0].trim();
    const value = parseFloat(m[1].replace(/[^0-9.\-]/g, ""));
    if (!label || !isFinite(value)) continue;
    labels.push(label); data.push(value);
  }
  const palette = ["#C44024","#1E88E5","#FB8C00","#2E7D32","#6A1B9A","#00838F","#EF6C00","#5D4037"];
  const bg = type === "pie" || type === "doughnut" ? labels.map((_, i) => palette[i % palette.length]) : "#C44024";
  const chart = {
    type,
    data: { labels, datasets: [{ label: title || "Series", data, backgroundColor: bg, borderColor: "#222", borderWidth: 1 }] },
    options: {
      title: { display: !!title, text: title, fontSize: 18, fontFamily: "Georgia" },
      legend: { display: type === "pie" || type === "doughnut" },
      scales: type === "pie" || type === "doughnut" ? {} : { yAxes: [{ ticks: { beginAtZero: true } }] },
    },
  };
  return `https://quickchart.io/chart?w=900&h=520&bkg=white&c=${encodeURIComponent(JSON.stringify(chart))}`;
}

export async function enrichChapterContent(
  content: string,
  opts: { ebookType: string; emotion?: string; quality?: "fast" | "pro" }
): Promise<string> {
  const rule = ruleFor(opts.ebookType);
  const lines = (content || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const t = line.trim();

    const v = t.match(VISUAL_RE);
    if (v) {
      if (!rule.needsImages) { continue; } // skip entirely for journal etc.
      const kv = parseKv(v[1]);
      const tail = v[2]?.trim();
      const scene = kv.scene || tail || "";
      let dataUrl: string | undefined;

      // Stock photo for non-fiction realism types; AI for everything else.
      if (rule.useStockPhotos) {
        const photo = await getStockPhoto(scene || kv.subject || "editorial", 1200, 800);
        if (photo) dataUrl = photo;
      }
      if (!dataUrl) {
        try {
          const styleHint = [kv.style, kv.mood, kv.colors].filter(Boolean).join(", ");
          const prompt = [scene, styleHint].filter(Boolean).join(" — ");
          dataUrl = await generateImage({
            prompt: prompt || "atmospheric editorial illustration",
            kind: "chapter",
            emotion: kv.mood || opts.emotion,
            quality: opts.quality || "fast",
            style: rule.imageStyle === "line-art" ? "line-art" : "color",
          });
        } catch (e) { console.warn("VISUAL render failed", e); }
      }
      if (dataUrl) {
        out.push(`[IMG|${dataUrl}|${(scene || "").replace(/\|/g, " ")}]`);
      } else {
        out.push(line);
      }
      continue;
    }

    const c = t.match(CHART_RE);
    if (c) {
      if (!rule.needsCharts) continue; // hide charts for kids/coloring/game/quiz
      const kv = parseKv(c[1]);
      const insight = kv.insight || c[2]?.trim() || "";
      try {
        const url = buildQuickChartUrl(kv);
        const dataUrl = await fetchAsDataUrl(url);
        out.push(`[IMG|${dataUrl}|${kv.title || ""}${insight ? ` — ${insight}` : ""}]`);
      } catch (e) {
        console.warn("CHART render failed", e);
        out.push(line);
      }
      continue;
    }

    out.push(line);
  }
  return out.join("\n");
}

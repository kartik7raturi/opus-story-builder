// Enrich chapter content by replacing [VISUAL ...] and [CHART ...] tag blocks
// with actual rendered images embedded as data URLs, using free open-source
// services (Pollinations Flux for images, QuickChart for charts).
import { generateImage } from "./ebook-api";

const VISUAL_RE = /^\[VISUAL\b([\s\S]*?)\]\s*(?:→|->)?\s*(.*)$/im;
const CHART_RE = /^\[CHART\b([\s\S]*?)\]\s*(?:→|->)?\s*(.*)$/im;

function parseKv(raw: string): Record<string, string> {
  // raw like: " | style: cinematic | mood: hopeful | scene: ..."
  const out: Record<string, string> = {};
  const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    const idx = p.indexOf(":");
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim().toLowerCase();
    const v = p.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    out[k] = v;
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
  // data: "2020:12, 2021:28, ..." OR "Apples:30, Oranges:20"
  const labels: string[] = [];
  const data: number[] = [];
  for (const pair of (kv.data || "").split(",")) {
    const m = pair.split(":");
    if (m.length < 2) continue;
    const label = m[0].trim();
    const value = parseFloat(m[1].replace(/[^0-9.\-]/g, ""));
    if (!label || !isFinite(value)) continue;
    labels.push(label);
    data.push(value);
  }

  const palette = ["#C44024", "#1E88E5", "#FB8C00", "#2E7D32", "#6A1B9A", "#00838F", "#EF6C00", "#5D4037"];
  const bg = type === "pie" || type === "doughnut"
    ? labels.map((_, i) => palette[i % palette.length])
    : "#C44024";

  const chart = {
    type,
    data: {
      labels,
      datasets: [{ label: title || "Series", data, backgroundColor: bg, borderColor: "#222", borderWidth: 1 }],
    },
    options: {
      title: { display: !!title, text: title, fontSize: 18, fontFamily: "Georgia" },
      legend: { display: type === "pie" || type === "doughnut" },
      plugins: { datalabels: { color: "#222", font: { weight: "bold" } } },
      scales: type === "pie" || type === "doughnut" ? {} : {
        yAxes: [{ ticks: { beginAtZero: true } }],
      },
    },
  };

  const c = encodeURIComponent(JSON.stringify(chart));
  return `https://quickchart.io/chart?w=900&h=520&bkg=white&c=${c}`;
}

export async function enrichChapterContent(
  content: string,
  opts: { emotion?: string; quality?: "fast" | "pro"; coloring?: boolean }
): Promise<string> {
  const lines = (content || "").replace(/\r\n/g, "\n").split("\n");

  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();

    // VISUAL → generate an actual illustration via Pollinations Flux
    const v = t.match(VISUAL_RE);
    if (v) {
      const kv = parseKv(v[1]);
      const tail = v[2]?.trim();
      const scene = kv.scene || tail || "";
      const styleHint = [kv.style, kv.mood, kv.colors].filter(Boolean).join(", ");
      const prompt = [scene, styleHint].filter(Boolean).join(" — ");
      try {
        const img = await generateImage({
          prompt: prompt || "atmospheric editorial illustration",
          kind: "chapter",
          emotion: kv.mood || opts.emotion,
          quality: opts.quality || "fast",
          style: opts.coloring ? "line-art" : "color",
        });
        out.push(`[IMG|${img}|${(scene || "").replace(/\|/g, " ")}]`);
      } catch (e) {
        console.warn("VISUAL render failed, keeping callout", e);
        out.push(line);
      }
      continue;
    }

    // CHART → render via QuickChart (free, open-source)
    const c = t.match(CHART_RE);
    if (c) {
      const kv = parseKv(c[1]);
      const insight = kv.insight || c[2]?.trim() || "";
      try {
        const url = buildQuickChartUrl(kv);
        const dataUrl = await fetchAsDataUrl(url);
        out.push(`[IMG|${dataUrl}|${kv.title || ""}${insight ? ` — ${insight}` : ""}]`);
      } catch (e) {
        console.warn("CHART render failed, keeping callout", e);
        out.push(line);
      }
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

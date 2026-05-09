// Free royalty-free stock photos via Unsplash Source (no API key required).
// Falls back to Picsum (Lorem Picsum) if Unsplash fails.

async function fetchAsDataUrl(url: string, timeoutMs = 25000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
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

export async function getStockPhoto(query: string, w = 1200, h = 800): Promise<string | null> {
  const q = encodeURIComponent(query.split(/\s+/).slice(0, 4).join(","));
  const seed = Math.floor(Math.random() * 100000);
  const tries = [
    `https://source.unsplash.com/${w}x${h}/?${q}&sig=${seed}`,
    `https://picsum.photos/seed/${encodeURIComponent(query + seed)}/${w}/${h}`,
  ];
  for (const url of tries) {
    try {
      const d = await fetchAsDataUrl(url);
      if (d && d.length > 1000) return d;
    } catch (e) {
      console.warn("stock photo failed", url, e);
    }
  }
  return null;
}

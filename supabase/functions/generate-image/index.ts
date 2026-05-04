// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, kind, emotion, quality, style } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const moodLine = emotion ? `Emotional atmosphere: ${emotion}.` : "";
    const isLineArt = style === "line-art";
    const styling = isLineArt
      ? `Coloring book line art. Pure black outlines on solid white background, no shading, no fill, no color, clean continuous strokes, printable, kid-friendly, no text, no letters.`
      : kind === "cover"
        ? `Stunning cinematic eBook cover art, portrait composition, rich depth, professional book-cover quality, dramatic lighting, evocative palette, painterly textures, no text, no letters, no logos, no watermark. ${moodLine}`
        : `Editorial chapter illustration, tasteful, atmospheric, painterly, cinematic palette, no text, no letters, no captions. ${moodLine}`;

    const finalPrompt = `${styling} Subject: ${prompt}`;

    // Free open-source HQ image generation via Pollinations (Flux/Turbo).
    const isCover = kind === "cover";
    // Higher resolution for HQ output
    const width = isCover ? 1024 : 1280;
    const height = isCover ? 1536 : 896;

    // Try high-quality models first, then fall back to faster ones if they fail/timeout.
    const models = quality === "pro"
      ? ["flux", "flux-realism", "flux-anime", "turbo"]
      : ["flux", "turbo"];

    async function tryModel(model: string, timeoutMs: number) {
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=true&private=true`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        return await fetch(url, { signal: ctrl.signal });
      } finally {
        clearTimeout(t);
      }
    }

    let arrayBuffer: ArrayBuffer | null = null;
    let lastErr = "";
    for (let attempt = 0; attempt < models.length + 1; attempt++) {
      const model = models[Math.min(attempt, models.length - 1)];
      try {
        const resp = await tryModel(model, 55000);
        if (resp.ok) {
          arrayBuffer = await resp.arrayBuffer();
          if (arrayBuffer.byteLength > 1000) break;
          lastErr = "empty image";
        } else {
          lastErr = `status ${resp.status}`;
          await resp.text().catch(() => "");
          console.warn(`image attempt ${attempt} model=${model} ${lastErr}`);
        }
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        console.warn(`image attempt ${attempt} model=${model} threw: ${lastErr}`);
      }
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }

    if (!arrayBuffer) {
      return new Response(JSON.stringify({ error: `Image service unavailable: ${lastErr}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return new Response(JSON.stringify({ image: dataUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

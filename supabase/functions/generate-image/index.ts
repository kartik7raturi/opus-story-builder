// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, kind, emotion, quality } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const moodLine = emotion ? `Emotional atmosphere: ${emotion}.` : "";
    const styling = kind === "cover"
      ? `Stunning cinematic eBook cover art, portrait composition, rich depth, professional book-cover quality, dramatic lighting, evocative palette, painterly textures, no text, no letters, no logos, no watermark. ${moodLine}`
      : `Editorial chapter illustration, tasteful, atmospheric, painterly, cinematic palette, no text, no letters, no captions. ${moodLine}`;

    const finalPrompt = `${styling} Subject: ${prompt}`;

    // Pollinations.ai image generation - free, open-source (Flux model), no API key
    const isCover = kind === "cover";
    const width = isCover ? 768 : 1024;
    const height = isCover ? 1152 : 768;
    const model = quality === "pro" ? "flux" : "flux";
    const seed = Math.floor(Math.random() * 1000000);

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=true`;

    const resp = await fetch(url);

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Pollinations image error", resp.status, text);
      return new Response(JSON.stringify({ error: `Image service error: ${resp.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // base64 encode
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

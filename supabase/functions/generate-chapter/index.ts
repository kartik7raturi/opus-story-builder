// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { bookTitle, emotion, tone, audience, chapter, prevSummary, wordsTarget } = await req.json();
    if (!chapter?.title) {
      return new Response(JSON.stringify({ error: "chapter.title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = Math.min(Math.max(Number(wordsTarget) || 1500, 600), 3500);

    const system = `You are a bestselling author. You write rich, immersive eBook chapters with strong voice, sensory detail, concrete examples, and clear structure. Use proper paragraphs separated by blank lines. Use ## for section headings within the chapter when appropriate. Do NOT include the chapter number or chapter title heading at the top — the layout adds them. Do not include any meta commentary. Aim for ~${target} words.`;

    const user = `Book: "${bookTitle}"
Primary emotion: ${emotion || "inspiring"}
Tone: ${tone || "engaging, vivid"}
Audience: ${audience || "general readers"}
${prevSummary ? `Previous chapter recap (for continuity): ${prevSummary}\n` : ""}
Write CHAPTER ${chapter.number}: "${chapter.title}".
Chapter summary: ${chapter.summary}
Key points to cover (weave them naturally, do not list them):
${(chapter.key_points || []).map((p: string) => `- ${p}`).join("\n")}

Write the full chapter now. Markdown allowed (## subheadings, *emphasis*, **bold**, > blockquotes, - bullet lists). End with a short, resonant closing paragraph.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Slowing down — please retry." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("AI chapter error", resp.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-chapter error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

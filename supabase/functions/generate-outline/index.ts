// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, emotion, audience, tone, chapters, tags, extra } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numChapters = Math.min(Math.max(Number(chapters) || 9, 3), 20);

    const system = `You are an award-winning book editor. Output STRICT JSON only — no prose, no markdown fences, no commentary. Just the JSON object.`;

    const user = `Design a complete eBook outline.

Title: "${title}"
Primary emotion / mood: ${emotion || "inspiring"}
Tone: ${tone || "engaging, vivid, modern"}
Target audience: ${audience || "general readers"}
Number of chapters: ${numChapters}
Suggested tags: ${tags || "(propose 6 strong ones)"}
Extra notes: ${extra || "(none)"}

Return ONLY this JSON shape, nothing else:
{
  "title": "refined polished title",
  "subtitle": "compelling subtitle",
  "author_pen_name": "tasteful pen name",
  "tagline": "single-sentence hook",
  "description": "120-180 word back-cover blurb",
  "tags": ["6-10 tags"],
  "cover_prompt": "detailed art-direction prompt for cover image (no text on cover, evocative, cinematic)",
  "chapters": [
    {
      "number": 1,
      "title": "chapter title",
      "summary": "2-3 sentence summary",
      "key_points": ["4-6 bullet points"],
      "image_prompt": "detailed visual prompt (no text in image)"
    }
  ]
}
Generate exactly ${numChapters} chapters.`;

    // Pollinations.ai - free, open-source, no API key, no limits
    const resp = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        seed: Math.floor(Math.random() * 1000000),
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Pollinations outline error", resp.status, text);
      return new Response(JSON.stringify({ error: `AI service error: ${resp.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let outline: any;
    try { outline = JSON.parse(content); } catch {
      const cleaned = content.replace(/```json|```/g, "").trim();
      // try to extract JSON object
      const match = cleaned.match(/\{[\s\S]*\}/);
      outline = JSON.parse(match ? match[0] : cleaned);
    }

    return new Response(JSON.stringify({ outline }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outline error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

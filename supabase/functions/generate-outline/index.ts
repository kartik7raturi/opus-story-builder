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

    const { title, emotion, audience, tone, chapters, tags, extra } = await req.json();

    if (!title || typeof title !== "string") {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numChapters = Math.min(Math.max(Number(chapters) || 9, 3), 20);

    const system = `You are an award-winning book editor and author. You design captivating, well-structured non-fiction and fiction eBook outlines. Output strict JSON only — no prose, no markdown fences.`;

    const user = `Design a complete eBook outline.

Title: "${title}"
Primary emotion / mood: ${emotion || "inspiring"}
Tone: ${tone || "engaging, vivid, modern"}
Target audience: ${audience || "general readers"}
Number of chapters: ${numChapters}
Suggested tags/keywords from user: ${tags || "(none — propose 6 strong ones)"}
Extra notes: ${extra || "(none)"}

Return JSON with this exact shape:
{
  "title": string,                     // refined polished title
  "subtitle": string,                  // compelling subtitle
  "author_pen_name": string,           // a tasteful pen name appropriate to the topic
  "tagline": string,                   // single-sentence hook for cover
  "description": string,               // 120-180 word back-cover blurb
  "tags": string[],                    // 6-10 SEO/discovery tags
  "cover_prompt": string,              // detailed art-direction prompt for an AI cover image (no text on cover, evocative, cinematic)
  "chapters": [
    {
      "number": number,
      "title": string,
      "summary": string,               // 2-3 sentence summary of the chapter
      "key_points": string[],          // 4-6 bullet points the chapter must cover
      "image_prompt": string           // detailed visual prompt for a chapter illustration (no text in image)
    }
  ]
}`;

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
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("AI outline error", resp.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let outline: any;
    try { outline = JSON.parse(content); } catch {
      // attempt to strip code fences
      const cleaned = content.replace(/```json|```/g, "").trim();
      outline = JSON.parse(cleaned);
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

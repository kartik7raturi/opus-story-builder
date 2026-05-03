// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { bookTitle, emotion, tone, audience, chapter, prevSummary, wordsTarget } = await req.json();
    if (!chapter?.title) {
      return new Response(JSON.stringify({ error: "chapter.title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = Math.min(Math.max(Number(wordsTarget) || 1500, 600), 3500);

    const system = `You are a bestselling author. You write rich, immersive eBook chapters with strong voice, sensory detail, concrete examples, and clear structure. Use proper paragraphs separated by blank lines. Use ## for section headings within the chapter when appropriate. Do NOT include the chapter number or chapter title heading at the top — the layout adds them. Do not include any meta commentary. Aim for approximately ${target} words.`;

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

    // Pollinations.ai - free open-source AI. Retry on timeouts (524/502/503/504).
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    async function callPollinations(model: string, timeoutMs: number) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        return await fetch("https://text.pollinations.ai/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages,
            seed: Math.floor(Math.random() * 1000000),
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
    }

    const models = ["openai", "openai-fast", "mistral"];
    let content = "";
    let lastErr = "";
    outer: for (let attempt = 0; attempt < 4; attempt++) {
      const model = models[Math.min(attempt, models.length - 1)];
      try {
        const resp = await callPollinations(model, 55000);
        if (resp.ok) {
          const data = await resp.json();
          content = data.choices?.[0]?.message?.content ?? "";
          if (content.trim().length > 200) break outer;
          lastErr = "empty/short content";
        } else {
          lastErr = `status ${resp.status}`;
          await resp.text().catch(() => "");
          console.warn(`chapter attempt ${attempt} model=${model} ${lastErr}`);
        }
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        console.warn(`chapter attempt ${attempt} model=${model} threw: ${lastErr}`);
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }

    if (!content || content.trim().length < 200) {
      // Last-resort fallback: synthesize a placeholder chapter so the eBook can complete.
      const kp = (chapter.key_points || []).map((p: string) => `- ${p}`).join("\n");
      content = `*The AI service is currently overloaded. A draft outline has been inserted so your eBook can finish — you can regenerate this chapter later.*\n\n## Overview\n\n${chapter.summary}\n\n## Key Points\n\n${kp}\n\n## Reflection\n\nThis chapter on **${chapter.title}** explores the heart of "${bookTitle}" through a ${emotion || "inspiring"} lens. Consider how each point connects to your own experience.`;
      console.error("chapter fallback used. lastErr=", lastErr);
    }

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

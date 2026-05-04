// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TYPE_DIRECTIVES: Record<string, string> = {
  standard:   "Premium general-interest writing. Mix story + insight.",
  self_help:  "Frameworks, examples, breakthroughs. End with practical exercises.",
  fiction:    "Scene-driven prose. Sensory detail, dialogue, character interiority.",
  biography:  "Life-as-narrative. Concrete scenes, voice, motivations.",
  technical:  "Expert clarity. Step-by-step. Code or worked examples where useful.",
  workbook:   "Heavy task-density. Short teaching, lots of doing.",
  journal:    "Guided prompts. Short reflective intros + multiple writing prompts.",
  cookbook:   "Each chapter = themed recipe(s). Ingredients list, steps, variations.",
  kids:       "Ages 4–10 voice. Short sentences, wonder, gentle lessons.",
  coloring:   "Each chapter is a themed line-art scene + a one-paragraph caption.",
  game:       "Each chapter contains puzzles, riddles, or choose-your-path mini-games.",
  comic:      "Panel-by-panel script: PANEL 1 [visual] / CAPTION / DIALOGUE.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { bookTitle, emotion, tone, audience, characters, ebookType, chapter, prevSummary, wordsTarget } = await req.json();
    if (!chapter?.title) {
      return new Response(JSON.stringify({ error: "chapter.title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = Math.min(Math.max(Number(wordsTarget) || 1500, 600), 3500);
    const directive = TYPE_DIRECTIVES[ebookType || "standard"] || TYPE_DIRECTIVES.standard;
    const charLine = Array.isArray(characters) && characters.length
      ? `Recurring characters/voices: ${characters.join("; ")}.` : "";

    const system = `You are an elite ebook author writing premium Amazon-KDP-quality chapters.

QUALITY STANDARDS — follow on every chapter:

WRITING: Hemingway-clean prose. Short punchy sentences for impact. Longer flowing sentences for description. Vary rhythm. Use metaphors that illuminate, not decorate. Open every chapter with a hook scene.

VISUALS: Before every major concept include a [VISUAL] block describing an AI image. Format exactly:
[VISUAL | style: cinematic | mood: hopeful | colors: warm gold and deep teal | scene: a lone figure at sunrise on a mountain ridge]

CHARTS: Where data illustrates a point, include a [CHART] block. Format exactly:
[CHART | type: bar | title: "Growth Over 5 Years" | data: 2020:12, 2021:28, 2022:45, 2023:67, 2024:89 | insight: "growth accelerated after Year 2"]

TASKS: End EVERY chapter with exactly 3 exercises tagged by difficulty, on their own lines:
[TASK | level: beginner | time: 5 min] → task description
[TASK | level: intermediate | time: 20 min] → task description
[TASK | level: advanced | time: 1 hour] → task description

Use proper paragraphs separated by blank lines. Use ## for sub-section headings inside the chapter. Do NOT include the chapter number or title at the top — the layout adds them. No meta commentary. Aim for ~${target} words.`;

    const user = `Book: "${bookTitle}"
Type direction: ${directive}
Primary emotion: ${emotion || "inspiring"}
Tone: ${tone || "Hemingway-clean, vivid"}
Audience: ${audience || "general readers"}
${charLine}
${prevSummary ? `Previous chapter recap: ${prevSummary}` : ""}

Write CHAPTER ${chapter.number}: "${chapter.title}".
Chapter summary: ${chapter.summary}
Key points to weave in naturally:
${(chapter.key_points || []).map((p: string) => `- ${p}`).join("\n")}

Write the full chapter NOW with [VISUAL], [CHART] (where it fits), and end with the 3 [TASK] blocks. Markdown allowed (## subheadings, *emphasis*, **bold**, > blockquotes, - bullets).`;

    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    async function call(model: string, timeoutMs: number) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        return await fetch("https://text.pollinations.ai/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, seed: Math.floor(Math.random() * 1000000) }),
          signal: ctrl.signal,
        });
      } finally { clearTimeout(t); }
    }

    const models = ["openai", "openai-fast", "mistral"];
    let content = "";
    let lastErr = "";
    outer: for (let attempt = 0; attempt < 4; attempt++) {
      const model = models[Math.min(attempt, models.length - 1)];
      try {
        const resp = await call(model, 55000);
        if (resp.ok) {
          const data = await resp.json();
          content = data.choices?.[0]?.message?.content ?? "";
          if (content.trim().length > 200) break outer;
          lastErr = "empty/short content";
        } else {
          lastErr = `status ${resp.status}`;
          await resp.text().catch(() => "");
        }
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }

    if (!content || content.trim().length < 200) {
      const kp = (chapter.key_points || []).map((p: string) => `- ${p}`).join("\n");
      content = `*The AI service was overloaded — a draft outline is inserted; regenerate later.*

[VISUAL | style: cinematic | mood: ${emotion || "hopeful"} | colors: warm and atmospheric | scene: opening scene for "${chapter.title}"]

## Overview

${chapter.summary}

## Key Points

${kp}

[TASK | level: beginner | time: 5 min] → Reflect on the central idea of this chapter in writing.
[TASK | level: intermediate | time: 20 min] → Apply one key point to a real situation in your life.
[TASK | level: advanced | time: 1 hour] → Teach this chapter's lesson to someone else.`;
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

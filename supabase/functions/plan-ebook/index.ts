// deno-lint-ignore-file no-explicit-any
import { corsHeaders, lovableChat, ruleFor, AGE_VOCAB } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { title, ebookType = "standard", notes = "", ageGroup } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rule = ruleFor(ebookType);
    const age = ageGroup || rule.ageDefault;

    const system = `You are an elite ebook architect. Think step-by-step like a senior editor planning a premium book. Output STRICT JSON only — no prose, no markdown.`;

    const user = `Create an "AI Thinking" plan for this ebook BEFORE we write it.

TITLE: "${title}"
TYPE: ${ebookType}
USER NOTES: ${notes || "(none)"}
TARGET AGE GROUP: ${age}
AGE TONE RULE: ${AGE_VOCAB[age]}

Type composition rules (MUST follow):
- Needs full story: ${rule.needsStory}
- Needs charts/data: ${rule.needsCharts}
- Needs tasks/exercises: ${rule.needsTasks}
- Needs images: ${rule.needsImages} (style: ${rule.imageStyle})
- Text mode: ${rule.textMode}
- Use copyright-free stock photos: ${rule.useStockPhotos}

Return JSON:
{
  "thinking": "200-400 word chain-of-thought reasoning about WHY this approach fits the title, audience, and type. First-person, like an editor's notebook.",
  "audience": "specific reader persona (1 sentence)",
  "ageGroup": "${age}",
  "tone": "writing tone (specific, e.g. 'warm bedtime voice' or 'crisp Hemingway')",
  "theme": "core thematic thread",
  "emotion": "primary emotional palette",
  "structure": "how chapters will progress (1-2 sentences)",
  "composition": {
    "story": ${rule.needsStory},
    "charts": ${rule.needsCharts},
    "tasks": ${rule.needsTasks},
    "images": ${rule.needsImages},
    "stockPhotos": ${rule.useStockPhotos}
  },
  "tags": ["6-8 KDP tags"]
}`;

    const content = await lovableChat({ system, user, json: true, temperature: 0.85 });
    let plan: any;
    try { plan = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      plan = m ? JSON.parse(m[0]) : null;
    }
    if (!plan) plan = {
      thinking: `Planning a ${ebookType} ebook titled "${title}" for ${age} audience.`,
      audience: "general readers",
      ageGroup: age,
      tone: "engaging and clear",
      theme: title,
      emotion: "engaging",
      structure: "Progressive chapter arc.",
      composition: { story: rule.needsStory, charts: rule.needsCharts, tasks: rule.needsTasks, images: rule.needsImages, stockPhotos: rule.useStockPhotos },
      tags: [ebookType, "ebook"],
    };
    plan.ageGroup = plan.ageGroup || age;
    plan.composition = plan.composition || { story: rule.needsStory, charts: rule.needsCharts, tasks: rule.needsTasks, images: rule.needsImages, stockPhotos: rule.useStockPhotos };

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plan-ebook error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

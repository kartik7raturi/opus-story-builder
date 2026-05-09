// deno-lint-ignore-file no-explicit-any
import { corsHeaders, lovableChat, ruleFor, AGE_VOCAB } from "../_shared/ai.ts";

const cleanJson = (s: string) => s.replace(/```json|```/g, "").trim();
const extractJson = (s: string) => {
  const c = cleanJson(s);
  const i = c.indexOf("{");
  if (i < 0) return c;
  let d = 0, str = false, esc = false;
  for (let k = i; k < c.length; k++) {
    const ch = c[k];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') str = !str;
    if (str) continue;
    if (ch === "{") d++;
    if (ch === "}") d--;
    if (d === 0) return c.slice(i, k + 1);
  }
  return c.slice(i);
};
const parse = (s: string) => {
  for (const c of [s, cleanJson(s), extractJson(s)]) {
    try { return JSON.parse(c); } catch { /* */ }
  }
  return null;
};

const fallback = ({ title, ebookType, numChapters, plan }: any) => {
  const rule = ruleFor(ebookType);
  const themes = ["The Beginning","Discovery","The Challenge","A New Path",
    "Turning Point","Tools & Wisdom","Stories That Matter","Deeper Truths",
    "Building Forward","Transformation"];
  return {
    title: String(title).trim(),
    subtitle: `A ${ebookType.replace("_"," ")} for curious readers`,
    author_pen_name: "Avery Quinn",
    tagline: plan?.theme || `A vivid journey through ${title}.`,
    description: `${title} — designed for ${plan?.audience || "engaged readers"}.`,
    emotion: plan?.emotion || "engaging",
    tone: plan?.tone || "clear and vivid",
    audience: plan?.audience || "general readers",
    ageGroup: plan?.ageGroup || rule.ageDefault,
    characters: rule.needsStory ? ["Protagonist", "Mentor", "Companion"] : [],
    tags: plan?.tags || [ebookType, "ebook"],
    chapters: Array.from({ length: numChapters }, (_, i) => ({
      number: i + 1,
      title: themes[i] || `Chapter ${i + 1}`,
      summary: `Chapter ${i + 1} of ${title}.`,
      key_points: ["Opening hook", "Core idea", "Example", "Takeaway"],
      image_prompt: `Editorial illustration for "${themes[i] || `chapter ${i + 1}`}" of ${title}, no text`,
    })),
  };
};

const normalize = (parsed: any, fb: any, n: number) => {
  const c = parsed?.outline && typeof parsed.outline === "object" ? parsed.outline : parsed;
  const chs = Array.isArray(c?.chapters) ? c.chapters : [];
  const usable = chs.map((ch: any, i: number) => ({
    number: Number(ch?.number) || i + 1,
    title: String(ch?.title || fb.chapters[i]?.title || `Chapter ${i + 1}`).trim(),
    summary: String(ch?.summary || fb.chapters[i]?.summary || "").trim(),
    key_points: Array.isArray(ch?.key_points) && ch.key_points.length
      ? ch.key_points.map(String).filter(Boolean).slice(0, 6)
      : fb.chapters[i]?.key_points || [],
    image_prompt: String(ch?.image_prompt || fb.chapters[i]?.image_prompt || `Illustration for ${fb.title}`).trim(),
  })).filter((x: any) => x.title).slice(0, n);

  if (!c || usable.length === 0) return fb;
  const completed = usable.length >= n ? usable : [...usable, ...fb.chapters.slice(usable.length, n)];
  return {
    ...fb, ...c,
    title: String(c.title || fb.title).trim(),
    subtitle: String(c.subtitle || fb.subtitle).trim(),
    author_pen_name: String(c.author_pen_name || fb.author_pen_name).trim(),
    tagline: String(c.tagline || fb.tagline).trim(),
    description: String(c.description || fb.description).trim(),
    emotion: String(c.emotion || fb.emotion).trim(),
    tone: String(c.tone || fb.tone).trim(),
    audience: String(c.audience || fb.audience).trim(),
    ageGroup: String(c.ageGroup || fb.ageGroup).trim(),
    characters: Array.isArray(c.characters) ? c.characters.map(String).slice(0, 5) : fb.characters,
    tags: Array.isArray(c.tags) && c.tags.length ? c.tags.map(String).slice(0, 10) : fb.tags,
    chapters: completed.map((x: any, i: number) => ({ ...x, number: i + 1 })),
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { title, ebookType = "standard", notes = "", chapters, plan } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const n = Math.min(Math.max(Number(chapters) || 9, 3), 20);
    const rule = ruleFor(ebookType);
    const age = plan?.ageGroup || rule.ageDefault;

    const system = `You are an elite ebook architect. Output STRICT JSON only — no prose, no markdown fences. Make bold, specific choices appropriate for the audience and type.`;

    const user = `Design a complete premium ebook outline.

TITLE: "${title}"
EBOOK TYPE: ${ebookType}
TEXT MODE: ${rule.textMode}
AGE GROUP: ${age}
AGE RULES: ${AGE_VOCAB[age]}
USER NOTES: ${notes || "(none)"}
CHAPTERS: ${n}

${plan ? `PLANNING CONTEXT:
- Audience: ${plan.audience}
- Tone: ${plan.tone}
- Theme: ${plan.theme}
- Emotion: ${plan.emotion}
- Structure: ${plan.structure}
` : ""}

Return ONLY JSON:
{
  "title": "polished title",
  "subtitle": "compelling subtitle",
  "author_pen_name": "tasteful pen name fitting the genre",
  "tagline": "single hook sentence",
  "description": "120-180 word back-cover blurb (age-appropriate vocabulary)",
  "emotion": "primary emotional palette",
  "tone": "writing tone",
  "audience": "specific reader persona",
  "ageGroup": "${age}",
  "characters": ${rule.needsStory ? '["3-5 named characters with one-line traits"]' : "[]"},
  "tags": ["6-10 KDP tags"],
  "chapters": [
    {
      "number": 1,
      "title": "evocative chapter title",
      "summary": "2-3 sentence summary",
      "key_points": ["4-6 key points"],
      "image_prompt": "detailed visual prompt (NO text in image)"
    }
  ]
}
Generate exactly ${n} chapters with strong progression.`;

    let content = "{}";
    try {
      content = await lovableChat({ system, user, json: true, temperature: 0.85 });
    } catch (e) {
      console.error("lovableChat outline failed", e);
    }
    const parsed = parse(content);
    const fb = fallback({ title, ebookType, numChapters: n, plan });
    const outline = normalize(parsed, fb, n);

    return new Response(JSON.stringify({ outline }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outline error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

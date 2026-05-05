// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cleanJsonText = (value: string) => value.replace(/```json|```/g, "").trim();

const extractBalancedJson = (value: string) => {
  const cleaned = cleanJsonText(value);
  const start = cleaned.indexOf("{");
  if (start === -1) return cleaned;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return cleaned.slice(start, i + 1);
  }
  return cleaned.slice(start);
};

const parseOutlineJson = (content: string) => {
  const candidates = [content, cleanJsonText(content), extractBalancedJson(content)];
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
  }
  return null;
};

const TYPE_GUIDANCE: Record<string, string> = {
  standard:   "A premium general-interest book. Balanced narrative + insight.",
  self_help:  "Transformation framework. Clear models, exercises, breakthroughs.",
  fiction:    "Story-driven novel. Characters, arcs, conflict, sensory scenes.",
  biography:  "Life-narrative arc. Real-feeling scenes, voice, turning points.",
  technical:  "Expert step-by-step guide. Code-like clarity, deep examples.",
  workbook:   "Action-heavy. Each chapter loaded with exercises and reflection.",
  journal:    "Guided journal. Prompts and white-space for writing.",
  cookbook:   "Recipes. Ingredients, steps, plating notes, variations per chapter.",
  kids:       "For ages 4–10. Simple language, big imagery, gentle lessons.",
  coloring:   "Coloring book. Each chapter is a themed line-art scene + caption.",
  game:       "Game book. Puzzles, choose-paths, mini-challenges per chapter.",
  comic:      "Comic / graphic. Panel-by-panel visual storytelling.",
};

const buildFallbackOutline = ({ title, ebookType, notes, numChapters }: any) => {
  const type = ebookType || "standard";
  const themes = ["The First Spark","Understanding the World","The Hidden Challenge","A New Method",
    "The Turning Point","Tools for the Journey","Stories of Change","The Deeper Lesson",
    "Building the Future","The Final Transformation"];
  return {
    title: String(title).trim(),
    subtitle: `A premium ${type.replace("_"," ")} ebook`,
    author_pen_name: "Avery Quinn",
    tagline: `A vivid journey through ${title}.`,
    description: `This ebook explores ${title} with structure, voice, and visual richness. ${notes || ""}`.trim(),
    emotion: "inspiring & cinematic",
    tone: "Hemingway-clean, vivid",
    audience: "general readers",
    characters: ["Narrator (warm, observant)", "Protagonist seeking change"],
    tags: ["ebook","guide","transformation","story","insight","growth"],
    cover_prompt: `Cinematic premium ebook cover for ${title}, dramatic lighting, symbolic imagery, no text`,
    chapters: Array.from({ length: numChapters }, (_, i) => ({
      number: i + 1,
      title: themes[i] || `Chapter ${i + 1}`,
      summary: `A polished chapter developing ${title}.`,
      key_points: ["Hook scene","Central idea","Examples & emotion","Strong transition"],
      image_prompt: `Cinematic illustration for chapter ${i + 1} of ${title}, no text`,
    })),
  };
};

const normalizeOutline = (parsed: any, fallback: any, numChapters: number) => {
  const candidate = parsed?.outline && typeof parsed.outline === "object" ? parsed.outline : parsed;
  const chapters = Array.isArray(candidate?.chapters) ? candidate.chapters : [];
  const usableChapters = chapters
    .map((chapter: any, index: number) => ({
      number: Number(chapter?.number) || index + 1,
      title: String(chapter?.title || fallback.chapters[index]?.title || `Chapter ${index + 1}`).trim(),
      summary: String(chapter?.summary || fallback.chapters[index]?.summary || fallback.description).trim(),
      key_points: Array.isArray(chapter?.key_points) && chapter.key_points.length
        ? chapter.key_points.map((point: any) => String(point)).filter(Boolean).slice(0, 6)
        : fallback.chapters[index]?.key_points || ["Opening hook", "Core lesson", "Practical example", "Reader takeaway"],
      image_prompt: String(chapter?.image_prompt || fallback.chapters[index]?.image_prompt || `Editorial illustration for ${fallback.title}`).trim(),
    }))
    .filter((chapter: any) => chapter.title && chapter.summary)
    .slice(0, numChapters);

  if (!candidate || typeof candidate !== "object" || usableChapters.length === 0) return fallback;

  const completedChapters = usableChapters.length >= numChapters
    ? usableChapters
    : [...usableChapters, ...fallback.chapters.slice(usableChapters.length, numChapters)];

  return {
    ...fallback,
    ...candidate,
    title: String(candidate.title || fallback.title).trim(),
    subtitle: String(candidate.subtitle || fallback.subtitle).trim(),
    author_pen_name: String(candidate.author_pen_name || fallback.author_pen_name).trim(),
    tagline: String(candidate.tagline || fallback.tagline).trim(),
    description: String(candidate.description || fallback.description).trim(),
    emotion: String(candidate.emotion || fallback.emotion).trim(),
    tone: String(candidate.tone || fallback.tone).trim(),
    audience: String(candidate.audience || fallback.audience).trim(),
    characters: Array.isArray(candidate.characters) && candidate.characters.length ? candidate.characters.map(String).slice(0, 5) : fallback.characters,
    tags: Array.isArray(candidate.tags) && candidate.tags.length ? candidate.tags.map(String).slice(0, 10) : fallback.tags,
    cover_prompt: String(candidate.cover_prompt || fallback.cover_prompt).trim(),
    chapters: completedChapters.map((chapter: any, index: number) => ({ ...chapter, number: index + 1 })),
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, ebookType = "standard", notes = "", chapters } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const numChapters = Math.min(Math.max(Number(chapters) || 9, 3), 20);
    const guidance = TYPE_GUIDANCE[ebookType] || TYPE_GUIDANCE.standard;

    const system = `You are an elite ebook architect and storyteller. Your mission is to design professional, visually stunning, deeply engaging Amazon-KDP-quality ebooks. You combine compelling narrative arcs with emotional resonance, rich visual descriptions for AI image generation, data-driven charts, actionable exercises, and expert knowledge structured for maximum retention. Be specific, vivid, purposeful — never generic.

You auto-derive: characters, emotion, tone, audience, tags, and creative direction from minimal user input. Output STRICT JSON only — no prose, no markdown fences.`;

    const user = `Design a complete, premium ebook outline.

TITLE: "${title}"
EBOOK TYPE: ${ebookType} — ${guidance}
USER NOTES: ${notes || "(none — invent the best direction yourself)"}
CHAPTERS: ${numChapters}

You MUST infer the emotional palette, tone, target audience, tags, and characters from the title + type. Make bold, specific choices.

Return ONLY this JSON shape:
{
  "title": "polished refined title",
  "subtitle": "compelling subtitle",
  "author_pen_name": "tasteful pen name",
  "tagline": "single-sentence hook",
  "description": "120-180 word back-cover blurb",
  "emotion": "primary emotional palette (e.g. 'hopeful and quietly defiant')",
  "tone": "writing tone (e.g. 'Hemingway-clean, cinematic, intimate')",
  "audience": "specific audience persona",
  "characters": ["3-5 named characters or archetypes with one-line traits"],
  "tags": ["6-10 strong KDP tags"],
  "cover_prompt": "detailed cinematic cover art-direction (NO text on cover)",
  "chapters": [
    {
      "number": 1,
      "title": "evocative chapter title",
      "summary": "2-3 sentence summary",
      "key_points": ["4-6 key points to cover"],
      "image_prompt": "detailed visual prompt for chapter art (NO text in image)"
    }
  ]
}
Generate exactly ${numChapters} chapters with strong narrative progression.`;

    const models = ["openai", "openai-fast", "mistral"];
    async function call(model: string, timeoutMs: number) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        return await fetch("https://text.pollinations.ai/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            response_format: { type: "json_object" },
            max_tokens: 6000,
            temperature: 0.8,
            seed: Math.floor(Math.random() * 1000000),
          }),
          signal: ctrl.signal,
        });
      } finally { clearTimeout(t); }
    }

    let content = "{}";
    let lastErr = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      const model = models[Math.min(attempt, models.length - 1)];
      try {
        const resp = await call(model, 50000);
        if (resp.ok) {
          const data = await resp.json();
          content = data.choices?.[0]?.message?.content ?? "{}";
          if (content && content.trim().length > 50) break;
          lastErr = "empty content";
        } else {
          lastErr = `status ${resp.status}`;
          await resp.text().catch(() => "");
        }
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }

    const parsed = parseOutlineJson(content);
    const fallback = buildFallbackOutline({ title, ebookType, notes, numChapters });
    const outline = normalizeOutline(parsed, fallback, numChapters);
    if (outline === fallback) console.error("outline fallback used. lastErr=", lastErr, "raw=", content.slice(0, 300));

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

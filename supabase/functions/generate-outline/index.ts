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

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
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
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next safer candidate before falling back.
    }
  }
  return null;
};

const buildFallbackOutline = ({ title, emotion, audience, tone, tags, extra, numChapters }: {
  title: string;
  emotion?: string;
  audience?: string;
  tone?: string;
  tags?: string;
  extra?: string;
  numChapters: number;
}) => {
  const mood = emotion || "inspiring";
  const reader = audience || "general readers";
  const tagList = (tags || "ebook, transformation, guide, story, creativity, growth")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);

  const chapterThemes = [
    "The First Spark",
    "Understanding the World",
    "The Hidden Challenge",
    "A New Method",
    "The Turning Point",
    "Tools for the Journey",
    "Stories of Change",
    "The Deeper Lesson",
    "Building the Future",
    "The Final Transformation",
  ];

  return {
    title: title.trim(),
    subtitle: `A ${mood} ebook for ${reader}`,
    author_pen_name: "Avery Quinn",
    tagline: `A vivid, ${tone || "engaging"} journey through ${title}.`,
    description: `This ebook explores ${title} with a ${mood} emotional direction, practical structure, and polished storytelling for ${reader}. It blends clear chapters, memorable examples, reflective moments, and useful takeaways so readers can move from curiosity to confidence. ${extra ? `It also includes these requested notes: ${extra}` : ""}`.trim(),
    tags: tagList.length >= 6 ? tagList : [...tagList, "ebook", "guide", "learning", "inspiration"].slice(0, 10),
    cover_prompt: `High-quality cinematic ebook cover artwork for ${title}, ${mood} mood, premium editorial composition, symbolic imagery, rich lighting, no text, no letters, no logo`,
    chapters: Array.from({ length: numChapters }, (_, index) => ({
      number: index + 1,
      title: chapterThemes[index] || `Chapter ${index + 1}`,
      summary: `A polished chapter that develops ${title} through a ${mood} lens, giving ${reader} a clear progression and meaningful insight.`,
      key_points: [
        "Open with a vivid scene or question",
        "Explain the central idea clearly",
        "Add practical examples and emotional depth",
        "End with a strong transition to the next chapter",
      ],
      image_prompt: `Premium cinematic illustration for chapter ${index + 1} of ${title}, ${mood} atmosphere, editorial book art, detailed scene, no text, no typography`,
    })),
  };
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
        max_tokens: 6000,
        temperature: 0.7,
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
    const outline = parseOutlineJson(content) ?? buildFallbackOutline({
      title,
      emotion,
      audience,
      tone,
      tags,
      extra,
      numChapters,
    });

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

// Shared Lovable AI Gateway helper. Free Google Gemini for text.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function lovableChat(args: {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  const models = [
    "google/gemini-2.5-flash",
    "google/gemini-2.5-flash-lite",
  ];

  let lastErr = "";
  for (const model of models) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    try {
      const resp = await fetch(GATEWAY, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
          ],
          temperature: args.temperature ?? 0.85,
          ...(args.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content ?? "";
        if (content && String(content).trim().length > 30) return content;
        lastErr = "empty content";
      } else {
        lastErr = `status ${resp.status}`;
        if (resp.status === 429) lastErr = "Rate limit — please retry in a moment.";
        if (resp.status === 402) lastErr = "AI credits exhausted. Add credits in Workspace settings.";
        await resp.text().catch(() => "");
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error(`AI gateway failed: ${lastErr}`);
}

// Type rules govern what each ebook type contains.
export type TypeRule = {
  needsStory: boolean;
  needsCharts: boolean;
  needsTasks: boolean;
  needsImages: boolean;
  imageStyle: "color" | "line-art" | "illustration";
  textMode: "full-story" | "instructional" | "minimal-caption" | "puzzle" | "qa" | "recipe" | "panel-script";
  ageDefault: "kids-4-7" | "kids-8-12" | "teen" | "adult";
  useStockPhotos: boolean;
};

export const TYPE_RULES: Record<string, TypeRule> = {
  standard:   { needsStory: false, needsCharts: true,  needsTasks: true,  needsImages: true,  imageStyle: "illustration", textMode: "instructional",   ageDefault: "adult",      useStockPhotos: true  },
  self_help:  { needsStory: false, needsCharts: true,  needsTasks: true,  needsImages: true,  imageStyle: "illustration", textMode: "instructional",   ageDefault: "adult",      useStockPhotos: true  },
  fiction:    { needsStory: true,  needsCharts: false, needsTasks: false, needsImages: true,  imageStyle: "color",        textMode: "full-story",      ageDefault: "adult",      useStockPhotos: false },
  biography:  { needsStory: true,  needsCharts: false, needsTasks: false, needsImages: true,  imageStyle: "illustration", textMode: "full-story",      ageDefault: "adult",      useStockPhotos: true  },
  technical:  { needsStory: false, needsCharts: true,  needsTasks: true,  needsImages: true,  imageStyle: "illustration", textMode: "instructional",   ageDefault: "adult",      useStockPhotos: true  },
  workbook:   { needsStory: false, needsCharts: true,  needsTasks: true,  needsImages: true,  imageStyle: "illustration", textMode: "instructional",   ageDefault: "adult",      useStockPhotos: true  },
  journal:    { needsStory: false, needsCharts: false, needsTasks: true,  needsImages: false, imageStyle: "illustration", textMode: "instructional",   ageDefault: "adult",      useStockPhotos: false },
  cookbook:   { needsStory: false, needsCharts: false, needsTasks: false, needsImages: true,  imageStyle: "color",        textMode: "recipe",          ageDefault: "adult",      useStockPhotos: true  },
  kids:       { needsStory: true,  needsCharts: false, needsTasks: false, needsImages: true,  imageStyle: "illustration", textMode: "full-story",      ageDefault: "kids-4-7",   useStockPhotos: false },
  coloring:   { needsStory: false, needsCharts: false, needsTasks: false, needsImages: true,  imageStyle: "line-art",     textMode: "minimal-caption", ageDefault: "kids-4-7",   useStockPhotos: false },
  game:       { needsStory: false, needsCharts: false, needsTasks: true,  needsImages: true,  imageStyle: "illustration", textMode: "puzzle",          ageDefault: "kids-8-12",  useStockPhotos: false },
  quiz:       { needsStory: false, needsCharts: false, needsTasks: true,  needsImages: false, imageStyle: "illustration", textMode: "qa",              ageDefault: "teen",       useStockPhotos: false },
  comic:      { needsStory: true,  needsCharts: false, needsTasks: false, needsImages: true,  imageStyle: "color",        textMode: "panel-script",    ageDefault: "teen",       useStockPhotos: false },
};

export function ruleFor(t?: string): TypeRule {
  return TYPE_RULES[t || "standard"] || TYPE_RULES.standard;
}

export const AGE_VOCAB: Record<string, string> = {
  "kids-4-7":  "Vocabulary for ages 4-7. Very simple words, 5-10 word sentences, playful repetition, gentle warmth, wonder. NO scary, violent, romantic, or adult content. NO complex concepts.",
  "kids-8-12": "Vocabulary for ages 8-12. Simple but vivid words, short sentences, light adventure ok, friendship themes, age-appropriate challenges. NO romance, violence, profanity, or adult themes.",
  "teen":      "Vocabulary for teens 13-17. Age-appropriate themes (identity, friendship, growth, mild adventure). No explicit content, profanity, drugs, or sexual themes.",
  "adult":     "Adult vocabulary, full nuance, sophisticated themes ok.",
};

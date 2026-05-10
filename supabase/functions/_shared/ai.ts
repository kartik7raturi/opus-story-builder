// Free open-source AI helper using Pollinations.ai — no API key, no credits required.
// Pollinations exposes an OpenAI-compatible endpoint backed by free open models
// (Mistral, Llama, OpenAI community endpoints).
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

// Free models served by Pollinations. Tried in order; fall back if one is busy.
const FREE_MODELS = ["openai", "mistral", "llama", "openai-large"];

async function callPollinations(model: string, args: {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  try {
    const resp = await fetch(POLLINATIONS_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: args.system + (args.json ? "\n\nReturn ONLY valid JSON. No prose, no markdown fences." : "") },
          { role: "user", content: args.user },
        ],
        temperature: args.temperature ?? 0.85,
        seed: Math.floor(Math.random() * 1_000_000),
        private: true,
        ...(args.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const text = await resp.text();
    // Pollinations may return either OpenAI-style JSON or plain text.
    try {
      const data = JSON.parse(text);
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim().length > 20) return content;
      if (typeof data === "string" && data.trim().length > 20) return data;
    } catch {
      if (text && text.trim().length > 20) return text;
    }
    throw new Error("empty content");
  } finally {
    clearTimeout(t);
  }
}

export async function lovableChat(args: {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  let lastErr = "";
  for (const model of FREE_MODELS) {
    try {
      return await callPollinations(model, args);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`pollinations model ${model} failed: ${lastErr}`);
    }
  }
  throw new Error(`Free AI provider failed: ${lastErr}`);
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

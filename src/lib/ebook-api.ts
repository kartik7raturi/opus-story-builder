import { supabase } from "@/integrations/supabase/client";

export type ChapterPlan = {
  number: number;
  title: string;
  summary: string;
  key_points: string[];
  image_prompt: string;
};

export type AgeGroup = "kids-4-7" | "kids-8-12" | "teen" | "adult";

export type Outline = {
  title: string;
  subtitle: string;
  author_pen_name: string;
  tagline: string;
  description: string;
  emotion?: string;
  tone?: string;
  audience?: string;
  ageGroup?: AgeGroup;
  characters?: string[];
  tags: string[];
  chapters: ChapterPlan[];
};

export type EbookPlan = {
  thinking: string;
  audience: string;
  ageGroup: AgeGroup;
  tone: string;
  theme: string;
  emotion: string;
  structure: string;
  composition: { story: boolean; charts: boolean; tasks: boolean; images: boolean; stockPhotos: boolean };
  tags: string[];
};

export type GenerateOptions = {
  title: string;
  ebookType: string;
  notes?: string;
  chapters?: number;
  ageGroup?: AgeGroup;
};

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const msg = (error as any)?.context?.responseText || error.message || "Request failed";
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export async function planEbook(opts: GenerateOptions): Promise<EbookPlan> {
  const { plan } = await invoke<{ plan: EbookPlan }>("plan-ebook", opts);
  return plan;
}

export async function generateOutline(opts: GenerateOptions & { plan?: EbookPlan }): Promise<Outline> {
  const { outline } = await invoke<{ outline: Outline }>("generate-outline", opts);
  if (!outline?.chapters?.length) throw new Error("Invalid outline returned");
  return outline;
}

export async function generateChapter(args: {
  bookTitle: string;
  ebookType: string;
  emotion?: string;
  tone?: string;
  audience?: string;
  ageGroup?: AgeGroup;
  characters?: string[];
  chapter: ChapterPlan;
  prevSummary?: string;
  wordsTarget?: number;
}): Promise<string> {
  const { content } = await invoke<{ content: string }>("generate-chapter", args);
  return content || "";
}

export async function generateImage(args: {
  prompt: string;
  kind: "cover" | "chapter";
  emotion?: string;
  quality?: "fast" | "pro";
  style?: "color" | "line-art";
}): Promise<string> {
  const { image } = await invoke<{ image: string }>("generate-image", args);
  return image;
}

// Type rules mirror the edge function rules — used client-side for routing.
export type TypeRule = {
  needsStory: boolean;
  needsCharts: boolean;
  needsTasks: boolean;
  needsImages: boolean;
  imageStyle: "color" | "line-art" | "illustration";
  textMode: string;
  ageDefault: AgeGroup;
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

export const ruleFor = (t?: string): TypeRule => TYPE_RULES[t || "standard"] || TYPE_RULES.standard;

import { supabase } from "@/integrations/supabase/client";

export type ChapterPlan = {
  number: number;
  title: string;
  summary: string;
  key_points: string[];
  image_prompt: string;
};

export type Outline = {
  title: string;
  subtitle: string;
  author_pen_name: string;
  tagline: string;
  description: string;
  tags: string[];
  cover_prompt: string;
  chapters: ChapterPlan[];
};

export type GenerateOptions = {
  title: string;
  emotion: string;
  audience?: string;
  tone?: string;
  chapters?: number;
  tags?: string;
  extra?: string;
};

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // Try to surface server-side message
    const msg = (error as any)?.context?.responseText || error.message || "Request failed";
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export async function generateOutline(opts: GenerateOptions): Promise<Outline> {
  const { outline } = await invoke<{ outline: Outline }>("generate-outline", opts);
  if (!outline?.chapters?.length) throw new Error("Invalid outline returned");
  return outline;
}

export async function generateChapter(args: {
  bookTitle: string;
  emotion: string;
  tone?: string;
  audience?: string;
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
}): Promise<string> {
  const { image } = await invoke<{ image: string }>("generate-image", args);
  return image;
}

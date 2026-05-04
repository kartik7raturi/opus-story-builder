import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Wand2 } from "lucide-react";

export type EbookType =
  | "standard"
  | "coloring"
  | "game"
  | "kids"
  | "workbook"
  | "cookbook"
  | "journal"
  | "comic"
  | "self_help"
  | "fiction"
  | "biography"
  | "technical";

export type GeneratorFormValues = {
  title: string;
  ebookType: EbookType;
  notes: string;
  chapters: number;
  wordsPerChapter: number;
  imagesPerChapter: boolean;
  hqImages: boolean;
};

const TYPES: { value: EbookType; label: string; hint: string }[] = [
  { value: "standard",   label: "Standard eBook",   hint: "Classic narrative or informational book" },
  { value: "self_help",  label: "Self-Help",        hint: "Transformation, frameworks, exercises" },
  { value: "fiction",    label: "Fiction / Novel",  hint: "Story-driven with characters & arcs" },
  { value: "biography",  label: "Biography",        hint: "Life-story narrative" },
  { value: "technical",  label: "Technical Guide",  hint: "Step-by-step expert content" },
  { value: "workbook",   label: "Workbook",         hint: "Heavy on tasks & reflection prompts" },
  { value: "journal",    label: "Guided Journal",   hint: "Prompted writing pages" },
  { value: "cookbook",   label: "Cookbook",         hint: "Recipes, ingredients, instructions" },
  { value: "kids",       label: "Kids' Book",       hint: "Ages 4–10, illustrated, simple language" },
  { value: "coloring",   label: "Coloring Book",    hint: "Line-art prompts on every page" },
  { value: "game",       label: "Game Book",        hint: "Puzzles, choices, mini-games" },
  { value: "comic",      label: "Comic / Graphic",  hint: "Panel-driven visual storytelling" },
];

interface Props {
  onSubmit: (v: GeneratorFormValues) => void;
  isGenerating: boolean;
}

export function GeneratorForm({ onSubmit, isGenerating }: Props) {
  const [v, setV] = useState<GeneratorFormValues>({
    title: "",
    ebookType: "standard",
    notes: "",
    chapters: 9,
    wordsPerChapter: 1500,
    imagesPerChapter: true,
    hqImages: false,
  });

  const set = <K extends keyof GeneratorFormValues>(k: K, val: GeneratorFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (v.title.trim()) onSubmit(v); }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="title" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          eBook Title
        </Label>
        <Input
          id="title"
          required
          maxLength={140}
          placeholder="e.g. The Quiet Architecture of Confidence"
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          className="h-14 text-lg font-display border-2 focus-visible:ring-primary"
        />
        <p className="text-xs text-muted-foreground">
          AI will auto-design the characters, emotion, tone, audience, tags & direction from your title.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">eBook Type</Label>
        <Select value={v.ebookType} onValueChange={(x) => set("ebookType", x as EbookType)}>
          <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.hint}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-md border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chapters</Label>
            <span className="font-display text-2xl text-primary">{v.chapters}</span>
          </div>
          <Slider min={3} max={20} step={1} value={[v.chapters]} onValueChange={([n]) => set("chapters", n)} />
        </div>
        <div className="space-y-3 rounded-md border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Words / chapter</Label>
            <span className="font-display text-2xl text-primary">~{v.wordsPerChapter}</span>
          </div>
          <Slider min={600} max={3000} step={100} value={[v.wordsPerChapter]} onValueChange={([n]) => set("wordsPerChapter", n)} />
          <p className="text-xs text-muted-foreground">~{(v.chapters * v.wordsPerChapter).toLocaleString()} words total.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Additional info (optional)
        </Label>
        <Textarea
          placeholder="Anything specific: characters, angle, themes to include or avoid, audience hints…"
          value={v.notes}
          rows={3}
          maxLength={1000}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-md border bg-card p-4 cursor-pointer">
          <div>
            <div className="font-semibold">Illustration per chapter</div>
            <div className="text-xs text-muted-foreground">An evocative AI image per chapter opener.</div>
          </div>
          <Switch checked={v.imagesPerChapter} onCheckedChange={(c) => set("imagesPerChapter", c)} />
        </label>
        <label className="flex items-center justify-between rounded-md border bg-card p-4 cursor-pointer">
          <div>
            <div className="font-semibold flex items-center gap-2">HQ image model <Sparkles className="h-3.5 w-3.5 text-accent" /></div>
            <div className="text-xs text-muted-foreground">Slower, richer (free open-source Flux). Off = fast.</div>
          </div>
          <Switch checked={v.hqImages} onCheckedChange={(c) => set("hqImages", c)} />
        </label>
      </div>

      <Button
        type="submit"
        disabled={isGenerating || !v.title.trim()}
        size="lg"
        className="w-full h-14 text-base font-semibold bg-ink text-primary-foreground hover:opacity-95 shadow-book"
      >
        <Wand2 className="mr-2 h-5 w-5" />
        {isGenerating ? "Crafting your eBook…" : "Generate eBook (.docx)"}
      </Button>
    </form>
  );
}

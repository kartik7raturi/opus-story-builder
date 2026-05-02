import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Wand2 } from "lucide-react";

export type GeneratorFormValues = {
  title: string;
  emotion: string;
  tone: string;
  audience: string;
  chapters: number;
  wordsPerChapter: number;
  tags: string;
  extra: string;
  imagesPerChapter: boolean;
  hqImages: boolean;
};

const EMOTIONS = [
  "Inspiring & uplifting",
  "Calm & meditative",
  "Romantic & tender",
  "Mysterious & suspenseful",
  "Dark & gothic",
  "Joyful & playful",
  "Melancholic & reflective",
  "Adventurous & bold",
  "Empowering & fierce",
  "Whimsical & dreamy",
  "Serious & academic",
  "Humorous & witty",
];

const TONES = [
  "Vivid & cinematic",
  "Conversational & warm",
  "Authoritative & expert",
  "Poetic & literary",
  "Practical & no-nonsense",
  "Storytelling & narrative",
];

const AUDIENCES = [
  "General readers",
  "Young adults",
  "Professionals",
  "Entrepreneurs",
  "Students",
  "Children (8–12)",
  "Spiritual seekers",
  "Hobbyists & enthusiasts",
];

interface Props {
  onSubmit: (v: GeneratorFormValues) => void;
  isGenerating: boolean;
}

export function GeneratorForm({ onSubmit, isGenerating }: Props) {
  const [v, setV] = useState<GeneratorFormValues>({
    title: "",
    emotion: EMOTIONS[0],
    tone: TONES[0],
    audience: AUDIENCES[0],
    chapters: 9,
    wordsPerChapter: 1500,
    tags: "",
    extra: "",
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
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emotion</Label>
          <Select value={v.emotion} onValueChange={(x) => set("emotion", x)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{EMOTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tone</Label>
          <Select value={v.tone} onValueChange={(x) => set("tone", x)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{TONES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audience</Label>
          <Select value={v.audience} onValueChange={(x) => set("audience", x)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{AUDIENCES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-md border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chapters</Label>
            <span className="font-display text-2xl text-primary">{v.chapters}</span>
          </div>
          <Slider min={3} max={20} step={1} value={[v.chapters]} onValueChange={([n]) => set("chapters", n)} />
          <p className="text-xs text-muted-foreground">More chapters = longer book, more time.</p>
        </div>
        <div className="space-y-3 rounded-md border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Words / chapter</Label>
            <span className="font-display text-2xl text-primary">~{v.wordsPerChapter}</span>
          </div>
          <Slider min={600} max={3000} step={100} value={[v.wordsPerChapter]} onValueChange={([n]) => set("wordsPerChapter", n)} />
          <p className="text-xs text-muted-foreground">Approx total: ~{(v.chapters * v.wordsPerChapter).toLocaleString()} words.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags / Keywords (optional)</Label>
        <Input
          placeholder="self-help, mindfulness, focus, productivity"
          value={v.tags}
          maxLength={200}
          onChange={(e) => set("tags", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extra direction (optional)</Label>
        <Textarea
          placeholder="Anything specific you want covered, characters to include, angle to take, things to avoid…"
          value={v.extra}
          rows={3}
          maxLength={1000}
          onChange={(e) => set("extra", e.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-md border bg-card p-4 cursor-pointer">
          <div>
            <div className="font-semibold">Illustration per chapter</div>
            <div className="text-xs text-muted-foreground">Adds an evocative image to each chapter opener.</div>
          </div>
          <Switch checked={v.imagesPerChapter} onCheckedChange={(c) => set("imagesPerChapter", c)} />
        </label>
        <label className="flex items-center justify-between rounded-md border bg-card p-4 cursor-pointer">
          <div>
            <div className="font-semibold flex items-center gap-2">HQ image model <Sparkles className="h-3.5 w-3.5 text-accent" /></div>
            <div className="text-xs text-muted-foreground">Slower & richer (Nano Banana Pro). Off = fast.</div>
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
        {isGenerating ? "Crafting your eBook…" : "Generate eBook"}
      </Button>
    </form>
  );
}

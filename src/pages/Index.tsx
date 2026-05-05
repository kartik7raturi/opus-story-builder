import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookMarked, Sparkles, Wand2, Layers, Palette, FileText } from "lucide-react";
import { GeneratorForm, type GeneratorFormValues } from "@/components/GeneratorForm";
import { ProgressTimeline, type Step } from "@/components/ProgressTimeline";
import { ResultView } from "@/components/ResultView";
import { generateOutline, generateChapter, generateImage, type Outline } from "@/lib/ebook-api";
import { buildEbookDocx, downloadBlob, downloadDataUrl, type BuiltChapter } from "@/lib/docx-builder";
import { enrichChapterContent } from "@/lib/media-enrich";

type Phase = "idle" | "generating" | "done" | "error";

const Index = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [cover, setCover] = useState<string>("");
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [docxFilename, setDocxFilename] = useState("ebook.docx");

  useEffect(() => {
    document.title = "Inkwell — AI eBook Generator";
    const desc = "Generate full, beautifully designed eBooks with AI: title, chapters, illustrations, cover & policy pages — downloadable as PDF.";
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
    m.setAttribute("content", desc);
    let l = document.querySelector('link[rel="canonical"]');
    if (!l) { l = document.createElement("link"); l.setAttribute("rel", "canonical"); document.head.appendChild(l); }
    l.setAttribute("href", window.location.origin + "/");
  }, []);

  const updateStep = (id: string, patch: Partial<Step>) =>
    setSteps((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const handleGenerate = async (v: GeneratorFormValues) => {
    setPhase("generating");
    setOutline(null);
    setCover("");
    setDocxBlob(null);

    const initial: Step[] = [
      { id: "outline", label: "Designing the book outline", status: "active", detail: "AI auto-deriving characters, emotion, tone, tags…" },
      { id: "cover", label: "Painting the cover", status: "pending" },
      ...Array.from({ length: v.chapters }, (_, i) => ({
        id: `ch-${i + 1}`, label: `Writing chapter ${i + 1}`, status: "pending" as const,
      })),
      { id: "docx", label: "Composing the .docx file", status: "pending" },
    ];
    setSteps(initial);

    const isColoring = v.ebookType === "coloring";

    try {
      const out = await generateOutline({
        title: v.title,
        ebookType: v.ebookType,
        notes: v.notes,
        chapters: v.chapters,
      });
      setOutline(out);
      updateStep("outline", { status: "done", detail: `${out.chapters.length} chapters · ${out.tags?.length || 0} tags · ${out.emotion || ""}` });

      setSteps((prev) => {
        const fixed = prev.filter((s) => !s.id.startsWith("ch-"));
        const before = fixed.findIndex((s) => s.id === "docx");
        const chSteps = out.chapters.map((c) => ({
          id: `ch-${c.number}`, label: `Writing Ch. ${c.number}: ${c.title}`, status: "pending" as const,
        }));
        return [...fixed.slice(0, before), ...chSteps, ...fixed.slice(before)];
      });

      updateStep("cover", { status: "active", detail: v.hqImages ? "HQ Flux model · ~60s" : "Fast model" });
      const coverImg = await generateImage({
        prompt: out.cover_prompt,
        kind: "cover",
        emotion: out.emotion,
        quality: v.hqImages ? "pro" : "fast",
      });
      setCover(coverImg);
      updateStep("cover", { status: "done" });

      const builtChapters: BuiltChapter[] = [];
      let prevSummary = "";
      for (const chapter of out.chapters) {
        updateStep(`ch-${chapter.number}`, { status: "active" });
        const tasks: Promise<any>[] = [
          generateChapter({
            bookTitle: out.title,
            ebookType: v.ebookType,
            emotion: out.emotion,
            tone: out.tone,
            audience: out.audience,
            characters: out.characters,
            chapter,
            prevSummary,
            wordsTarget: v.wordsPerChapter,
          }),
        ];
        if (v.imagesPerChapter) {
          tasks.push(generateImage({
            prompt: chapter.image_prompt,
            kind: "chapter",
            emotion: out.emotion,
            quality: v.hqImages ? "pro" : "fast",
            style: isColoring ? "line-art" : "color",
          }).catch((err) => { console.warn("Chapter image failed", err); return undefined; }));
        }
        const [rawContent, image] = await Promise.all(tasks);
        updateStep(`ch-${chapter.number}`, { detail: "Rendering visuals & charts…" });
        const content = await enrichChapterContent(rawContent as string, {
          emotion: out.emotion,
          quality: v.hqImages ? "pro" : "fast",
          coloring: isColoring,
        });
        builtChapters.push({
          plan: { number: chapter.number, title: chapter.title },
          content,
          image,
        });
        prevSummary = chapter.summary;
        updateStep(`ch-${chapter.number}`, { status: "done", detail: `${(content as string).split(/\s+/).length.toLocaleString()} words` });
      }

      updateStep("docx", { status: "active", detail: "Typesetting cover, TOC, chapters…" });
      const titledCover = await composeCoverWithTitle(coverImg, out.title, out.subtitle, out.author_pen_name);
      setCover(titledCover);
      const blob = await buildEbookDocx({ outline: out, cover: titledCover, chapters: builtChapters });
      const safeName = out.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "ebook";
      const filename = `${safeName}.docx`;
      setDocxBlob(blob);
      setDocxFilename(filename);
      updateStep("docx", { status: "done", detail: `${(blob.size / 1024).toFixed(0)} KB` });
      setPhase("done");
      // Auto-download immediately
      downloadBlob(blob, filename);
      toast.success("Your eBook is ready! Download starting…");
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Generation failed";
      toast.error(msg);
      setSteps((prev) => prev.map((s) => s.status === "active" ? { ...s, status: "error", detail: msg } : s));
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("idle");
    setOutline(null);
    setCover("");
    setDocxBlob(null);
    setSteps([]);
  };

  const features = useMemo(() => ([
    { icon: Layers, title: "Full structure", text: "Outline, chapters, TOC, copyright, disclaimer & license pages." },
    { icon: Palette, title: "Cinematic art", text: "AI-painted cover and one illustration per chapter." },
    { icon: Sparkles, title: "Emotion-aware", text: "Pick the mood — every word and image follows it." },
    { icon: FileText, title: "Print-ready PDF", text: "Editorial 6×9 layout, page numbers, running headers." },
  ]), []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden bg-hero grain">
        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-ink text-primary-foreground">
              <BookMarked className="h-4 w-4" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">Inkwell</span>
          </div>
          <div className="hidden items-center gap-6 text-sm md:flex">
            <a href="#generator" className="text-muted-foreground hover:text-foreground">Generator</a>
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#how" className="text-muted-foreground hover:text-foreground">How it works</a>
          </div>
        </nav>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-12 md:pt-20 md:pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" /> Powered by Gemini 3 Pro
          </div>
          <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight text-balance">
            Type a title.<br />
            <span className="italic text-primary">Receive a whole book.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground text-balance">
            Inkwell generates a complete, beautifully designed eBook — chapters, illustrations,
            cover art, copyright & policy pages — and hands you a print-ready PDF in minutes.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
            <span className="rounded-full border bg-card px-3 py-1">📖 8–20 chapters</span>
            <span className="rounded-full border bg-card px-3 py-1">🎨 AI cover + illustrations</span>
            <span className="rounded-full border bg-card px-3 py-1">📄 Editorial PDF</span>
            <span className="rounded-full border bg-card px-3 py-1">🏷️ Tags & policies</span>
          </div>
        </div>

        {/* Decorative floating books */}
        <div className="pointer-events-none absolute -left-10 top-32 hidden h-40 w-28 rotate-[-12deg] rounded-sm bg-ink shadow-book md:block animate-float-slow" />
        <div className="pointer-events-none absolute -right-6 top-48 hidden h-48 w-32 rotate-[8deg] rounded-sm bg-gold shadow-book md:block animate-float-slow" style={{ animationDelay: "1.5s" }} />
      </header>

      {/* Generator */}
      <main id="generator" className="mx-auto max-w-6xl px-6 -mt-10 pb-24">
        <section className="rounded-lg border bg-card shadow-book p-6 md:p-10">
          {phase === "idle" || phase === "error" ? (
            <>
              <div className="mb-8 max-w-2xl">
                <h2 className="font-display text-3xl md:text-4xl font-bold">Compose your book</h2>
                <p className="mt-2 text-muted-foreground">Fill in the details. We'll handle title polish, structure, voice, and visuals.</p>
              </div>
              <GeneratorForm onSubmit={handleGenerate} isGenerating={false} />
            </>
          ) : phase === "generating" ? (
            <div className="grid gap-10 md:grid-cols-[1fr_360px]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">In progress</div>
                <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight text-balance">
                  {outline?.title || "Designing your book…"}
                </h2>
                {outline?.subtitle && (
                  <p className="font-display italic text-lg text-muted-foreground mt-2">{outline.subtitle}</p>
                )}
                <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/2 animate-shimmer" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Generation usually takes 1–3 minutes depending on chapter count and image quality.
                  Please keep this tab open.
                </p>
                {cover && (
                  <div className="mt-8 max-w-[260px]">
                    <img src={cover} alt="Generated cover" className="w-full rounded-sm shadow-book animate-float-slow" />
                  </div>
                )}
              </div>
              <div className="rounded-md border bg-background p-5">
                <h3 className="font-display text-lg mb-4">Progress</h3>
                <div className="max-h-[480px] overflow-y-auto pr-2">
                  <ProgressTimeline steps={steps} />
                </div>
              </div>
            </div>
          ) : outline && cover ? (
            <ResultView
              outline={outline}
              cover={cover}
              docxBlob={docxBlob}
              onDownloadDocx={() => docxBlob && downloadBlob(docxBlob, docxFilename)}
              onDownloadCover={() => downloadDataUrl(cover, docxFilename.replace(/\.docx$/, "-cover.png"))}
              onReset={reset}
            />
          ) : null}
        </section>

        {/* Features */}
        <section id="features" className="mt-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-bold">Everything a real book needs</h2>
            <p className="mt-3 text-muted-foreground">No half-baked drafts. Inkwell ships finished eBooks with all the trimmings.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-md border bg-card p-6 shadow-soft">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-sm bg-ink text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mt-20 grid gap-10 md:grid-cols-3">
          {[
            { n: "01", t: "Describe", d: "Title, emotion, tone, audience, length. The more specific, the better." },
            { n: "02", t: "Generate", d: "We design the outline, write each chapter, paint cover and illustrations." },
            { n: "03", t: "Download", d: "Receive a typeset PDF and high-res cover. Yours to publish, share, or sell." },
          ].map((s) => (
            <div key={s.n}>
              <div className="font-display text-6xl font-bold text-primary/20">{s.n}</div>
              <h3 className="font-display text-2xl font-semibold mt-2">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-foreground">Inkwell</span>
            <span>· AI eBook studio</span>
          </div>
          <div>Crafted with <Wand2 className="inline h-3 w-3 mx-0.5" /> · Powered by Lovable AI</div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

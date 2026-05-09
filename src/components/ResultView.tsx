import { BookOpen, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EbookPlan, Outline } from "@/lib/ebook-api";

interface Props {
  outline: Outline;
  plan?: EbookPlan | null;
  docxBlob: Blob | null;
  onDownloadDocx: () => void;
  onReset: () => void;
}

export function ResultView({ outline, plan, docxBlob, onDownloadDocx, onReset }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Your eBook is ready</div>
        <h2 className="font-display text-4xl md:text-5xl leading-tight text-balance">{outline.title}</h2>
        {outline.subtitle && <p className="font-display italic text-xl text-muted-foreground mt-2 text-balance">{outline.subtitle}</p>}
        <p className="mt-3 text-sm text-muted-foreground">by {outline.author_pen_name}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onDownloadDocx} disabled={!docxBlob} size="lg" className="bg-ink text-primary-foreground hover:opacity-95">
          <Download className="mr-2 h-4 w-4" /> Download eBook (.docx)
        </Button>
        <Button onClick={onReset} variant="outline" size="lg">Create another</Button>
      </div>

      <p className="text-base leading-relaxed">{outline.description}</p>

      {plan?.thinking && (
        <div className="rounded-md border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg">AI Thinking</h3>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{plan.thinking}</p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div><span className="font-semibold">Audience:</span> {plan.audience}</div>
            <div><span className="font-semibold">Age:</span> {plan.ageGroup}</div>
            <div><span className="font-semibold">Tone:</span> {plan.tone}</div>
            <div><span className="font-semibold">Theme:</span> {plan.theme}</div>
          </div>
        </div>
      )}

      {outline.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {outline.tags.map((t) => <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>)}
        </div>
      )}

      <div className="rounded-md border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg">Table of Contents</h3>
        </div>
        <ol className="space-y-2">
          {outline.chapters.map((c) => (
            <li key={c.number} className="flex gap-3 text-sm">
              <span className="font-mono text-muted-foreground tabular-nums">{String(c.number).padStart(2, "0")}</span>
              <span className="font-medium">{c.title}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

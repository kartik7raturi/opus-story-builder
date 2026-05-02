import { BookOpen, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Outline } from "@/lib/ebook-api";

interface Props {
  outline: Outline;
  cover: string;
  pdfBlob: Blob | null;
  onDownloadPdf: () => void;
  onDownloadCover: () => void;
  onReset: () => void;
}

export function ResultView({ outline, cover, pdfBlob, onDownloadPdf, onDownloadCover, onReset }: Props) {
  return (
    <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="relative animate-float-slow">
          <img
            src={cover}
            alt={`${outline.title} cover`}
            className="w-full rounded-sm shadow-book"
          />
          <div className="absolute inset-0 rounded-sm ring-1 ring-black/10 pointer-events-none" />
        </div>
        <div className="space-y-2">
          <Button onClick={onDownloadPdf} disabled={!pdfBlob} size="lg" className="w-full bg-ink text-primary-foreground hover:opacity-95">
            <Download className="mr-2 h-4 w-4" /> Download eBook PDF
          </Button>
          <Button onClick={onDownloadCover} variant="outline" size="lg" className="w-full">
            <ImageIcon className="mr-2 h-4 w-4" /> Download Cover Image
          </Button>
          <Button onClick={onReset} variant="ghost" size="sm" className="w-full">
            Create another eBook
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Your eBook is ready</div>
          <h2 className="font-display text-4xl md:text-5xl leading-tight text-balance">{outline.title}</h2>
          {outline.subtitle && <p className="font-display italic text-xl text-muted-foreground mt-2 text-balance">{outline.subtitle}</p>}
          <p className="mt-3 text-sm text-muted-foreground">by {outline.author_pen_name}</p>
        </div>

        <p className="text-base leading-relaxed">{outline.description}</p>

        {outline.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {outline.tags.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
            ))}
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
    </div>
  );
}

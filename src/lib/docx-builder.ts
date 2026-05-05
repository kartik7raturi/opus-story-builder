import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ImageRun, PageBreak, LevelFormat, ShadingType, Table, TableRow, TableCell,
  WidthType, BorderStyle, Header, Footer, PageNumber, ExternalHyperlink,
} from "docx";
import type { Outline } from "./ebook-api";

export type BuiltChapter = {
  plan: { number: number; title: string };
  content: string;
  image?: string; // data URL
};

export type EbookPayload = {
  outline: Outline;
  cover: string;
  chapters: BuiltChapter[];
};

// ---- helpers ----

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function imageType(dataUrl: string): "png" | "jpg" {
  return /image\/png/i.test(dataUrl) ? "png" : "jpg";
}

// Inline markdown: **bold**, *italic*, `code`
function inlineRuns(text: string, base: { bold?: boolean; italics?: boolean } = {}): TextRun[] {
  const out: TextRun[] = [];
  // Tokenize on **...**, *...*, `...`
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    }
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...base }));
    } else if (tok.startsWith("*")) {
      out.push(new TextRun({ text: tok.slice(1, -1), italics: true, ...base }));
    } else if (tok.startsWith("`")) {
      out.push(new TextRun({ text: tok.slice(1, -1), font: "Consolas", ...base }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  if (out.length === 0) out.push(new TextRun({ text, ...base }));
  return out;
}

// Parse [VISUAL | ...] blocks into a styled callout
function parseTaggedBlock(line: string): { kind: "VISUAL" | "CHART" | "TASK"; raw: string } | null {
  const m = line.match(/^\[(VISUAL|CHART|TASK)\b([\s\S]*?)\]\s*(?:→|->)?\s*(.*)$/i);
  if (!m) return null;
  const kind = m[1].toUpperCase() as "VISUAL" | "CHART" | "TASK";
  const inside = m[2].trim().replace(/^\|\s*/, "");
  const after = m[3].trim();
  return { kind, raw: after ? `${inside}${inside ? " | " : ""}${after}` : inside };
}

function calloutParagraphs(kind: string, raw: string): Paragraph[] {
  const colors: Record<string, string> = {
    VISUAL: "EAF4FF",
    CHART: "FFF3E0",
    TASK: "EAF7EC",
  };
  const accents: Record<string, string> = {
    VISUAL: "1E88E5",
    CHART: "FB8C00",
    TASK: "2E7D32",
  };
  const fill = colors[kind] || "F2F2F2";
  const accent = accents[kind] || "666666";

  return [
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill, color: "auto" },
      spacing: { before: 120, after: 120 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: accent, space: 4 },
      },
      children: [
        new TextRun({ text: `${kind}  `, bold: true, color: accent, size: 20 }),
        new TextRun({ text: raw, size: 22 }),
      ],
    }),
  ];
}

function buildChapterParagraphs(ch: BuiltChapter): Paragraph[] {
  const paras: Paragraph[] = [];

  paras.push(new Paragraph({ children: [new PageBreak()] }));

  // Image
  if (ch.image) {
    try {
      paras.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({
          type: imageType(ch.image),
          data: dataUrlToBytes(ch.image),
          transformation: { width: 500, height: 320 },
          altText: { title: ch.plan.title, description: ch.plan.title, name: ch.plan.title },
        } as any)],
      }));
    } catch (e) { console.warn("image embed failed", e); }
  }

  // Chapter label
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({
      text: `CHAPTER ${String(ch.plan.number).padStart(2, "0")}`,
      bold: true, color: "C44024", size: 20,
    })],
  }));

  // Chapter title
  paras.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    children: [new TextRun({ text: ch.plan.title, bold: true, size: 44 })],
  }));

  // Content
  const lines = (ch.content || "").replace(/\r\n/g, "\n").split("\n");
  let buf: string[] = [];
  let listBuf: string[] = [];

  const flushPara = () => {
    if (buf.length) {
      paras.push(new Paragraph({
        spacing: { after: 200, line: 340 },
        children: inlineRuns(buf.join(" ").trim()),
      }));
      buf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length) {
      for (const item of listBuf) {
        paras.push(new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: inlineRuns(item),
        }));
      }
      listBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }

    // Embedded image token: [IMG|dataUrl|caption]
    if (line.startsWith("[IMG|")) {
      flushPara(); flushList();
      const inner = line.slice(5, line.endsWith("]") ? -1 : undefined);
      const sep = inner.indexOf("|");
      const dataUrl = sep > 0 ? inner.slice(0, sep) : inner;
      const caption = sep > 0 ? inner.slice(sep + 1) : "";
      try {
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 80 },
          children: [new ImageRun({
            type: imageType(dataUrl),
            data: dataUrlToBytes(dataUrl),
            transformation: { width: 480, height: 300 },
            altText: { title: caption || "illustration", description: caption || "illustration", name: "illustration" },
          } as any)],
        }));
        if (caption) {
          paras.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: caption, italics: true, size: 18, color: "666666" })],
          }));
        }
      } catch (e) { console.warn("inline image embed failed", e); }
      continue;
    }

    const tagged = parseTaggedBlock(line);
    if (tagged) {
      flushPara(); flushList();
      paras.push(...calloutParagraphs(tagged.kind, tagged.raw));
      continue;
    }
    if (/^##\s+/.test(line)) {
      flushPara(); flushList();
      paras.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        children: [new TextRun({ text: line.replace(/^##\s+/, ""), bold: true, size: 30 })],
      }));
      continue;
    }
    if (/^#\s+/.test(line)) {
      flushPara(); flushList();
      paras.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        children: [new TextRun({ text: line.replace(/^#\s+/, ""), bold: true, size: 30 })],
      }));
      continue;
    }
    if (/^>\s+/.test(line)) {
      flushPara(); flushList();
      paras.push(new Paragraph({
        spacing: { before: 120, after: 120 },
        indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: "C44024", space: 8 } },
        children: inlineRuns(line.replace(/^>\s+/, ""), { italics: true }),
      }));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      listBuf.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    flushList();
    buf.push(line);
  }
  flushPara(); flushList();

  return paras;
}

// ---- main ----
export async function buildEbookDocx(payload: EbookPayload): Promise<Blob> {
  const { outline, cover, chapters } = payload;

  const sectionChildren: Paragraph[] = [];

  // Cover (full image)
  if (cover) {
    try {
      sectionChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({
          type: imageType(cover),
          data: dataUrlToBytes(cover),
          transformation: { width: 480, height: 720 },
          altText: { title: outline.title, description: outline.title, name: outline.title },
        } as any)],
      }));
    } catch (e) { console.warn("cover embed failed", e); }
  }

  // Title page
  sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
  sectionChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 240 },
    children: [new TextRun({ text: outline.title, bold: true, size: 56 })],
  }));
  if (outline.subtitle) {
    sectionChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: outline.subtitle, italics: true, size: 28, color: "555555" })],
    }));
  }
  sectionChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 800 },
    children: [new TextRun({ text: outline.author_pen_name || "", size: 24 })],
  }));

  // Copyright
  sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
  sectionChildren.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "Copyright", bold: true })],
  }));
  const year = new Date().getFullYear();
  for (const t of [
    `Copyright © ${year} ${outline.author_pen_name}. All rights reserved.`,
    `No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without prior written permission, except for brief quotations in critical reviews.`,
    `This eBook was generated with the assistance of artificial intelligence. The author has reviewed and curated the final work.`,
    `First digital edition, ${year}.`,
  ]) sectionChildren.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: t })] }));

  // About
  sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
  sectionChildren.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "About This Book", bold: true })],
  }));
  if (outline.tagline) {
    sectionChildren.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: outline.tagline, italics: true, size: 26 })],
    }));
  }
  sectionChildren.push(new Paragraph({
    spacing: { after: 200, line: 340 },
    children: [new TextRun({ text: outline.description || "" })],
  }));
  if (outline.tags?.length) {
    sectionChildren.push(new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({ text: "Tags: ", bold: true }),
        new TextRun({ text: outline.tags.join(" · ") }),
      ],
    }));
  }

  // TOC
  sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
  sectionChildren.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "Contents", bold: true })],
  }));
  for (const c of chapters) {
    sectionChildren.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `${String(c.plan.number).padStart(2, "0")}.  `, color: "888888" }),
        new TextRun({ text: c.plan.title }),
      ],
    }));
  }

  // Chapters
  for (const ch of chapters) {
    sectionChildren.push(...buildChapterParagraphs(ch));
  }

  // Closing
  sectionChildren.push(new Paragraph({ children: [new PageBreak()] }));
  sectionChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200 },
    children: [new TextRun({ text: "Thank you for reading.", italics: true, size: 28, color: "666666" })],
  }));
  sectionChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200 },
    children: [new TextRun({ text: `— ${outline.author_pen_name}`, size: 22 })],
  }));

  const doc = new Document({
    creator: outline.author_pen_name || "Inkwell",
    title: outline.title,
    description: outline.description,
    styles: {
      default: { document: { run: { font: "Georgia", size: 24 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 44, bold: true, font: "Georgia" },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, font: "Georgia" },
          paragraph: { spacing: { before: 200, after: 160 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: outline.title, italics: true, size: 18, color: "888888" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", size: 18, color: "888888" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" }),
            ],
          })],
        }),
      },
      children: sectionChildren,
    }],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); }, 1000);
}

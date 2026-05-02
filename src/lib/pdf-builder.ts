import jsPDF from "jspdf";
import type { Outline } from "./ebook-api";

export type BuiltChapter = {
  plan: { number: number; title: string };
  content: string;
  image?: string; // data URL
};

export type EbookPayload = {
  outline: Outline;
  cover: string; // data URL
  chapters: BuiltChapter[];
};

// ---- Layout constants (A5-ish, in pt) ----
const PAGE_W = 432; // 6 inches
const PAGE_H = 648; // 9 inches
const MARGIN_X = 54;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 64;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// Editorial colors (RGB)
const C_INK = [28, 22, 18] as const;
const C_MUTED = [110, 96, 84] as const;
const C_ACCENT = [196, 64, 36] as const; // vermilion
const C_GOLD = [196, 148, 60] as const;
const C_PARCHMENT = [248, 243, 232] as const;

function rgb(c: readonly [number, number, number]) { return c; }

function paintBackground(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function drawPageNumber(doc: jsPDF, n: number) {
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2]);
  doc.text(String(n), PAGE_W / 2, PAGE_H - 28, { align: "center" });
}

function drawRunningHeader(doc: jsPDF, text: string) {
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2]);
  doc.text(text, PAGE_W / 2, 36, { align: "center" });
  doc.setDrawColor(C_GOLD[0], C_GOLD[1], C_GOLD[2]);
  doc.setLineWidth(0.5);
  doc.line(PAGE_W / 2 - 24, 42, PAGE_W / 2 + 24, 42);
}

// ---- Cover ----
function addCover(doc: jsPDF, payload: EbookPayload) {
  paintBackground(doc, [18, 14, 12]);
  // Cover image fills page
  try {
    doc.addImage(payload.cover, "JPEG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");
  } catch {
    try { doc.addImage(payload.cover, "PNG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST"); } catch {}
  }
  // Dark gradient overlay (simulate with translucent rectangles)
  doc.setFillColor(0, 0, 0);
  // @ts-ignore - GState exists in jsPDF
  doc.setGState(new (doc as any).GState({ opacity: 0.35 }));
  doc.rect(0, PAGE_H * 0.45, PAGE_W, PAGE_H * 0.55, "F");
  // @ts-ignore
  doc.setGState(new (doc as any).GState({ opacity: 0.55 }));
  doc.rect(0, PAGE_H * 0.7, PAGE_W, PAGE_H * 0.3, "F");
  // @ts-ignore
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Gold accent bar
  doc.setFillColor(C_GOLD[0], C_GOLD[1], C_GOLD[2]);
  doc.rect(MARGIN_X, PAGE_H - 200, 40, 3, "F");

  // Title
  doc.setTextColor(248, 243, 232);
  doc.setFont("times", "bold");
  const title = payload.outline.title || "Untitled";
  const titleSize = title.length > 28 ? 28 : 36;
  doc.setFontSize(titleSize);
  const titleLines = doc.splitTextToSize(title, CONTENT_W);
  doc.text(titleLines, MARGIN_X, PAGE_H - 170);

  // Subtitle
  if (payload.outline.subtitle) {
    doc.setFont("times", "italic");
    doc.setFontSize(13);
    doc.setTextColor(230, 220, 200);
    const subLines = doc.splitTextToSize(payload.outline.subtitle, CONTENT_W);
    const yAfterTitle = PAGE_H - 170 + titleLines.length * (titleSize * 1.1) + 8;
    doc.text(subLines, MARGIN_X, yAfterTitle);
  }

  // Author
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(C_GOLD[0], C_GOLD[1], C_GOLD[2]);
  doc.text((payload.outline.author_pen_name || "").toUpperCase(), MARGIN_X, PAGE_H - 50);
}

// ---- Title page ----
function addTitlePage(doc: jsPDF, payload: EbookPayload, pageNum: number) {
  doc.addPage();
  paintBackground(doc, C_PARCHMENT);

  doc.setTextColor(C_INK[0], C_INK[1], C_INK[2]);
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  const t = doc.splitTextToSize(payload.outline.title, CONTENT_W);
  doc.text(t, PAGE_W / 2, PAGE_H / 2 - 40, { align: "center" });

  if (payload.outline.subtitle) {
    doc.setFont("times", "italic");
    doc.setFontSize(13);
    doc.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2]);
    const s = doc.splitTextToSize(payload.outline.subtitle, CONTENT_W);
    doc.text(s, PAGE_W / 2, PAGE_H / 2, { align: "center" });
  }

  // ornament
  doc.setDrawColor(C_ACCENT[0], C_ACCENT[1], C_ACCENT[2]);
  doc.setLineWidth(0.8);
  doc.line(PAGE_W / 2 - 30, PAGE_H / 2 + 30, PAGE_W / 2 + 30, PAGE_H / 2 + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(C_INK[0], C_INK[1], C_INK[2]);
  doc.text(payload.outline.author_pen_name || "", PAGE_W / 2, PAGE_H / 2 + 60, { align: "center" });

  drawPageNumber(doc, pageNum);
}

// ---- Copyright / Policy / TOC pages ----
function addParagraphPage(doc: jsPDF, opts: { heading: string; body: string; pageNum: number; runHeader: string }) {
  doc.addPage();
  paintBackground(doc, C_PARCHMENT);
  drawRunningHeader(doc, opts.runHeader);

  doc.setTextColor(C_INK[0], C_INK[1], C_INK[2]);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(opts.heading, MARGIN_X, MARGIN_TOP + 10);

  doc.setDrawColor(C_GOLD[0], C_GOLD[1], C_GOLD[2]);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, MARGIN_TOP + 18, MARGIN_X + 40, MARGIN_TOP + 18);

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 32, 28);
  const lines = doc.splitTextToSize(opts.body, CONTENT_W);
  doc.text(lines, MARGIN_X, MARGIN_TOP + 44, { lineHeightFactor: 1.5 } as any);

  drawPageNumber(doc, opts.pageNum);
}

function addTOC(doc: jsPDF, payload: EbookPayload, pageNum: number) {
  doc.addPage();
  paintBackground(doc, C_PARCHMENT);
  drawRunningHeader(doc, "Contents");

  doc.setTextColor(C_INK[0], C_INK[1], C_INK[2]);
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text("Contents", MARGIN_X, MARGIN_TOP + 10);
  doc.setDrawColor(C_GOLD[0], C_GOLD[1], C_GOLD[2]);
  doc.line(MARGIN_X, MARGIN_TOP + 18, MARGIN_X + 40, MARGIN_TOP + 18);

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  let y = MARGIN_TOP + 50;
  payload.chapters.forEach((c) => {
    if (y > PAGE_H - MARGIN_BOTTOM - 14) return;
    doc.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2]);
    doc.text(String(c.plan.number).padStart(2, "0"), MARGIN_X, y);
    doc.setTextColor(C_INK[0], C_INK[1], C_INK[2]);
    const titleLines = doc.splitTextToSize(c.plan.title, CONTENT_W - 40);
    doc.text(titleLines, MARGIN_X + 28, y);
    y += titleLines.length * 16 + 6;
  });
  drawPageNumber(doc, pageNum);
}

// ---- Markdown-ish renderer for chapter body ----
type Block =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "ul"; items: string[] };

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  let listBuf: string[] = [];
  const flushPara = () => {
    if (buf.length) {
      blocks.push({ type: "p", text: buf.join(" ").trim() });
      buf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length) {
      blocks.push({ type: "ul", items: listBuf.slice() });
      listBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (/^##\s+/.test(line)) { flushPara(); flushList(); blocks.push({ type: "h2", text: line.replace(/^##\s+/, "") }); continue; }
    if (/^#\s+/.test(line)) { flushPara(); flushList(); blocks.push({ type: "h2", text: line.replace(/^#\s+/, "") }); continue; }
    if (/^>\s+/.test(line)) { flushPara(); flushList(); blocks.push({ type: "quote", text: line.replace(/^>\s+/, "") }); continue; }
    if (/^[-*]\s+/.test(line)) { flushPara(); listBuf.push(line.replace(/^[-*]\s+/, "")); continue; }
    flushList();
    buf.push(line);
  }
  flushPara(); flushList();
  return blocks;
}

function stripInline(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

class PageCursor {
  y: number;
  pageNum: number;
  constructor(public doc: jsPDF, public runHeader: string, startPage: number) {
    this.y = MARGIN_TOP;
    this.pageNum = startPage;
  }
  ensure(space: number) {
    if (this.y + space > PAGE_H - MARGIN_BOTTOM) this.newPage();
  }
  newPage() {
    drawPageNumber(this.doc, this.pageNum);
    this.doc.addPage();
    paintBackground(this.doc, C_PARCHMENT);
    drawRunningHeader(this.doc, this.runHeader);
    this.pageNum++;
    this.y = MARGIN_TOP;
  }
  finish() {
    drawPageNumber(this.doc, this.pageNum);
  }
}

function addChapter(doc: jsPDF, ch: BuiltChapter, runHeader: string, startPage: number): number {
  // Chapter opener page
  doc.addPage();
  paintBackground(doc, C_PARCHMENT);

  let pageNum = startPage;

  // Image at top (if any)
  let openerY = MARGIN_TOP;
  if (ch.image) {
    try {
      const imgH = 200;
      doc.addImage(ch.image, "JPEG", MARGIN_X, openerY, CONTENT_W, imgH, undefined, "FAST");
      openerY += imgH + 24;
    } catch {
      try {
        const imgH = 200;
        doc.addImage(ch.image, "PNG", MARGIN_X, openerY, CONTENT_W, imgH, undefined, "FAST");
        openerY += imgH + 24;
      } catch {}
    }
  }

  // Chapter label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(C_ACCENT[0], C_ACCENT[1], C_ACCENT[2]);
  doc.text(`CHAPTER ${String(ch.plan.number).padStart(2, "0")}`, MARGIN_X, openerY);
  openerY += 18;

  // Chapter title
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(C_INK[0], C_INK[1], C_INK[2]);
  const titleLines = doc.splitTextToSize(ch.plan.title, CONTENT_W);
  doc.text(titleLines, MARGIN_X, openerY);
  openerY += titleLines.length * 28 + 8;

  // Gold rule
  doc.setDrawColor(C_GOLD[0], C_GOLD[1], C_GOLD[2]);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_X, openerY, MARGIN_X + 40, openerY);
  openerY += 22;

  const cur = new PageCursor(doc, runHeader, pageNum);
  cur.y = openerY;

  const blocks = parseMarkdown(ch.content || "");
  for (const block of blocks) {
    if (block.type === "h2") {
      cur.ensure(40);
      doc.setFont("times", "bold");
      doc.setFontSize(15);
      doc.setTextColor(C_INK[0], C_INK[1], C_INK[2]);
      const lines = doc.splitTextToSize(stripInline(block.text), CONTENT_W);
      doc.text(lines, MARGIN_X, cur.y);
      cur.y += lines.length * 18 + 10;
    } else if (block.type === "quote") {
      cur.ensure(36);
      doc.setDrawColor(C_ACCENT[0], C_ACCENT[1], C_ACCENT[2]);
      doc.setLineWidth(2);
      doc.line(MARGIN_X, cur.y - 4, MARGIN_X, cur.y + 30);
      doc.setFont("times", "italic");
      doc.setFontSize(11.5);
      doc.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2]);
      const lines = doc.splitTextToSize(stripInline(block.text), CONTENT_W - 14);
      // ensure room for full quote
      cur.ensure(lines.length * 16 + 12);
      doc.text(lines, MARGIN_X + 12, cur.y + 6, { lineHeightFactor: 1.4 } as any);
      cur.y += lines.length * 16 + 16;
    } else if (block.type === "ul") {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(40, 32, 28);
      for (const it of block.items) {
        const lines = doc.splitTextToSize(stripInline(it), CONTENT_W - 16);
        cur.ensure(lines.length * 15 + 4);
        doc.setFillColor(C_ACCENT[0], C_ACCENT[1], C_ACCENT[2]);
        doc.circle(MARGIN_X + 3, cur.y - 3, 1.6, "F");
        doc.text(lines, MARGIN_X + 14, cur.y, { lineHeightFactor: 1.5 } as any);
        cur.y += lines.length * 15 + 4;
      }
      cur.y += 6;
    } else {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 24, 20);
      const lines = doc.splitTextToSize(stripInline(block.text), CONTENT_W);
      // paragraph may span pages
      let i = 0;
      while (i < lines.length) {
        const remaining = PAGE_H - MARGIN_BOTTOM - cur.y;
        const lineH = 16.5;
        const fit = Math.max(1, Math.floor(remaining / lineH));
        const slice = lines.slice(i, i + fit);
        doc.text(slice, MARGIN_X, cur.y, { lineHeightFactor: 1.5 } as any);
        cur.y += slice.length * lineH;
        i += slice.length;
        if (i < lines.length) cur.newPage();
      }
      cur.y += 8;
    }
  }
  cur.finish();
  return cur.pageNum;
}

function policyText(kind: "copyright" | "disclaimer" | "license", outline: Outline): string {
  const year = new Date().getFullYear();
  if (kind === "copyright") {
    return `Copyright © ${year} ${outline.author_pen_name}. All rights reserved.

No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.

This eBook was generated with the assistance of artificial intelligence. The author has reviewed and curated the final work.

First digital edition, ${year}.`;
  }
  if (kind === "disclaimer") {
    return `The information contained in this eBook is for general informational and educational purposes only. While the author has made every effort to ensure the accuracy of the content, no representations or warranties are made regarding the completeness, accuracy, reliability, or suitability of the information.

Any reliance you place on the material in this book is strictly at your own risk. The author shall not be liable for any losses or damages arising from the use of this content. Where applicable, please consult qualified professionals before acting on advice contained herein.`;
  }
  return `License & Permissions

This eBook is licensed for personal, non-commercial use by the original purchaser. You may not copy, redistribute, sell, sub-license, rent, or share this eBook in whole or in part without express written permission from the rights holder.

For permissions, bulk licensing, translation rights, or media inquiries, please contact the publisher.`;
}

export async function buildEbookPdf(payload: EbookPayload): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H], compress: true });

  let pageNum = 1;
  // Cover (no number)
  addCover(doc, payload);

  // Title page
  addTitlePage(doc, payload, ++pageNum);

  // Copyright
  addParagraphPage(doc, { heading: "Copyright", body: policyText("copyright", payload.outline), pageNum: ++pageNum, runHeader: payload.outline.title });

  // Disclaimer
  addParagraphPage(doc, { heading: "Disclaimer", body: policyText("disclaimer", payload.outline), pageNum: ++pageNum, runHeader: payload.outline.title });

  // License
  addParagraphPage(doc, { heading: "License", body: policyText("license", payload.outline), pageNum: ++pageNum, runHeader: payload.outline.title });

  // Description / About this book
  addParagraphPage(doc, { heading: "About This Book", body: `${payload.outline.tagline}\n\n${payload.outline.description}\n\nTags: ${(payload.outline.tags || []).join(" · ")}`, pageNum: ++pageNum, runHeader: payload.outline.title });

  // TOC
  addTOC(doc, payload, ++pageNum);

  // Chapters
  for (const ch of payload.chapters) {
    pageNum++;
    pageNum = addChapter(doc, ch, payload.outline.title, pageNum);
  }

  // Closing thanks page
  doc.addPage();
  paintBackground(doc, C_PARCHMENT);
  doc.setFont("times", "italic");
  doc.setFontSize(14);
  doc.setTextColor(C_MUTED[0], C_MUTED[1], C_MUTED[2]);
  doc.text("Thank you for reading.", PAGE_W / 2, PAGE_H / 2, { align: "center" });
  doc.setDrawColor(C_GOLD[0], C_GOLD[1], C_GOLD[2]);
  doc.line(PAGE_W / 2 - 24, PAGE_H / 2 + 12, PAGE_W / 2 + 24, PAGE_H / 2 + 12);
  doc.setFontSize(10);
  doc.text(`— ${payload.outline.author_pen_name}`, PAGE_W / 2, PAGE_H / 2 + 32, { align: "center" });

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); }, 1000);
}

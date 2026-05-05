// Compose a cover image with title, subtitle, and author name overlay (canvas).
export async function composeCoverWithTitle(
  baseDataUrl: string,
  title: string,
  subtitle: string | undefined,
  author: string,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = img.naturalWidth || 1024;
      const H = img.naturalHeight || 1536;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(baseDataUrl);
      ctx.drawImage(img, 0, 0, W, H);

      // Top dark gradient for title
      const gTop = ctx.createLinearGradient(0, 0, 0, H * 0.45);
      gTop.addColorStop(0, "rgba(0,0,0,0.78)");
      gTop.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gTop;
      ctx.fillRect(0, 0, W, H * 0.45);

      // Bottom dark gradient for author
      const gBot = ctx.createLinearGradient(0, H * 0.65, 0, H);
      gBot.addColorStop(0, "rgba(0,0,0,0)");
      gBot.addColorStop(1, "rgba(0,0,0,0.82)");
      ctx.fillStyle = gBot;
      ctx.fillRect(0, H * 0.65, W, H * 0.35);

      // Title
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 12;

      const titleSize = Math.round(W * 0.085);
      ctx.font = `bold ${titleSize}px Georgia, "Times New Roman", serif`;
      const titleLines = wrapLines(ctx, title.toUpperCase(), W * 0.85);
      let y = H * 0.12;
      for (const line of titleLines) {
        ctx.fillText(line, W / 2, y);
        y += titleSize * 1.1;
      }

      if (subtitle) {
        const subSize = Math.round(W * 0.035);
        ctx.font = `italic ${subSize}px Georgia, serif`;
        ctx.fillStyle = "#f0e6d2";
        const subLines = wrapLines(ctx, subtitle, W * 0.8);
        y += subSize * 0.5;
        for (const line of subLines) {
          ctx.fillText(line, W / 2, y);
          y += subSize * 1.2;
        }
      }

      // Author bottom
      const authorSize = Math.round(W * 0.045);
      ctx.font = `600 ${authorSize}px Georgia, serif`;
      ctx.fillStyle = "#fff";
      ctx.fillText(author.toUpperCase(), W / 2, H - H * 0.06);

      // Decorative line above author
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = Math.max(2, W * 0.003);
      const lineY = H - H * 0.06 - authorSize * 1.2;
      ctx.beginPath();
      ctx.moveTo(W * 0.35, lineY);
      ctx.lineTo(W * 0.65, lineY);
      ctx.stroke();

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(baseDataUrl);
    img.src = baseDataUrl;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// deno-lint-ignore-file no-explicit-any
import { corsHeaders, lovableChat, ruleFor, AGE_VOCAB } from "../_shared/ai.ts";

function buildPrompt(args: any) {
  const { bookTitle, ebookType, emotion, tone, audience, ageGroup, characters, chapter, prevSummary, wordsTarget } = args;
  const rule = ruleFor(ebookType);
  const age = ageGroup || rule.ageDefault;
  const target = Math.min(Math.max(Number(wordsTarget) || 1500, 300), 3500);

  const charLine = Array.isArray(characters) && characters.length
    ? `Recurring characters: ${characters.join("; ")}.` : "";

  // Per-type instructions
  let modeInstruction = "";
  let lengthHint = `Aim for ~${target} words.`;
  let visualBlock = `Insert one [VISUAL] block at the opening:\n[VISUAL | style: cinematic | mood: ${emotion || "evocative"} | scene: opening scene description]`;
  let chartBlock = rule.needsCharts ? `Where data illustrates a point, include a [CHART] block:\n[CHART | type: bar | title: "Chart Title" | data: A:10, B:20, C:30 | insight: "what this shows"]` : "";
  let taskBlock = rule.needsTasks ? `End with exactly 3 exercises:\n[TASK | level: beginner | time: 5 min] → task\n[TASK | level: intermediate | time: 20 min] → task\n[TASK | level: advanced | time: 1 hour] → task` : "";

  switch (rule.textMode) {
    case "full-story":
      modeInstruction = `Write a COMPLETE narrative chapter with: (1) hook scene, (2) rising action, (3) conflict/turning point, (4) emotional resolution that bridges to the next chapter. Use dialogue, sensory detail, and character interiority. Show, don't tell.`;
      lengthHint = `Target ${Math.max(target, 1500)} words — full story arc, not a summary.`;
      break;
    case "instructional":
      modeInstruction = `Write a teaching chapter: hook → core concept → 2-3 examples → practical takeaway. Use ## subheadings.`;
      break;
    case "minimal-caption":
      modeInstruction = `COLORING BOOK PAGE. NO STORY, NO TEXT BODY, NO CHARTS, NO TASKS. Output ONLY:
1. One [VISUAL] block describing a black-and-white line-art coloring scene (no shading, simple bold outlines, age-appropriate).
2. One short caption sentence (max 12 words) below it.
That's all. No paragraphs, no lessons.`;
      lengthHint = "";
      visualBlock = `[VISUAL | style: line-art | scene: bold simple coloring scene description, no shading, kid-friendly]`;
      chartBlock = "";
      taskBlock = "";
      break;
    case "puzzle":
      modeInstruction = `GAME BOOK PAGE. NO STORY OR LECTURE. Output ONLY:
1. One [VISUAL] block (illustration of the puzzle theme).
2. 2-4 puzzles/riddles/mini-games as [TASK] blocks (age-appropriate).
3. An "Answers" section at the end (hidden formatting: ## Answers).`;
      lengthHint = "Keep it short — puzzles only.";
      chartBlock = "";
      taskBlock = `Use [TASK | level: easy | time: 5 min] → puzzle/riddle text`;
      break;
    case "qa":
      modeInstruction = `QUIZ CHAPTER. Output 8-12 quiz questions with 4 options each, then an Answer Key. Age-appropriate ONLY.`;
      lengthHint = "";
      chartBlock = "";
      taskBlock = "";
      visualBlock = "";
      break;
    case "recipe":
      modeInstruction = `COOKBOOK CHAPTER. Format: ## Recipe Name → short intro → ## Ingredients (list) → ## Steps (numbered) → ## Variations / Tips. Include 1-2 recipes per chapter.`;
      chartBlock = "";
      break;
    case "panel-script":
      modeInstruction = `COMIC SCRIPT. Format panels as:
PANEL 1
[visual description]
CAPTION: ...
DIALOGUE: Character: "..."`;
      chartBlock = "";
      taskBlock = "";
      break;
  }

  const safety = age.startsWith("kids") || age === "teen"
    ? `STRICT: NO violence, romance, profanity, drugs, alcohol, scary horror, or mature themes. Content must be 100% age-safe for ${age}.`
    : "";

  const system = `You are an elite ebook author writing premium ${ebookType} content for ${age} readers.

AGE-APPROPRIATE LANGUAGE: ${AGE_VOCAB[age]}
${safety}

WRITING QUALITY: Hemingway-clean prose. Short punchy sentences for impact, longer flowing ones for description. Vary rhythm. Strong metaphors. Open with a hook.

MODE: ${modeInstruction}
${lengthHint}

Use blank-line separated paragraphs. Use ## for sub-headings. Do NOT include the chapter number/title at the top — the layout adds them. No meta commentary. Markdown allowed (## **bold** *italic* > blockquote - bullets).`;

  const user = `Book: "${bookTitle}"
Type: ${ebookType} | Emotion: ${emotion || "engaging"} | Tone: ${tone || "vivid"} | Audience: ${audience || "general"}
${charLine}
${prevSummary ? `Previous chapter recap: ${prevSummary}` : ""}

Write CHAPTER ${chapter.number}: "${chapter.title}".
Summary: ${chapter.summary}
Key points to weave in:
${(chapter.key_points || []).map((p: string) => `- ${p}`).join("\n")}

${visualBlock ? "VISUAL REQUIRED:\n" + visualBlock : ""}
${chartBlock ? "\nCHART OPTIONAL:\n" + chartBlock : ""}
${taskBlock ? "\nTASKS REQUIRED:\n" + taskBlock : ""}

Write the full chapter NOW.`;

  return { system, user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const args = await req.json();
    if (!args?.chapter?.title) {
      return new Response(JSON.stringify({ error: "chapter.title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { system, user } = buildPrompt(args);
    let content = "";
    try {
      content = await lovableChat({ system, user, temperature: 0.85 });
    } catch (e) {
      console.error("lovableChat chapter failed", e);
    }
    if (!content || content.trim().length < 100) {
      const rule = ruleFor(args.ebookType);
      const kp = (args.chapter.key_points || []).map((p: string) => `- ${p}`).join("\n");
      content = `*The AI service was overloaded — a draft is inserted; regenerate later.*

[VISUAL | style: ${rule.imageStyle} | scene: opening scene for "${args.chapter.title}"]

## Overview
${args.chapter.summary}

## Key Points
${kp}`;
    }
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-chapter error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

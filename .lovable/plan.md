## Plan: Major eBook Generator Overhaul

### 1. AI Provider Switch → Lovable AI Gateway (free Google Gemini)
- Replace Pollinations text calls in `generate-outline` and `generate-chapter` with **Lovable AI Gateway** using `google/gemini-2.5-flash` (free during promo period, no key needed by user — `LOVABLE_API_KEY` already set).
- Add a new edge function `plan-ebook` that uses Gemini to do **chain-of-thought planning** (audience age, tone, theme, structure) BEFORE outline generation. Returned plan is shown to the user and fed into outline + chapters.

### 2. Type-aware content rules
Add a `TYPE_RULES` matrix that controls what each ebook type contains:

| Type | Text | Story | Charts | Images | Tasks | Stock Photos |
|---|---|---|---|---|---|---|
| coloring | minimal caption only | ❌ | ❌ | ✅ line-art only | ❌ | ❌ |
| game | puzzle prompts only | ❌ | ❌ | ✅ illustrations | ✅ puzzles | ❌ |
| kids | simple age-appropriate | ✅ short | ❌ | ✅ illustrations | ❌ | ❌ |
| quiz | age-appropriate Q&A | ❌ | ❌ | ✅ optional | ✅ questions | ❌ |
| fiction / novel | **full story** | ✅ full | ❌ | ✅ AI scenes | ❌ | optional |
| self_help / guide / cookbook / biography / technical | full text | varies | ✅ | ✅ + stock photos | ✅ | ✅ via Unsplash/Pexels free APIs |

### 3. Age-aware tone
Add `ageGroup` field to outline: `kids-4-7`, `kids-8-12`, `teen`, `adult`. System prompts switch vocabulary, sentence length, and content safety per group. Strict: no adult content for kids/quiz.

### 4. Full story chapters
For `fiction`, `novel`, `kids`, `biography`: chapter prompt forces complete narrative arcs (scene → conflict → resolution), 1800-2500 words, with dialogue and sensory detail. No cliffhanger summaries.

### 5. Remove cover generation
- Drop `cover_prompt`, `composeCoverWithTitle`, and the cover image step from the pipeline.
- DOCX starts with title page (typeset text only) instead of image cover.
- Remove cover-compose import in `Index.tsx`.

### 6. Free stock photos for non-fiction
Add `src/lib/stock-photos.ts` (and edge equivalent) that pulls from:
- **Unsplash Source** (`https://source.unsplash.com/featured/?query`) — no key, free, royalty-free
- **Pexels public CDN fallback** via `picsum` for placeholders
Used only for `self_help`, `guide`, `cookbook`, `biography`, `technical`, `standard`. Coloring/game/kids/quiz use AI line-art / illustrations only.

### 7. AI-thinking plan step (visible)
New flow:
1. User submits title + type → call `plan-ebook` → show "AI Thinking" panel (audience, age group, tone, theme, structure rationale, content composition).
2. User clicks Continue → outline → chapters → docx.

### 8. Multiple free open-source assembly tools
Already using `docx`. Keep `.docx` as primary. The current `pdf-builder.ts` stays (jsPDF) for PDF export option. No new heavy deps.

### Files to change
- **Edit** `supabase/functions/generate-outline/index.ts` — Lovable AI Gateway, age group, type rules, no cover_prompt
- **Edit** `supabase/functions/generate-chapter/index.ts` — Lovable AI Gateway, age-aware prompts, type-conditional sections, full-story mode
- **New** `supabase/functions/plan-ebook/index.ts` — AI thinking step
- **Edit** `supabase/config.toml` — register new function
- **Edit** `src/lib/ebook-api.ts` — add `planEbook()`, add ageGroup/typeRules to types
- **Edit** `src/lib/docx-builder.ts` — remove cover image, add title page, conditional sections per type
- **Edit** `src/lib/media-enrich.ts` — route to stock photos vs AI vs line-art per type
- **New** `src/lib/stock-photos.ts` — Unsplash free source helper
- **Edit** `src/pages/Index.tsx` — new plan step in UI, drop cover compose
- **Edit** `src/components/GeneratorForm.tsx` — optional age group selector (auto-derived if blank)
- **Edit** `src/components/ResultView.tsx` — show AI thinking panel
- **Delete** `src/lib/cover-compose.ts`

### Technical notes
- Lovable AI uses `LOVABLE_API_KEY` (already in secrets) → `https://ai.gateway.lovable.dev/v1/chat/completions` with `Lovable-API-Key` header.
- Default model `google/gemini-2.5-flash`; fall back to `google/gemini-2.5-flash-lite` on 429.
- Handle 429 (rate limit) and 402 (credits) gracefully in UI.
- Stock photo URLs returned as direct image links → fetched and embedded in `.docx` as image runs.

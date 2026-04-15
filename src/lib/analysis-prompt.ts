import { z } from 'zod';

// -----------------------------------------------------------------------------
// Single source of truth for Gemini analysis output.
//
// Both /api/analyze (manual) and /api/pipeline/process-video (n8n) import
// buildAnalysisPrompt + parseAnalysisResult from this file. The Zod schema is
// authoritative; ANALYSIS_RESPONSE_SCHEMA is hand-written to mirror it for
// Gemini's `responseSchema` config (Gemini needs a JSON-Schema-ish shape, not
// a Zod object).
//
// Classification design (Goal 6):
//   verdict       — approve | reject. The gatekeeper: does this video belong
//                   on VibeCodersHQ at all?
//   feed_category — pulse | forge | alchemy. The router. ALWAYS populated,
//                   even on reject, so manual override has a destination
//                   without a second Gemini round-trip.
// -----------------------------------------------------------------------------

export const SKILL_TAGS = [
  'Sales',
  'Copywriting',
  'Marketing Psychology',
  'AI/Automation',
  'Content Creation',
  'Outreach',
  'Time Management',
  'VibeCoding/Architecture',
] as const;

const ContentTag = z.object({
  tag: z.string(),
  weight: z.number(),
  segment_start_pct: z.number(),
  segment_end_pct: z.number(),
});

const QuizQuestion = z.object({
  lesson_number: z.number(),
  skill_tag: z.string(),
  question: z.string(),
});

const CategorySignals = z
  .object({
    is_tutorial: z.boolean(),
    is_news: z.boolean(),
    is_monetization: z.boolean(),
    is_mindset: z.boolean(),
    novelty_claim: z.boolean(),
    novelty_substantiated: z.boolean(),
  })
  .strict();

export const AnalysisResultSchema = z.object({
  humanScore: z.number(),
  humanScoreReason: z.string(),
  takeaways: z.array(z.string()),
  category: z.string(),
  content_tags: z.array(ContentTag),
  quiz_questions: z.array(QuizQuestion),

  // Goal 6 — classification
  verdict: z.enum(['approve', 'reject']),
  feed_category: z.enum(['pulse', 'forge', 'alchemy']),
  category_confidence: z.number().min(0).max(1),
  category_rationale: z.string(),
  category_signals: CategorySignals,
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// Gemini `responseSchema` mirror. Keep in sync with AnalysisResultSchema above.
export const ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    humanScore: { type: 'number' as const },
    humanScoreReason: { type: 'string' as const },
    takeaways: { type: 'array' as const, items: { type: 'string' as const } },
    category: { type: 'string' as const },
    content_tags: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          tag: { type: 'string' as const },
          weight: { type: 'number' as const },
          segment_start_pct: { type: 'number' as const },
          segment_end_pct: { type: 'number' as const },
        },
        required: ['tag', 'weight', 'segment_start_pct', 'segment_end_pct'] as const,
      },
    },
    quiz_questions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          lesson_number: { type: 'number' as const },
          skill_tag: { type: 'string' as const },
          question: { type: 'string' as const },
        },
        required: ['lesson_number', 'skill_tag', 'question'] as const,
      },
    },
    verdict: { type: 'string' as const, enum: ['approve', 'reject'] as const },
    feed_category: {
      type: 'string' as const,
      enum: ['pulse', 'forge', 'alchemy'] as const,
    },
    category_confidence: { type: 'number' as const },
    category_rationale: { type: 'string' as const },
    category_signals: {
      type: 'object' as const,
      properties: {
        is_tutorial: { type: 'boolean' as const },
        is_news: { type: 'boolean' as const },
        is_monetization: { type: 'boolean' as const },
        is_mindset: { type: 'boolean' as const },
        novelty_claim: { type: 'boolean' as const },
        novelty_substantiated: { type: 'boolean' as const },
      },
      required: [
        'is_tutorial',
        'is_news',
        'is_monetization',
        'is_mindset',
        'novelty_claim',
        'novelty_substantiated',
      ] as const,
    },
  },
  required: [
    'humanScore',
    'humanScoreReason',
    'takeaways',
    'category',
    'content_tags',
    'quiz_questions',
    'verdict',
    'feed_category',
    'category_confidence',
    'category_rationale',
    'category_signals',
  ] as const,
};

export function parseAnalysisResult(raw: unknown): AnalysisResult {
  return AnalysisResultSchema.parse(raw);
}

export function buildAnalysisPrompt(
  transcript: string,
  publishedAt: string | null,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const publishBlock = publishedAt
    ? `Video published: ${publishedAt}. Today: ${today}. Use this to judge whether any "new"/"just released" claims in the transcript are substantiated.`
    : `Publish date unknown. Judge novelty from transcript specifics alone (model names, version numbers, funding events, dates mentioned).`;

  return `
Analyze this YouTube video transcript.

${publishBlock}

Goal 1: Calculate a "Human Verification Score" (0-100).
- CRITICAL: For verified/high-quality content (which this is), the score MUST be between 91 and 100.
- 91-99: Excellent, authentic, high signal.
- 100: Absolute masterpiece, purely human, deeply rigorous.
- NEVER return a score below 91 for this specific task.

Goal 2: Extract 3 specific, high-value Key Lessons.
- STYLE: Curiosity-Driven & Benefit-Oriented.
- LENGTH: Each lesson MUST be 75 characters or less (including spaces/punctuation).
- Do NOT just summarize. Tease the value.
- BAD: "He talks about being consistent."
- GOOD: "The 'Rule of 100' framework that guarantees your first result."
- GOOD: "Why 'Shallow Work' destroys careers (and the fix)."
- Make the user feel they *must* watch to get the full secret.
- Look for specific frameworks, numbers, or unique insights.
- Keep it punchy and concise - single line per lesson!

Goal 3: Determine the "Vibe" category (e.g., Productivity, Mindset, Sales, Coding).
This is a free-form sub-genre label, NOT the feed_category in Goal 6.

Goal 4: Extract exactly 3 "Content DNA" tags for interest-based scoring.
- Each tag is a lowercase_slug (e.g., cold_approach, dating, business_mindset, morning_routine).
- Keep tags broad enough to be reusable across videos, but specific enough to be meaningful.
- Assign weights: the primary/dominant topic = 10, secondary = 8, tertiary = 5.
- For each tag, estimate what percentage range of the video discusses that topic.
  Use segment_start_pct (0-100) and segment_end_pct (0-100). These can overlap if topics are interwoven.
- Example shape: [{"tag":"cold_emails","weight":10,"segment_start_pct":0,"segment_end_pct":45},{"tag":"outreach_mindset","weight":8,"segment_start_pct":30,"segment_end_pct":75},{"tag":"tech_setup","weight":5,"segment_start_pct":65,"segment_end_pct":100}]

Goal 5: Generate EXACTLY 6 "Proof of Work" Questions.
- CRITICAL: YOU MUST GENERATE EXACTLY 6 QUESTIONS. DO NOT GENERATE 3. DO NOT GENERATE 5. EXACTLY 6.
- Convert the essence of the lessons into 6 UNIQUE, open-ended application questions.
- Draw from the full context of the video to create 6 varied questions.
- The questions must force the user to apply the concept to their own business, life, or workflow.
- Do NOT ask "What did the video say?" Ask "How would you use this to..."
- You MUST assign one of these exact 'Skill Tags' to each question: ['Sales', 'Copywriting', 'Marketing Psychology', 'AI/Automation', 'Content Creation', 'Outreach', 'Time Management', 'VibeCoding/Architecture'].
- Questions must be SHORT and punchy. MAXIMUM 15 WORDS per question. No fluff.
- Do NOT start with "Based on..." or "According to..." — just ask directly.
- Number them exactly 1, 2, 3, 4, 5, and 6 via the "lesson_number" field.

Goal 6: Classify this video for the VibeCodersHQ feed. TWO separate decisions.

=== Decision A: verdict ('approve' | 'reject') ===

REJECT if the transcript is primarily about ANY of:
- Fitness, diet, lifestyle, cooking, relationships (unless framed as outreach/sales psychology)
- Entertainment, gaming, reaction content, politics, celebrity news
- Faceless AI slop (auto-generated voiceover, "top 10" compilations with no human insight)
- **Generic motivation / self-help rah-rah.** This is the single most common failure mode and the reason this filter exists. A video that talks about discipline, consistency, mindset, "lion mode," "the grind," sacrifice, hard work, "don't give up," "trust the process," "embrace the process," "stay focused" → **REJECT**, even when it names the concept ("Rule of Consistency", "Lion Mode", "Sorting Hat"). Named concepts with zero measurable criteria are still rah-rah.
  Mindset content escapes reject into alchemy ONLY when it contains concrete, measurable specifics — one or more of:
    (a) specific time blocks / durations / frequencies ("4-hour deep work blocks", "30 min cold calls at 9am")
    (b) specific numeric thresholds, kill rules, or review criteria ("if < 1 PR per block, kill tomorrow's block", "audit the top 20% of clients quarterly")
    (c) specific products, prices, packaging, or dollar amounts
    (d) specific code, tools, commands, model names, or build steps
  If the video is ONLY about "how to think" / "how to feel" / "how to persist" without any of (a)-(d) → **REJECT**. It does not matter how inspiring it is. It does not matter if the creator names their framework. No numbers, no rules, no specifics → reject.
  Rule of thumb: if stripping all the "motivation" language leaves nothing behind — reject. If stripping the motivation language leaves a concrete system (numbers, rules, prices, code) — approve + alchemy.

APPROVE if the transcript is primarily about ONE of: building with AI/code, shipping products, selling/pricing AI services, OR a specific named builder-focus framework with measurable specifics — AND at least one of the three category tests below fires cleanly.

IGNORE the title. Ignore "BRAND NEW" / "INSANE" / "GAME CHANGER" claims unless the transcript proves specifics. YouTubers lie in titles. The transcript is truth.

=== Decision B: feed_category ('pulse' | 'forge' | 'alchemy') ===

You MUST populate this field on EVERY call, even when verdict='reject'. If reject, still answer: "if I had to route this, which bucket fits best?" Never null.

**Walk the decision tree below IN ORDER. Return at the FIRST rule that fires. Do NOT score buckets independently and pick the highest — that is wrong and produces non-deterministic outputs. The order encodes priority.**

---

STEP 1 — **Alchemy trigger — the "soft skills" layer.** Alchemy is about the non-technical side of running an AI-era business: selling, positioning, mindset, discipline. The viewer doesn't open an IDE — they think about how to sell, run, or focus on a business. Fire alchemy if the video's PRIMARY lesson is any of:
  - Cold outreach, cold DMs, cold email scripts, sales calls, closing, objection handling
  - Pricing, offers, packaging, positioning, tiered service menus, retainer models
  - Client acquisition, lead generation as a business process (not "use AI to build a lead-gen tool" — that's forge)
  - Business models / "AI businesses I'd start in 2026" / "$0 to $X MRR" playbooks
  - Mindset, productivity, focus, discipline, deep work, consistency — ESPECIALLY when named (e.g. "4-hour blocks", "Rule of 100")
  - Agency operations, hiring, delegation, SOPs for a service business

  If YES → **feed_category = "alchemy"**. STOP. Do not evaluate Steps 2-4.

  **Tutorial sprinkled with revenue talk = forge, not alchemy.** If the video is a step-by-step build (commands, screenshares, prompts, IDE, deploy) and the creator happens to mention "I use this in my $4M agency" or "this is how I land clients" — that's flavoring, not the lesson. The viewer's takeaway is the artifact. → continue to Step 2, will likely land on forge.

  **Edge case — "how to build and sell X" tutorials:** these genuinely live on the alchemy/forge border. Pick whichever feels closer and don't agonize. Either bucket serves the viewer. Do not spend reasoning budget on this.

  If NO → continue to Step 2.

STEP 2 — **New-release trigger (exclusionary).**

**FRESHNESS GATE — evaluate FIRST before anything else in this step:**
Pulse is ONLY available for videos published within the last **8 days** (calendar days from today).
  - If publish date is provided AND video is **> 8 days old** → **pulse is NOT available**. Skip the rest of Step 2 entirely and continue to Step 3. A stale news video must route to forge/alchemy or be rejected. This is by design: Pulse is the "latest news" tab, sorted newest-first. Videos older than 8 days are buried by fresher content and have no business in that bucket regardless of how release-focused they were at the time.
  - If publish date is provided AND video is **≤ 8 days old** → pulse is available, continue with the trigger test below.
  - If publish date is UNKNOWN → pulse is available only if the transcript explicitly anchors novelty to a recent timeframe ("yesterday Anthropic shipped", "this week OpenAI launched", "just now"). Vague "new"/"brand new" claims without a concrete recent anchor do NOT qualify — continue to Step 3.

**Trigger test (only reached if the freshness gate passed):** Does the video's headline, opening, or framing hit ANY of these "news signals"? **Trust them at face value — we only run on preapproved channels, so creators BSing on novelty is a tiny risk and handled out-of-band.** Do NOT require Gemini to independently verify version numbers or release dates:
  - "X just dropped" / "just launched" / "just released" / "just shipped"
  - "X changes everything" / "this changes the game"
  - "Y just killed Z" / "the end of Z" / "Z is dead"
  - A specific named new model / tool / API / feature as the subject (e.g. "Claude 4.6", "Gemma 4", "GPT-5", "Routines", "Co-work Dispatch")
  - Benchmark reactions, comparison videos, feature tours of a named release
  - "How to get X" where X is a named AI product/tool/access method (free tokens, API keys, new SDK)

  Also apply the strip test as a secondary check: remove the named model/tool from the premise. If nothing is left, pulse. If a generic "how to build [thing]" still stands, the tool is an instrument → continue to Step 3.

  Examples:
  - "Claude 4.6 just dropped — here's what it can do" → strip Claude 4.6 → nothing left → PULSE.
  - "How to get free Claude tokens via Open Router" → strip Claude/Open Router → nothing left → PULSE (access/tool IS the topic).
  - "How to build a CRM with Claude Code" → strip Claude Code → "how to build a CRM" still stands → NOT pulse, continue.

  → YES: **feed_category = "pulse"**. STOP. Do not evaluate Steps 3-4.
  → NO: continue to Step 3.

STEP 3 — Is the video a **generalizable step-by-step tutorial** where a named AI tool is the INSTRUMENT (not the subject) used to produce a working artifact (script, repo, deployed app, prompt library, automation)?
  The test: the tool is swappable. If the creator used a different AI model tomorrow, the lesson still holds. The viewer walks away with a thing they built.
  Signals: "first do X, then Y, then Z," exact commands, IDE screenshares, copy-paste prompts, a clear handoff artifact at the end.
  → YES: **feed_category = "forge"**.
  → NO: continue to Step 4.

STEP 4 — **Zero-build-content gate.** This step ONLY fires when Step 3 answered NO. If the transcript contains ANY commands, code snippets, file names, IDE screenshares, API calls, or copy-paste prompts — even sparse ones — then Step 3 was YES and you must return **forge**, not Step 4.
  If (and only if) Step 3 is truly NO: does the video present a **specific, named builder-focus framework** with measurable criteria — deep work, time allocation, discipline system, prioritization method — applied to a builder/creator's working life, with concrete numeric/binary dos/don'ts (e.g. "4-hour blocks", "kill the next block if < 1 PR", "top 20% of clients audited quarterly")?
  → YES: **feed_category = "alchemy"** (mindset sub-type). Must pass the "no rah-rah" test from Decision A.
  → NO: continue to Step 5.

STEP 5 — Default. If the video was approved but didn't match Steps 1-4, pick the closest bucket by vibe and set category_confidence ≤ 0.5. If the video is being REJECTED, still pick the closest bucket — do not leave it null.

---

**Tiebreaker clarifications** (for the edge cases this validation surfaced):

- "How I built X to sell it" → STEP 1 wins → **alchemy**. The sale is the point.
- "Here's what's new in [recent model] and how I use it" → STEP 2 wins → **pulse**. The release is the point.
- "Here's how to build X with [any tool]" (no sale angle, no new release as topic) → STEP 3 → **forge**.
- "Mindset / focus / discipline framework" with measurable specifics → **alchemy**.
- "Mindset / focus / discipline framework" without measurable specifics → **reject** (and feed_category=alchemy for override).

=== Few-shot examples ===

Example 1 — clickbait tutorial → forge
  Title: "INSANE NEW CLAUDE TRICK NOBODY IS USING 🔥"
  Transcript: "...first open your terminal and run npx create-next-app, then in claude.md paste this exact config, then we hit /init..."
  Video is not about selling, not about a newly-released model — just a replicable workflow.
  → Step 1 NO, Step 2 NO, Step 3 YES → verdict: "approve", feed_category: "forge".

Example 2 — new-model demo → pulse (NOT forge)
  Title: "Claude just shipped Routines — full walkthrough"
  Transcript: "...Anthropic dropped Routines yesterday. Let me show you what it does. You hit the new endpoint, pass a routine_id, and it runs async. Here's the API call, here's what comes back. Price is $0.003 per..."
  Even though there are commands and an API call, the *point* is the new feature release. If Routines hadn't been announced this week, this video wouldn't exist.
  → Step 1 NO, Step 2 YES (new API, version numbers, reaction format) → verdict: "approve", feed_category: "pulse".

Example 3 — sell-the-service tutorial → alchemy (NOT forge)
  Title: "How I build AI websites and sell them for $5k"
  Transcript: "...I charge $5k flat. The pitch deck has three slides. I build it with Claude Code, deploy to Vercel, hand over a Loom, and invoice same day. Here's the exact Claude prompt I use for the hero section..."
  Even though there's a build walkthrough, the *point* is the $5k offer/pricing/packaging.
  → Step 1 YES (dollar amount, pricing, packaging) → verdict: "approve", feed_category: "alchemy".

Example 4 — pure motivation dressed as framework → reject
  Title: "You NEED to hear this if you're struggling"
  Transcript: "...the Rule of Consistency says you just keep showing up. Trust the process. I call it the 'compound mindset.' Don't let anyone tell you it can't be done..."
  "Rule of Consistency" and "compound mindset" SOUND like frameworks but have zero measurable criteria, zero dollar amounts, zero build steps. This is exactly the rescue-by-framing trap.
  → REJECT. feed_category = "alchemy" (closest bucket, populated for override).

Example 5 — pricing framework → alchemy
  Title: "How I Charge $15k for AI Agents"
  Transcript: "...I stopped selling by the hour. Three deliverables: discovery audit $2k, agent build $10k, 30-day support $3k. Here's the pricing sheet..."
  → Step 1 YES → verdict: "approve", feed_category: "alchemy".

Example 6 — named focus framework with specifics → alchemy (mindset sub-type)
  Title: "The 4-hour block system that ships features"
  Transcript: "...I block 4 hours every morning, no Slack, no email. I track lines-of-code and PRs shipped per block. If a block produces less than one PR, I kill the next day's block and do async review instead..."
  Measurable criteria (4h, PR count, kill rule). Not rah-rah.
  → Step 1 NO, Step 2 NO, Step 3 NO, Step 4 YES → verdict: "approve", feed_category: "alchemy".

=== Output fields for Goal 6 ===
- verdict: "approve" | "reject"
- feed_category: "pulse" | "forge" | "alchemy" (ALWAYS populated, never null)
- category_confidence: 0.0–1.0, how confident you are in feed_category
- category_rationale: 1-2 sentences. On reject, explain why. On approve, explain the dominant signal.
- category_signals: object with booleans:
    is_tutorial           — explicit steps/commands/artifacts present
    is_news               — references a recent model/tool/event
    is_monetization       — discusses pricing/packaging/selling
    is_mindset            — discusses focus/discipline frameworks
    novelty_claim         — transcript uses "new/just released/brand new" language
    novelty_substantiated — that claim is backed by specifics (version, date, spec)

Transcript:
"${transcript}"
`;
}

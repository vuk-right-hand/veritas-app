---
description: Extract curiosity-driven "3 Key Lessons" from YouTube video transcripts
---

# Video Lesson Extraction Skill

## Purpose
This skill contains the proven methodology for extracting high-quality, curiosity-driven "3 Key Lessons" from YouTube video transcripts using AI analysis.

## Core Principles

### 1. Curiosity-Driven Style
**Don't summarize — TEASE the value.**

Lessons should create a "curiosity gap" that makes users feel they MUST watch the video to get the full insight.

**BAD Examples:**
- ❌ "He talks about being consistent."
- ❌ "The importance of hard work."
- ❌ "Focus on your goals."

**GOOD Examples:**
- ✅ "The 'Rule of 100' framework that guarantees your first result."
- ✅ "Why 'Shallow Work' destroys careers (and the fix)."
- ✅ "The counter-intuitive productivity hack top performers use daily."

### 2. Length Constraints
- **Maximum: 75 characters per lesson** (including spaces and punctuation)
- **Must fit on a single line** in the UI
- Be punchy and concise

### 3. What to Look For
Extract:
- **Named frameworks** (e.g., "The 3-Part Decision Framework")
- **Specific numbers** (e.g., "The 90-second conversion window")
- **Counter-intuitive insights** (e.g., "Why working less can 10x your output")
- **Unique terminology** from the speaker (e.g., "The 'Green Blob Business Model'")

Avoid:
- Generic advice
- Obvious statements
- Long explanations

## AI Prompt Template

Use this prompt structure when analyzing transcripts:

```
Analyze this YouTube video transcript.

Goal: Extract 3 curiosity-driven Key Lessons.

CRITICAL CONSTRAINTS:
- Each lesson MUST be 75 characters or less (including spaces/punctuation)
- Style: Curiosity-Driven & Benefit-Oriented
- Do NOT just summarize. Tease the value.
- Make the user feel they *must* watch to get the full secret
- Look for specific frameworks, numbers, or unique insights
- Keep it punchy - single line per lesson!

EXAMPLES:
❌ BAD: "He talks about productivity strategies."
✅ GOOD: "The 'Decision Chain' method that 10x your daily output."

Transcript:
"[INSERT TRANSCRIPT HERE]"

Return JSON: { "takeaways": ["lesson 1", "lesson 2", "lesson 3"] }
```

## Usage in Code

### Option 1: Direct Integration (Current)
Embed the prompt directly in your API route:

```typescript
const prompt = `
  Goal 2: Extract 3 specific, high-value Key Lessons.
  - LENGTH: Each lesson MUST be 75 characters or less.
  - STYLE: Curiosity-Driven & Benefit-Oriented.
  [... rest of prompt from template above ...]
`;
```

### Option 2: External Prompt File (Future Enhancement)
Store the prompt in a separate file and import it:

```typescript
import { LESSON_EXTRACTION_PROMPT } from '@/lib/prompts/lesson-extraction';

const prompt = LESSON_EXTRACTION_PROMPT(transcript);
```

## Quality Checklist

Before accepting AI-generated lessons, verify:

- [ ] Each lesson is ≤75 characters
- [ ] Lessons create curiosity (don't just state facts)
- [ ] Lessons mention specific frameworks/numbers/terms when possible
- [ ] Lessons avoid generic advice like "work hard" or "be consistent"
- [ ] Lessons are benefit-oriented (imply a transformation)

## Examples from Production

### Example 1: Marketing Strategy Video
**Video**: "3 Stories You Need For Your Content"

**Generated Lessons**:
1. "The 'Three-Act Storytelling Framework' that makes your competition irrelevant." (73 chars)
2. "Why admitting failures is the fastest way to build a loyal audience." (70 chars)
3. "The secret to making 'boring' topics unforgettable through emotion." (68 chars)

### Example 2: Business Strategy Video
**Video**: "Why I'm Shutting Down My Business"

**Generated Lessons**:
1. "The 'Traffic Light System' that reveals energy-draining activities." (69 chars)
2. "The 'Green Blob Business' model where freedom beats revenue targets." (70 chars)
3. "How multi-millionaires accelerate growth through mastermind events." (69 chars)

## Performance Tips

1. **Transcript Length**: Truncate to ~25,000 characters to avoid token limits
2. **Temperature**: Use 0.3 for more consistent/deterministic outputs
3. **Retry Logic**: If lessons are too long, retry with stronger emphasis on character limit
4. **Model Selection**: `gemini-2.5-flash` works well for speed + quality balance

## Maintenance

When updating this skill:
1. Test with 3-5 diverse video transcripts
2. Verify character counts
3. Check for curiosity-driven style
4. Update examples in this document
5. Update the prompt in `/api/analyze/route.ts` to match

---

**Created**: 2026-02-10  
**Last Updated**: 2026-02-10  
**Version**: 1.0

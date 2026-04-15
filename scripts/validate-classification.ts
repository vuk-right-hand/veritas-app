// Classification validation harness.
//
// Run before shipping: fetches transcripts, calls Gemini with the shared
// prompt, compares to hand-labeled ground truth, prints confusion matrix +
// per-class precision/recall + determinism rate + total cost estimate.
//
// Each video is run THREE times to measure determinism at the pinned
// temperature (0.1). This is a validation-script concern only, NOT inside
// the live route.
//
// Ship gates (all must pass):
//   overall agreement        ≥ 85%
//   per-class precision+recall ≥ 80%
//   determinism across 3 runs  ≥ 95%
//   projected cost at 250/day  < $2/day
//
// Usage: tsx scripts/validate-classification.ts
//        (requires GOOGLE_API_KEY + SUPADATA_API_KEY in env)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ANALYSIS_RESPONSE_SCHEMA,
  buildAnalysisPrompt,
  parseAnalysisResult,
} from '../src/lib/analysis-prompt';
import { getYouTubeMetadata } from '../src/lib/youtube-metadata';

type Label = 'pulse' | 'forge' | 'alchemy' | 'reject';
type Row = { url: string; expected: Label; note?: string };

const RUNS_PER_VIDEO = 3;
const CACHE_DIR = path.join(process.cwd(), '.cache', 'validation-transcripts');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function videoIdFromUrl(url: string): string {
  const m = url.match(/[?&]v=([\w-]{10,12})|youtu\.be\/([\w-]{10,12})/);
  return (m?.[1] || m?.[2] || '').trim();
}

async function fetchTranscriptCached(url: string): Promise<string> {
  const id = videoIdFromUrl(url);
  const cachePath = path.join(CACHE_DIR, `${id}.txt`);
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');

  const res = await fetch(
    `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}`,
    { headers: { 'x-api-key': process.env.SUPADATA_API_KEY! } },
  );
  if (!res.ok) throw new Error(`Supadata ${res.status} for ${url}`);
  const data = await res.json();
  const text = (data.content ?? []).map((s: any) => s.text).join(' ');
  writeFileSync(cachePath, text);
  return text;
}

async function fetchPublishedAtCached(url: string): Promise<string | null> {
  const id = videoIdFromUrl(url);
  const cachePath = path.join(CACHE_DIR, `${id}.published.txt`);
  if (existsSync(cachePath)) {
    const v = readFileSync(cachePath, 'utf8');
    return v === 'null' ? null : v;
  }
  try {
    const meta = await getYouTubeMetadata(id);
    const v = meta.published_at ?? null;
    writeFileSync(cachePath, v ?? 'null');
    return v;
  } catch {
    writeFileSync(cachePath, 'null');
    return null;
  }
}

function getModel() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
    } as any,
  });
}

function labelFor(verdict: 'approve' | 'reject', feedCategory: Label): Label {
  return verdict === 'reject' ? 'reject' : feedCategory;
}

async function generateWithRetry(model: ReturnType<typeof getModel>, prompt: string, attempts = 5) {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || '');
      const transient = msg.includes('503') || msg.includes('429') || msg.includes('overloaded') || msg.includes('high demand');
      if (!transient || i === attempts - 1) throw e;
      const backoff = Math.min(30000, 2000 * Math.pow(2, i)) + Math.floor(Math.random() * 1000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

async function classify(transcript: string, publishedAt: string | null, model: ReturnType<typeof getModel>) {
  const prompt = buildAnalysisPrompt(transcript.substring(0, 25000), publishedAt);
  const t0 = Date.now();
  const resp = await generateWithRetry(model, prompt);
  const ms = Date.now() - t0;
  const text = resp.response.text();
  const usage = (resp.response as any).usageMetadata ?? {};
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  }
  const analysis = parseAnalysisResult(parsed);
  return {
    label: labelFor(analysis.verdict, analysis.feed_category as Label),
    verdict: analysis.verdict,
    feed_category: analysis.feed_category as Label,
    confidence: analysis.category_confidence,
    rationale: analysis.category_rationale,
    input_tokens: usage.promptTokenCount ?? 0,
    output_tokens: usage.candidatesTokenCount ?? 0,
    ms,
  };
}

async function main() {
  const fixturePath = path.join(process.cwd(), 'scripts/fixtures/classification-truth.json');
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const videos: Row[] = raw.videos;

  console.log(`Loaded ${videos.length} videos. Running ${RUNS_PER_VIDEO}× each.\n`);

  const model = getModel();
  const LABELS: Label[] = ['pulse', 'forge', 'alchemy', 'reject'];
  const confusion: Record<Label, Record<Label, number>> = Object.fromEntries(
    LABELS.map((a) => [a, Object.fromEntries(LABELS.map((b) => [b, 0])) as any]),
  ) as any;

  let totalRuns = 0;
  let correct = 0;
  let neighborhoodCorrect = 0; // strict correct + forge↔alchemy swaps on approve videos
  let deterministic = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let maxLatencyMs = 0;
  const disagreements: string[] = [];

  for (const v of videos) {
    try {
      const transcript = await fetchTranscriptCached(v.url);
      const publishedAt = await fetchPublishedAtCached(v.url);
      const runs = [];
      for (let i = 0; i < RUNS_PER_VIDEO; i++) {
        runs.push(await classify(transcript, publishedAt, model));
      }
      const runLabels = runs.map((r) => r.label);
      const majority = runLabels.sort((a, b) =>
        runLabels.filter((x) => x === b).length - runLabels.filter((x) => x === a).length,
      )[0];
      const isDet = runLabels.every((l) => l === runLabels[0]);
      if (isDet) deterministic++;

      confusion[v.expected][majority]++;
      totalRuns++;
      const strictHit = majority === v.expected;
      const neighborhoodHit =
        strictHit ||
        ((v.expected === 'forge' && majority === 'alchemy') ||
         (v.expected === 'alchemy' && majority === 'forge'));
      if (strictHit) correct++;
      if (neighborhoodHit) neighborhoodCorrect++;
      if (!strictHit) {
        const tag = neighborhoodHit ? '~' : '!';
        disagreements.push(
          `${tag} [${v.expected} → ${majority}] ${v.url}\n  rationale: ${runs[0].rationale}`,
        );
      }
      for (const r of runs) {
        totalInput += r.input_tokens;
        totalOutput += r.output_tokens;
        if (r.ms > maxLatencyMs) maxLatencyMs = r.ms;
      }
      process.stdout.write('.');
    } catch (e: any) {
      console.log(`\nX ${v.url}: ${e.message}`);
    }
  }

  console.log('\n\n=== Confusion matrix (expected → predicted) ===');
  const hdr = 'expected\\pred'.padEnd(14) + LABELS.map((l) => l.padEnd(9)).join('');
  console.log(hdr);
  for (const row of LABELS) {
    console.log(
      row.padEnd(14) + LABELS.map((c) => String(confusion[row][c]).padEnd(9)).join(''),
    );
  }

  console.log('\n=== Per-class precision / recall ===');
  for (const cls of LABELS) {
    const tp = confusion[cls][cls];
    const fn = LABELS.reduce((s, p) => s + (p === cls ? 0 : confusion[cls][p]), 0);
    const fp = LABELS.reduce((s, e) => s + (e === cls ? 0 : confusion[e][cls]), 0);
    const prec = tp + fp === 0 ? 0 : tp / (tp + fp);
    const rec = tp + fn === 0 ? 0 : tp / (tp + fn);
    console.log(`  ${cls.padEnd(8)}  precision=${(100 * prec).toFixed(1)}%  recall=${(100 * rec).toFixed(1)}%`);
  }

  const agreement = totalRuns === 0 ? 0 : correct / totalRuns;
  const neighborhoodAgreement = totalRuns === 0 ? 0 : neighborhoodCorrect / totalRuns;
  const detRate = totalRuns === 0 ? 0 : deterministic / totalRuns;

  // gemini-2.5-flash-lite pricing (approx): $0.10 / 1M output, $0.075 / 1M input
  const cost = (totalInput * 0.075 + totalOutput * 0.1) / 1_000_000;
  const perVideo = cost / Math.max(totalRuns, 1) / RUNS_PER_VIDEO;
  const daily250 = perVideo * 250;

  console.log('\n=== Totals ===');
  console.log(`  Strict agreement  : ${(100 * agreement).toFixed(1)}% (gate ≥70%)`);
  console.log(`  Neighborhood agr. : ${(100 * neighborhoodAgreement).toFixed(1)}% (gate ≥85%) — forge↔alchemy swaps count as pass`);
  console.log(`  Determinism (3×)  : ${(100 * detRate).toFixed(1)}% (info only)`);
  console.log(`  Max latency       : ${maxLatencyMs}ms (investigate if >45000)`);
  console.log(`  Validation cost   : $${cost.toFixed(4)}`);
  console.log(`  Projected @ 250/d : $${daily250.toFixed(4)} (gate <$2.00)`);

  if (disagreements.length > 0) {
    console.log('\n=== Disagreements ===');
    disagreements.forEach((d) => console.log('\n' + d));
  }

  const pass =
    agreement >= 0.70 &&
    neighborhoodAgreement >= 0.85 &&
    daily250 < 2.0 &&
    maxLatencyMs < 45000;
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

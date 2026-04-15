// Quiz UX safety tests — run with: node --test scripts/test-quiz-ux.mjs
//
// Goal: prove the quiz grading route NEVER shows the user an ugly error in the
// browser, while still honestly failing insults/gibberish.
//
// Two layers:
//   1. Pure logic — the hard-fail regex and the post-parse `passed` computation.
//      Mirrors the literals in src/app/api/quiz/submit/route.ts. If those
//      literals change, update this file.
//   2. Live integration — hits the running dev server. Gated behind
//      QUIZ_LIVE_TEST=1 so normal test runs don't require next dev + supabase.
//      Run with: QUIZ_LIVE_TEST=1 node --test scripts/test-quiz-ux.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ---------- Layer 1: mirror route.ts hard-fail logic ----------

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HARD_FAIL_STEMS = ['shit', 'fuck', 'fck', 'fukk', 'dumb', 'dick', 'bitch', 'cunt'];
const HARD_FAIL_WHOLE = ['stupid', 'awful', 'idiot', 'moron', 'f you', 'f u', 'asshole'];
const STEM_RE = new RegExp(`\\b(${HARD_FAIL_STEMS.map(escapeRegex).join('|')})`, 'i');
const WHOLE_RE = new RegExp(`\\b(${HARD_FAIL_WHOLE.map(escapeRegex).join('|')})\\b`, 'i');
const NEGATIVE_PHRASES = ['dont know', "don't know", 'dunno', 'who cares', 'idk', 'i have no idea', 'no idea', 'not sure', 'whatever', 'giving up', 'give up'];

function checkHardFail(answer) {
    const trimmed = answer.trim().toLowerCase();
    if (trimmed.length <= 1) return true;
    if (STEM_RE.test(trimmed) || WHOLE_RE.test(trimmed)) return true;
    if (NEGATIVE_PHRASES.some(phrase => trimmed.includes(phrase))) return true;
    if (/(.)\1{4,}/.test(trimmed)) return true;
    if (trimmed.split(/\s+/).some(word => word.length > 20)) return true;
    return false;
}

// Mirrors the `const passed = ...` line in route.ts after Gemini parse/fallback.
// grading.passed ?? true means: generous default on missing key.
// isHardFail short-circuits that so insults never get a free pass.
function computePassed(isHardFail, grading) {
    return isHardFail ? false : (grading.passed ?? true);
}

describe('hard-fail regex — insults and giveups are honest', () => {
    const mustFail = [
        'fuck off',
        'this is fucking stupid',
        'fck this quiz',
        'fckn lame',
        'dumbass',
        'dumber than a rock',
        'dickhead',
        'bitch please',
        'what an asshole',
        'f u',
        'f you',
        'idk',
        "i don't know",
        'whatever',
        'giving up',
        'a',
        'aaaaaaa',
        'supercalifragilisticexpialidocious', // >20 chars
    ];
    for (const answer of mustFail) {
        test(`fails: "${answer}"`, () => {
            assert.equal(checkHardFail(answer), true);
        });
    }
});

describe('hard-fail regex — legitimate coding answers pass through', () => {
    const mustPass = [
        'React hooks let you use state in function components',
        'async function fetches data without blocking',
        "I'd assume React batches state updates in event handlers",
        'the assignment operator stores a value in a variable',
        'you run assessments to verify the model',
        'this function helps assist the user with typing',
        'a classic pattern for this is the observer',
        "let's get down to brass tacks",
        'a great idea would be memoization',
        'the component re-renders on state change',
    ];
    for (const answer of mustPass) {
        test(`passes: "${answer}"`, () => {
            assert.equal(checkHardFail(answer), false);
        });
    }
});

describe('computePassed — generous under infra failure, strict on insults', () => {
    test('Gemini outage (empty fallback) on clean answer → pass', () => {
        const grading = { passed: true, confidence: 'low', feedback: 'Great effort!' };
        assert.equal(computePassed(false, grading), true);
    });

    test('Gemini returns valid JSON missing `passed` key → generous pass', () => {
        const grading = { confidence: 'high', feedback: 'ok' };
        assert.equal(computePassed(false, grading), true);
    });

    test('Gemini defies instructions and says passed:true for insult → still fails', () => {
        const grading = { passed: true, confidence: 'high', feedback: 'Spot on!' };
        assert.equal(computePassed(true, grading), false);
    });

    test('Gemini outage on insult (would fallback to pass) → still fails via Fix D', () => {
        const fallback = { passed: true, confidence: 'low', feedback: 'Great effort!' };
        assert.equal(computePassed(true, fallback), false);
    });

    test('Gemini legitimately grades a weak answer as failed → fail respected', () => {
        const grading = { passed: false, confidence: 'medium', feedback: 'Consider X' };
        assert.equal(computePassed(false, grading), false);
    });
});

// ---------- Layer 2: live endpoint integration ----------
// Confirms the user never sees an error payload, always gets 200 + JSON body
// with a boolean `passed`. Only runs when QUIZ_LIVE_TEST=1.

const LIVE = process.env.QUIZ_LIVE_TEST === '1';
const BASE = process.env.QUIZ_TEST_BASE || 'http://localhost:3000';
const TEST_USER = process.env.QUIZ_TEST_USER_ID;
const TEST_VIDEO = process.env.QUIZ_TEST_VIDEO_ID;

describe('live /api/quiz/submit — never surfaces errors to the user', { skip: !LIVE }, () => {
    const base = {
        user_id: TEST_USER,
        video_id: TEST_VIDEO,
        topic: 'React Hooks',
        question: 'Explain how useState works.',
    };

    async function submit(user_answer) {
        const res = await fetch(`${BASE}/api/quiz/submit`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...base, user_answer }),
        });
        const body = await res.json().catch(() => ({}));
        return { status: res.status, body };
    }

    test('valid answer → 200, no error field, passed boolean present', async () => {
        const { status, body } = await submit('useState returns a value and a setter that triggers re-renders');
        assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert.equal(typeof body.passed, 'boolean');
        assert.equal(body.error, undefined, 'response must not contain an error field');
    });

    test('insult → 200 (no ugly toast), passed:false', async () => {
        const { status, body } = await submit('fuck off');
        assert.equal(status, 200);
        assert.equal(body.passed, false);
        assert.equal(body.error, undefined);
    });

    test('one-char answer → 200, passed:false', async () => {
        const { status, body } = await submit('x');
        assert.equal(status, 200);
        assert.equal(body.passed, false);
        assert.equal(body.error, undefined);
    });

    test('"i dont know" → 200, passed:false', async () => {
        const { status, body } = await submit("i don't know");
        assert.equal(status, 200);
        assert.equal(body.passed, false);
        assert.equal(body.error, undefined);
    });

    test('legitimate coding term with "assume" → 200, no false hard-fail', async () => {
        const { status, body } = await submit("I'd assume React batches state updates in handlers");
        assert.equal(status, 200);
        assert.equal(body.error, undefined);
        // We don't assert passed=true because Gemini is the real grader; we only
        // assert the user sees a clean response, not a 500/503 or error field.
    });
});

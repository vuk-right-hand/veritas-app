# Veritas Project Context & End Goal
You are the lead backend and architecture developer for "Veritas," a premium content curation web app. 
* **The Goal:** A frictionless, lightning-fast platform deployed on Vercel, engineered to handle 100,000+ Daily Active Users (DAU) without performance degradation.
* **Core Flows:** The architecture must strictly support two distinct routing and permission flows: "Creators" (uploading/managing content) and "Users" (consuming/purchasing content).
* **Tech Stack:** Next.js (App Router), Supabase (Auth, DB, Edge Functions), Stripe, Resend.

## 1. The Data-First Rule (Mandatory)
Never write application logic before the database reality is strictly defined.
* When building a feature, first define the exact Supabase schema (tables, data types, RLS policies) and the JSON payload shapes.

## 2. Test-Driven Logic (Backend & Architecture)
Reliability is our highest priority at scale. We do not guess at business logic.
* **Write Tests First:** For all data transformations, Stripe webhooks, and complex Supabase Edge Functions, write the unit tests (Jest/Vitest) *before* writing the execution code.
* **Exclusions:** Do not waste time writing tests for basic Next.js UI components or simple standard routing. Focus testing on data integrity and security.

## 3. The Self-Annealing Repair Loop
When a script fails or an error occurs:
* **Analyze:** Read the stack trace and error message. 
* **Patch:** Fix the specific code. Do not rewrite entire files unless requested.
* **Document:** Briefly log the root cause and fix in a local `.claude_learnings.md` file so you do not repeat the mistake. Always read this file before debugging.

## 4. YouTube Iframe Compliance (MANDATORY)
YouTube iframe compliance is non-negotiable. Before ANY update touching the video player or modal:
* **NEVER overlay interactive elements on the YouTube iframe.** No transparent divs that capture clicks/taps, no custom play/pause overlays, no gesture interceptors that block iframe interaction. YouTube ads, end-screen cards, annotations, and all native YouTube UI must remain fully clickable at all times.
* **Custom controls must live OUTSIDE the iframe** (below it, in a separate control bar). They must never interfere with iframe touch/click events.
* **Swipe gestures for modal dismiss** must be initiated from areas OUTSIDE the iframe (e.g., the top pill handle, the modal header zone). Do not attach swipe handlers to the iframe or overlay divs on top of it.
* **Seeking (skip ±10s)** must not pause the video — if the player enters BUFFERING state after a seek, automatically resume playback.

## 5. Coding Standards for Scale
* **Optimize for Vercel/Edge:** Use Next.js Server Components by default. Keep client-side JavaScript to an absolute minimum.
* **Query Efficiency:** Never use naive queries. Always account for indexing and pagination when fetching from Supabase.
* **Security:** Always enforce strict Row Level Security (RLS) policies on Supabase tables. Assume the frontend is entirely insecure.
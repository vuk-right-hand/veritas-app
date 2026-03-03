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
* **Document:** Briefly log the root cause and fix in a local `.gemini_learnings.md` file so you do not repeat the mistake. Always read this file before debugging.

## 4. Coding Standards for Scale
* **Optimize for Vercel/Edge:** Use Next.js Server Components by default. Keep client-side JavaScript to an absolute minimum.
* **Query Efficiency:** Never use naive queries. Always account for indexing and pagination when fetching from Supabase.
* **Security:** Always enforce strict Row Level Security (RLS) policies on Supabase tables. Assume the frontend is entirely insecure.
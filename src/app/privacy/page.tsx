import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — VibeCodersHQ",
  description: "How VibeCodersHQ collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">
        <Link
          href="/"
          className="inline-block text-sm text-blue-600 hover:underline mb-8"
        >
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          VibeCodersHQ — Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          Effective Date: March 5, 2026 &middot;{" "}
          <a href="https://www.vibecodershq.io" className="underline">
            vibecodershq.io
          </a>
        </p>

        <article className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              1. What We Build and What We Collect
            </h2>
            <p className="mb-3">
              VibeCodersHQ is a curated educational platform. To provide you with
              personalized learning curriculums and our Proof of Work
              verification, we collect the following information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Account Data:</strong> Your email address, profile name,
                and authentication tokens provided by third-party logins (Google,
                GitHub) when you create an account.
              </li>
              <li>
                <strong>Learning &amp; Behavioral Data:</strong> We track your
                interaction with the platform to customize your feed. This
                includes video watch time, quiz performance, points earned, and
                specific search queries (to identify content gaps and curate new
                material).
              </li>
              <li>
                <strong>Technical Data:</strong> Essential session cookies and
                local storage required to keep you securely logged in.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              2. How We Use Your Data
            </h2>
            <p className="mb-3">
              We use your data strictly to operate and improve the platform:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                To calculate your Proof of Work scores and update your profile
                status.
              </li>
              <li>
                To tailor the &ldquo;Watch This Next&rdquo; recommendations
                based on your onboarding goals and completed quizzes.
              </li>
              <li>
                To secure your account and send transactional emails (like
                password resets).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              3. Google User Data
            </h2>
            <p className="mb-3">
              When you sign in with Google, VibeCodersHQ accesses only your
              basic profile information (name and email address) to create and
              manage your account. If you use the &ldquo;Claim Channel&rdquo;
              feature, we additionally request read-only access to your YouTube
              channel list solely to verify channel ownership.
            </p>
            <p className="mb-3">
              <strong>
                We do not store, share, or transfer your Google user data to any
                third party.
              </strong>{" "}
              Google authentication tokens are used exclusively for session
              management and are never exposed to advertisers or analytics
              providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              4. Third-Party Sharing (No Advertisers)
            </h2>
            <p className="mb-3">
              We are an educational tool, not an ad network.{" "}
              <strong>
                We do not sell your personal data, watch history, or search
                queries to advertisers.
              </strong>{" "}
              We only share data with essential infrastructure providers required
              to run the platform:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong>Hosting &amp; Database:</strong> Vercel and Supabase.
              </li>
              <li>
                <strong>Communications:</strong> Resend (for secure transactional
                emails).
              </li>
              <li>
                <strong>AI &amp; Search:</strong> Gemini (for generating quiz
                feedback and powering our vector search engine).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Data Retention and Deletion
            </h2>
            <p>
              We retain your data only as long as your account is active. You may
              request full deletion of your account, including all accumulated
              Proof of Work points, watch history, and quiz data, at any time by
              contacting us at{" "}
              <a
                href="mailto:admin@vibecodershq.io"
                className="text-blue-600 underline"
              >
                admin@vibecodershq.io
              </a>
              . Upon request, your data will be permanently removed within 30
              days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. Your Rights
            </h2>
            <p>
              You own your data. You can request to export or delete your
              profile at any time by contacting us at{" "}
              <a
                href="mailto:admin@vibecodershq.io"
                className="text-blue-600 underline"
              >
                admin@vibecodershq.io
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              7. Contact
            </h2>
            <p>
              If you have questions about this Privacy Policy or how we handle
              your data, contact VibeCodersHQ at{" "}
              <a
                href="mailto:admin@vibecodershq.io"
                className="text-blue-600 underline"
              >
                admin@vibecodershq.io
              </a>
              .
            </p>
          </section>
        </article>

        <footer className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-500">
          <p>
            &copy; 2026 VibeCodersHQ. All rights reserved. &middot;{" "}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}

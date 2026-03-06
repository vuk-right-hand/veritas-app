import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy — Vibe Coders HQ",
  description: "How Vibe Coders HQ collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute top-[-20%] right-[-10%] w-[400px] md:w-[800px] h-[400px] md:h-[800px] bg-red-900/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 md:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 font-mono mb-12">
          Effective Date: March 5, 2026
        </p>

        <article className="space-y-10">
          {/* Section 1 */}
          <section className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 md:p-10">
            <h2 className="text-xl font-bold text-white mb-4">
              1. What We Build and What We Collect
            </h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Vibe Coders HQ is a curated educational platform. To provide you with
              personalized learning curriculums and our Proof of Work
              verification, we collect the following information:
            </p>
            <ul className="space-y-4 text-gray-400 leading-relaxed">
              <li>
                <span className="text-white font-semibold">Account Data:</span>{" "}
                Your email address, profile name, and authentication tokens
                provided by third-party logins (Google, GitHub) when you create
                an account.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Learning &amp; Behavioral Data:
                </span>{" "}
                We track your interaction with the platform to customize your
                feed. This includes video watch time, quiz performance, points
                earned, and specific search queries (to identify content gaps and
                curate new material).
              </li>
              <li>
                <span className="text-white font-semibold">
                  Technical Data:
                </span>{" "}
                Essential session cookies and local storage required to keep you
                securely logged in.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 md:p-10">
            <h2 className="text-xl font-bold text-white mb-4">
              2. How We Use Your Data
            </h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              We use your data strictly to operate and improve the platform:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 leading-relaxed ml-2">
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

          {/* Section 3 */}
          <section className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 md:p-10">
            <h2 className="text-xl font-bold text-white mb-4">
              3. Third-Party Sharing (No Advertisers)
            </h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              We are an educational tool, not an ad network.{" "}
              <span className="text-white font-semibold">
                We do not sell your personal data, watch history, or search
                queries to advertisers.
              </span>{" "}
              We only share data with essential infrastructure providers required
              to run the platform:
            </p>
            <ul className="space-y-3 text-gray-400 leading-relaxed ml-2">
              <li>
                <span className="text-white font-semibold">
                  Hosting &amp; Database:
                </span>{" "}
                Vercel and Supabase.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Communications:
                </span>{" "}
                Resend (for secure transactional emails).
              </li>
              <li>
                <span className="text-white font-semibold">
                  AI &amp; Search:
                </span>{" "}
                Gemini (for generating quiz feedback and powering our vector
                search engine).
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 md:p-10">
            <h2 className="text-xl font-bold text-white mb-4">
              4. Your Rights
            </h2>
            <p className="text-gray-400 leading-relaxed">
              You own your data. You can request to export or delete your
              profile, including all accumulated Proof of Work points and watch
              history, at any time by contacting our support team.
            </p>
          </section>
        </article>

        <Footer />
      </div>
    </main>
  );
}

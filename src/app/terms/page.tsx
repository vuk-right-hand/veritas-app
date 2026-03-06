import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Terms of Service — Vibe Coders HQ",
  description: "Terms and conditions for using the Vibe Coders HQ platform.",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-gray-500 font-mono mb-12">
          Effective Date: March 5, 2026
        </p>

        <article className="space-y-10">
          {/* Section 1 */}
          <section className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 md:p-10">
            <h2 className="text-xl font-bold text-white mb-4">
              1. The Platform Model (Curation, Not Hosting)
            </h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Vibe Coders HQ operates as an educational curation layer. We do not host,
              store, or own the video content displayed on the platform. All
              videos are embedded using standard public protocols (such as the
              YouTube iframe API).
            </p>
            <ul className="space-y-4 text-gray-400 leading-relaxed">
              <li>
                <span className="text-white font-semibold">
                  Intellectual Property:
                </span>{" "}
                All video content, branding, and creator likenesses belong to
                their respective original creators or copyright holders.
              </li>
              <li>
                <span className="text-white font-semibold">
                  Content Availability:
                </span>{" "}
                Because we do not host the videos, we cannot guarantee their
                permanent availability. If a creator removes or restricts a
                video on the host platform, it will simultaneously become
                unavailable on Vibe Coders HQ.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 md:p-10">
            <h2 className="text-xl font-bold text-white mb-4">
              2. Vibe Coders HQ Intellectual Property
            </h2>
            <p className="text-gray-400 leading-relaxed">
              While we do not own the embedded videos, Vibe Coders HQ retains all
              rights, title, and interest in the platform&apos;s proprietary
              architecture. This includes our custom quizzes, the &ldquo;Proof
              of Work&rdquo; scoring logic, user interfaces, branding, and the
              underlying code.
            </p>
          </section>

          {/* Section 3 */}
          <section className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 md:p-10">
            <h2 className="text-xl font-bold text-white mb-4">
              3. Acceptable Use and Anti-Cheating
            </h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Vibe Coders HQ is designed to verify actual human learning. To maintain
              the integrity of our platform and the &ldquo;Mythical&rdquo;
              status economy, you agree to the following strict constraints:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 leading-relaxed ml-2">
              <li>
                You will not use bots, scripts, or automated tools to complete
                quizzes, farm points, or manipulate watch time.
              </li>
              <li>
                You will not attempt to bypass our database constraints to
                submit duplicate quiz attempts.
              </li>
            </ul>
            <p className="text-gray-400 leading-relaxed mt-4 border-l-2 border-red-700 pl-4">
              Violation of these rules will result in the immediate and permanent
              termination of your account and the forfeiture of all earned
              points.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 md:p-10">
            <h2 className="text-xl font-bold text-white mb-4">
              4. Account Security
            </h2>
            <p className="text-gray-400 leading-relaxed">
              You are responsible for maintaining the confidentiality of your
              login credentials (including third-party OAuth accounts and Magic
              Links) and for all activities that occur under your account.
            </p>
          </section>
        </article>

        <Footer />
      </div>
    </main>
  );
}

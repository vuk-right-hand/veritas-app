"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">

      {/* Background Gradient - Dark Red */}
      <div className="absolute top-[-20%] right-[-10%] w-[400px] md:w-[800px] h-[400px] md:h-[800px] bg-red-900/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

      <div className="z-10 max-w-4xl flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/30 border border-red-900/50 text-xs font-medium text-red-400 mb-8 backdrop-blur-md">
          <Sparkles className="w-3 h-3" />
          Veritas Alpha
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold tracking-tighter mb-6 md:mb-8 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
          Your Attention Is <br /> <span className="text-red-600">Your Dignity.</span>
        </h1>

        <p className="text-lg sm:text-xl md:text-2xl text-gray-400 mb-8 md:mb-12 leading-relaxed max-w-2xl font-light px-2">
          No AI. No entertainment. No faceless BS. <br />
          <span className="text-gray-200">Real undiscovered experts from the YouTube ocean.</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link
            href="/onboarding"
            className="px-10 py-4 bg-red-700 text-white rounded-lg font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 group shadow-[0_0_30px_rgba(185,28,28,0.3)]"
          >
            Start Customizing Feed
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/dashboard"
            className="px-8 py-4 bg-white/5 border border-white/10 rounded-lg font-semibold hover:bg-white/10 transition-colors text-gray-300"
          >
            View Demo Dashboard
          </Link>
        </div>
      </div>

      <div className="absolute bottom-10 text-xs text-gray-600 font-mono">
        Powered by Supadata & Gemini Flash 1.5
      </div>
    </main>
  );
}
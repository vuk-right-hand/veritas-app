import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full py-6 flex items-center justify-center gap-4 text-xs text-gray-600 font-mono">
      <Link href="/privacy" className="hover:text-gray-400 transition-colors">
        Privacy Policy
      </Link>
      <span className="text-gray-800">|</span>
      <Link href="/terms" className="hover:text-gray-400 transition-colors">
        Terms of Service
      </Link>
    </footer>
  );
}

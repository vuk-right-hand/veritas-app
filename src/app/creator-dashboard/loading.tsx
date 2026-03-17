export default function CreatorDashboardLoading() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
            {/* Navbar skeleton */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5" />
                    <div className="w-8 h-8 rounded-full bg-white/5" />
                    <div className="w-44 h-5 rounded-full bg-white/5 animate-pulse" />
                </div>
            </nav>

            <main className="pt-32 pb-24 px-8 max-w-[1200px] mx-auto">
                {/* Avatar + channel name */}
                <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12 border-b border-white/5 pb-8">
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-white/5 animate-pulse" />
                        <div className="space-y-3">
                            <div className="w-48 h-6 rounded-full bg-white/5 animate-pulse" />
                            <div className="w-32 h-4 rounded-full bg-white/5 animate-pulse" />
                            <div className="w-24 h-4 rounded-full bg-white/5 animate-pulse" />
                        </div>
                    </div>
                    {/* Stat pills */}
                    <div className="flex gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse">
                                <div className="w-12 h-6 rounded-full bg-white/5" />
                                <div className="w-16 h-3 rounded-full bg-white/5 mt-1" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tab bar */}
                <div className="flex gap-2 mb-10">
                    <div className="w-24 h-9 rounded-full bg-white/10 animate-pulse" />
                    <div className="w-24 h-9 rounded-full bg-white/5 animate-pulse" />
                </div>

                {/* Content rows */}
                <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
                    ))}
                </div>
            </main>
        </div>
    );
}

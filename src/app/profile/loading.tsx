export default function ProfileLoading() {
    return (
        <div className="min-h-screen bg-black text-white font-sans p-6 md:p-12 pb-24 md:pb-12 relative overflow-hidden flex items-center justify-center">
            {/* Background ambience */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10">
                {/* Back link */}
                <div className="w-28 h-5 rounded-full bg-white/5 animate-pulse mb-8" />

                <div className="bg-[#0f0f0f] border border-white/5 backdrop-blur-md rounded-3xl p-6 md:p-10 shadow-2xl">
                    {/* Avatar + name row */}
                    <div className="flex items-center gap-5 mb-8">
                        <div className="w-20 h-20 rounded-full bg-white/5 animate-pulse flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="w-40 h-5 rounded-full bg-white/5 animate-pulse" />
                            <div className="w-56 h-4 rounded-full bg-white/5 animate-pulse" />
                        </div>
                    </div>

                    {/* Tab bar */}
                    <div className="flex gap-2 mb-8 border-b border-white/5 pb-4">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className={`h-8 rounded-full animate-pulse ${i === 0 ? 'w-20 bg-white/10' : 'w-16 bg-white/5'}`}
                            />
                        ))}
                    </div>

                    {/* Form fields */}
                    <div className="space-y-5">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <div className="w-24 h-3 rounded-full bg-white/5 animate-pulse" />
                                <div className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/5 animate-pulse" />
                            </div>
                        ))}
                        <div className="w-full h-11 rounded-xl bg-red-600/20 border border-red-500/20 animate-pulse mt-4" />
                    </div>
                </div>
            </div>
        </div>
    );
}

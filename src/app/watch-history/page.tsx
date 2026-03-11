import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Clock, Play } from 'lucide-react';
import { getCurrentUserId } from '@/app/actions/quiz-actions';
import { getWatchHistory } from '@/app/actions/watch-history-actions';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
    title: 'Watch History - VibeCoders',
};

// ─── Date Grouping ─────────────────────────────────────────────────────────────

function getGroupLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    if (date >= startOfToday) return 'Today';
    if (date >= startOfYesterday) return 'Yesterday';
    if (date >= startOfWeek) return 'This Week';

    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function groupByDate(videos: any[]): { label: string; items: any[] }[] {
    const groups: Map<string, any[]> = new Map();
    for (const v of videos) {
        const label = getGroupLabel(v.watchedAt);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label)!.push(v);
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function WatchHistoryPage() {
    const userId = await getCurrentUserId();

    if (!userId) {
        redirect('/login');
    }

    const watchHistory = await getWatchHistory(userId);
    const groups = groupByDate(watchHistory);

    return (
        <div className="min-h-screen bg-black text-white font-sans pb-24 md:pb-12 relative overflow-hidden">
            {/* Background ambience */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/profile"
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Profile
                    </Link>
                </div>

                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-red-600/15 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Watch History</h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {watchHistory.length === 0
                                ? 'No videos watched yet'
                                : `${watchHistory.length} video${watchHistory.length !== 1 ? 's' : ''} watched`}
                        </p>
                    </div>
                </div>

                {watchHistory.length === 0 ? (
                    <div className="py-24 text-center border border-white/5 rounded-2xl border-dashed">
                        <Play className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Videos you watch will appear here.</p>
                        <Link
                            href="/dashboard"
                            className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                        >
                            Go to feed →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groups.map(({ label, items }) => (
                            <section key={label}>
                                {/* Date group header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                                        {label}
                                    </h2>
                                    <div className="flex-1 h-px bg-white/5" />
                                </div>

                                {/* Video rows */}
                                <div className="space-y-0.5">
                                    {items.map((video) => (
                                        <a
                                            key={video.id}
                                            href={`/v/${video.slug || video.video_id}`}
                                            className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                                        >
                                            {/* Thumbnail */}
                                            <div className="relative w-28 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-900">
                                                <img
                                                    src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                                                        <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-semibold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                                                    {video.title}
                                                </p>
                                                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                                    {video.channelTitle}
                                                </p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}

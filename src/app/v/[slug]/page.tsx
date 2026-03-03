import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ShieldCheck, PlayCircle } from 'lucide-react';

export const revalidate = 60; // Cache invalidation

export async function generateMetadata(
    { params }: { params: { slug: string } }
): Promise<Metadata> {
    const { data: video } = await supabaseAdmin
        .from('videos')
        .select('id, title, description')
        .eq('slug', params.slug)
        .single();

    if (!video) {
        return {
            title: 'Video Not Found',
            metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vibecodershq.io'),
        };
    }

    return {
        title: `${video.title} - VibeCoders`,
        description: video.description || `Watch and learn from ${video.title} on VibeCoders.`,
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vibecodershq.io'),
        openGraph: {
            images: [`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`],
        }
    };
}

// Utility to safely format user names for UGC
function formatUgcName(fullName?: string): string {
    if (!fullName) return "Anonymous";
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

// Ensure no emails slip through
function sanitizeUgcAnswer(answer: string): string {
    return answer.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '[REDACTED]');
}

export default async function VideoPage({ params }: { params: { slug: string } }) {
    const { slug } = params;

    // 1. Fetch Video
    const { data: video } = await supabaseAdmin
        .from('videos')
        .select('*')
        .eq('slug', slug)
        .single();

    // SEO Spam Penalty Gate - Reject unverified/unapproved immediately
    if (!video || video.status !== 'verified') {
        notFound();
    }

    // 2. Fetch UGC Privacy Trap: Top 3 Proof of Work answers
    const { data: attempts } = await supabaseAdmin
        .from('quiz_attempts')
        .select('user_answer, user_id, topic, question')
        .eq('video_id', video.id)
        .eq('passed', true)
        .limit(3);

    // Safely map over the response to format the name and redacting contact info
    const ugcAnswers = await Promise.all((attempts || []).map(async (attempt) => {
        let ugcName = "Anonymous";

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('name, full_name')
            .eq('id', attempt.user_id)
            .single();

        if (profile) {
            ugcName = formatUgcName(profile.full_name || profile.name);
        } else {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(attempt.user_id);
            if (authUser?.user?.user_metadata?.full_name) {
                ugcName = formatUgcName(authUser.user.user_metadata.full_name);
            }
        }

        return {
            question: attempt.question,
            answer: sanitizeUgcAnswer(attempt.user_answer),
            topic: attempt.topic,
            authorName: ugcName
        };
    }));

    // 3. UI Display
    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Video Embed Hub */}
                <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 border border-zinc-800 relative z-10 ring-1 ring-white/10">
                    <iframe
                        src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
                        title={video.title}
                        className="w-full h-full absolute inset-0 text-white"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>

                {/* Video Title Card */}
                <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-3xl rounded-full pointer-events-none -mr-32 -mt-32"></div>
                    <div className="z-10 flex-1">
                        <h1 className="text-3xl font-black mb-2 tracking-tight">{video.title}</h1>
                        <p className="text-zinc-400 font-medium tracking-wide">{video.channel_title}</p>
                    </div>
                    <div className="z-10 flex items-center gap-2 bg-red-500/10 text-red-500 px-5 py-2.5 rounded-full font-bold border border-red-500/20 whitespace-nowrap shadow-lg shadow-red-500/5">
                        <ShieldCheck className="w-5 h-5" />
                        Human-Verified
                    </div>
                </div>

                {/* 3 Key AI Lessons */}
                <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl relative overflow-hidden">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <PlayCircle className="w-6 h-6 text-red-500" />
                        3 Key Lessons
                    </h2>
                    <ul className="space-y-4 relative z-10">
                        {(video.summary_points || ["Understanding core concepts.", "Applying new techniques.", "Building real-world projects."]).map((point: string, idx: number) => (
                            <li key={idx} className="flex gap-5 p-5 rounded-xl bg-black/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold flex-shrink-0 border border-red-500/30">
                                    {idx + 1}
                                </div>
                                <p className="text-zinc-300 leading-relaxed font-medium">{point}</p>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Proof of Work UGC Gallery */}
                {ugcAnswers.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-zinc-700/5 blur-3xl rounded-full pointer-events-none"></div>

                        <h2 className="text-2xl font-bold mb-8 relative z-10 flex items-center gap-2">
                            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Proof of Work</span>
                            <span className="text-zinc-500 font-normal">Community Answers</span>
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                            {ugcAnswers.map((ugc, idx) => (
                                <div key={idx} className="p-6 rounded-2xl bg-black border border-zinc-800 flex flex-col h-full shadow-lg transition-transform hover:-translate-y-1 duration-300">
                                    <div className="mb-6 flex-grow">
                                        <span className="text-xs font-black uppercase tracking-widest text-red-500/80 mb-3 block">{ugc.topic}</span>
                                        <h3 className="font-semibold text-sm text-zinc-200 mb-4 tracking-wide leading-relaxed">{ugc.question}</h3>
                                        <p className="text-zinc-400 italic text-sm leading-relaxed border-l-2 border-zinc-800 pl-4 py-1">"{ugc.answer}"</p>
                                    </div>
                                    <div className="mt-auto pt-5 border-t border-zinc-800/50 flex flex-col gap-1 text-sm bg-gradient-to-b from-transparent to-zinc-900/30 -mx-6 px-6 -mb-6 pb-6 rounded-b-2xl">
                                        <span className="font-black text-white/90">{ugc.authorName}</span>
                                        <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" />
                                            Verified Answer
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

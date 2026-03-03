import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import VideoCard from '@/components/VideoCard';
import { ShieldCheck } from 'lucide-react';

export const revalidate = 60; // Cache invalidation

export async function generateMetadata(
    { params }: { params: { slug: string } }
): Promise<Metadata> {
    const { data: creator } = await supabaseAdmin
        .from('creators')
        .select('channel_name, description, avatar_url')
        .eq('slug', params.slug)
        .single();

    if (!creator) {
        return {
            title: 'Creator Not Found',
            metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vibecodershq.io'),
        };
    }

    return {
        title: `${creator.channel_name} - Verified Creator on VibeCoders`,
        description: creator.description || `Watch verified videos from ${creator.channel_name}.`,
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vibecodershq.io'),
        openGraph: {
            images: [creator.avatar_url || '/default-avatar.png'],
        }
    };
}

export default async function CreatorPage({ params }: { params: { slug: string } }) {
    const { slug } = params;

    // Fetch creator
    const { data: creator } = await supabaseAdmin
        .from('creators')
        .select('*')
        .eq('slug', slug)
        .single();

    if (!creator) {
        notFound();
    }

    // Fetch their verified videos
    const { data: videos } = await supabaseAdmin
        .from('videos')
        .select('*')
        .eq('channel_url', creator.channel_url)
        .eq('status', 'verified')
        .order('published_at', { ascending: false });

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-6xl mx-auto">

                {/* Creator Header */}
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-12 bg-zinc-900 border border-zinc-800 p-8 rounded-2xl relative overflow-hidden">
                    <div className="absolute -top-32 -left-32 w-64 h-64 bg-red-500/10 rounded-full blur-3xl"></div>

                    {creator.avatar_url ? (
                        <img
                            src={creator.avatar_url}
                            alt={creator.channel_name}
                            className="w-32 h-32 rounded-full border-4 border-red-500/20 object-cover z-10"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-black border-4 border-red-500/20 flex items-center justify-center text-4xl font-bold z-10">
                            {creator.channel_name?.charAt(0) || '?'}
                        </div>
                    )}

                    <div className="flex-1 text-center md:text-left space-y-4 z-10">
                        <div className="flex flex-col md:flex-row items-center gap-3 justify-center md:justify-start">
                            <h1 className="text-4xl font-black tracking-tight">{creator.channel_name}</h1>
                            {creator.is_verified && (
                                <span className="flex items-center gap-1 bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-xs font-bold border border-red-500/20 uppercase tracking-wider">
                                    <ShieldCheck className="w-4 h-4" />
                                    Human-Verified
                                </span>
                            )}
                        </div>

                        {creator.description && (
                            <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">{creator.description}</p>
                        )}

                        {!creator.user_id && (
                            <div className="mt-4 inline-block">
                                <a
                                    href="/claim-channel"
                                    className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95 flex items-center justify-center"
                                >
                                    Claim Profile
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* Video Grid */}
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                        Verified Videos
                        <span className="bg-zinc-800 px-3 py-1 rounded-full text-zinc-400 text-sm font-bold">
                            {videos?.length || 0}
                        </span>
                    </h2>

                    {videos && videos.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {videos.map((v) => (
                                <VideoCard
                                    key={v.id}
                                    videoId={v.id}
                                    title={v.title}
                                    humanScore={v.human_score}
                                    takeaways={v.summary_points || []}
                                    customDescription={v.custom_description}
                                    channelTitle={v.channel_title || creator.channel_name}
                                    channelUrl={v.channel_url}
                                    publishedAt={v.published_at || v.created_at}
                                    customLinks={v.custom_links}
                                    channelDescription={creator.description}
                                    channelLinks={creator.links}
                                    isChannelClaimed={!!creator.user_id}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                            <p className="text-zinc-500">No verified videos found for this creator yet.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

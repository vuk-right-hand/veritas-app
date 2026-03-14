import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import VideoPageClient from './video-page-client';

export const revalidate = 60;

export async function generateMetadata(
    { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
    const { slug } = await params;

    const isValidSlug = /^[a-zA-Z0-9-]+$/.test(slug);
    if (!isValidSlug) {
        return {
            title: 'Video Not Found',
            metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vibecodershq.io'),
        };
    }
    const safeSlug = slug.slice(0, 100);

    const { data: video } = await supabaseAdmin
        .from('videos')
        .select('id, title, description, channel_title, slug')
        .eq('slug', safeSlug)
        .single();

    if (!video) {
        return {
            title: 'Video Not Found',
            metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vibecodershq.io'),
        };
    }

    return {
        title: `${video.title} - Veritas`,
        description: video.description || `Watch and learn from ${video.title} on Veritas.`,
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vibecodershq.io'),
        alternates: video.slug ? {
            canonical: `/v/${video.slug}`,
        } : {},
        openGraph: {
            title: `${video.title} - Veritas`,
            description: video.description || `Watch and learn from ${video.title} on Veritas.`,
            url: video.slug ? `/v/${video.slug}` : undefined,
            images: [`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`],
            type: 'video.other',
        }
    };
}

export default async function VideoPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ autoQuiz?: string }> }) {
    const { slug } = await params;
    const { autoQuiz } = await searchParams;

    const isValidSlug = /^[a-zA-Z0-9-]+$/.test(slug);
    if (!isValidSlug) {
        notFound();
    }
    const safeSlug = slug.slice(0, 100);

    // 1. Fetch video
    const { data: video } = await supabaseAdmin
        .from('videos')
        .select('id, title, human_score, channel_title, channel_url, published_at, summary_points, custom_description, custom_links, slug, status')
        .eq('slug', safeSlug)
        .eq('status', 'verified')
        .single();

    if (!video || video.status !== 'verified') {
        notFound();
    }

    // 2. Fetch creator by channel_url (for description, links, claim status, slug)
    let creatorId: string | undefined;
    let creatorSlug: string | undefined;
    let channelDescription: string | undefined;
    let channelLinks: { title: string; url: string }[] | undefined;
    let isChannelClaimed = false;

    if (video.channel_url) {
        const { data: creator } = await supabaseAdmin
            .from('creators')
            .select('id, slug, description, links, user_id')
            .eq('channel_url', video.channel_url)
            .maybeSingle();

        if (creator) {
            creatorId = creator.id;
            creatorSlug = creator.slug || undefined;
            channelDescription = creator.description || undefined;
            channelLinks = creator.links || undefined;
            isChannelClaimed = !!creator.user_id;
        }
    }

    return (
        <VideoPageClient
            videoId={video.id}
            title={video.title}
            humanScore={video.human_score}
            takeaways={video.summary_points || []}
            customDescription={video.custom_description || undefined}
            channelTitle={video.channel_title || undefined}
            channelUrl={video.channel_url || undefined}
            publishedAt={video.published_at || undefined}
            customLinks={video.custom_links || undefined}
            channelDescription={channelDescription}
            channelLinks={channelLinks}
            isChannelClaimed={isChannelClaimed}
            slug={video.slug}
            creatorSlug={creatorSlug}
            creatorId={creatorId}
            autoQuiz={autoQuiz === 'true'}
        />
    );
}

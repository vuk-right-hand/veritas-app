"use client";

import { useRouter } from 'next/navigation';
import VideoCard from '@/components/VideoCard';

interface VideoPageClientProps {
    videoId: string;
    title: string;
    humanScore: number;
    takeaways: string[];
    customDescription?: string;
    channelTitle?: string;
    channelUrl?: string;
    publishedAt?: string;
    customLinks?: { title: string; url: string }[];
    channelDescription?: string;
    channelLinks?: { title: string; url: string }[];
    isChannelClaimed?: boolean;
    slug?: string;
    creatorSlug?: string;
}

export default function VideoPageClient(props: VideoPageClientProps) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-black">
            <VideoCard
                {...props}
                autoOpen
                onClose={() => router.push('/dashboard')}
            />
        </div>
    );
}

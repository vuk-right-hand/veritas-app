"use client";

import React, { useEffect, useRef, useState } from 'react';

interface SmartVideoPlayerProps {
    videoId: string;
    title?: string;
    className?: string;
    onEnded?: () => void;
    autoplay?: boolean;
    controls?: boolean;
}

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

export default function SmartVideoPlayer({ videoId, title, className, onEnded, autoplay = false, controls = true }: SmartVideoPlayerProps) {
    const playerRef = useRef<HTMLDivElement>(null);
    const playerInstanceRef = useRef<any>(null);
    const [apiReady, setApiReady] = useState(false);

    useEffect(() => {
        // 1. Load the IFrame Player API code asynchronously.
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

            // Define global callback
            window.onYouTubeIframeAPIReady = () => {
                setApiReady(true);
            };
        } else {
            setApiReady(true);
        }
    }, []);

    useEffect(() => {
        if (apiReady && playerRef.current) {
            // Destroy existing player if videoId changes to prevent duplicates/memory leaks
            if (playerInstanceRef.current) {
                playerInstanceRef.current.destroy();
            }

            // 2. Create the player
            playerInstanceRef.current = new window.YT.Player(playerRef.current, {
                videoId: videoId,
                playerVars: {
                    'playsinline': 1,
                    'autoplay': autoplay ? 1 : 0,
                    'modestbranding': 1,
                    'rel': 0,
                    'controls': controls ? 1 : 0,
                },
                events: {
                    'onStateChange': onPlayerStateChange
                }
            });
        }
    }, [apiReady, videoId]);

    const onPlayerStateChange = (event: any) => {
        // YT.PlayerState.ENDED = 0
        if (event.data === 0) {
            console.log("Video Ended - Triggering Callback");
            if (onEnded) onEnded();
        }
    };

    return (
        <div className={`relative w-full h-full bg-black ${className}`}>
            {/* The API will replace this div with the iframe */}
            <div ref={playerRef} className="w-full h-full" />
        </div>
    );
}

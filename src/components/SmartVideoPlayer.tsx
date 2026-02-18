"use client";

import React, { useEffect, useRef, useState } from 'react';

interface SmartVideoPlayerProps {
    videoId: string;
    title?: string;
    className?: string;
    onEnded?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    autoplay?: boolean;
    controls?: boolean;
}

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

export interface SmartVideoPlayerRef {
    playVideo: () => void;
    pauseVideo: () => void;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    setVolume: (volume: number) => void;
    setPlaybackRate: (rate: number) => void;
    getDuration: () => number;
    getCurrentTime: () => number;
    getPlayerState: () => number;
    mute: () => void;
    unMute: () => void;
    isMuted: () => boolean;
}

export default React.forwardRef<SmartVideoPlayerRef, SmartVideoPlayerProps>(function SmartVideoPlayer(
    { videoId, title, className, onEnded, onPlay, onPause, autoplay = false, controls = true },
    ref
) {
    const playerRef = useRef<HTMLDivElement>(null);
    const playerInstanceRef = useRef<any>(null);
    const [apiReady, setApiReady] = useState(false);

    // Use refs for callbacks so the YouTube player always calls the LATEST version
    // (avoids stale closure bug where player captures old callbacks at creation time)
    const onEndedRef = useRef(onEnded);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);

    // Keep refs in sync with latest props on every render
    useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
    useEffect(() => { onPlayRef.current = onPlay; }, [onPlay]);
    useEffect(() => { onPauseRef.current = onPause; }, [onPause]);

    React.useImperativeHandle(ref, () => ({
        playVideo: () => playerInstanceRef.current?.playVideo?.(),
        pauseVideo: () => playerInstanceRef.current?.pauseVideo?.(),
        seekTo: (seconds: number, allowSeekAhead: boolean = true) => playerInstanceRef.current?.seekTo?.(seconds, allowSeekAhead),
        setVolume: (volume: number) => playerInstanceRef.current?.setVolume?.(volume),
        setPlaybackRate: (rate: number) => playerInstanceRef.current?.setPlaybackRate?.(rate),
        getDuration: () => playerInstanceRef.current?.getDuration?.() || 0,
        getCurrentTime: () => playerInstanceRef.current?.getCurrentTime?.() || 0,
        getPlayerState: () => playerInstanceRef.current?.getPlayerState?.() || -1,
        mute: () => playerInstanceRef.current?.mute?.(),
        unMute: () => playerInstanceRef.current?.unMute?.(),
        isMuted: () => playerInstanceRef.current?.isMuted?.() || false,
    }));

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

            // 2. Create the player — callbacks go through refs so they're always fresh
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
                    'onStateChange': (event: any) => {
                        // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3
                        const state = event.data;
                        if (state === 0) {
                            console.log("🎬 Video Ended");
                            onEndedRef.current?.();
                        } else if (state === 1) {
                            console.log("▶️ Video Playing");
                            onPlayRef.current?.();
                        } else if (state === 2) {
                            console.log("⏸️ Video Paused");
                            onPauseRef.current?.();
                        }
                    }
                }
            });
        }
    }, [apiReady, videoId]);

    return (
        <div className={`relative w-full h-full bg-black ${className}`}>
            {/* The API will replace this div with the iframe */}
            <div ref={playerRef} className="w-full h-full" />
        </div>
    );
});

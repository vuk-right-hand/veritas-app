import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getMyMission } from '@/app/actions/video-actions';
import { getUserSkillsMatrix, getCurrentUserId } from '@/app/actions/quiz-actions';
import { getTopCreators, getWatchHistory } from '@/app/actions/watch-history-actions';
import { getUserHandshakes } from '@/app/actions/handshake-actions';
import ProfileClientTabs from '@/components/ProfileClientTabs';
import BottomNav from '@/components/BottomNav';

export default async function ProfilePage() {
    const userId = await getCurrentUserId();
    
    let mission = null;
    let skillsMatrix = {};
    let topCreators: any[] = [];
    let watchHistory: any[] = [];
    let handshakes: any[] = [];

    // If user is authenticated, aggressively load all dependencies concurrently
    if (userId) {
        const [missionResult, skillsMatrixResult, topCreatorsResult, watchHistoryResult, handshakesResult] = await Promise.all([
            getMyMission(),
            getUserSkillsMatrix(userId),
            getTopCreators(userId),
            getWatchHistory(userId),
            getUserHandshakes(),
        ]);

        mission = missionResult;
        skillsMatrix = skillsMatrixResult || {};
        topCreators = topCreatorsResult || [];
        watchHistory = watchHistoryResult || [];
        handshakes = handshakesResult || [];
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans p-6 md:p-12 pb-24 md:pb-12 relative overflow-hidden flex items-center justify-center">
            {/* Background Ambience */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Feed
                </Link>

                {!userId ? (
                    <div className="bg-[#0f0f0f] border border-white/5 backdrop-blur-md rounded-3xl p-6 md:p-10 shadow-2xl text-center">
                        <h2 className="text-xl font-bold mb-4">Session Not Found</h2>
                        <p className="text-gray-400 mb-8">Please reload or login again to access your profile.</p>
                        <Link href="/login" className="bg-white text-black font-bold py-3 px-6 rounded-xl">
                            Log in
                        </Link>
                    </div>
                ) : (
                    <ProfileClientTabs
                        initialMission={mission}
                        skillsMatrix={skillsMatrix}
                        topCreators={topCreators}
                        watchHistory={watchHistory}
                        handshakes={handshakes}
                    />
                )}
            </div>
            
            <BottomNav />
        </div>
    );
}

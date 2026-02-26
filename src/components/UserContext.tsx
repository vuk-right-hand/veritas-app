"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUserProfile, UserProfile } from '@/app/actions/user-actions';

interface UserContextProps {
    userProfile: UserProfile | null;
    isLoading: boolean;
    refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextProps>({
    userProfile: null,
    isLoading: true,
    refreshProfile: async () => { },
});

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshProfile = async () => {
        setIsLoading(true);
        try {
            const profile = await getCurrentUserProfile();
            setUserProfile(profile);
        } catch (error) {
            console.error('Error fetching user profile in context:', error);
            setUserProfile(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshProfile();
    }, []);

    return (
        <UserContext.Provider value={{ userProfile, isLoading, refreshProfile }}>
            {children}
        </UserContext.Provider>
    );
}

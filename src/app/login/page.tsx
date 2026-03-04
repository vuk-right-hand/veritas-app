"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const LoginPage = dynamic(() => import('./login-client'), { ssr: false });

export default function LoginPageWrapper() {
    return (
        <Suspense>
            <LoginPage />
        </Suspense>
    );
}

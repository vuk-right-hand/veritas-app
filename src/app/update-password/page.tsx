"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const UpdatePasswordPage = dynamic(() => import('./update-password-client'), { ssr: false });

export default function UpdatePasswordWrapper() {
    return (
        <Suspense>
            <UpdatePasswordPage />
        </Suspense>
    );
}

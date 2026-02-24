'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

interface AuthGuardProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
    const { user, userDoc, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        if (allowedRoles && userDoc && !allowedRoles.includes(userDoc.role)) {
            router.replace('/dashboard');
        }
    }, [user, userDoc, loading, router, allowedRoles]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;
    if (allowedRoles && userDoc && !allowedRoles.includes(userDoc.role)) return null;

    return <>{children}</>;
}

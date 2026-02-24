'use client';

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
} from 'react';
import {
    User,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserDoc } from '@/types';
import { phoneToEmail } from '@/lib/utils';

interface AuthContextValue {
    user: User | null;
    userDoc: UserDoc | null;
    loading: boolean;
    login: (phone: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);


export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUserDoc = useCallback(async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
                setUserDoc(snap.data() as UserDoc);
            }
        } catch (err) {
            console.error('Failed to fetch user doc:', err);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                await fetchUserDoc(firebaseUser.uid);
            } else {
                setUserDoc(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [fetchUserDoc]);

    const login = useCallback(async (phone: string, password: string) => {
        const email = phoneToEmail(phone);
        await signInWithEmailAndPassword(auth, email, password);
    }, []);

    const logout = useCallback(async () => {
        await signOut(auth);
        setUserDoc(null);
    }, []);

    const changePassword = useCallback(
        async (currentPassword: string, newPassword: string) => {
            if (!user || !user.email) throw new Error('Chưa xác thực');
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
        },
        [user]
    );

    return (
        <AuthContext.Provider value={{ user, userDoc, loading, login, logout, changePassword }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

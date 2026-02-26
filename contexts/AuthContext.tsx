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
import { UserDoc, AppPermission, CustomRoleDoc } from '@/types';
import { phoneToEmail } from '@/lib/utils';

interface AuthContextValue {
    user: User | null;
    userDoc: UserDoc | null;
    loading: boolean;
    permissions: Set<AppPermission>;
    hasPermission: (key: AppPermission) => boolean;
    getToken: () => Promise<string>;
    login: (phone: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Derive built-in permissions from base role (backward compat)
function getBuiltInPermissions(userDoc: UserDoc): AppPermission[] {
    const { role, canManageHR } = userDoc;
    if (role === 'admin' || role === 'store_manager') {
        return ['view_overview', 'view_history', 'view_schedule', 'edit_schedule', 'view_users', 'manage_hr'];
    }
    if (role === 'manager') {
        const perms: AppPermission[] = ['view_overview', 'view_history'];
        if (canManageHR) {
            perms.push('view_schedule', 'edit_schedule', 'view_users', 'manage_hr');
        }
        return perms;
    }
    if (role === 'employee') {
        return ['register_shift'];
    }
    return [];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<Set<AppPermission>>(new Set());

    const fetchUserDoc = useCallback(async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
                const data = snap.data() as UserDoc;
                setUserDoc(data);

                // Build built-in permissions first
                const builtIn = getBuiltInPermissions(data);
                const permSet = new Set<AppPermission>(builtIn);

                // Load custom role permissions if assigned
                if (data.customRoleId) {
                    try {
                        const roleSnap = await getDoc(doc(db, 'custom_roles', data.customRoleId));
                        if (roleSnap.exists()) {
                            const roleData = roleSnap.data() as CustomRoleDoc;
                            roleData.permissions.forEach(p => permSet.add(p));
                        }
                    } catch (err) {
                        console.error('Failed to load custom role:', err);
                    }
                }

                setPermissions(permSet);
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
                setPermissions(new Set());
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [fetchUserDoc]);

    const getToken = useCallback(async () => {
        if (!user) throw new Error('Chưa đăng nhập');
        return user.getIdToken();
    }, [user]);

    const login = useCallback(async (phone: string, password: string) => {
        const email = phoneToEmail(phone);
        const credential = await signInWithEmailAndPassword(auth, email, password);

        // Check if account is active in Firestore before allowing access
        const snap = await getDoc(doc(db, 'users', credential.user.uid));
        if (snap.exists() && snap.data()?.isActive === false) {
            // Sign out immediately to prevent access
            await signOut(auth);
            throw new Error('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản lý.');
        }
    }, []);

    const logout = useCallback(async () => {
        await signOut(auth);
        setUserDoc(null);
        setPermissions(new Set());
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

    const hasPermission = useCallback(
        (key: AppPermission) => permissions.has(key),
        [permissions]
    );

    return (
        <AuthContext.Provider value={{ user, userDoc, loading, permissions, hasPermission, getToken, login, logout, changePassword }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

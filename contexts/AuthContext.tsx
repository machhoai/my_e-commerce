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
    signInWithCustomToken,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserDoc, CustomRoleDoc, OfficeDoc } from '@/types';
import { phoneToEmail } from '@/lib/utils';

// ── Role cookie helpers (Edge-readable, not for auth — just nav hints) ──────
const ROLE_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
function writeRoleCookie(role: string) {
    if (typeof document === 'undefined') return;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `user_role=${encodeURIComponent(role)}; Max-Age=${ROLE_COOKIE_MAX_AGE}; Path=/${secure}; SameSite=Lax`;
}
function clearRoleCookie() {
    if (typeof document === 'undefined') return;
    document.cookie = 'user_role=; Max-Age=0; Path=/';
}

// ── LocalStorage key for office user's selected store ───────────────────────
const OFFICE_STORE_KEY = 'office_selected_store_id';

interface AuthContextValue {
    user: User | null;
    userDoc: UserDoc | null;
    loading: boolean;
    /** Set of permission keys granted to this user (page.* / action.*). Admin bypass = always full. */
    permissions: Set<string>;
    /**
     * Check if the current user has a given permission key.
     * Admin & super_admin always return true (bypass).
     * Custom roles are checked against their `permissions` array.
     */
    hasPermission: (key: string) => boolean;
    /** Default route after login, derived from the user's custom role */
    roleDefaultRoute: string | null;
    getToken: () => Promise<string>;
    login: (phone: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;

    // ── Office managed stores ───────────────────────────────────────────────
    /** List of store IDs this office is allowed to manage (office-context users only). */
    managedStoreIds: string[];
    /**
     * The store ID currently selected for data viewing.
     * - Store-context users: === userDoc.storeId (fixed)
     * - Office-context users: whichever store from managedStoreIds they picked
     * - Admin/super_admin: set separately per page via their own store selector
     */
    effectiveStoreId: string;
    /** Update the store selection for office-context users and persist to localStorage. */
    setEffectiveStoreId: (storeId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<Set<string>>(new Set());
    const [roleDefaultRoute, setRoleDefaultRoute] = useState<string | null>(null);
    const [managedStoreIds, setManagedStoreIds] = useState<string[]>([]);
    const [effectiveStoreId, setEffectiveStoreIdState] = useState<string>('');

    const setEffectiveStoreId = useCallback((storeId: string) => {
        setEffectiveStoreIdState(storeId);
        if (typeof window !== 'undefined') {
            localStorage.setItem(OFFICE_STORE_KEY, storeId);
        }
    }, []);

    const fetchUserDoc = useCallback(async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
                const data = snap.data() as UserDoc;
                setUserDoc(data);

                // Write role cookie immediately so middleware /admin lock works
                writeRoleCookie(data.role);

                // Load custom role permissions if assigned
                if (data.customRoleId) {
                    try {
                        const roleSnap = await getDoc(doc(db, 'custom_roles', data.customRoleId));
                        if (roleSnap.exists()) {
                            const roleData = roleSnap.data() as CustomRoleDoc;
                            setPermissions(new Set<string>(roleData.permissions ?? []));
                            setRoleDefaultRoute(roleData.defaultRoute || null);
                        } else {
                            setPermissions(new Set());
                            setRoleDefaultRoute(null);
                        }
                    } catch (err) {
                        console.error('Failed to load custom role:', err);
                        setPermissions(new Set());
                        setRoleDefaultRoute(null);
                    }
                } else {
                    // No customRoleId — try loading permissions from the system role doc
                    // System roles (manager, store_manager, employee) are stored in
                    // custom_roles collection with doc ID matching the role name.
                    try {
                        const sysRoleSnap = await getDoc(doc(db, 'custom_roles', data.role));
                        if (sysRoleSnap.exists()) {
                            const sysRoleData = sysRoleSnap.data() as CustomRoleDoc;
                            setPermissions(new Set<string>(sysRoleData.permissions ?? []));
                            setRoleDefaultRoute(sysRoleData.defaultRoute || null);
                        } else {
                            setPermissions(new Set());
                            setRoleDefaultRoute(null);
                        }
                    } catch {
                        setPermissions(new Set());
                        setRoleDefaultRoute(null);
                    }
                }

                // ── Resolve office managed stores ───────────────────────
                const isOfficeCtx = data.workplaceType === 'OFFICE' || (data.officeId && data.role !== 'admin');
                if (isOfficeCtx && data.officeId) {
                    try {
                        const officeSnap = await getDoc(doc(db, 'offices', data.officeId));
                        if (officeSnap.exists()) {
                            const officeData = officeSnap.data() as OfficeDoc;
                            const ids = officeData.managedStoreIds ?? [];
                            setManagedStoreIds(ids);

                            // Restore or default the effective store selection
                            const saved = typeof window !== 'undefined'
                                ? (localStorage.getItem(OFFICE_STORE_KEY) ?? '')
                                : '';
                            const valid = saved && ids.includes(saved) ? saved : (ids[0] ?? '');
                            setEffectiveStoreIdState(valid);
                        } else {
                            setManagedStoreIds([]);
                            setEffectiveStoreIdState('');
                        }
                    } catch (err) {
                        console.error('Failed to load office doc:', err);
                        setManagedStoreIds([]);
                        setEffectiveStoreIdState('');
                    }
                } else if (data.storeId) {
                    // Store-context user: effectiveStoreId = their own storeId
                    setManagedStoreIds([]);
                    setEffectiveStoreIdState(data.storeId);
                } else {
                    setManagedStoreIds([]);
                    setEffectiveStoreIdState('');
                }
            }
        } catch (err) {
            console.error('Failed to fetch user doc:', err);
        }
    }, []);

    useEffect(() => {
        let recoveryAttempted = false;

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                await fetchUserDoc(firebaseUser.uid);

                // Sync token → session cookie (rolling 7-day window)
                try {
                    const idToken = await firebaseUser.getIdToken();
                    await fetch('/api/auth/session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken }),
                    });
                } catch (err) {
                    console.error('Failed to refresh session cookie:', err);
                }

                recoveryAttempted = false;
                setLoading(false);
            } else {
                if (!recoveryAttempted) {
                    recoveryAttempted = true;
                    try {
                        const res = await fetch('/api/auth/session');
                        if (res.ok) {
                            const data = await res.json();
                            if (data.customToken) {
                                await signInWithCustomToken(auth, data.customToken);
                                return;
                            }
                        }
                    } catch (err) {
                        console.error('Session recovery failed:', err);
                    }
                }

                recoveryAttempted = false;
                setUserDoc(null);
                setPermissions(new Set());
                setRoleDefaultRoute(null);
                setManagedStoreIds([]);
                setEffectiveStoreIdState('');
                setLoading(false);
            }
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

        const snap = await getDoc(doc(db, 'users', credential.user.uid));
        if (snap.exists() && snap.data()?.isActive === false) {
            await signOut(auth);
            throw new Error('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản lý.');
        }

        try {
            const idToken = await credential.user.getIdToken();
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });
        } catch (err) {
            console.error('Failed to create session cookie:', err);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/session', { method: 'DELETE' });
        } catch (err) {
            console.error('Failed to clear session cookie:', err);
        }
        clearRoleCookie();
        await signOut(auth);
        setUserDoc(null);
        setPermissions(new Set());
        setRoleDefaultRoute(null);
        setManagedStoreIds([]);
        setEffectiveStoreIdState('');
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

    /**
     * Check if the current user has a given permission key.
     *
     * - Admin / super_admin → always true (bypass all checks)
     * - Others → check if `key` is in their permissions Set
     */
    const hasPermission = useCallback(
        (key: string): boolean => {
            if (!userDoc) return false;
            if (userDoc.role === 'super_admin' || userDoc.role === 'admin') return true;
            return permissions.has(key);
        },
        [permissions, userDoc]
    );

    return (
        <AuthContext.Provider value={{
            user, userDoc, loading, permissions, hasPermission,
            roleDefaultRoute, getToken, login, logout, changePassword,
            managedStoreIds, effectiveStoreId, setEffectiveStoreId,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

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
import { UserDoc, AppPermission, CustomRoleDoc, ALL_PERMISSIONS, CrudAction, PermissionMatrix } from '@/types';
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



interface AuthContextValue {
    user: User | null;
    userDoc: UserDoc | null;
    loading: boolean;
    permissions: Set<AppPermission>;
    permissionMatrix: PermissionMatrix | null;
    hasPermission: (resource: string, action?: CrudAction) => boolean;
    roleDefaultRoute: string | null;
    getToken: () => Promise<string>;
    login: (phone: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}


const AuthContext = createContext<AuthContextValue | null>(null);

// Derive built-in permissions from base role (backward compat)
function getBuiltInPermissions(userDoc: UserDoc): AppPermission[] {
    const { role, canManageHR } = userDoc;
    // Super admin gets every permission
    if (role === 'super_admin') {
        return ALL_PERMISSIONS.map(p => p.key);
    }
    if (role === 'admin' || role === 'store_manager') {
        return ['view_overview', 'view_history', 'view_schedule', 'edit_schedule', 'view_users', 'manage_hr', 'manage_kpi_templates', 'score_employees', 'view_all_kpi', 'export_kpi'];
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
    const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix | null>(null);
    const [roleDefaultRoute, setRoleDefaultRoute] = useState<string | null>(null);


    const fetchUserDoc = useCallback(async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
                const data = snap.data() as UserDoc;
                setUserDoc(data);

                // Build built-in permissions first
                const builtIn = getBuiltInPermissions(data);
                const permSet = new Set<AppPermission>(builtIn);

                // Write role cookie immediately so middleware /admin lock works
                // on the very first navigation after login (no race condition).
                writeRoleCookie(data.role);

                // Load custom role permissions if assigned
                if (data.customRoleId) {
                    try {
                        const roleSnap = await getDoc(doc(db, 'custom_roles', data.customRoleId));
                        if (roleSnap.exists()) {
                            const roleData = roleSnap.data() as CustomRoleDoc;
                            roleData.permissions.forEach(p => permSet.add(p));
                            setRoleDefaultRoute(roleData.defaultRoute || null);
                            setPermissionMatrix(roleData.permissionMatrix ?? null);
                        }
                    } catch (err) {
                        console.error('Failed to load custom role:', err);
                    }
                } else {
                    setPermissionMatrix(null);
                }


                setPermissions(permSet);
            }
        } catch (err) {
            console.error('Failed to fetch user doc:', err);
        }
    }, []);

    useEffect(() => {
        // Track whether we've already tried session cookie recovery
        // to prevent infinite loops (signInWithCustomToken triggers
        // onAuthStateChanged again).
        let recoveryAttempted = false;

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                // ✅ User authenticated (from IndexedDB or recovery)
                await fetchUserDoc(firebaseUser.uid);

                // Sync token → session cookie (rolling 7-day window).
                // This keeps the cookie alive as long as the user opens
                // the app at least once every 7 days.
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
                // ❌ User is null — IndexedDB may have been wiped by the OS.
                // Try to recover from the server-side session cookie ONCE.
                if (!recoveryAttempted) {
                    recoveryAttempted = true;
                    try {
                        const res = await fetch('/api/auth/session');
                        if (res.ok) {
                            const data = await res.json();
                            if (data.customToken) {
                                // Re-authenticate silently — this will
                                // trigger onAuthStateChanged again with
                                // the recovered user.
                                await signInWithCustomToken(auth, data.customToken);
                                return; // Don't setLoading(false) yet
                            }
                        }
                    } catch (err) {
                        console.error('Session recovery failed:', err);
                    }
                }

                // Recovery failed or not applicable — truly logged out
                recoveryAttempted = false;
                setUserDoc(null);
                setPermissions(new Set());
                setPermissionMatrix(null);
                setRoleDefaultRoute(null);
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

        // Check if account is active in Firestore before allowing access
        const snap = await getDoc(doc(db, 'users', credential.user.uid));
        if (snap.exists() && snap.data()?.isActive === false) {
            // Sign out immediately to prevent access
            await signOut(auth);
            throw new Error('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản lý.');
        }

        // Create a 7-day server-side session cookie for PWA persistence
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
        // Clear the server-side session cookie before signing out
        try {
            await fetch('/api/auth/session', { method: 'DELETE' });
        } catch (err) {
            console.error('Failed to clear session cookie:', err);
        }
        // Clear the Edge-readable role cookie
        clearRoleCookie();
        await signOut(auth);
        setUserDoc(null);
        setPermissions(new Set());
        setPermissionMatrix(null);
        setRoleDefaultRoute(null);
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
     * Check if the current user has permission for a given resource + action.
     *
     * Priority:
     *  1. super_admin / admin → always true (bypass)
     *  2. permissionMatrix[resource][action] if matrix exists
     *  3. Fallback: treat the resource string as a legacy AppPermission key
     */
    const hasPermission = useCallback(
        (resource: string, action: CrudAction = 'read'): boolean => {
            if (!userDoc) return false;
            // Admins bypass all checks
            if (userDoc.role === 'super_admin' || userDoc.role === 'admin') return true;
            // Check granular matrix first
            if (permissionMatrix && permissionMatrix[resource]) {
                return permissionMatrix[resource][action] === true;
            }
            // Fallback: treat resource as a legacy flat AppPermission key
            return permissions.has(resource as AppPermission);
        },
        [permissions, permissionMatrix, userDoc]
    );


    return (
        <AuthContext.Provider value={{ user, userDoc, loading, permissions, permissionMatrix, hasPermission, roleDefaultRoute, getToken, login, logout, changePassword }}>
            {children}
        </AuthContext.Provider>
    );

}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

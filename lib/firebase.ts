import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton pattern to avoid re-initialization in Next.js hot-reload
let app: FirebaseApp;
let auth: Auth;

if (getApps().length) {
    app = getApp();
    auth = getAuth(app);
} else {
    app = initializeApp(firebaseConfig);
    // Use initializeAuth with explicit persistence to ensure auth state survives
    // PWA restarts on mobile (especially iOS). IndexedDB is primary (most reliable),
    // falling back to localStorage if IndexedDB is unavailable.
    auth = typeof window !== 'undefined'
        ? initializeAuth(app, {
            persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        })
        : getAuth(app);
}

const db: Firestore = getFirestore(app);

export { app, auth, db };

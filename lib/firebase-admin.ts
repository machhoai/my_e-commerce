import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;

function getAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    adminApp = initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });

    return adminApp;
}

export function getAdminAuth(): Auth {
    return getAuth(getAdminApp());
}

export function getAdminMessaging() {
    const { getMessaging } = require('firebase-admin/messaging');
    return getMessaging(getAdminApp());
}

export function getAdminDb(): Firestore {
    return getFirestore(getAdminApp());
}

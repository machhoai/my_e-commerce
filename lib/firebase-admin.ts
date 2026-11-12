import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;

function getAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const hasExplicitCredentials = Boolean(clientEmail || privateKey);
    if (hasExplicitCredentials && (!projectId || !clientEmail || !privateKey)) {
        throw new Error('Firebase Admin explicit credentials are incomplete.');
    }

    adminApp = initializeApp({
        projectId,
        serviceAccountId: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_ID,
        credential: hasExplicitCredentials
            ? cert({ projectId, clientEmail, privateKey: privateKey!.replace(/\\n/g, '\n') })
            : applicationDefault(),
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

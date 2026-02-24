import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    QueryConstraint,
    DocumentData,
    Unsubscribe,
    addDoc,
    serverTimestamp,
    WithFieldValue,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Generic get one ──────────────────────────────────────────
export async function getDocument<T>(
    collectionPath: string,
    id: string
): Promise<T | null> {
    const snap = await getDoc(doc(db, collectionPath, id));
    return snap.exists() ? (snap.data() as T) : null;
}

// ── Generic get collection ───────────────────────────────────
export async function getCollection<T>(
    collectionPath: string,
    ...constraints: QueryConstraint[]
): Promise<T[]> {
    const q = query(collection(db, collectionPath), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

// ── Generic set (create / overwrite with known ID) ───────────
export async function setDocument<T extends DocumentData>(
    collectionPath: string,
    id: string,
    data: WithFieldValue<T>
): Promise<void> {
    await setDoc(doc(db, collectionPath, id), data);
}

// ── Generic add (auto-generated ID) ─────────────────────────
export async function addDocument<T extends DocumentData>(
    collectionPath: string,
    data: WithFieldValue<T>
): Promise<string> {
    const ref = await addDoc(collection(db, collectionPath), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

// ── Generic update (partial) ─────────────────────────────────
export async function updateDocument(
    collectionPath: string,
    id: string,
    data: Partial<DocumentData>
): Promise<void> {
    await updateDoc(doc(db, collectionPath, id), data);
}

// ── Generic delete ───────────────────────────────────────────
export async function deleteDocument(
    collectionPath: string,
    id: string
): Promise<void> {
    await deleteDoc(doc(db, collectionPath, id));
}

// ── Real-time listener for a single document ────────────────
export function subscribeDocument<T>(
    collectionPath: string,
    id: string,
    callback: (data: T | null) => void
): Unsubscribe {
    return onSnapshot(doc(db, collectionPath, id), (snap) => {
        callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null);
    });
}

// ── Real-time listener for a collection ─────────────────────
export function subscribeCollection<T>(
    collectionPath: string,
    callback: (data: T[]) => void,
    ...constraints: QueryConstraint[]
): Unsubscribe {
    const q = query(collection(db, collectionPath), ...constraints);
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
    });
}

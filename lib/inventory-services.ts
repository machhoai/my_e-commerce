/**
 * Inventory Services — Server-side Firebase Admin utilities
 *
 * These functions are designed to be called from API routes ONLY.
 * They use Firebase Admin SDK for atomic Firestore transactions.
 */

import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type {
    InventoryTransactionDoc,
    LocationType,
    InventoryTransactionType,
    TransactionStatus,
} from '@/types/inventory';

// ── Record a new inventory transaction ──────────────────────────
// Writes an immutable ledger entry to `inventory_transactions`.
export async function recordTransaction(data: {
    productId: string;
    fromLocationType: LocationType | '';
    fromLocationId: string;
    toLocationType: LocationType | '';
    toLocationId: string;
    quantity: number;
    type: InventoryTransactionType;
    status: TransactionStatus;
    createdByUserId: string;
    approvedByUserId?: string | null;
    referenceId?: string;
    note?: string;
}): Promise<string> {
    const db = getAdminDb();
    const colRef = db.collection('inventory_transactions');
    const docRef = colRef.doc(); // auto-generated ID

    const transaction: Omit<InventoryTransactionDoc, 'id'> & { id: string } = {
        id: docRef.id,
        productId: data.productId,
        fromLocationType: data.fromLocationType,
        fromLocationId: data.fromLocationId,
        toLocationType: data.toLocationType,
        toLocationId: data.toLocationId,
        quantity: data.quantity,
        type: data.type,
        status: data.status,
        createdByUserId: data.createdByUserId,
        approvedByUserId: data.approvedByUserId ?? null,
        referenceId: data.referenceId ?? '',
        note: data.note ?? '',
        timestamp: new Date().toISOString(),
    };

    await docRef.set(transaction);
    return docRef.id;
}

// ── Update inventory balance atomically ─────────────────────────
// Uses Firestore runTransaction to safely increment/decrement stock.
// Creates the balance document if it does not exist.
//
// Document ID convention: `${productId}_${locationType}_${locationId}`
export async function updateBalance(
    productId: string,
    locationType: LocationType,
    locationId: string,
    quantityChange: number // positive = add stock, negative = remove stock
): Promise<void> {
    const db = getAdminDb();
    const balanceId = `${productId}_${locationType}_${locationId}`;
    const docRef = db.collection('inventory_balances').doc(balanceId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);

        if (snap.exists) {
            const current = snap.data()!;
            const newStock = (current.currentStock ?? 0) + quantityChange;

            if (newStock < 0) {
                throw new Error(
                    `Insufficient stock for product ${productId} at ${locationType}:${locationId}. ` +
                    `Current: ${current.currentStock}, requested change: ${quantityChange}`
                );
            }

            tx.update(docRef, {
                currentStock: newStock,
                lastUpdated: new Date().toISOString(),
            });
        } else {
            // First time — create the balance document
            if (quantityChange < 0) {
                throw new Error(
                    `Cannot create balance with negative stock for product ${productId} at ${locationType}:${locationId}`
                );
            }

            tx.set(docRef, {
                id: balanceId,
                productId,
                locationType,
                locationId,
                currentStock: quantityChange,
                lastUpdated: new Date().toISOString(),
            });
        }
    });
}

// ── Get current balance for a product at a location ─────────────
export async function getBalance(
    productId: string,
    locationType: LocationType,
    locationId: string
): Promise<number> {
    const db = getAdminDb();
    const balanceId = `${productId}_${locationType}_${locationId}`;
    const snap = await db.collection('inventory_balances').doc(balanceId).get();

    if (!snap.exists) return 0;
    return snap.data()?.currentStock ?? 0;
}

// ── Move stock between two locations atomically ─────────────────
// Decrements source and increments destination in a single transaction,
// then records the ledger entry.
export async function moveStock(data: {
    productId: string;
    fromLocationType: LocationType;
    fromLocationId: string;
    toLocationType: LocationType;
    toLocationId: string;
    quantity: number;
    type: InventoryTransactionType;
    createdByUserId: string;
    referenceId?: string;
    note?: string;
}): Promise<string> {
    const db = getAdminDb();

    const fromBalanceId = `${data.productId}_${data.fromLocationType}_${data.fromLocationId}`;
    const toBalanceId = `${data.productId}_${data.toLocationType}_${data.toLocationId}`;

    const fromRef = db.collection('inventory_balances').doc(fromBalanceId);
    const toRef = db.collection('inventory_balances').doc(toBalanceId);

    // Atomic transfer
    await db.runTransaction(async (tx) => {
        const fromSnap = await tx.get(fromRef);
        const toSnap = await tx.get(toRef);

        const fromStock = fromSnap.exists ? (fromSnap.data()?.currentStock ?? 0) : 0;
        if (fromStock < data.quantity) {
            throw new Error(
                `Insufficient stock at ${data.fromLocationType}:${data.fromLocationId}. ` +
                `Available: ${fromStock}, requested: ${data.quantity}`
            );
        }

        // Decrement source
        if (fromSnap.exists) {
            tx.update(fromRef, {
                currentStock: fromStock - data.quantity,
                lastUpdated: new Date().toISOString(),
            });
        }

        // Increment destination
        if (toSnap.exists) {
            tx.update(toRef, {
                currentStock: (toSnap.data()?.currentStock ?? 0) + data.quantity,
                lastUpdated: new Date().toISOString(),
            });
        } else {
            tx.set(toRef, {
                id: toBalanceId,
                productId: data.productId,
                locationType: data.toLocationType,
                locationId: data.toLocationId,
                currentStock: data.quantity,
                lastUpdated: new Date().toISOString(),
            });
        }
    });

    // Record the ledger entry
    return recordTransaction({
        productId: data.productId,
        fromLocationType: data.fromLocationType,
        fromLocationId: data.fromLocationId,
        toLocationType: data.toLocationType,
        toLocationId: data.toLocationId,
        quantity: data.quantity,
        type: data.type,
        status: 'APPROVED',
        createdByUserId: data.createdByUserId,
        referenceId: data.referenceId,
        note: data.note,
    });
}

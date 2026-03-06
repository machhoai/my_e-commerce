import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// GET /api/inventory/transactions — query the inventory ledger
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        await auth.verifyIdToken(token);

        const { searchParams } = new URL(req.url);
        const locationId = searchParams.get('locationId');
        const storeId = searchParams.get('storeId');
        const productId = searchParams.get('productId');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const type = searchParams.get('type');

        const db = getAdminDb();

        const locationType = searchParams.get('locationType');

        // Filter by locationType (e.g. 'CENTRAL') — returns transactions involving that location type
        if (locationType) {
            const [fromSnap, toSnap] = await Promise.all([
                db.collection('inventory_transactions')
                    .where('fromLocationType', '==', locationType)
                    .limit(500).get(),
                db.collection('inventory_transactions')
                    .where('toLocationType', '==', locationType)
                    .limit(500).get(),
            ]);

            const txMap = new Map<string, any>();
            for (const d of fromSnap.docs) txMap.set(d.id, { id: d.id, ...d.data() });
            for (const d of toSnap.docs) txMap.set(d.id, { id: d.id, ...d.data() });

            let results = Array.from(txMap.values());

            if (productId) results = results.filter(r => r.productId === productId);
            if (type) results = results.filter(r => r.type === type);
            if (dateFrom) results = results.filter(r => r.timestamp >= dateFrom);
            if (dateTo) results = results.filter(r => r.timestamp <= dateTo + 'T23:59:59.999Z');

            results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            return NextResponse.json(results.slice(0, 500));
        }

        // Filter by storeId — returns transactions where the store is either source or destination
        if (storeId) {
            const [fromSnap, toSnap] = await Promise.all([
                db.collection('inventory_transactions')
                    .where('fromLocationId', '==', storeId)
                    .limit(500).get(),
                db.collection('inventory_transactions')
                    .where('toLocationId', '==', storeId)
                    .limit(500).get(),
            ]);

            const txMap = new Map<string, any>();
            for (const d of fromSnap.docs) txMap.set(d.id, { id: d.id, ...d.data() });
            for (const d of toSnap.docs) txMap.set(d.id, { id: d.id, ...d.data() });

            // Also include transactions for counters belonging to this store
            try {
                const counterSnap = await db.collection('counters').where('storeId', '==', storeId).get();
                const counterIds = counterSnap.docs.map(d => d.id);
                for (const cid of counterIds) {
                    const [cFrom, cTo] = await Promise.all([
                        db.collection('inventory_transactions')
                            .where('fromLocationId', '==', cid)
                            .limit(200).get(),
                        db.collection('inventory_transactions')
                            .where('toLocationId', '==', cid)
                            .limit(200).get(),
                    ]);
                    for (const d of cFrom.docs) txMap.set(d.id, { id: d.id, ...d.data() });
                    for (const d of cTo.docs) txMap.set(d.id, { id: d.id, ...d.data() });
                }
            } catch { /* counters collection might not exist */ }

            let results = Array.from(txMap.values());

            if (locationId) results = results.filter(r => r.fromLocationId === locationId || r.toLocationId === locationId);
            if (productId) results = results.filter(r => r.productId === productId);
            if (type) results = results.filter(r => r.type === type);
            if (dateFrom) results = results.filter(r => r.timestamp >= dateFrom);
            if (dateTo) results = results.filter(r => r.timestamp <= dateTo + 'T23:59:59.999Z');

            results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            return NextResponse.json(results.slice(0, 500));
        }

        // Filter by location (either from or to)
        if (locationId) {
            // We need to query both fromLocationId and toLocationId — do two queries
            const [fromSnap, toSnap] = await Promise.all([
                db.collection('inventory_transactions')
                    .where('fromLocationId', '==', locationId)
                    .orderBy('timestamp', 'desc')
                    .limit(500).get(),
                db.collection('inventory_transactions')
                    .where('toLocationId', '==', locationId)
                    .orderBy('timestamp', 'desc')
                    .limit(500).get(),
            ]);

            // Merge and deduplicate
            const txMap = new Map<string, any>();
            for (const d of fromSnap.docs) txMap.set(d.id, { id: d.id, ...d.data() });
            for (const d of toSnap.docs) txMap.set(d.id, { id: d.id, ...d.data() });

            let results = Array.from(txMap.values());

            // Apply additional filters client-side
            if (productId) results = results.filter(r => r.productId === productId);
            if (type) results = results.filter(r => r.type === type);
            if (dateFrom) results = results.filter(r => r.timestamp >= dateFrom);
            if (dateTo) results = results.filter(r => r.timestamp <= dateTo + 'T23:59:59.999Z');

            results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

            return NextResponse.json(results.slice(0, 500));
        }

        // No location filter — apply other filters via Firestore
        let q: FirebaseFirestore.Query = db.collection('inventory_transactions');
        if (productId) q = q.where('productId', '==', productId);
        if (type) q = q.where('type', '==', type);

        const snap = await q.limit(500).get();
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Date filters client-side (Firestore can't combine inequality on different fields)
        if (dateFrom) results = results.filter((r: any) => r.timestamp >= dateFrom);
        if (dateTo) results = results.filter((r: any) => r.timestamp <= dateTo + 'T23:59:59.999Z');

        results.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        return NextResponse.json(results);
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

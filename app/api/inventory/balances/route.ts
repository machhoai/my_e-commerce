import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

// GET /api/inventory/balances?locationType=STORE&locationId=xxx
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const auth = getAdminAuth();
        await auth.verifyIdToken(token);

        const { searchParams } = new URL(req.url);
        const locationType = searchParams.get('locationType');
        const locationId = searchParams.get('locationId');

        if (!locationType || !locationId) {
            return NextResponse.json({ error: 'locationType and locationId required' }, { status: 400 });
        }

        const db = getAdminDb();
        const snap = await db.collection('inventory_balances')
            .where('locationType', '==', locationType)
            .where('locationId', '==', locationId)
            .get();

        const balances = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        return NextResponse.json(balances);
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
}

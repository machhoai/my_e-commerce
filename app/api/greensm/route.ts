import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type {
    GreenSMMonthlyUsageDoc,
    GreenSMPlayDoc,
    GreenSMPrize,
    GreenSMSettingsDoc,
} from '@/types';

const SETTINGS_COLLECTION = 'greensm_settings';
const SETTINGS_DOC_ID = 'global';
const USAGE_COLLECTION = 'greensm_monthly_usage';
const PLAYS_COLLECTION = 'greensm_plays';
const PAGE_PERMISSION = 'page.greensm.promotion';
const SETTINGS_PERMISSION = 'action.greensm.settings';

const DEFAULT_PRIZES: GreenSMPrize[] = [
    { id: 'segment-0', name: 'Giảm giá 20% cho vé lẻ', imageUrl: '', rate: 5, quantity: 50, remaining: 50, isActive: true },
    { id: 'segment-1', name: 'Giảm giá 10% cho vé lẻ', imageUrl: '', rate: 15, quantity: 100, remaining: 100, isActive: true },
    { id: 'segment-2', name: 'Free 1 lượt game', imageUrl: '', rate: 20, quantity: 80, remaining: 80, isActive: true },
    { id: 'segment-3', name: 'Free 1 lượt boothgame', imageUrl: '', rate: 20, quantity: 80, remaining: 80, isActive: true },
    { id: 'segment-4', name: 'Free 1 lượt gấp thú', imageUrl: '', rate: 15, quantity: 60, remaining: 60, isActive: true },
    { id: 'segment-5', name: 'Mua 1 tặng 1 vé lẻ', imageUrl: '', rate: 5, quantity: 30, remaining: 30, isActive: true },
];

const DEFAULT_SETTINGS: GreenSMSettingsDoc = {
    id: SETTINGS_DOC_ID,
    monthlyLimit: 2,
    prizes: DEFAULT_PRIZES,
};

type Caller = {
    uid: string;
    name?: string;
    role?: string;
};

function monthKeyVN(date = new Date()): string {
    return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function normalizeContact(raw: string): { contact: string; contactType: 'phone' | 'email'; participantKey: string } {
    const value = raw.trim();
    if (!value) throw new Error('Vui lòng nhập email hoặc số điện thoại.');

    if (value.includes('@')) {
        const email = value.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Email không hợp lệ.');
        }
        return { contact: email, contactType: 'email', participantKey: `email:${email}` };
    }

    let phone = value.replace(/[^\d]/g, '');
    if (phone.startsWith('84') && phone.length === 11) phone = `0${phone.slice(2)}`;
    if (phone.length === 9 && /^[35789]/.test(phone)) phone = `0${phone}`;

    if (!/^0[0-9]{9}$/.test(phone)) {
        throw new Error('Số điện thoại không hợp lệ.');
    }

    return { contact: phone, contactType: 'phone', participantKey: `phone:${phone}` };
}

function usageDocId(monthKey: string, participantKey: string): string {
    const digest = createHash('sha256').update(participantKey).digest('hex').slice(0, 32);
    return `${monthKey}_${digest}`;
}

async function getCaller(req: NextRequest, permission: string): Promise<Caller | null> {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;

    const decoded = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return null;

    const userData = userSnap.data();
    const role = userData?.role;
    if (role === 'admin' || role === 'super_admin') {
        return { uid: decoded.uid, name: userData?.name, role };
    }

    if (userData?.customRoleId) {
        const roleSnap = await db.collection('custom_roles').doc(userData.customRoleId).get();
        const permissions: string[] = roleSnap.data()?.permissions || [];
        if (permissions.includes(permission)) {
            return { uid: decoded.uid, name: userData?.name, role };
        }
    }

    return null;
}

async function ensureSettings(): Promise<GreenSMSettingsDoc> {
    const db = getAdminDb();
    const ref = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
    const snap = await ref.get();
    if (snap.exists) return { ...DEFAULT_SETTINGS, ...snap.data(), id: SETTINGS_DOC_ID } as GreenSMSettingsDoc;

    const now = new Date().toISOString();
    const settings = { ...DEFAULT_SETTINGS, updatedAt: now };
    await ref.set(settings);
    return settings;
}

function sanitizePrizes(prizes: GreenSMPrize[]): GreenSMPrize[] {
    return prizes.map((prize) => {
        const quantity = Math.max(0, Math.floor(Number(prize.quantity) || 0));
        const remaining = Math.min(quantity, Math.max(0, Math.floor(Number(prize.remaining) || 0)));
        return {
            id: prize.id || randomUUID(),
            name: prize.name?.trim() || 'Quà tặng',
            imageUrl: prize.imageUrl?.trim() || '',
            rate: Math.max(0, Math.min(100, Number(prize.rate) || 0)),
            quantity,
            remaining,
            isActive: prize.isActive !== false,
            ...(prize.campaignId?.trim() ? { campaignId: prize.campaignId.trim() } : {}),
        };
    });
}

function pickPrize(prizes: GreenSMPrize[]): GreenSMPrize | null {
    const eligible = prizes.filter((prize) => prize.isActive && prize.remaining > 0 && prize.rate > 0);
    const roll = Math.random() * 100;
    let cumulative = 0;

    for (const prize of eligible) {
        cumulative += prize.rate;
        if (roll < cumulative) return prize;
    }

    return null;
}

export async function GET(req: NextRequest) {
    try {
        const caller = await getCaller(req, PAGE_PERMISSION);
        if (!caller) return NextResponse.json({ error: 'Bạn không có quyền truy cập GreenSM.' }, { status: 403 });

        const settings = await ensureSettings();
        const db = getAdminDb();
        const recentSnap = await db.collection(PLAYS_COLLECTION).orderBy('createdAt', 'desc').limit(20).get();
        const recentPlays = recentSnap.docs.map(d => ({ id: d.id, ...d.data() } as GreenSMPlayDoc));

        return NextResponse.json({ settings, recentPlays, monthKey: monthKeyVN() });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const caller = await getCaller(req, PAGE_PERMISSION);
        if (!caller) return NextResponse.json({ error: 'Bạn không có quyền truy cập GreenSM.' }, { status: 403 });

        const body = await req.json() as { action: 'check' | 'spin'; contact: string };
        const { contact, contactType, participantKey } = normalizeContact(body.contact || '');
        const monthKey = monthKeyVN();
        const db = getAdminDb();
        const settings = await ensureSettings();
        const safeMonthlyLimit = Math.max(1, Math.floor(settings.monthlyLimit || 2));
        const usageId = usageDocId(monthKey, participantKey);
        const usageRef = db.collection(USAGE_COLLECTION).doc(usageId);

        if (body.action === 'check') {
            const usageSnap = await usageRef.get();
            const usedCount = usageSnap.exists ? Number(usageSnap.data()?.usedCount || 0) : 0;
            const remainingPlays = Math.max(0, safeMonthlyLimit - usedCount);
            return NextResponse.json({
                allowed: remainingPlays > 0,
                contact,
                contactType,
                monthKey,
                monthlyLimit: safeMonthlyLimit,
                usedCount,
                remainingPlays,
                message: remainingPlays > 0 ? 'Khách hàng đủ điều kiện chơi.' : 'Khách hàng đã tới giới hạn lượt chơi trong tháng.',
            });
        }

        if (body.action !== 'spin') {
            return NextResponse.json({ error: 'Action không hợp lệ.' }, { status: 400 });
        }

        const result = await db.runTransaction(async (tx) => {
            const settingsRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);

            // ── PHASE 1: ALL READS first (Firestore Admin rule) ──────────
            const [settingsSnap, usageSnap] = await Promise.all([
                tx.get(settingsRef),
                tx.get(usageRef),
            ]);

            const txSettings = settingsSnap.exists
                ? ({ ...DEFAULT_SETTINGS, ...settingsSnap.data(), id: SETTINGS_DOC_ID } as GreenSMSettingsDoc)
                : settings;
            const monthlyLimit = Math.max(1, Math.floor(txSettings.monthlyLimit || 2));
            const existingUsage = usageSnap.exists ? usageSnap.data() as GreenSMMonthlyUsageDoc : null;
            const usedCount = Number(existingUsage?.usedCount || 0);

            if (usedCount >= monthlyLimit) {
                return {
                    success: false,
                    limitReached: true,
                    monthlyLimit,
                    usedCount,
                    remainingPlays: 0,
                    message: 'Khách hàng đã tới giới hạn lượt chơi trong tháng.',
                };
            }

            const now = new Date().toISOString();
            const prizes = sanitizePrizes(txSettings.prizes || []);
            const selectedPrize = pickPrize(prizes);

            // Read voucher code BEFORE any writes (Firestore Admin SDK requirement)
            let distributedVoucherCode: string | null = null;
            let voucherCodeRef: FirebaseFirestore.DocumentReference | null = null;

            if (selectedPrize?.campaignId) {
                const codeQuery = db.collection('voucher_codes')
                    .where('campaignId', '==', selectedPrize.campaignId)
                    .where('status', '==', 'available')
                    .limit(1);

                const codeSnap = await tx.get(codeQuery);

                if (!codeSnap.empty) {
                    const codeDoc = codeSnap.docs[0];
                    voucherCodeRef = codeDoc.ref;
                    distributedVoucherCode = codeDoc.id;
                }
            }

            // ── PHASE 2: ALL WRITES after reads ─────────────────────────

            // Update prize inventory
            if (selectedPrize) {
                const updatedPrizes = prizes.map((prize) =>
                    prize.id === selectedPrize.id
                        ? { ...prize, remaining: Math.max(0, prize.remaining - 1) }
                        : prize
                );
                tx.update(settingsRef, {
                    prizes: updatedPrizes,
                    updatedAt: now,
                });
            }

            // Distribute voucher code
            if (voucherCodeRef) {
                tx.update(voucherCodeRef, {
                    status: 'distributed',
                    distributedToPhone: contact,
                    distributedAt: now,
                });
            }

            // Update usage count
            if (usageSnap.exists) {
                tx.update(usageRef, {
                    usedCount: FieldValue.increment(1),
                    updatedAt: now,
                });
            } else {
                const usageDoc: GreenSMMonthlyUsageDoc = {
                    id: usageId,
                    contact,
                    contactType,
                    participantKey,
                    monthKey,
                    usedCount: 1,
                    createdAt: now,
                    updatedAt: now,
                };
                tx.set(usageRef, usageDoc);
            }

            // Write play log
            const playRef = db.collection(PLAYS_COLLECTION).doc();
            const playDoc: GreenSMPlayDoc = {
                id: playRef.id,
                contact,
                contactType,
                participantKey,
                monthKey,
                staffUid: caller.uid,
                staffName: caller.name || undefined,
                prizeId: selectedPrize?.id || null,
                prizeName: selectedPrize?.name || null,
                prizeImageUrl: selectedPrize?.imageUrl || null,
                won: Boolean(selectedPrize),
                createdAt: now,
                voucherCode: distributedVoucherCode,
            };
            tx.set(playRef, playDoc);

            const newUsedCount = usedCount + 1;
            return {
                success: true,
                limitReached: false,
                monthlyLimit,
                usedCount: newUsedCount,
                remainingPlays: Math.max(0, monthlyLimit - newUsedCount),
                prize: selectedPrize || null,
                voucherCode: distributedVoucherCode,
                message: selectedPrize ? `Chúc mừng! Khách hàng trúng ${selectedPrize.name}.` : 'Chúc khách hàng may mắn lần sau.',
            };
        });

        return NextResponse.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const caller = await getCaller(req, SETTINGS_PERMISSION);
        if (!caller) return NextResponse.json({ error: 'Bạn không có quyền cài đặt GreenSM.' }, { status: 403 });

        const body = await req.json() as Partial<GreenSMSettingsDoc>;
        const monthlyLimit = Math.max(1, Math.min(50, Math.floor(Number(body.monthlyLimit) || 2)));
        const prizes = sanitizePrizes(body.prizes || []);

        if (prizes.length === 0) {
            return NextResponse.json({ error: 'Cần ít nhất 1 món quà.' }, { status: 400 });
        }

        const totalRate = prizes.filter(p => p.isActive && p.remaining > 0).reduce((sum, prize) => sum + prize.rate, 0);
        if (totalRate > 100) {
            return NextResponse.json({ error: 'Tổng tỷ lệ trúng của các quà đang bật không được vượt quá 100%.' }, { status: 400 });
        }

        const settings: GreenSMSettingsDoc = {
            id: SETTINGS_DOC_ID,
            monthlyLimit,
            prizes,
            updatedAt: new Date().toISOString(),
            updatedBy: caller.uid,
        };

        await getAdminDb().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).set(settings, { merge: true });
        return NextResponse.json({ success: true, settings, message: 'Đã lưu cài đặt GreenSM.' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

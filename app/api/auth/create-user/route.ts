import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { phoneToEmail, defaultPassword } from '@/lib/utils';
import { UserDoc } from '@/types';
import { canManageHr } from '@/lib/hr-access';
import { assertPermission, assertWorkplaceScope, requireWorkplaceCaller, workplaceAccessResponse } from '@/lib/workplace/access';
import { currentMembershipId, parseWorkplaceKey, workplaceKey } from '@/lib/workplace/keys';
import type { WorkplaceMembership, WorkplaceType } from '@/types';
import { assertWorkplaceExists } from '@/lib/workplace/server';

// Allow large payloads for base64 ID card photos
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    let createdAuthUid: string | null = null;
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const adminDb = getAdminDb();

        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (!callerDoc.exists) return NextResponse.json({ error: 'Không được phép' }, { status: 401 });

        const callerData = callerDoc.data() as UserDoc;
        const callerRole = callerData.role;
        const callerStoreId = callerData.storeId;

        if (!(await canManageHr(adminDb, callerData))) {
            return NextResponse.json({ error: 'Bạn không có quyền tạo người dùng' }, { status: 403 });
        }

        const body = await req.json();
        const {
            name, phone, type, dob, jobTitle,
            email: realEmail, idCard, bankAccount, education, contractNumber,
            gender, permanentAddress, idCardFrontPhoto, idCardBackPhoto,
            probationStartDate, officialStartDate, resignationDate,
            canManageHR, customRoleId,
            // Workplace assignment
            workplaceType: bodyWorkplaceType,
            storeId: bodyStoreId,
            storeIds: bodyStoreIds,
            officeId: bodyOfficeId,
            warehouseId: bodyWarehouseId,
        } = body as {
            name: string; phone: string; type: UserDoc['type'];
            dob?: string; jobTitle?: string; email?: string;
            idCard?: string; bankAccount?: string; education?: string; contractNumber?: string;
            gender?: string; permanentAddress?: string;
            idCardFrontPhoto?: string; idCardBackPhoto?: string;
            probationStartDate?: string; officialStartDate?: string;
            resignationDate?: string;
            canManageHR?: boolean;
            customRoleId?: string | null;
            workplaceType?: 'STORE' | 'OFFICE' | 'CENTRAL';
            storeId?: string; storeIds?: string[]; officeId?: string; warehouseId?: string;
        };

        let { role } = body as { role: UserDoc['role'] };

        // Enforce role restrictions
        if (callerRole === 'store_manager') {
            if (!['manager', 'employee'].includes(role)) role = 'employee';
        } else if (callerRole !== 'admin' && callerRole !== 'super_admin') {
            role = 'employee';
        }

        // Resolve workplaceType and the single location ID
        const isAdmin = callerRole === 'admin' || callerRole === 'super_admin';
        const effectiveWorkplaceType: 'STORE' | 'OFFICE' | 'CENTRAL' = isAdmin
            ? (bodyWorkplaceType || 'STORE')
            : 'STORE'; // non-admin always creates within their store

        const requestedStoreIds = Array.isArray(bodyStoreIds)
            ? [...new Set(bodyStoreIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
            : [];
        if (requestedStoreIds.length > 100) {
            return NextResponse.json({ error: 'Số lượng cửa hàng được chọn vượt quá giới hạn.' }, { status: 400 });
        }
        const callerPrimaryWorkplace = callerData.primaryWorkplaceKey
            ? parseWorkplaceKey(callerData.primaryWorkplaceKey)
            : null;
        const callerPrimaryStoreId = callerPrimaryWorkplace?.type === 'STORE'
            ? callerPrimaryWorkplace.id
            : undefined;
        const fallbackStoreId = bodyStoreId || callerPrimaryStoreId || callerStoreId;
        const effectiveStoreIds = effectiveWorkplaceType === 'STORE'
            ? (requestedStoreIds.length ? requestedStoreIds : (fallbackStoreId ? [fallbackStoreId] : []))
            : [];
        const effectiveStoreId = effectiveStoreIds[0];
        const effectiveOfficeId = isAdmin ? bodyOfficeId : undefined;
        const effectiveWarehouseId = isAdmin ? bodyWarehouseId : undefined;

        const locationIds = effectiveWorkplaceType === 'STORE' ? effectiveStoreIds
            : effectiveWorkplaceType === 'OFFICE' && effectiveOfficeId ? [effectiveOfficeId]
                : effectiveWorkplaceType === 'CENTRAL' && effectiveWarehouseId ? [effectiveWarehouseId]
                    : [];
        const locationId = effectiveWorkplaceType === 'STORE' ? effectiveStoreId
            : effectiveWorkplaceType === 'OFFICE' ? effectiveOfficeId : effectiveWarehouseId;
        if (locationIds.length) {
            const workplaceCaller = await requireWorkplaceCaller(req);
            assertPermission(workplaceCaller, 'action.hr.workplaces.assign');
            await Promise.all(locationIds.flatMap(id => [
                assertWorkplaceScope(workplaceCaller, effectiveWorkplaceType, id),
                assertWorkplaceExists(adminDb, workplaceKey(effectiveWorkplaceType, id)),
            ]));
        }

        if (!name || !phone || !role || !type) {
            return NextResponse.json({ error: 'Thiếu các trường bắt buộc' }, { status: 400 });
        }

        // Check phone uniqueness before creating the Firebase Auth user
        const phoneCheck = await adminDb.collection('users')
            .where('phone', '==', phone).limit(1).get();
        if (!phoneCheck.empty) {
            return NextResponse.json(
                { error: 'Số điện thoại này đã được sử dụng bởi một tài khoản khác.' },
                { status: 409 }
            );
        }

        const email = phoneToEmail(phone);
        const password = defaultPassword(phone);

        const newUser = await adminAuth.createUser({ email, password, displayName: name });
        createdAuthUid = newUser.uid;

        const initialKey = locationId ? workplaceKey(effectiveWorkplaceType, locationId) : undefined;
        const userDoc: UserDoc = {
            uid: newUser.uid,
            name,
            phone,
            role,
            type,
            isActive: true,
            createdAt: new Date().toISOString(),
            workplaceType: effectiveWorkplaceType,
            workplaceSchemaVersion: 2,
            ...(initialKey && { primaryWorkplaceKey: initialKey }),
            ...(effectiveStoreId && { storeId: effectiveStoreId }),
            ...(effectiveOfficeId && { officeId: effectiveOfficeId }),
            ...(effectiveWarehouseId && { warehouseId: effectiveWarehouseId }),
            ...(dob && { dob }),
            ...(jobTitle && { jobTitle }),
            ...(realEmail && { email: realEmail }),
            ...(idCard && { idCard }),
            ...(bankAccount && { bankAccount }),
            ...(education && { education }),
            ...(contractNumber && { contractNumber }),
            ...(gender && { gender }),
            ...(permanentAddress && { permanentAddress }),
            ...(idCardFrontPhoto && { idCardFrontPhoto }),
            ...(idCardBackPhoto && { idCardBackPhoto }),
            ...(probationStartDate && { probationStartDate }),
            ...(officialStartDate && { officialStartDate }),
            ...(resignationDate && { resignationDate }),
            ...(isAdmin && canManageHR !== undefined && { canManageHR: Boolean(canManageHR) }),
            ...(customRoleId && { customRoleId }),
        };

        const batch = adminDb.batch();
        batch.set(adminDb.collection('users').doc(newUser.uid), userDoc);
        if (locationIds.length && initialKey) {
            const now = new Date().toISOString();
            for (const assignedLocationId of locationIds) {
                const key = workplaceKey(effectiveWorkplaceType, assignedLocationId);
                const headId = currentMembershipId(newUser.uid, key);
                const membershipId = `${headId}__v1`;
                const membership: WorkplaceMembership = {
                    id: membershipId, userId: newUser.uid,
                    workplace: { type: effectiveWorkplaceType as WorkplaceType, id: assignedLocationId, key },
                    status: 'ACTIVE', effectiveFrom: now, effectiveTo: null, version: 2,
                    createdAt: now, createdBy: decoded.uid, updatedAt: now, updatedBy: decoded.uid,
                };
                batch.set(adminDb.collection('workplace_memberships').doc(membershipId), membership);
                batch.set(adminDb.collection('workplace_membership_heads').doc(headId), {
                    userId: newUser.uid, workplaceKey: key, activeMembershipId: membershipId, updatedAt: now,
                });
            }
        }
        await batch.commit();
        createdAuthUid = null;

        return NextResponse.json({ uid: newUser.uid, message: 'Người dùng đã được tạo thành công' });
    } catch (err: unknown) {
        if (createdAuthUid) {
            try { await getAdminAuth().deleteUser(createdAuthUid); } catch { /* best-effort rollback */ }
        }
        const accessResponse = workplaceAccessResponse(err);
        if (accessResponse) return accessResponse;
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

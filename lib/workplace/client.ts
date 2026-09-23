import type { User } from 'firebase/auth';
import type { UserDoc } from '@/types';

export async function fetchStoreMembers(user: User, storeId: string): Promise<UserDoc[]> {
    const token = await user.getIdToken();
    const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/members`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Không thể tải danh sách nhân viên.');
    return Array.isArray(data) ? data : [];
}

export async function fetchWorkplaceMembers(user: User, type: 'STORE' | 'OFFICE' | 'CENTRAL', id: string): Promise<UserDoc[]> {
    const token = await user.getIdToken(); const key = `${type}:${encodeURIComponent(id)}`;
    const response = await fetch(`/api/workplaces/${encodeURIComponent(key)}/members`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Không thể tải danh sách nhân viên.');
    return Array.isArray(data) ? data : [];
}

export async function fetchAllEmployees(user: User): Promise<UserDoc[]> {
    const token = await user.getIdToken();
    const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Không thể tải danh sách nhân viên.');
    return Array.isArray(data) ? data : [];
}

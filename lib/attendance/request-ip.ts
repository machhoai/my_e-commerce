import 'server-only';

import type { NextRequest } from 'next/server';
import { normalizeIpAddress } from '@/lib/attendance/policy';

function firstForwardedAddress(value: string | null): string | null {
    if (!value) return null;
    return value.split(',').map((item) => item.trim()).find(Boolean) ?? null;
}

/**
 * Resolve the client IP only from a header controlled by the deployment proxy.
 * Self-hosted production must set ATTENDANCE_TRUSTED_IP_HEADER explicitly.
 */
export function getTrustedAttendanceRequestIp(req: NextRequest): string | null {
    const configuredHeader = process.env.ATTENDANCE_TRUSTED_IP_HEADER?.trim().toLowerCase();
    if (configuredHeader) {
        return normalizeIpAddress(firstForwardedAddress(req.headers.get(configuredHeader)));
    }

    if (process.env.VERCEL) {
        return normalizeIpAddress(
            firstForwardedAddress(
                req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-forwarded-for'),
            ),
        );
    }

    if (req.headers.get('cf-ray')) {
        return normalizeIpAddress(req.headers.get('cf-connecting-ip'));
    }

    if (process.env.NODE_ENV !== 'production') {
        return normalizeIpAddress(
            firstForwardedAddress(
                req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
            ),
        );
    }

    return null;
}

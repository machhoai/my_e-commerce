import { isIP } from 'node:net';
// @ts-expect-error Explicit extension supports the Node strip-types test runner.
export { distanceInMeters, evaluateGpsVerification } from './gps.ts';
import type { AttendanceVerificationDecision } from './gps.ts';
export type { AttendanceLocationCapture, AttendanceGpsTarget, AttendanceVerificationReason, AttendanceVerificationDecision } from './gps.ts';

export function normalizeIpAddress(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = value.trim().replace(/^"|"$/g, '').replace(/^::ffff:/i, '').toLowerCase();
    const version = isIP(normalized);
    if (version === 4) return normalized;
    if (version === 6) {
        return new URL(`http://[${normalized}]/`).hostname.slice(1, -1);
    }
    return null;
}

export function evaluateIpVerification(
    requestIp: string | null | undefined,
    allowedIpAddresses: string[],
): AttendanceVerificationDecision {
    const normalizedRequestIp = normalizeIpAddress(requestIp);
    if (!normalizedRequestIp) {
        return {
            accepted: false,
            reason: 'IP_REQUIRED',
            distanceM: null,
            matchedIpAddress: null,
        };
    }

    const allowed = new Set(
        allowedIpAddresses
            .map(normalizeIpAddress)
            .filter((value): value is string => Boolean(value)),
    );
    const accepted = allowed.has(normalizedRequestIp);
    return {
        accepted,
        reason: accepted ? null : 'INVALID_IP',
        distanceM: null,
        matchedIpAddress: accepted ? normalizedRequestIp : null,
    };
}

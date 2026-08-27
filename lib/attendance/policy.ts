import { isIP } from 'node:net';

export interface AttendanceLocationCapture {
    latitude: number;
    longitude: number;
    accuracyM: number;
    capturedAt: string;
}

export interface AttendanceGpsTarget {
    latitude: number;
    longitude: number;
    radiusM: number;
    maxAccuracyM: number;
    maxAgeSeconds: number;
}

export type AttendanceVerificationReason =
    | 'LOCATION_REQUIRED'
    | 'GPS_ACCURACY_LOW'
    | 'GPS_STALE'
    | 'OUTSIDE_GEOFENCE'
    | 'IP_REQUIRED'
    | 'INVALID_IP';

export interface AttendanceVerificationDecision {
    accepted: boolean;
    reason: AttendanceVerificationReason | null;
    distanceM: number | null;
    matchedIpAddress: string | null;
}

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (value: number) => (value * Math.PI) / 180;

export function distanceInMeters(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
): number {
    const latitudeDelta = toRadians(to.latitude - from.latitude);
    const longitudeDelta = toRadians(to.longitude - from.longitude);
    const fromLatitude = toRadians(from.latitude);
    const toLatitude = toRadians(to.latitude);
    const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(fromLatitude) *
            Math.cos(toLatitude) *
            Math.sin(longitudeDelta / 2) ** 2;

    return (
        2 *
        EARTH_RADIUS_M *
        Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
}

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

export function evaluateGpsVerification(
    location: AttendanceLocationCapture | null | undefined,
    target: AttendanceGpsTarget,
    now = new Date(),
): AttendanceVerificationDecision {
    if (!location) {
        return {
            accepted: false,
            reason: 'LOCATION_REQUIRED',
            distanceM: null,
            matchedIpAddress: null,
        };
    }

    if (
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude) ||
        location.latitude < -90 ||
        location.latitude > 90 ||
        location.longitude < -180 ||
        location.longitude > 180
    ) {
        return {
            accepted: false,
            reason: 'LOCATION_REQUIRED',
            distanceM: null,
            matchedIpAddress: null,
        };
    }

    if (
        !Number.isFinite(location.accuracyM) ||
        location.accuracyM < 0 ||
        location.accuracyM > target.maxAccuracyM
    ) {
        return {
            accepted: false,
            reason: 'GPS_ACCURACY_LOW',
            distanceM: null,
            matchedIpAddress: null,
        };
    }

    const capturedAt = new Date(location.capturedAt);
    if (
        Number.isNaN(capturedAt.getTime()) ||
        Math.abs(now.getTime() - capturedAt.getTime()) > target.maxAgeSeconds * 1_000
    ) {
        return {
            accepted: false,
            reason: 'GPS_STALE',
            distanceM: null,
            matchedIpAddress: null,
        };
    }

    const distanceM = distanceInMeters(location, target);
    const accepted = distanceM <= target.radiusM;
    return {
        accepted,
        reason: accepted ? null : 'OUTSIDE_GEOFENCE',
        distanceM,
        matchedIpAddress: null,
    };
}

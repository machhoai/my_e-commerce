/**
 * ZKTeco Biometric Device — Data Exploration API
 * ================================================
 * Diagnostic endpoint for raw data extraction from ZKTeco attendance device.
 *
 * Usage:
 *   GET /api/zkteco/explore?action=info    → Device info, name, time
 *   GET /api/zkteco/explore?action=users   → All registered users (raw)
 *   GET /api/zkteco/explore?action=logs    → Last 100 attendance logs
 *   GET /api/zkteco/explore?action=all     → Everything above combined
 *
 * CRITICAL NOTES:
 * - The physical device only accepts ONE socket at a time.
 * - If the legacy office software holds the socket, this will timeout.
 * - The `finally` block ALWAYS disconnects to prevent device freeze.
 */

import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime — TCP sockets are NOT available in Edge
export const runtime = 'nodejs';

// Prevent Next.js from caching this diagnostic route
export const dynamic = 'force-dynamic';

// ─── Device Configuration ───────────────────────────────────────────────────
const DEVICE_HOST = process.env.ZKTECO_HOST || 'bduck.fortiddns.com';
const DEVICE_PORT = parseInt(process.env.ZKTECO_PORT || '4370', 10);
const CONNECTION_TIMEOUT_MS = 8000; // 8s — generous for NAT traversal
const INACTIVITY_TIMEOUT_MS = 5000; // 5s — per-command inactivity limit

type ActionType = 'info' | 'users' | 'logs' | 'all';

const VALID_ACTIONS: ActionType[] = ['info', 'users', 'logs', 'all'];

// ─── Timeout utility ────────────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: "${label}" did not complete within ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ─── Main GET handler ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = (searchParams.get('action') || 'info') as ActionType;

  // Validate action parameter
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      {
        error: 'Invalid action parameter',
        message: `Valid actions: ${VALID_ACTIONS.join(', ')}`,
        received: action,
      },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let device: any = null;

  try {
    // Dynamic import — zkteco-js is a CommonJS module
    const ZktecoModule = await import('zkteco-js');
    const Zkteco = ZktecoModule.default || ZktecoModule;

    // Constructor: new Zkteco(ip, port, timeout, inactivityTimeout)
    device = new Zkteco(DEVICE_HOST, DEVICE_PORT, CONNECTION_TIMEOUT_MS, INACTIVITY_TIMEOUT_MS);

    // ── Connect with strict timeout ──────────────────────────────────────
    await withTimeout(
      device.createSocket(),
      CONNECTION_TIMEOUT_MS,
      `TCP connect to ${DEVICE_HOST}:${DEVICE_PORT}`
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {
      _meta: {
        host: DEVICE_HOST,
        port: DEVICE_PORT,
        action,
        queriedAt: new Date().toISOString(),
      },
    };

    // ── Action: info ─────────────────────────────────────────────────────
    if (action === 'info' || action === 'all') {
      const [info, deviceName, deviceTime, vendor, platform, os, version, serialNo, mac, pin, ssr, faceOn, attendanceSize] =
        await Promise.allSettled([
          withTimeout(device.getInfo(), INACTIVITY_TIMEOUT_MS, 'getInfo'),
          withTimeout(device.getDeviceName(), INACTIVITY_TIMEOUT_MS, 'getDeviceName'),
          withTimeout(device.getTime(), INACTIVITY_TIMEOUT_MS, 'getTime'),
          withTimeout(device.getVendor(), INACTIVITY_TIMEOUT_MS, 'getVendor'),
          withTimeout(device.getPlatform(), INACTIVITY_TIMEOUT_MS, 'getPlatform'),
          withTimeout(device.getOS(), INACTIVITY_TIMEOUT_MS, 'getOS'),
          withTimeout(device.getDeviceVersion(), INACTIVITY_TIMEOUT_MS, 'getDeviceVersion'),
          withTimeout(device.getSerialNumber?.() ?? Promise.resolve('N/A'), INACTIVITY_TIMEOUT_MS, 'getSerialNumber'),
          withTimeout(device.getMacAddress(), INACTIVITY_TIMEOUT_MS, 'getMacAddress'),
          withTimeout(device.getPIN(), INACTIVITY_TIMEOUT_MS, 'getPIN'),
          withTimeout(device.getSSR(), INACTIVITY_TIMEOUT_MS, 'getSSR'),
          withTimeout(device.getFaceOn(), INACTIVITY_TIMEOUT_MS, 'getFaceOn'),
          withTimeout(device.getAttendanceSize(), INACTIVITY_TIMEOUT_MS, 'getAttendanceSize'),
        ]);

      result.info = {
        general: info.status === 'fulfilled' ? info.value : { _error: (info as PromiseRejectedResult).reason?.message },
        deviceName: deviceName.status === 'fulfilled' ? deviceName.value : { _error: (deviceName as PromiseRejectedResult).reason?.message },
        deviceTime: deviceTime.status === 'fulfilled' ? deviceTime.value : { _error: (deviceTime as PromiseRejectedResult).reason?.message },
        vendor: vendor.status === 'fulfilled' ? vendor.value : { _error: (vendor as PromiseRejectedResult).reason?.message },
        platform: platform.status === 'fulfilled' ? platform.value : { _error: (platform as PromiseRejectedResult).reason?.message },
        os: os.status === 'fulfilled' ? os.value : { _error: (os as PromiseRejectedResult).reason?.message },
        firmwareVersion: version.status === 'fulfilled' ? version.value : { _error: (version as PromiseRejectedResult).reason?.message },
        serialNumber: serialNo.status === 'fulfilled' ? serialNo.value : { _error: (serialNo as PromiseRejectedResult).reason?.message },
        macAddress: mac.status === 'fulfilled' ? mac.value : { _error: (mac as PromiseRejectedResult).reason?.message },
        pin: pin.status === 'fulfilled' ? pin.value : { _error: (pin as PromiseRejectedResult).reason?.message },
        ssr: ssr.status === 'fulfilled' ? ssr.value : { _error: (ssr as PromiseRejectedResult).reason?.message },
        faceOn: faceOn.status === 'fulfilled' ? faceOn.value : { _error: (faceOn as PromiseRejectedResult).reason?.message },
        attendanceSize: attendanceSize.status === 'fulfilled' ? attendanceSize.value : { _error: (attendanceSize as PromiseRejectedResult).reason?.message },
      };
    }

    // ── Action: users ────────────────────────────────────────────────────
    if (action === 'users' || action === 'all') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usersResult: any = await withTimeout(
        device.getUsers(),
        INACTIVITY_TIMEOUT_MS,
        'getUsers'
      );

      const usersArray = Array.isArray(usersResult?.data) ? usersResult.data : usersResult;

      result.users = {
        totalCount: Array.isArray(usersArray) ? usersArray.length : 'unknown',
        // Show first 50 for exploration, full raw structure
        sample: Array.isArray(usersArray) ? usersArray.slice(0, 50) : usersArray,
        _rawKeys: Array.isArray(usersArray) && usersArray.length > 0
          ? Object.keys(usersArray[0])
          : [],
        _note: 'Showing first 50 users. Full data available on device.',
      };
    }

    // ── Action: logs (attendance) ────────────────────────────────────────
    if (action === 'logs' || action === 'all') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logsResult: any = await withTimeout(
        device.getAttendances(),
        INACTIVITY_TIMEOUT_MS * 2, // Logs can be large — allow 10s
        'getAttendances'
      );

      const logsArray = Array.isArray(logsResult?.data) ? logsResult.data : logsResult;

      result.logs = {
        totalCount: Array.isArray(logsArray) ? logsArray.length : 'unknown',
        // Return LAST 100 records (most recent) to avoid payload overload
        recentRecords: Array.isArray(logsArray) ? logsArray.slice(-100) : logsArray,
        _rawKeys: Array.isArray(logsArray) && logsArray.length > 0
          ? Object.keys(logsArray[0])
          : [],
        _note: 'Showing last 100 attendance records (most recent). Total count shown above.',
      };
    }

    return NextResponse.json(result, { status: 200 });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    // Classify the error for the consumer
    let errorType = 'UNKNOWN';
    let httpStatus = 500;
    const msg = error.message || '';

    if (msg.includes('ECONNREFUSED')) {
      errorType = 'DEVICE_BUSY';
      httpStatus = 503;
    } else if (msg.includes('ETIMEDOUT') || msg.includes('Timeout')) {
      errorType = 'DEVICE_TIMEOUT';
      httpStatus = 504;
    } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      errorType = 'DNS_RESOLUTION_FAILED';
      httpStatus = 502;
    } else if (msg.includes('EHOSTUNREACH')) {
      errorType = 'HOST_UNREACHABLE';
      httpStatus = 502;
    } else if (msg.includes('ECONNRESET')) {
      errorType = 'CONNECTION_RESET';
      httpStatus = 502;
    }

    console.error(`[ZKTeco Explore] ${errorType}:`, msg);

    return NextResponse.json(
      {
        error: 'Device communication failed',
        errorType,
        details: msg,
        troubleshooting: {
          DEVICE_BUSY: 'Another application (legacy software) is holding the socket. Close it and retry.',
          DEVICE_TIMEOUT: 'Device did not respond in time. Check if the DDNS is reachable and port 4370 is forwarded.',
          DNS_RESOLUTION_FAILED: `Cannot resolve hostname "${DEVICE_HOST}". Check DDNS configuration.`,
          HOST_UNREACHABLE: 'Network path to device is blocked. Check firewall/NAT rules.',
          CONNECTION_RESET: 'Device forcibly closed the connection. It may have been restarted.',
          UNKNOWN: 'Unexpected error. Check server logs for stack trace.',
        }[errorType],
        _meta: {
          host: DEVICE_HOST,
          port: DEVICE_PORT,
          attemptedAt: new Date().toISOString(),
        },
      },
      { status: httpStatus }
    );

  } finally {
    // ═══════════════════════════════════════════════════════════════════════
    // CRITICAL: Always release the socket. The physical device will FREEZE
    // if we don't disconnect, blocking the legacy office software too.
    // ═══════════════════════════════════════════════════════════════════════
    if (device) {
      try {
        await device.disconnect();
        console.log('[ZKTeco Explore] Socket disconnected cleanly.');
      } catch (disconnectErr) {
        // Swallow disconnect errors — the socket may already be dead
        console.warn('[ZKTeco Explore] Disconnect error (non-fatal):', disconnectErr);
      }
    }
  }
}

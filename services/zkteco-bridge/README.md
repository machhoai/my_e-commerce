# ZKTeco Bridge — Python Microservice

Hardware bridge between the **B.Duck Cityfuns** Next.js ERP and a physical ZKTeco biometric attendance device.

## Why a separate service?

The ZKTeco device communicates over raw TCP sockets using a proprietary binary protocol. Node.js libraries (`zkteco-js`) failed to parse packets from our Face ID model. The Python `pyzk` library handles this reliably.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the server (port 8001)
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

The server will be available at **http://localhost:8001**.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/api/zkteco/users` | All registered users |
| `GET` | `/api/zkteco/logs?limit=500` | Attendance records (most recent first) |

## Calling from Next.js

```typescript
// In a Next.js API route or Server Component
const res = await fetch('http://localhost:8001/api/zkteco/users');
const { data, totalCount } = await res.json();
```

## Device Safety

> **⚠️ The physical device only accepts ONE TCP socket at a time.**

The code follows a strict safety protocol:

1. **Connect** → `zk.connect()`
2. **Lock device UI** → `conn.disable_device()` (prevents user interaction during transfer)
3. **Fetch data** → `conn.get_users()` / `conn.get_attendance()`
4. **Unlock device UI** → `conn.enable_device()`
5. **Disconnect** → `conn.disconnect()` (in `finally` block — **always runs**)

If the socket is not released, the device **freezes** and requires a physical reboot.

## Configuration

The bridge no longer requires editing source code. For one device, configure:

```bash
ZK_API_KEY=replace-with-a-strong-secret
ZK_DEVICE_ID=store-01-zk
ZK_DEVICE_HOST=113.171.86.171
ZK_DEVICE_PORT=4370
ZK_DEVICE_TIMEOUT=15
```

One bridge can also serve multiple devices. `device_id` is supplied by the ERP
as a query parameter and must match `attendance_devices/{deviceId}`:

```bash
ZK_DEVICES_JSON=[{"device_id":"store-01-zk","host":"192.0.2.10","port":4370,"password":0},{"device_id":"store-02-zk","host":"192.0.2.11","port":4370,"password":0}]
```

Keep `ZK_API_KEY` in the bridge and ERP server environments only. Do not store it
in Firestore. The ERP uses `ZKTECO_API_KEY` for the same value. The scheduled
sync route additionally requires `CRON_SECRET` and runs every five minutes on
Vercel plans that support sub-daily cron schedules.

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

Edit the constants at the top of `main.py`:

```python
DEVICE_IP = "bduck.fortiddns.com"
DEVICE_PORT = 4370
DEVICE_TIMEOUT = 15
```

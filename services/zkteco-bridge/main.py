"""
ZKTeco Bridge — Python Microservice
=====================================
Hardware bridge between B.Duck Cityfuns Next.js ERP and a physical
ZKTeco biometric attendance device behind NAT.

Endpoints:
  GET /api/zkteco/users  → All registered users (JSON)
  GET /api/zkteco/logs   → All attendance records (JSON)

Start:
  uvicorn main:app --host 0.0.0.0 --port 8001 --reload
  — or —
  python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

from datetime import datetime
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from zk import ZK  # type: ignore[import-untyped]

# ─── Device Configuration ───────────────────────────────────────────────────
DEVICE_IP = "bduck.fortiddns.com"
DEVICE_PORT = 4370
DEVICE_TIMEOUT = 15  # seconds — generous for NAT/DDNS traversal

# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="ZKTeco Bridge API",
    description="Hardware bridge for B.Duck Cityfuns biometric attendance device",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "zkteco-bridge",
        "status": "running",
        "device": f"{DEVICE_IP}:{DEVICE_PORT}",
    }


# ─── GET /api/zkteco/users ──────────────────────────────────────────────────
@app.get("/api/zkteco/users")
def get_users():
    """
    Connect to the ZKTeco device and fetch all registered users.
    pyzk returns custom User objects — we manually serialize them to dicts.
    """
    conn = None
    try:
        zk = ZK(
            DEVICE_IP,
            port=DEVICE_PORT,
            timeout=DEVICE_TIMEOUT,
            password=0,
            force_udp=False,
            ommit_ping=False,
        )
        conn = zk.connect()
        conn.disable_device()  # Lock the physical UI during data transfer

        raw_users = conn.get_users()

        conn.enable_device()  # Unlock the physical UI

        # ── Manual serialization: pyzk User → dict ───────────────────────
        users = []
        for u in raw_users:
            users.append({
                "uid": u.uid,
                "user_id": u.user_id,
                "name": u.name,
                "privilege": u.privilege,
                "password": u.password,
                "group_id": u.group_id,
            })

        return {
            "totalCount": len(users),
            "data": users,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # ═══════════════════════════════════════════════════════════════════
        # CRITICAL: Always release the TCP socket. The physical device
        # only accepts ONE connection — failing to disconnect will FREEZE
        # the device and block the legacy office software.
        # ═══════════════════════════════════════════════════════════════════
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


# ─── GET /api/zkteco/logs ───────────────────────────────────────────────────
@app.get("/api/zkteco/logs")
def get_attendance_logs(
    limit: int = Query(
        default=500,
        ge=1,
        le=50000,
        description="Max records to return (most recent first)",
    ),
):
    """
    Connect to the ZKTeco device and fetch attendance records.
    pyzk returns custom Attendance objects — we manually serialize them to dicts.
    """
    conn = None
    try:
        zk = ZK(
            DEVICE_IP,
            port=DEVICE_PORT,
            timeout=DEVICE_TIMEOUT,
            password=0,
            force_udp=False,
            ommit_ping=False,
        )
        conn = zk.connect()
        conn.disable_device()

        raw_attendances = conn.get_attendance()

        conn.enable_device()

        # ── Manual serialization: pyzk Attendance → dict ─────────────────
        logs = []
        for a in raw_attendances:
            logs.append({
                "uid": a.uid,
                "user_id": a.user_id,
                "timestamp": (
                    a.timestamp.isoformat()
                    if isinstance(a.timestamp, datetime)
                    else str(a.timestamp)
                ),
                "status": a.status,
                "punch": a.punch,
            })

        # Sort descending (most recent first) and apply limit
        logs.sort(key=lambda x: x["timestamp"], reverse=True)
        total = len(logs)
        logs = logs[:limit]

        return {
            "totalCount": total,
            "returnedCount": len(logs),
            "data": logs,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


# ─── Direct Run ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

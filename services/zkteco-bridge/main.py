"""
ZKTeco Bridge Microservice
Exposes all major pyzk capabilities as RESTful API endpoints.

Security: All routes are protected by an X-API-Key header.
Hardware: Every endpoint follows the connect → disable → operate → enable → disconnect lifecycle.
"""

import os
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field
from zk import ZK

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEVICE_HOST = "bduck.fortiddns.com"
DEVICE_PORT = 4370
DEVICE_TIMEOUT = 15

# Load API key from env; fall back to a safe default for local dev only.
API_KEY = os.getenv("ZK_API_KEY", "change-me-in-production")

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ZKTeco Bridge API",
    description="RESTful wrapper around the pyzk library for ZKTeco biometric devices.",
    version="2.0.0",
)

# ---------------------------------------------------------------------------
# Security Dependency
# ---------------------------------------------------------------------------


def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> str:
    """Validate the X-API-Key header on every request."""
    if x_api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
    return x_api_key


# ---------------------------------------------------------------------------
# Helper: ZK connection factory
# ---------------------------------------------------------------------------


def _get_zk() -> ZK:
    """Return a configured (but not yet connected) ZK instance."""
    return ZK(
        DEVICE_HOST,
        port=DEVICE_PORT,
        timeout=DEVICE_TIMEOUT,
        password=0,
        force_udp=False,
        ommit_ping=True,  # MANDATORY for cloud/NAT deployments
    )


# ---------------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------------


class UserCreateRequest(BaseModel):
    uid: int = Field(..., description="Internal numeric user ID (1-based slot on device)")
    name: str = Field(..., max_length=24, description="Display name on device")
    privilege: int = Field(0, description="0=User, 14=Admin")
    password: str = Field("", max_length=8, description="PIN password (optional)")
    group_id: str = Field("", description="Group ID (optional)")
    user_id: str = Field(..., max_length=9, description="Employee / card number")


class SetTimeRequest(BaseModel):
    datetime_str: Optional[str] = Field(
        None,
        description="ISO-8601 datetime string to set on device. Defaults to current server time if omitted.",
    )


class VoiceRequest(BaseModel):
    index: int = Field(0, ge=0, le=10, description="Voice clip index (0-10)")


# ---------------------------------------------------------------------------
# 1. DEVICE INFO
# ---------------------------------------------------------------------------


@app.get(
    "/api/zkteco/info",
    tags=["Device Info"],
    summary="Get device firmware, serial, time, and capacity info",
)
def get_device_info(_: str = Depends(verify_api_key)):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        firmware = conn.get_firmware_version()
        mac = conn.get_mac()
        serial = conn.get_serialnumber()
        device_name = conn.get_device_name()
        device_time = conn.get_time()
        conn.read_sizes()

        result = {
            "firmware_version": firmware,
            "mac_address": mac,
            "serial_number": serial,
            "device_name": device_name,
            "device_time": str(device_time),
            "capacity": {
                "users": conn.users,
                "fingers": conn.fingers,
                "records": conn.records,
                "dummy": conn.dummy,
                "cards": conn.cards,
                "fingers_cap": conn.fingers_cap,
                "users_cap": conn.users_cap,
                "rec_cap": conn.rec_cap,
                "faces_cap": conn.faces_cap,
                "faces": conn.faces,
                "user_count": conn.user_count,
                "fp_count": conn.fp_count,
                "record_count": conn.record_count,
            },
        }

        conn.enable_device()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.disconnect()


# ---------------------------------------------------------------------------
# 2. USERS
# ---------------------------------------------------------------------------


@app.get(
    "/api/zkteco/users",
    tags=["Users"],
    summary="Retrieve all enrolled users from the device",
)
def get_users(_: str = Depends(verify_api_key)):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        users = conn.get_users()
        result = [
            {
                "uid": u.uid,
                "name": u.name,
                "privilege": u.privilege,
                "password": u.password,
                "group_id": u.group_id,
                "user_id": u.user_id,
            }
            for u in users
        ]

        conn.enable_device()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.disconnect()


@app.post(
    "/api/zkteco/users",
    tags=["Users"],
    summary="Create or update a user on the device",
    status_code=201,
)
def create_or_update_user(
    body: UserCreateRequest,
    _: str = Depends(verify_api_key),
):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        conn.set_user(
            uid=body.uid,
            name=body.name,
            privilege=body.privilege,
            password=body.password,
            group_id=body.group_id,
            user_id=body.user_id,
        )

        conn.enable_device()
        return {"message": f"User uid={body.uid} saved successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.disconnect()


@app.delete(
    "/api/zkteco/users/{uid}",
    tags=["Users"],
    summary="Delete a user by their internal UID",
)
def delete_user(uid: int, _: str = Depends(verify_api_key)):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        conn.delete_user(uid=uid)

        conn.enable_device()
        return {"message": f"User uid={uid} deleted successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.disconnect()


# ---------------------------------------------------------------------------
# 3. ATTENDANCE LOGS
# ---------------------------------------------------------------------------


@app.get(
    "/api/zkteco/logs",
    tags=["Attendance"],
    summary="Retrieve all attendance/punch records from the device",
)
def get_attendance_logs(_: str = Depends(verify_api_key)):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        attendances = conn.get_attendance()
        result = [
            {
                "uid": a.uid,
                "user_id": a.user_id,
                "timestamp": str(a.timestamp),
                "status": a.status,
                "punch": a.punch,
            }
            for a in attendances
        ]

        conn.enable_device()
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.disconnect()


@app.delete(
    "/api/zkteco/logs",
    tags=["Attendance"],
    summary="⚠️ Clear ALL attendance records from the device",
)
def clear_attendance_logs(_: str = Depends(verify_api_key)):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        conn.clear_attendance()

        conn.enable_device()
        return {"message": "All attendance records cleared successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.disconnect()


# ---------------------------------------------------------------------------
# 4. DEVICE CONTROL
# ---------------------------------------------------------------------------


@app.post(
    "/api/zkteco/device/restart",
    tags=["Device Control"],
    summary="⚠️ Restart the biometric device",
)
def restart_device(_: str = Depends(verify_api_key)):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        # enable_device is intentionally skipped — device is restarting
        conn.restart()

        return {"message": "Device restart command sent successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass  # Socket may already be gone after restart


@app.post(
    "/api/zkteco/device/voice",
    tags=["Device Control"],
    summary="Trigger a voice test on the device",
)
def test_voice(body: VoiceRequest = VoiceRequest(), _: str = Depends(verify_api_key)):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        conn.test_voice(index=body.index)

        conn.enable_device()
        return {"message": f"Voice index {body.index} triggered successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.disconnect()


@app.post(
    "/api/zkteco/device/time",
    tags=["Device Control"],
    summary="Sync device clock to server time (or a provided datetime)",
)
def set_device_time(body: SetTimeRequest = SetTimeRequest(), _: str = Depends(verify_api_key)):
    zk = _get_zk()
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        if body.datetime_str:
            target_time = datetime.fromisoformat(body.datetime_str)
        else:
            target_time = datetime.now()

        conn.set_time(target_time)

        conn.enable_device()
        return {
            "message": "Device time synchronized successfully.",
            "synced_time": target_time.isoformat(),
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid datetime format: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.disconnect()

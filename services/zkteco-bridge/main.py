"""
ZKTeco Bridge Microservice
Exposes all major pyzk capabilities as RESTful API endpoints.

Security: All routes are protected by an X-API-Key header.
Hardware: Every endpoint follows the connect → disable → operate → enable → disconnect lifecycle.
"""

import json
import logging
import os
import secrets
import threading
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from zk import ZK

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

LEGACY_DEVICE_ID = os.getenv("ZK_DEVICE_ID", "legacy-device")
DEVICE_HOST = os.getenv("ZK_DEVICE_HOST", "")
DEVICE_PORT = int(os.getenv("ZK_DEVICE_PORT", "4370"))
DEVICE_TIMEOUT = int(os.getenv("ZK_DEVICE_TIMEOUT", "15"))

# A missing or sample key must never authorize access to physical devices.
API_KEY = os.getenv("ZK_API_KEY", "").strip()
_DEVICE_LOCK = threading.Lock()
logger = logging.getLogger(__name__)

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


def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> str:
    """Validate the X-API-Key header on every request."""
    if not API_KEY or API_KEY == "change-me-in-production":
        raise HTTPException(status_code=503, detail="Bridge API key is not configured.")
    if not x_api_key or not secrets.compare_digest(x_api_key, API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
    return x_api_key


def exclusive_device_access(request: Request, _: str = Depends(verify_api_key)):
    """Protect the single device socket for the entire request, including cleanup."""
    if request.method not in ("GET", "HEAD") and os.getenv("ZK_ALLOW_WRITES", "true").lower() != "true":
        raise HTTPException(status_code=403, detail="Device write operations are disabled.")
    if not _DEVICE_LOCK.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Device operation already in progress.")
    try:
        yield
    finally:
        _DEVICE_LOCK.release()


router = APIRouter(dependencies=[Depends(exclusive_device_access)])


@app.get("/", include_in_schema=False)
@app.get("/healthz", include_in_schema=False)
def health():
    """Liveness only: never connect to or enumerate a device."""
    return {"status": "ok", "service": "zkteco-bridge"}


def _disconnect_safely(conn, restore_device: bool = True):
    """Restore the device even on a read failure and always release its socket."""
    if conn is None:
        return
    try:
        if restore_device:
            try:
                conn.enable_device()
            except Exception:
                logger.warning("Could not restore device UI before disconnect.")
    finally:
        try:
            conn.disconnect()
        except Exception:
            logger.warning("Device disconnect did not complete cleanly.")
            # pyzk closes its socket only after a successful CMD_EXIT response.
            # A failed command must not leave a live TCP connection behind.
            sock = getattr(conn, "_ZK__sock", None)
            if sock is not None:
                try:
                    sock.close()
                except Exception:
                    logger.warning("Could not close the device socket.")


# ---------------------------------------------------------------------------
# Helper: ZK connection factory
# ---------------------------------------------------------------------------


def _device_configs() -> dict:
    """Load a multi-device map, falling back to the legacy single-device env."""
    raw = os.getenv("ZK_DEVICES_JSON", "").strip()
    if raw:
        try:
            devices = json.loads(raw)
            return {str(device["device_id"]): device for device in devices}
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            raise RuntimeError(f"Invalid ZK_DEVICES_JSON: {exc}") from exc
    if not DEVICE_HOST:
        raise HTTPException(status_code=503, detail="Bridge device host is not configured.")
    return {
        LEGACY_DEVICE_ID: {
            "device_id": LEGACY_DEVICE_ID,
            "host": DEVICE_HOST,
            "port": DEVICE_PORT,
            "timeout": DEVICE_TIMEOUT,
            "password": int(os.getenv("ZK_DEVICE_PASSWORD", "0")),
        }
    }


def _get_zk(device_id: Optional[str] = None) -> ZK:
    """Return a configured (but not yet connected) ZK instance."""
    devices = _device_configs()
    selected_id = device_id or (next(iter(devices)) if len(devices) == 1 else None)
    if not selected_id or selected_id not in devices:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown or missing device_id. Available: {', '.join(devices.keys())}",
        )
    config = devices[selected_id]
    return ZK(
        str(config["host"]),
        port=int(config.get("port", 4370)),
        timeout=int(config.get("timeout", DEVICE_TIMEOUT)),
        password=int(config.get("password", 0)),
        force_udp=bool(config.get("force_udp", False)),
        ommit_ping=bool(config.get("ommit_ping", True)),
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


@router.get(
    "/api/zkteco/info",
    tags=["Device Info"],
    summary="Get device firmware, serial, time, and capacity info",
)
def get_device_info(device_id: Optional[str] = None, _: str = Depends(verify_api_key)):
    zk = _get_zk(device_id)
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

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _disconnect_safely(conn if conn is not None else zk, restore_device=conn is not None)


# ---------------------------------------------------------------------------
# 2. USERS
# ---------------------------------------------------------------------------


@router.get(
    "/api/zkteco/users",
    tags=["Users"],
    summary="Retrieve all enrolled users from the device",
)
def get_users(device_id: Optional[str] = None, _: str = Depends(verify_api_key)):
    zk = _get_zk(device_id)
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

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _disconnect_safely(conn if conn is not None else zk, restore_device=conn is not None)


@router.post(
    "/api/zkteco/users",
    tags=["Users"],
    summary="Create or update a user on the device",
    status_code=201,
)
def create_or_update_user(
    body: UserCreateRequest,
    device_id: Optional[str] = None,
    _: str = Depends(verify_api_key),
):
    zk = _get_zk(device_id)
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

        return {"message": f"User uid={body.uid} saved successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _disconnect_safely(conn if conn is not None else zk, restore_device=conn is not None)


@router.delete(
    "/api/zkteco/users/{uid}",
    tags=["Users"],
    summary="Delete a user by their internal UID",
)
def delete_user(uid: int, device_id: Optional[str] = None, _: str = Depends(verify_api_key)):
    zk = _get_zk(device_id)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        conn.delete_user(uid=uid)

        return {"message": f"User uid={uid} deleted successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _disconnect_safely(conn if conn is not None else zk, restore_device=conn is not None)


# ---------------------------------------------------------------------------
# 3. ATTENDANCE LOGS
# ---------------------------------------------------------------------------


@router.get(
    "/api/zkteco/logs",
    tags=["Attendance"],
    summary="Retrieve all attendance/punch records from the device",
)
def get_attendance_logs(device_id: Optional[str] = None, _: str = Depends(verify_api_key)):
    zk = _get_zk(device_id)
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

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _disconnect_safely(conn if conn is not None else zk, restore_device=conn is not None)


@router.delete(
    "/api/zkteco/logs",
    tags=["Attendance"],
    summary="⚠️ Clear ALL attendance records from the device",
)
def clear_attendance_logs(device_id: Optional[str] = None, _: str = Depends(verify_api_key)):
    zk = _get_zk(device_id)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        conn.clear_attendance()

        return {"message": "All attendance records cleared successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _disconnect_safely(conn if conn is not None else zk, restore_device=conn is not None)


# ---------------------------------------------------------------------------
# 4. DEVICE CONTROL
# ---------------------------------------------------------------------------


@router.post(
    "/api/zkteco/device/restart",
    tags=["Device Control"],
    summary="⚠️ Restart the biometric device",
)
def restart_device(device_id: Optional[str] = None, _: str = Depends(verify_api_key)):
    zk = _get_zk(device_id)
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
        _disconnect_safely(conn if conn is not None else zk, restore_device=False)


@router.post(
    "/api/zkteco/device/voice",
    tags=["Device Control"],
    summary="Trigger a voice test on the device",
)
def test_voice(
    body: VoiceRequest = VoiceRequest(),
    device_id: Optional[str] = None,
    _: str = Depends(verify_api_key),
):
    zk = _get_zk(device_id)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        conn.test_voice(index=body.index)

        return {"message": f"Voice index {body.index} triggered successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _disconnect_safely(conn if conn is not None else zk, restore_device=conn is not None)


@router.post(
    "/api/zkteco/device/time",
    tags=["Device Control"],
    summary="Sync device clock to server time (or a provided datetime)",
)
def set_device_time(
    body: SetTimeRequest = SetTimeRequest(),
    device_id: Optional[str] = None,
    _: str = Depends(verify_api_key),
):
    zk = _get_zk(device_id)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        if body.datetime_str:
            target_time = datetime.fromisoformat(body.datetime_str)
        else:
            target_time = datetime.now()

        conn.set_time(target_time)

        return {
            "message": "Device time synchronized successfully.",
            "synced_time": target_time.isoformat(),
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid datetime format: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _disconnect_safely(conn if conn is not None else zk, restore_device=conn is not None)


app.include_router(router)

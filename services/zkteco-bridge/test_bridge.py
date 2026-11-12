"""Offline ASGI tests. Every ZK client is replaced before serving requests."""
import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch


with patch.dict(os.environ, {"ZK_API_KEY": "offline-test-key", "ZK_DEVICE_HOST": "192.0.2.1", "ZK_DEVICE_ID": "test-device"}):
    spec = importlib.util.spec_from_file_location("bridge_under_test", Path(__file__).with_name("main.py"))
    bridge = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bridge)


class BridgeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.zk_patch = patch.object(bridge, "ZK")
        self.factory = self.zk_patch.start()
        self.addCleanup(self.zk_patch.stop)
        self.conn = MagicMock()
        self.conn.get_users.return_value = []
        self.conn.get_attendance.return_value = []
        self.factory.return_value.connect.return_value = self.conn

    async def request(self, path, method="GET", key="offline-test-key"):
        messages = []
        headers = [] if key is None else [(b"x-api-key", key.encode())]
        scope = {
            "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
            "method": method, "scheme": "http", "path": path,
            "raw_path": path.encode(), "query_string": b"", "root_path": "",
            "headers": headers, "server": ("test", 80), "client": ("127.0.0.1", 1),
        }

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            messages.append(message)

        await bridge.app(scope, receive, send)
        response = next(message for message in messages if message["type"] == "http.response.start")
        body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
        return response["status"], json.loads(body)

    async def test_health_does_not_access_hardware_even_without_key(self):
        with patch.object(bridge, "API_KEY", ""):
            status, body = await self.request("/healthz", key=None)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")
        self.factory.assert_not_called()

    async def test_unauthorized_requests_never_access_hardware(self):
        for key in (None, "wrong-key"):
            status, _ = await self.request("/api/zkteco/users", key=key)
            self.assertEqual(status, 401)
        self.factory.assert_not_called()

    async def test_unconfigured_or_sample_key_fails_closed(self):
        for value in ("", "change-me-in-production"):
            with patch.object(bridge, "API_KEY", value):
                status, _ = await self.request("/api/zkteco/users", key=value)
                self.assertEqual(status, 503)
        self.factory.assert_not_called()

    async def test_busy_device_is_rejected_before_opening_socket(self):
        bridge._DEVICE_LOCK.acquire()
        try:
            status, _ = await self.request("/api/zkteco/logs")
            self.assertEqual(status, 409)
            self.factory.assert_not_called()
        finally:
            bridge._DEVICE_LOCK.release()

    async def test_failed_read_restores_ui_disconnects_and_releases_lock(self):
        self.conn.get_users.side_effect = RuntimeError("Simulated read failure")
        status, _ = await self.request("/api/zkteco/users")
        self.assertEqual(status, 500)
        self.conn.enable_device.assert_called_once()
        self.conn.disconnect.assert_called_once()
        self.assertFalse(bridge._DEVICE_LOCK.locked())
        self.conn.get_users.side_effect = None
        status, body = await self.request("/api/zkteco/users")
        self.assertEqual(status, 200)
        self.assertEqual(body, [])

    async def test_disconnect_still_runs_if_restoring_ui_fails(self):
        self.conn.enable_device.side_effect = RuntimeError("Simulated restore failure")
        status, _ = await self.request("/api/zkteco/logs")
        self.assertEqual(status, 200)
        self.conn.disconnect.assert_called_once()
        self.assertFalse(bridge._DEVICE_LOCK.locked())

    async def test_trial_write_operations_never_touch_hardware(self):
        with patch.dict(os.environ, {"ZK_ALLOW_WRITES": "false"}):
            for path, method in (("/api/zkteco/device/restart", "POST"), ("/api/zkteco/logs", "DELETE")):
                status, _ = await self.request(path, method=method)
                self.assertEqual(status, 403)
        self.factory.assert_not_called()

    async def test_failed_exit_command_closes_underlying_socket(self):
        self.conn.disconnect.side_effect = RuntimeError("Simulated exit failure")
        status, _ = await self.request("/api/zkteco/logs")
        self.assertEqual(status, 200)
        self.conn._ZK__sock.close.assert_called_once()
        self.assertFalse(bridge._DEVICE_LOCK.locked())

    async def test_failed_connect_closes_socket_without_enabling_device(self):
        client = self.factory.return_value
        client.connect.side_effect = RuntimeError("Simulated connect failure")
        client.disconnect.side_effect = RuntimeError("Not connected")
        status, _ = await self.request("/api/zkteco/users")
        self.assertEqual(status, 500)
        client.enable_device.assert_not_called()
        client._ZK__sock.close.assert_called_once()
        self.assertFalse(bridge._DEVICE_LOCK.locked())


if __name__ == "__main__":
    unittest.main()

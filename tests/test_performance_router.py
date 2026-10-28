import unittest
from unittest.mock import patch

import oracledb
from fastapi import HTTPException

from app.modules.performance import router


class PerformanceRouterTests(unittest.TestCase):
    def test_oracle_errors_become_service_unavailable(self):
        with self.assertLogs(router.logger, level="ERROR"):
            with self.assertRaises(HTTPException) as raised:
                router._run(
                    lambda: (_ for _ in ()).throw(oracledb.DatabaseError("failure")),
                    "las sesiones activas",
                )

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("las sesiones activas", raised.exception.detail)
        self.assertIn("Oracle", raised.exception.detail)

    def test_configuration_errors_become_service_unavailable(self):
        with self.assertLogs(router.logger, level="ERROR"):
            with self.assertRaises(HTTPException) as raised:
                router._run(
                    lambda: (_ for _ in ()).throw(ValueError("DB_USER no configurado")),
                    "las sesiones activas",
                )

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("DB_USER no configurado", raised.exception.detail)

    def test_missing_sql_file_becomes_service_unavailable(self):
        with self.assertLogs(router.logger, level="ERROR"):
            with self.assertRaises(HTTPException) as raised:
                router._run(
                    lambda: (_ for _ in ()).throw(OSError("query file is missing")),
                    "las sesiones activas",
                )

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("query file is missing", raised.exception.detail)

    def test_oracle_endpoint_returns_empty_list(self):
        with patch(
            "app.modules.performance.service.get_blocked_sessions_data",
            return_value=[],
        ):
            self.assertEqual(router.read_blocked_sessions(), [])


if __name__ == "__main__":
    unittest.main()

import json
import os
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


BASE_URL = os.getenv("DBA_MONITOR_TEST_BASE_URL")


@unittest.skipUnless(
    BASE_URL,
    "Set DBA_MONITOR_TEST_BASE_URL to run HTTP checks against a live app.",
)
class PerformanceHttpTests(unittest.TestCase):
    endpoints = {
        "/api/performance/sessions": {
            "sid", "serial_number", "username", "status", "machine", "program", "logon_time",
        },
        "/api/performance/blocked-sessions": {
            "sid", "serial_number", "blocking_instance", "blocking_session",
            "blocking_session_status", "event", "seconds_in_wait",
        },
        "/api/performance/top-sql": {
            "sql_id", "sql_text", "executions", "cpu_time_seconds",
            "elapsed_time_seconds", "buffer_gets", "disk_reads",
        },
        "/api/performance/query-times": {
            "sql_id", "sql_text", "executions",
            "total_elapsed_seconds", "avg_elapsed_seconds",
        },
        "/api/performance/resource-usage": {
            "sid", "username", "cpu_seconds", "pga_used_mb",
        },
    }

    def test_dashboard_and_performance_endpoints_over_http(self):
        with urlopen(f"{BASE_URL}/rendimiento", timeout=15) as response:
            html = response.read().decode("utf-8")
            self.assertEqual(response.status, 200)
            for label in (
                "Sesiones activas",
                "Sesiones bloqueadas",
                "SQL de mayor consumo de CPU",
                "Tiempos de ejecución SQL",
                "CPU y memoria por sesión",
            ):
                self.assertIn(label, html)

        with urlopen(f"{BASE_URL}/static/js/performance.js", timeout=15) as response:
            frontend = response.read().decode("utf-8")
            self.assertEqual(response.status, 200)
            for endpoint in self.endpoints:
                self.assertIn(endpoint, frontend)

        for endpoint, expected_keys in self.endpoints.items():
            with self.subTest(endpoint=endpoint):
                try:
                    with urlopen(f"{BASE_URL}{endpoint}", timeout=30) as response:
                        self.assertEqual(response.status, 200)
                        rows = json.loads(response.read())
                except HTTPError as error:
                    self.fail(f"{endpoint} returned HTTP {error.code}: {error.read()!r}")
                except URLError as error:
                    self.fail(f"Cannot reach {endpoint}: {error}")

                self.assertIsInstance(rows, list)
                for row in rows:
                    self.assertTrue(expected_keys.issubset(row))

                if endpoint.endswith("/top-sql"):
                    self.assertLessEqual(len(rows), 10)
                    cpu_times = [row["cpu_time_seconds"] for row in rows]
                    self.assertEqual(cpu_times, sorted(cpu_times, reverse=True))
                    for row in rows:
                        self.assertGreater(row["executions"], 0)
                        self.assertGreaterEqual(row["cpu_time_seconds"], 0)
                elif endpoint.endswith("/query-times"):
                    self.assertLessEqual(len(rows), 10)
                    elapsed_times = [row["total_elapsed_seconds"] for row in rows]
                    self.assertEqual(elapsed_times, sorted(elapsed_times, reverse=True))
                    for row in rows:
                        self.assertGreater(row["executions"], 0)
                        self.assertGreaterEqual(row["total_elapsed_seconds"], 0)
                        self.assertGreaterEqual(row["avg_elapsed_seconds"], 0)
                        self.assertAlmostEqual(
                            row["avg_elapsed_seconds"],
                            row["total_elapsed_seconds"] / row["executions"],
                            delta=0.001,
                        )
                elif endpoint.endswith("/resource-usage"):
                    self.assertLessEqual(len(rows), 10)
                    for row in rows:
                        self.assertGreaterEqual(row["cpu_seconds"], 0)
                        self.assertGreaterEqual(row["pga_used_mb"], 0)


if __name__ == "__main__":
    unittest.main()

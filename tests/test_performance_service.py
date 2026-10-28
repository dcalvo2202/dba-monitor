import unittest
from unittest.mock import patch

from app.modules.performance import service


class PerformanceServiceTests(unittest.TestCase):
    def test_service_returns_active_session_rows(self):
        rows = [{"sid": 42, "username": "APP_USER", "status": "ACTIVE"}]

        with patch(
            "app.modules.performance.service.repository.get_active_sessions",
            return_value=rows,
        ):
            self.assertEqual(service.get_active_sessions_data(), rows)

    def test_all_services_preserve_empty_results(self):
        operations = (
            ("get_active_sessions", service.get_active_sessions_data),
            ("get_blocked_sessions", service.get_blocked_sessions_data),
            ("get_top_sql", service.get_top_sql_data),
            ("get_query_times", service.get_query_times_data),
            ("get_resource_usage", service.get_resource_usage_data),
        )

        for repository_method, service_method in operations:
            with self.subTest(endpoint=repository_method):
                with patch(
                    f"app.modules.performance.service.repository.{repository_method}",
                    return_value=[],
                ):
                    self.assertEqual(service_method(), [])


if __name__ == "__main__":
    unittest.main()

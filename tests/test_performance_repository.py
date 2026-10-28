import unittest
from unittest.mock import Mock, patch

from app.modules.performance import repository


class PerformanceRepositoryTests(unittest.TestCase):
    def test_fetch_all_maps_column_names_and_closes_resources(self):
        cursor = Mock()
        cursor.description = [("SID",), ("USERNAME",)]
        cursor.fetchall.return_value = [(17, "APP_USER")]
        connection = Mock()
        connection.cursor.return_value = cursor

        with patch(
            "app.modules.performance.repository.get_connection",
            return_value=connection,
        ):
            rows = repository.get_active_sessions()

        self.assertEqual(rows, [{"sid": 17, "username": "APP_USER"}])
        self.assertEqual(connection.call_timeout, repository.QUERY_TIMEOUT_MS)
        cursor.close.assert_called_once_with()
        connection.close.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()

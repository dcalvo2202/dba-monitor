import os

from dotenv import load_dotenv


load_dotenv()


class Settings:
    def __init__(self) -> None:
        self.db_host = os.getenv("DB_HOST", "localhost")
        self.db_port = int(os.getenv("DB_PORT", "1521"))
        self.db_service = os.getenv("DB_SERVICE", "")
        self.db_user = os.getenv("DB_USER", "")
        self.db_password = os.getenv("DB_PASSWORD", "")


settings = Settings()
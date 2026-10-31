"""Settings, read from environment variables / backend/.env (same names as the Laravel version)."""
import re
from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "Base App"
    app_env: str = "local"
    app_debug: bool = True
    app_url: str = "http://localhost:8082"
    frontend_url: str = "http://localhost:5176"

    # Database (PostgreSQL). DB_URL, when set, wins over the separate parts.
    db_url: str = ""
    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_database: str = "base_app"
    db_username: str = "postgres"
    db_password: str = ""

    bcrypt_rounds: int = 12

    # Cache / throttling: "redis" or anything else (= in this process's memory).
    cache_store: str = "database"
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_password: str = ""
    redis_prefix: str = "base_app_"

    # Sessions (stored in the `sessions` table; the browser only holds a random id)
    session_lifetime: int = 480  # minutes
    session_secure_cookie: bool = False
    session_same_site: str = "lax"
    remember_days: int = 30

    # ── config/base.php ──────────────────────────────────────────
    # Password given to every new login; the user must change it at first login.
    app_default_password: str = "Welcome@123"
    # The everyday role ("normal user"): cannot be renamed or deleted.
    app_default_role: str = "User"
    superadmin_username: str = "superadmin"
    superadmin_email: str = "superadmin@example.com"
    superadmin_password: str = "Admin@123"
    default_company_name: str = "My Company Pvt Ltd"
    default_company_short_name: str = "MAIN"

    # The one fixed role. It passes every permission check and cannot be edited or deleted.
    super_admin_role: str = "SuperAdmin"
    # Administrators: starts with every permission; only the SuperAdmin may change it or give it out.
    admin_role: str = "Admin"
    # How long dropdown lists stay cached (seconds). They are also cleared on every change.
    lookup_cache_ttl: int = 86400

    @property
    def is_testing(self) -> bool:
        return self.app_env == "testing"

    @property
    def database_url(self) -> str:
        if self.db_url:
            url = self.db_url
            for old in ("postgres://", "postgresql://"):
                if url.startswith(old):
                    return "postgresql+psycopg://" + url[len(old):]
            return url
        auth = quote_plus(self.db_username)
        if self.db_password:
            auth += ":" + quote_plus(self.db_password)
        return f"postgresql+psycopg://{auth}@{self.db_host}:{self.db_port}/{self.db_database}"

    @property
    def session_cookie_name(self) -> str:
        return re.sub(r"[^a-z0-9]+", "-", self.app_name.lower()).strip("-") + "-session"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

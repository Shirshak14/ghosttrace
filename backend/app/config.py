from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "GhostTrace"
    environment: str = "development"

    # Database: SQLite for local dev, PostgreSQL in Docker / production.
    database_url: str = "sqlite:///./ghosttrace.db"

    # Auth
    secret_key: str = "change-me-in-production"
    access_token_minutes: int = 60 * 24

    # CORS / links
    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"

    # GitHub API (a fine-grained or classic token with public read access).
    github_token: str | None = None
    github_max_files_per_repo: int = 400
    github_max_repos_per_owner: int = 30
    github_max_commits_per_repo: int = 40

    # Email alerts (SMTP)
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "GhostTrace <alerts@ghosttrace.local>"
    smtp_starttls: bool = True

    # Breach intelligence
    xposedornot_api_url: str = "https://api.xposedornot.com/v1"
    pwned_passwords_api_url: str = "https://api.pwnedpasswords.com"
    hibp_api_key: str | None = None

    # Monitoring scheduler
    monitor_interval_minutes: int = 60
    enable_scheduler: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

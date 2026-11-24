from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "All Sports API"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:8081", "http://localhost:8099"]
    # Comma-separated list of extra production origins (e.g. the deployed
    # frontend's domain), added on top of the dev defaults above.
    extra_cors_origins: str = ""

    @property
    def all_cors_origins(self) -> list[str]:
        extra = [origin.strip() for origin in self.extra_cors_origins.split(",") if origin.strip()]
        return [*self.cors_origins, *extra]

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str


@lru_cache
def get_settings() -> Settings:
    return Settings()

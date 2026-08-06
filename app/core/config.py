from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Vivo AdaptAI API"
    environment: str = "development"
    demo_mode: bool = True
    use_supabase: bool = False
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    supabase_url: str | None = None
    supabase_key: str | None = None
    supabase_publishable_key: str | None = None
    frontend_url: str = "http://127.0.0.1:5500"
    funcionario_emails: str = ""
    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,http://localhost:5500,"
        "http://127.0.0.1:5500,https://vivo-adapt-ai.vercel.app"
    )

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.realtime.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if self.environment == "development":
            origins.extend(["http://127.0.0.1:4173", "http://localhost:4173", "null"])
        return list(dict.fromkeys(origins))

    @property
    def allowed_employee_emails(self) -> set[str]:
        return {email.strip().lower() for email in self.funcionario_emails.split(",") if email.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()

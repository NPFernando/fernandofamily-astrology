import os


def _float_env(name: str, default: str | None) -> float | None:
    value = os.environ.get(name, default)
    return float(value) if value not in (None, "") else None


class Settings:
    app_name: str = os.environ.get("APP_NAME", "Fernando Family Astrology")
    app_env: str = os.environ.get("APP_ENV", "development")
    public_base_url: str = os.environ.get("PUBLIC_BASE_URL", "http://localhost:3000")
    public_repository_url: str = os.environ.get(
        "PUBLIC_REPOSITORY_URL", "https://github.com/NPFernando/fernandofamily-astrology"
    )
    default_locale: str = os.environ.get("DEFAULT_LOCALE", "si")
    supported_locales: list[str] = os.environ.get("SUPPORTED_LOCALES", "en,si").split(",")
    default_timezone: str = os.environ.get("DEFAULT_TIMEZONE", "Asia/Colombo")
    default_location_name: str = os.environ.get("DEFAULT_LOCATION_NAME", "Colombo, Sri Lanka")
    default_latitude: float | None = _float_env("DEFAULT_LATITUDE", None)
    default_longitude: float | None = _float_env("DEFAULT_LONGITUDE", None)
    default_bird: str = os.environ.get("DEFAULT_BIRD", "peacock")
    pyjhora_version: str = os.environ.get("PYJHORA_VERSION", "4.8.7")
    pyjhora_commit: str = os.environ.get("PYJHORA_COMMIT", "ca22995709bd60e371e7820a1a5efc80ce4cf821")
    log_level: str = os.environ.get("LOG_LEVEL", "INFO")
    cors_allowed_origins: list[str] = [
        o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
    ]
    # Set at container build time (Phase 6) to the actual deployed git commit SHA,
    # so /api/v1/metadata can satisfy AGPL-3.0 section 13's "corresponding source"
    # traceability requirement precisely rather than only by version tag.
    deployed_commit: str = os.environ.get("DEPLOYED_COMMIT", "dev")

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()

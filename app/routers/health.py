from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/")
def root() -> dict[str, str]:
    return {"message": "Vivo AdaptAI API está online"}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vivo-adaptai-api"}


@router.get("/status")
def status() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "environment": settings.environment,
        "demo_mode": settings.demo_mode,
        "use_supabase": settings.use_supabase,
        "groq_configured": bool(settings.groq_api_key),
    }

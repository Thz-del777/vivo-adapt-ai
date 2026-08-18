from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["health"])


def _memoria_pico_mb() -> float | None:
    """Lê o pico de RSS no Linux do Render sem adicionar outra dependência."""
    try:
        with open("/proc/self/status", encoding="utf-8") as status_processo:
            for linha in status_processo:
                if linha.startswith("VmHWM:"):
                    return round(int(linha.split()[1]) / 1024, 1)
    except (OSError, ValueError, IndexError):
        return None
    return None


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
        "groq_model": settings.groq_model,
        "memoria_pico_mb": _memoria_pico_mb(),
    }

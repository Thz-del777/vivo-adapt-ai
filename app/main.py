import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import ajuda, auth, chat, demonstracao, echo, eventos, health, historico, notificacoes, operacao, perfil, preferencias, privacidade

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Vivo AdaptAI API iniciada (environment=%s, demo_mode=%s)", settings.environment, settings.demo_mode)
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router)
app.include_router(echo.router)
app.include_router(chat.router)
app.include_router(demonstracao.router)
app.include_router(auth.router)
app.include_router(historico.router)
app.include_router(perfil.router)
app.include_router(preferencias.router)
app.include_router(eventos.router)
app.include_router(ajuda.router)
app.include_router(notificacoes.router)
app.include_router(operacao.router)
app.include_router(privacidade.router)

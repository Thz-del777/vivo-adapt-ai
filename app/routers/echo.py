from fastapi import APIRouter

from app.models.schemas import EchoRequest, EchoResponse

router = APIRouter(tags=["utilities"])


@router.post("/echo", response_model=EchoResponse)
def echo(payload: EchoRequest) -> EchoResponse:
    return EchoResponse(mensagem=payload.mensagem)

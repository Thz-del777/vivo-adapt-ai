from datetime import datetime
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, EmailStr, Field


Perfil = Literal["iniciante", "intermediario", "avancado"]


class ChatRequest(BaseModel):
    cliente_id: int | None = Field(
        default=None,
        gt=0,
        examples=[1],
        description="Usado apenas no modo DEMO sem uma sessao autenticada.",
    )
    mensagem: str = Field(min_length=1, max_length=2_000, examples=["Quero tirar a segunda via da minha fatura"])
    modo_guiado: bool = Field(
        default=False,
        description="Quando ativo, o Mimo orienta uma única ação por vez.",
    )


class ChatResponse(BaseModel):
    cliente_id: int
    nome: str
    ild: int = Field(ge=0, le=100)
    perfil: Perfil
    resposta: str
    origem_resposta: Literal["groq", "fallback", "demo"]


class MensagemHistoricoResponse(BaseModel):
    id: int
    remetente: str
    conteudo: str
    origem_resposta: str | None = None
    perfil_no_momento: Perfil | None = None
    ild_no_momento: float | None = None
    created_at: str | None = None


class ConversaHistoricoResponse(BaseModel):
    id: int
    status: str
    canal: str
    iniciada_em: str | None = None
    encerrada_em: str | None = None
    ultima_mensagem: MensagemHistoricoResponse | None = None


class ConversaHistoricoDetalheResponse(ConversaHistoricoResponse):
    mensagens: list[MensagemHistoricoResponse] = []


class EncerramentoConversaResponse(BaseModel):
    encerrada: bool
    conversas_encerradas: int = Field(ge=0)
    conversa_id: int | None = None
    status: Literal["encerrada", "sem_conversa_aberta", "historico_desativado"]


class EchoRequest(BaseModel):
    mensagem: str = Field(min_length=1, max_length=2_000)


class EchoResponse(BaseModel):
    mensagem: str


class AuthCredentials(BaseModel):
    email: EmailStr
    senha: str = Field(
        min_length=8,
        max_length=128,
        validation_alias=AliasChoices("senha", "password"),
        description="Senha da conta. O campo password também é aceito por compatibilidade.",
    )


class PasswordForgotRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    senha: str = Field(
        min_length=12,
        max_length=128,
        validation_alias=AliasChoices("senha", "password"),
    )


class PasswordChangeRequest(BaseModel):
    senha_atual: str = Field(min_length=8, max_length=128)
    nova_senha: str = Field(min_length=12, max_length=128)


class MensagemResponse(BaseModel):
    mensagem: str


class AvaliacaoInicial(BaseModel):
    """Respostas simples usadas para definir o ILD inicial, nao diagnostico."""

    uso_aplicativos: Literal["raramente", "as_vezes", "quase_todo_dia"]
    autonomia_duvidas: Literal["preciso_de_ajuda", "peco_ajuda_as_vezes", "tento_sozinho"]
    conclusao_tarefas: Literal["desisto_com_facilidade", "consigo_com_calma", "consigo_sozinho"]


class SignUpRequest(AuthCredentials):
    senha: str = Field(
        min_length=12,
        max_length=128,
        validation_alias=AliasChoices("senha", "password"),
    )
    nome: str | None = Field(default=None, min_length=1, max_length=100)
    avaliacao_inicial: AvaliacaoInicial


class AuthUserResponse(BaseModel):
    id: str
    email: EmailStr | None = None
    email_confirmado: bool
    papel: Literal["cliente", "funcionario"] = "cliente"


class AuthSessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int | None = None
    user: AuthUserResponse


class DispositivoSessaoResponse(BaseModel):
    id: str
    navegador: str
    sistema: str
    tipo_dispositivo: Literal["computador", "celular", "dispositivo"]
    criada_em: datetime
    ultimo_acesso_em: datetime
    atual: bool = False


class SessoesDispositivosResponse(BaseModel):
    sessoes: list[DispositivoSessaoResponse]


class SignUpResponse(BaseModel):
    user: AuthUserResponse
    session: AuthSessionResponse | None = None
    mensagem: str
    ild: int | None = Field(default=None, ge=0, le=100)
    perfil: Perfil | None = None


class PerfilResponse(BaseModel):
    nome: str
    email: EmailStr | None = None
    telefone: str | None = None
    ild: int = Field(ge=0, le=100)
    perfil: Perfil


class PerfilUpdateRequest(BaseModel):
    nome: str = Field(min_length=1, max_length=100)
    telefone: str | None = Field(default=None, max_length=30)


class PreferenciasResponse(BaseModel):
    tema: Literal["claro", "escuro"] = "claro"
    idioma: Literal["pt-br", "en"] = "pt-br"
    modo_atendimento: Literal["texto", "voz", "hibrido", "texto-simplificado", "libras", "perguntar"] = "texto"
    confirmar_encerramento: bool = True
    notificacoes_resumo: bool = True
    notificacoes_novidades: bool = False
    tamanho_texto: int = Field(default=2, ge=1, le=3)
    alto_contraste: bool = False
    paleta_cores: Literal["padrao", "protanopia", "deuteranopia", "tritanopia", "monocromatica"] = "padrao"
    espacamento_ampliado: bool = False
    leitura_voz_alta: bool = True
    libras: bool = False
    comandos_voz: bool = False
    personalizacao_atendimento: bool = True
    salvar_historico: bool = True
    usar_microfone: bool = False
    usar_camera: bool = False
    dados_uso_anonimos: bool = False
    notificacoes_app: bool = True


class PreferenciasUpdateRequest(BaseModel):
    tema: Literal["claro", "escuro"] | None = None
    idioma: Literal["pt-br", "en"] | None = None
    modo_atendimento: Literal["texto", "voz", "hibrido", "texto-simplificado", "libras", "perguntar"] | None = None
    confirmar_encerramento: bool | None = None
    notificacoes_resumo: bool | None = None
    notificacoes_novidades: bool | None = None
    tamanho_texto: int | None = Field(default=None, ge=1, le=3)
    alto_contraste: bool | None = None
    paleta_cores: Literal["padrao", "protanopia", "deuteranopia", "tritanopia", "monocromatica"] | None = None
    espacamento_ampliado: bool | None = None
    leitura_voz_alta: bool | None = None
    libras: bool | None = None
    comandos_voz: bool | None = None
    personalizacao_atendimento: bool | None = None
    salvar_historico: bool | None = None
    usar_microfone: bool | None = None
    usar_camera: bool | None = None
    dados_uso_anonimos: bool | None = None
    notificacoes_app: bool | None = None


TipoEventoDigital = Literal[
    "acesso_app",
    "acao",
    "tarefa_iniciada",
    "tarefa_concluida",
    "erro",
    "tarefa_abandonada",
    "pedido_suporte",
]


class EventoDigitalRequest(BaseModel):
    evento_chave: str = Field(min_length=8, max_length=100)
    tipo_evento: TipoEventoDigital
    nome_tarefa: str | None = Field(default=None, max_length=120)
    duracao_segundos: int | None = Field(default=None, ge=0, le=86_400)
    detalhes: dict[str, Any] = Field(default_factory=dict)


class EventoDigitalResponse(BaseModel):
    registrado: bool
    ild: int = Field(ge=0, le=100)
    perfil: Perfil


AssuntoAjuda = Literal["fatura", "internet_wifi", "conta", "acessibilidade", "atendimento", "outro"]


class SolicitacaoAjudaRequest(BaseModel):
    assunto: AssuntoAjuda
    descricao: str = Field(min_length=10, max_length=1_000)


class SolicitacaoAjudaResponse(BaseModel):
    protocolo: str
    status: Literal["aberta"] = "aberta"
    mensagem: str


TipoNotificacao = Literal["sistema", "atendimento", "seguranca", "novidade", "lembrete"]


class NotificacaoResponse(BaseModel):
    id: int
    tipo: TipoNotificacao
    titulo: str
    mensagem: str
    link: str | None = None
    lida: bool
    criada_em: datetime


class NotificacoesResponse(BaseModel):
    notificacoes: list[NotificacaoResponse]
    nao_lidas: int = Field(ge=0)


class NotificacaoAcaoResponse(BaseModel):
    atualizado: bool
    nao_lidas: int = Field(ge=0)


class RealtimeConfigResponse(BaseModel):
    supabase_url: str
    supabase_publishable_key: str


StatusSolicitacao = Literal["aberta", "em_andamento", "concluida", "cancelada"]


class AtendimentoFilaItemResponse(BaseModel):
    id: int
    protocolo: str | None = None
    tipo: str
    descricao: str | None = None
    status: StatusSolicitacao
    criada_em: datetime
    atualizada_em: datetime | None = None
    assumida_em: datetime | None = None
    resolvida_em: datetime | None = None
    atendente_nome: str | None = None
    atendente_auth_user_id: str | None = None
    cliente_id: int
    cliente_nome: str
    ild: int = Field(ge=0, le=100)
    perfil: Perfil
    ultima_mensagem: str | None = None


class AtendimentoPainelResponse(BaseModel):
    abertas: int = Field(ge=0)
    em_andamento: int = Field(ge=0)
    concluidas: int = Field(ge=0)
    minhas: int = Field(ge=0)
    solicitacoes: list[AtendimentoFilaItemResponse]


class AtendimentoDetalheResponse(AtendimentoFilaItemResponse):
    mensagens: list[MensagemHistoricoResponse] = []


class AtendimentoRespostaRequest(BaseModel):
    mensagem: str = Field(min_length=1, max_length=2_000)


class AtendimentoOperacaoResponse(BaseModel):
    atualizado: bool
    status: StatusSolicitacao
    mensagem: str


class ConsentimentoPrivacidadeResponse(BaseModel):
    tipo: Literal["personalizacao", "historico", "dados_uso_anonimos", "comunicacoes"]
    concedido: bool
    versao_politica: str
    atualizado_em: datetime


class ConsentimentosPrivacidadeUpdateRequest(BaseModel):
    personalizacao: bool | None = None
    historico: bool | None = None
    dados_uso_anonimos: bool | None = None
    comunicacoes: bool | None = None


class PrivacidadeResumoResponse(BaseModel):
    email: str | None = None
    nome: str
    consentimentos: list[ConsentimentoPrivacidadeResponse]
    totais: dict[str, int]
    versao_politica: str
    atualizado_em: str


class ConfirmacaoPrivacidadeRequest(BaseModel):
    confirmacao: str = Field(min_length=3, max_length=80)


class ExcluirContaRequest(ConfirmacaoPrivacidadeRequest):
    senha: str = Field(min_length=8, max_length=128)


class AcaoPrivacidadeResponse(BaseModel):
    concluido: bool
    mensagem: str
    removidos: dict[str, int] = Field(default_factory=dict)

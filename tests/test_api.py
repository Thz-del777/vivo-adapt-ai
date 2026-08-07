import hashlib

import pytest
from fastapi.testclient import TestClient

import app.routers.chat as chat_router
import app.routers.ajuda as ajuda_router
import app.routers.auth as auth_router
import app.routers.historico as historico_router
import app.routers.notificacoes as notificacoes_router
import app.routers.operacao as operacao_router
import app.routers.perfil as perfil_router
import app.routers.preferencias as preferencias_router
import app.routers.privacidade as privacidade_router
import app.routers.eventos as eventos_router
from app.core.config import Settings
from app.main import app
from app.models.schemas import AvaliacaoInicial, AuthSessionResponse, AuthUserResponse, SignUpResponse
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.supabase_cliente_repository import SupabaseClienteRepository
from app.services.prompt_service import criar_prompt
from app.services.fallback_service import gerar_resposta_fallback
from app.services.onboarding_service import definir_ild_inicial
from app.services.auth_service import AuthService
from app.services.password_security_service import PasswordSecurityService, SenhaInseguraError

client = TestClient(app)


def definir_settings(monkeypatch, **overrides):
    settings = Settings(**overrides)
    monkeypatch.setattr(chat_router, "get_settings", lambda: settings)


def test_health_e_status():
    health = client.get("/health")
    status = client.get("/status")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "service": "vivo-adaptai-api"}
    assert status.status_code == 200
    assert status.json()["status"] == "ok"


def test_demonstracao_ild_compara_os_tres_perfis_sem_ia():
    resposta = client.post(
        "/demonstracao/ild",
        json={"mensagem": "Quero tirar a segunda via da minha fatura"},
    )
    assert resposta.status_code == 200
    comparacoes = resposta.json()["comparacoes"]
    assert [item["perfil"] for item in comparacoes] == ["iniciante", "intermediario", "avancado"]
    assert [item["ild"] for item in comparacoes] == [25, 50, 85]
    assert len({item["resposta"] for item in comparacoes}) == 3


def test_evento_digital_exige_login():
    resposta = client.post(
        "/eventos",
        json={"evento_chave": "evento-12345", "tipo_evento": "acao"},
    )
    assert resposta.status_code == 401


def test_evento_digital_atualiza_ild_sem_aceitar_dados_sensiveis(monkeypatch):
    recebido = {}

    class AuthServiceFalso:
        def usuario_atual(self, token):
            assert token == "token-valido"
            return AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True)

    class EventoRepositoryFalso:
        def registrar(self, **dados):
            recebido.update(dados)
            return {"registrado": True, "ild": 54, "perfil": "intermediario"}

    monkeypatch.setattr(
        eventos_router,
        "get_settings",
        lambda: Settings(
            use_supabase=True,
            supabase_url="https://exemplo.supabase.co",
            supabase_key="chave-de-teste",
        ),
    )
    monkeypatch.setattr(eventos_router, "AuthService", lambda _settings: AuthServiceFalso())
    monkeypatch.setattr(
        ClienteRepository,
        "get_by_auth_user_id",
        lambda _self, _id: {"id": 42, "nome": "Maria"},
    )
    monkeypatch.setattr(eventos_router, "SupabaseEventoRepository", lambda *_args: EventoRepositoryFalso())

    resposta = client.post(
        "/eventos",
        headers={"Authorization": "Bearer token-valido"},
        json={
            "evento_chave": "evento-12345",
            "tipo_evento": "tarefa_concluida",
            "nome_tarefa": "alterar_perfil",
            "duracao_segundos": 75,
            "detalhes": {"pagina": "perfil", "elemento": "salvar", "senha": "nao-guardar"},
        },
    )

    assert resposta.status_code == 200
    assert resposta.json() == {"registrado": True, "ild": 54, "perfil": "intermediario"}
    assert recebido["cliente_id"] == 42
    assert recebido["detalhes"] == {"pagina": "perfil", "elemento": "salvar"}


def test_evento_digital_rejeita_tipo_desconhecido():
    resposta = client.post(
        "/eventos",
        headers={"Authorization": "Bearer token"},
        json={"evento_chave": "evento-12345", "tipo_evento": "senha_digitada"},
    )
    assert resposta.status_code == 422


def test_solicitacao_ajuda_exige_login():
    resposta = client.post(
        "/ajuda/solicitacoes",
        json={"assunto": "internet_wifi", "descricao": "Minha internet não está funcionando."},
    )
    assert resposta.status_code == 401


def test_notificacoes_exigem_login():
    resposta = client.get("/notificacoes")
    assert resposta.status_code == 401


def test_operacao_exige_funcionario_autenticado():
    resposta = client.get("/operacao/atendimentos")
    assert resposta.status_code == 401


def test_papel_funcionario_vem_de_configuracao_segura():
    class UsuarioSupabaseFalso:
        id = "funcionario-1"
        email = "agente@vivo.com.br"
        email_confirmed_at = "2026-07-28"
        app_metadata = {}

    servico = AuthService.__new__(AuthService)
    servico.settings = Settings(funcionario_emails="agente@vivo.com.br")
    funcionario = servico._user_response(UsuarioSupabaseFalso())
    assert funcionario.papel == "funcionario"

    servico.settings = Settings(funcionario_emails="")
    cliente = servico._user_response(UsuarioSupabaseFalso())
    assert cliente.papel == "cliente"


def test_fluxo_operacao_assumir_responder_e_concluir(monkeypatch):
    usuario = AuthUserResponse(
        id="funcionario-1",
        email="agente@vivo.com.br",
        email_confirmado=True,
        papel="funcionario",
    )

    class RepositorioOperacaoFalso:
        status = "aberta"

        def listar(self):
            return [{
                "id": 9, "protocolo": "VA-9", "tipo": "internet_wifi", "descricao": "Sem internet",
                "status": self.status, "criada_em": "2026-07-28T12:00:00+00:00", "cliente_id": 42,
                "cliente_nome": "Maria", "ild": 25, "perfil": "iniciante", "ultima_mensagem": "Preciso de ajuda",
                "atendente_auth_user_id": "funcionario-1" if self.status != "aberta" else None,
                "atendente_nome": "Agente" if self.status != "aberta" else None,
            }]

        def assumir(self, solicitacao_id, atendente_id, atendente_nome):
            assert (solicitacao_id, atendente_id, atendente_nome) == (9, "funcionario-1", "Agente")
            self.status = "em_andamento"
            return {"id": 9}

        def responder(self, solicitacao_id, atendente_id, atendente_nome, mensagem):
            assert (solicitacao_id, atendente_id, atendente_nome, mensagem) == (9, "funcionario-1", "Agente", "Vamos resolver juntos.")
            return self.status == "em_andamento"

        def concluir(self, solicitacao_id, atendente_id, atendente_nome):
            assert (solicitacao_id, atendente_id, atendente_nome) == (9, "funcionario-1", "Agente")
            self.status = "concluida"
            return True

    repositorio = RepositorioOperacaoFalso()
    monkeypatch.setattr(operacao_router, "_atendente", lambda _credenciais: (usuario, "Agente", repositorio))

    fila = client.get("/operacao/atendimentos", headers={"Authorization": "Bearer token"})
    assert fila.status_code == 200
    assert fila.json()["abertas"] == 1

    assumir = client.patch("/operacao/atendimentos/9/assumir", headers={"Authorization": "Bearer token"})
    assert assumir.status_code == 200
    assert assumir.json()["status"] == "em_andamento"

    responder = client.post(
        "/operacao/atendimentos/9/respostas",
        headers={"Authorization": "Bearer token"},
        json={"mensagem": "Vamos resolver juntos."},
    )
    assert responder.status_code == 200

    concluir = client.patch("/operacao/atendimentos/9/concluir", headers={"Authorization": "Bearer token"})
    assert concluir.status_code == 200
    assert concluir.json()["status"] == "concluida"


def test_notificacoes_listar_ler_e_arquivar(monkeypatch):
    class RepositorioNotificacaoFalso:
        def __init__(self):
            self.itens = [
                {
                    "id": 7,
                    "tipo": "atendimento",
                    "titulo": "Atendimento encerrado",
                    "mensagem": "Seu resumo esta disponivel.",
                    "link": "historico.html",
                    "lida": False,
                    "criada_em": "2026-07-28T12:00:00+00:00",
                }
            ]

        def listar(self, cliente_id):
            assert cliente_id == 42
            return self.itens

        def contar_nao_lidas(self, cliente_id):
            assert cliente_id == 42
            return sum(not item["lida"] for item in self.itens)

        def marcar_lida(self, notificacao_id, cliente_id):
            assert cliente_id == 42
            for item in self.itens:
                if item["id"] == notificacao_id:
                    item["lida"] = True
                    return True
            return False

        def marcar_todas_lidas(self, cliente_id):
            assert cliente_id == 42
            for item in self.itens:
                item["lida"] = True

        def arquivar(self, notificacao_id, cliente_id):
            assert cliente_id == 42
            return any(item["id"] == notificacao_id for item in self.itens)

    repositorio = RepositorioNotificacaoFalso()
    monkeypatch.setattr(notificacoes_router, "_contexto", lambda _credenciais: (42, repositorio))

    consulta = client.get("/notificacoes", headers={"Authorization": "Bearer token"})
    assert consulta.status_code == 200
    assert consulta.json()["nao_lidas"] == 1
    assert consulta.json()["notificacoes"][0]["id"] == 7

    leitura = client.patch("/notificacoes/7/ler", headers={"Authorization": "Bearer token"})
    assert leitura.status_code == 200
    assert leitura.json()["nao_lidas"] == 0

    arquivo = client.delete("/notificacoes/7", headers={"Authorization": "Bearer token"})
    assert arquivo.status_code == 200
    assert arquivo.json()["atualizado"] is True

    ausente = client.patch("/notificacoes/999/ler", headers={"Authorization": "Bearer token"})
    assert ausente.status_code == 404


def test_configuracao_realtime_expoe_apenas_chave_publicavel(monkeypatch):
    monkeypatch.setattr(notificacoes_router, "_contexto", lambda _credenciais: (42, object()))
    monkeypatch.setattr(
        notificacoes_router,
        "get_settings",
        lambda: Settings(
            supabase_url="https://projeto.supabase.co",
            supabase_key="sb_secret_nao_expor",
            supabase_publishable_key="sb_publishable_publica",
        ),
    )
    resposta = client.get(
        "/notificacoes/realtime/config",
        headers={"Authorization": "Bearer token"},
    )
    assert resposta.status_code == 200
    assert resposta.json() == {
        "supabase_url": "https://projeto.supabase.co",
        "supabase_publishable_key": "sb_publishable_publica",
    }
    assert "secret" not in resposta.text


def test_solicitacao_ajuda_registra_cliente_autenticado(monkeypatch):
    recebido = {}

    class AuthServiceAjudaFalso:
        def usuario_atual(self, token):
            assert token == "token-valido"
            return AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True)

    class RepositorioAjudaFalso:
        def criar(self, cliente_id, assunto, descricao):
            recebido.update(cliente_id=cliente_id, assunto=assunto, descricao=descricao)
            return {"protocolo": "VA-20260728-ABC123"}

    monkeypatch.setattr(
        ajuda_router,
        "get_settings",
        lambda: Settings(
            use_supabase=True,
            supabase_url="https://exemplo.supabase.co",
            supabase_key="chave-de-teste",
        ),
    )
    monkeypatch.setattr(ajuda_router, "AuthService", lambda _settings: AuthServiceAjudaFalso())
    monkeypatch.setattr(
        ClienteRepository,
        "get_by_auth_user_id",
        lambda _self, _id: {"id": 42, "nome": "Maria"},
    )
    monkeypatch.setattr(ajuda_router, "SupabaseSolicitacaoRepository", lambda *_args: RepositorioAjudaFalso())

    resposta = client.post(
        "/ajuda/solicitacoes",
        headers={"Authorization": "Bearer token-valido"},
        json={"assunto": "internet_wifi", "descricao": "  Minha internet não está funcionando.  "},
    )

    assert resposta.status_code == 201
    assert resposta.json()["protocolo"] == "VA-20260728-ABC123"
    assert recebido == {
        "cliente_id": 42,
        "assunto": "internet_wifi",
        "descricao": "Minha internet não está funcionando.",
    }


def test_chat_demo_e_perfis(monkeypatch):
    definir_settings(monkeypatch, demo_mode=True, use_supabase=False)
    casos = [(1, "iniciante", 25), (4, "intermediario", 49), (2, "avancado", 71)]
    for cliente_id, perfil, ild in casos:
        resposta = client.post("/chat", json={"cliente_id": cliente_id, "mensagem": "Preciso de ajuda"})
        assert resposta.status_code == 200
        corpo = resposta.json()
        assert corpo["perfil"] == perfil
        assert corpo["ild"] == ild
        assert corpo["origem_resposta"] == "demo"


def test_falha_groq_usa_fallback(monkeypatch):
    definir_settings(monkeypatch, demo_mode=False, use_supabase=False, groq_api_key="chave-de-teste")

    def falhar(*_args, **_kwargs):
        raise TimeoutError("timeout simulado")

    monkeypatch.setattr(chat_router.GroqService, "gerar_resposta", falhar)
    monkeypatch.setattr(
        chat_router,
        "obter_usuario_autenticado",
        lambda _credenciais: AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True),
    )
    monkeypatch.setattr(
        ClienteRepository,
        "get_by_auth_user_id",
        lambda _self, _id: {"id": 1, "nome": "Maria", "acessos_app": 5, "chamadas_suporte": 4, "tempo_medio_tarefa": 3, "erros": 2, "tarefas_abandonadas": 1},
    )
    resposta = client.post("/chat", json={"mensagem": "Ajuda"}, headers={"Authorization": "Bearer token"})
    assert resposta.status_code == 200
    assert resposta.json()["origem_resposta"] == "fallback"


def test_falha_supabase_usa_json(monkeypatch):
    def falhar(*_args, **_kwargs):
        raise ConnectionError("falha simulada")

    monkeypatch.setattr(SupabaseClienteRepository, "get_by_id", falhar)
    repositorio = ClienteRepository(
        Settings(use_supabase=True, supabase_url="https://exemplo.supabase.co", supabase_key="chave-de-teste")
    )
    assert repositorio.get_by_id(1)["nome"] == "Maria"


def test_cliente_inexistente_retorna_404(monkeypatch):
    definir_settings(monkeypatch, demo_mode=True, use_supabase=False)
    resposta = client.post("/chat", json={"cliente_id": 9999, "mensagem": "Olá"})
    assert resposta.status_code == 404
    assert resposta.json()["detail"].startswith("Cliente")


def test_chat_autenticado_usa_cliente_vinculado(monkeypatch):
    definir_settings(monkeypatch, demo_mode=True, use_supabase=True)
    interacoes = []
    monkeypatch.setattr(
        chat_router,
        "obter_usuario_autenticado",
        lambda _credenciais: AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True),
    )
    monkeypatch.setattr(
        ClienteRepository,
        "get_by_auth_user_id",
        lambda _self, _id: {"id": 42, "nome": "Cliente autenticado", "acessos_app": 5, "chamadas_suporte": 4, "tempo_medio_tarefa": 3, "erros": 2, "tarefas_abandonadas": 1},
    )
    monkeypatch.setattr(
        chat_router.AtendimentoService,
        "registrar_interacao",
        lambda _self, **dados: interacoes.append(dados),
    )
    monkeypatch.setattr(
        chat_router.AtendimentoService,
        "obter_contexto_recente",
        lambda _self, _cliente_id: [],
    )

    resposta = client.post(
        "/chat",
        json={"mensagem": "Quero ajuda"},
        headers={"Authorization": "Bearer token-de-teste"},
    )

    assert resposta.status_code == 200
    assert resposta.json()["cliente_id"] == 42
    assert resposta.json()["nome"] == "Cliente autenticado"
    assert interacoes[0]["cliente_id"] == 42
    assert interacoes[0]["origem_resposta"] == "demo"


def test_chat_respeita_historico_desativado(monkeypatch):
    definir_settings(monkeypatch, demo_mode=True, use_supabase=True)
    interacoes = []
    monkeypatch.setattr(
        chat_router,
        "obter_usuario_autenticado",
        lambda _credenciais: AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True),
    )
    monkeypatch.setattr(
        ClienteRepository,
        "get_by_auth_user_id",
        lambda _self, _id: {
            "id": 42,
            "nome": "Maria",
            "acessos_app": 5,
            "chamadas_suporte": 4,
            "tempo_medio_tarefa": 3,
            "erros": 2,
            "tarefas_abandonadas": 1,
            "preferencias": {"salvar_historico": False},
        },
    )
    monkeypatch.setattr(
        chat_router.AtendimentoService,
        "registrar_interacao",
        lambda _self, **dados: interacoes.append(dados),
    )

    resposta = client.post(
        "/chat",
        json={"mensagem": "Quero ajuda"},
        headers={"Authorization": "Bearer token-de-teste"},
    )

    assert resposta.status_code == 200
    assert interacoes == []


def test_prompt_usa_historico_e_evitar_repeticao():
    prompt = criar_prompt(
        "Arthur",
        25,
        "iniciante",
        "Preciso configurar o dispositivo",
        [
            {"remetente": "cliente", "conteudo": "Estou usando o roteador da Vivo."},
            {"remetente": "assistente", "conteudo": "Vamos configurar o roteador passo a passo."},
        ],
    )
    assert "Cliente: Estou usando o roteador da Vivo." in prompt
    assert "Mimo: Vamos configurar o roteador passo a passo." in prompt
    assert "nao repita perguntas ja respondidas" in prompt
    assert "Nao informe enderecos IP" in prompt


def test_modo_guiado_limita_resposta_a_uma_acao():
    prompt = criar_prompt(
        "Arthur",
        25,
        "iniciante",
        "Quero a segunda via da fatura",
        modo_guiado=True,
    )
    resposta_fallback = gerar_resposta_fallback(
        "iniciante", "Quero a segunda via da fatura", modo_guiado=True
    )

    assert "MODO GUIADO ATIVO" in prompt
    assert "exatamente uma acao pratica" in prompt
    assert "Você conseguiu" in resposta_fallback
    assert "Primeiro" in resposta_fallback


def test_avaliacao_inicial_define_tres_perfis():
    iniciante = AvaliacaoInicial(
        uso_aplicativos="raramente",
        autonomia_duvidas="preciso_de_ajuda",
        conclusao_tarefas="desisto_com_facilidade",
    )
    intermediario = AvaliacaoInicial(
        uso_aplicativos="as_vezes",
        autonomia_duvidas="peco_ajuda_as_vezes",
        conclusao_tarefas="consigo_com_calma",
    )
    avancado = AvaliacaoInicial(
        uso_aplicativos="quase_todo_dia",
        autonomia_duvidas="tento_sozinho",
        conclusao_tarefas="consigo_sozinho",
    )

    assert definir_ild_inicial(iniciante)[1:] == (0, "iniciante")
    assert definir_ild_inicial(intermediario)[1:] == (31, "intermediario")
    assert definir_ild_inicial(avancado)[1:] == (72, "avancado")


def test_chat_producao_sem_login_retorna_401(monkeypatch):
    definir_settings(monkeypatch, demo_mode=False)
    resposta = client.post("/chat", json={"cliente_id": 1, "mensagem": "Ajuda"})
    assert resposta.status_code == 401


def test_historico_exibe_apenas_conversas_do_cliente_autenticado(monkeypatch):
    class RepositorioFalso:
        def listar_conversas_cliente(self, cliente_id):
            assert cliente_id == 42
            return [
                {
                    "id": 9,
                    "status": "aberta",
                    "canal": "web",
                    "iniciada_em": "2026-07-26T12:00:00+00:00",
                    "encerrada_em": None,
                    "ultima_mensagem": {
                        "id": 90,
                        "remetente": "assistente",
                        "conteudo": "Como posso ajudar?",
                        "origem_resposta": "demo",
                        "perfil_no_momento": "iniciante",
                        "ild_no_momento": 25,
                        "created_at": "2026-07-26T12:00:01+00:00",
                    },
                }
            ]

    monkeypatch.setattr(
        historico_router,
        "_cliente_da_sessao",
        lambda _credenciais: ({"id": 42}, Settings()),
    )
    monkeypatch.setattr(historico_router, "_repositorio", lambda _settings: RepositorioFalso())

    resposta = client.get("/conversas", headers={"Authorization": "Bearer token"})

    assert resposta.status_code == 200
    assert resposta.json()[0]["id"] == 9
    assert resposta.json()[0]["ultima_mensagem"]["origem_resposta"] == "demo"


def test_historico_desativado_nao_expoe_conversas(monkeypatch):
    monkeypatch.setattr(
        historico_router,
        "_cliente_da_sessao",
        lambda _credenciais: ({"id": 42, "preferencias": {"salvar_historico": False}}, Settings()),
    )

    resposta = client.get("/conversas", headers={"Authorization": "Bearer token"})

    assert resposta.status_code == 200
    assert resposta.json() == []


def test_encerrar_conversa_atual_fecha_somente_as_abertas_do_cliente(monkeypatch):
    class RepositorioFalso:
        def encerrar_conversas_abertas(self, cliente_id):
            assert cliente_id == 42
            return [
                {
                    "id": 8,
                    "cliente_id": 42,
                    "status": "encerrada",
                    "iniciada_em": "2026-07-26T10:00:00+00:00",
                },
                {
                    "id": 9,
                    "cliente_id": 42,
                    "status": "encerrada",
                    "iniciada_em": "2026-07-26T12:00:00+00:00",
                },
            ]

    monkeypatch.setattr(
        historico_router,
        "_cliente_da_sessao",
        lambda _credenciais: (
            {"id": 42, "preferencias": {"notificacoes_resumo": False}},
            Settings(use_supabase=True),
        ),
    )
    monkeypatch.setattr(historico_router, "_repositorio", lambda _settings: RepositorioFalso())

    resposta = client.patch(
        "/conversas/atual/encerrar",
        headers={"Authorization": "Bearer token"},
    )

    assert resposta.status_code == 200
    assert resposta.json() == {
        "encerrada": True,
        "conversas_encerradas": 2,
        "conversa_id": 9,
        "status": "encerrada",
    }


def test_encerrar_conversa_atual_e_idempotente_quando_nao_ha_aberta(monkeypatch):
    class RepositorioFalso:
        def encerrar_conversas_abertas(self, _cliente_id):
            return []

    monkeypatch.setattr(
        historico_router,
        "_cliente_da_sessao",
        lambda _credenciais: ({"id": 42}, Settings(use_supabase=True)),
    )
    monkeypatch.setattr(historico_router, "_repositorio", lambda _settings: RepositorioFalso())

    resposta = client.patch(
        "/conversas/atual/encerrar",
        headers={"Authorization": "Bearer token"},
    )

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "sem_conversa_aberta"
    assert resposta.json()["conversas_encerradas"] == 0


def test_perfil_consulta_e_atualiza_apenas_cliente_autenticado(monkeypatch):
    usuario = AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True)
    cliente = {
        "id": 42,
        "auth_user_id": "usuario-1",
        "nome": "Maria",
        "telefone": None,
        "acessos_app": 3,
        "chamadas_suporte": 2,
        "tempo_medio_tarefa": 3,
        "erros": 2,
        "tarefas_abandonadas": 1,
    }

    class AuthServicePerfilFalso:
        def usuario_atual(self, _token):
            return usuario

    class RepositorioPerfilFalso:
        def get_by_auth_user_id(self, auth_user_id):
            assert auth_user_id == "usuario-1"
            return cliente

        def atualizar_perfil(self, auth_user_id, nome, telefone):
            assert auth_user_id == "usuario-1"
            cliente.update({"nome": nome, "telefone": telefone})
            return cliente

        def listar_historico_ild(self, cliente_id):
            assert cliente_id == 42
            return [{
                "ild": 31,
                "perfil": "intermediario",
                "motivo_calculo": "evento_tarefa_concluida",
                "calculado_em": "2026-08-07T12:00:00Z",
            }]

    monkeypatch.setattr(perfil_router, "AuthService", lambda _settings: AuthServicePerfilFalso())
    monkeypatch.setattr(perfil_router, "SupabaseClienteRepository", lambda *_args: RepositorioPerfilFalso())
    monkeypatch.setattr(
        perfil_router,
        "get_settings",
        lambda: Settings(supabase_url="https://exemplo.supabase.co", supabase_key="chave"),
    )

    consulta = client.get("/perfil", headers={"Authorization": "Bearer token"})
    assert consulta.status_code == 200
    assert consulta.json()["nome"] == "Maria"
    assert consulta.json()["perfil"] == "intermediario"

    painel = client.get("/perfil/ild", headers={"Authorization": "Bearer token"})
    assert painel.status_code == 200
    assert painel.json()["ild"] == 31
    assert painel.json()["indicadores"]["acessos_app"] == 3
    assert painel.json()["historico"][0]["motivo"] == "evento_tarefa_concluida"

    atualizacao = client.patch(
        "/perfil",
        headers={"Authorization": "Bearer token"},
        json={"nome": "Maria Silva", "telefone": "11999999999"},
    )
    assert atualizacao.status_code == 200
    assert atualizacao.json()["nome"] == "Maria Silva"
    assert atualizacao.json()["telefone"] == "11999999999"


def test_preferencias_sao_lidas_e_salvas_para_usuario_autenticado(monkeypatch):
    usuario = AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True)
    cliente = {"id": 42, "auth_user_id": "usuario-1", "preferencias": {}}

    class AuthServicePreferenciasFalso:
        def usuario_atual(self, _token):
            return usuario

    class RepositorioPreferenciasFalso:
        def get_by_auth_user_id(self, auth_user_id):
            assert auth_user_id == "usuario-1"
            return cliente

        def atualizar_preferencias(self, auth_user_id, preferencias):
            assert auth_user_id == "usuario-1"
            cliente["preferencias"] = preferencias
            return cliente

    monkeypatch.setattr(preferencias_router, "AuthService", lambda _settings: AuthServicePreferenciasFalso())
    monkeypatch.setattr(preferencias_router, "SupabaseClienteRepository", lambda *_args: RepositorioPreferenciasFalso())
    monkeypatch.setattr(
        preferencias_router,
        "get_settings",
        lambda: Settings(supabase_url="https://exemplo.supabase.co", supabase_key="chave"),
    )

    consulta = client.get("/preferencias", headers={"Authorization": "Bearer token"})
    assert consulta.status_code == 200
    assert consulta.json()["tema"] == "claro"
    assert consulta.json()["leitura_voz_alta"] is True
    assert consulta.json()["salvar_historico"] is True
    assert consulta.json()["usar_camera"] is False

    atualizacao = client.patch(
        "/preferencias",
        headers={"Authorization": "Bearer token"},
        json={
            "tema": "escuro",
            "tamanho_texto": 3,
            "libras": True,
            "salvar_historico": False,
            "dados_uso_anonimos": True,
        },
    )
    assert atualizacao.status_code == 200
    assert atualizacao.json()["tema"] == "escuro"
    assert atualizacao.json()["tamanho_texto"] == 3
    assert atualizacao.json()["libras"] is True
    assert atualizacao.json()["salvar_historico"] is False
    assert atualizacao.json()["dados_uso_anonimos"] is True


class AuthServiceFalso:
    usuario = AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True)

    def cadastrar(self, *_args):
        return SignUpResponse(user=self.usuario, mensagem="Conta criada com sucesso.")

    def entrar(self, *_args):
        return AuthSessionResponse(
            access_token="token-de-teste",
            refresh_token="refresh-de-teste",
            token_type="bearer",
            expires_in=3600,
            user=self.usuario,
        )

    def renovar_sessao(self, refresh_token):
        assert refresh_token == "refresh-de-teste"
        return self.entrar()

    def usuario_atual(self, token):
        if token != "token-de-teste":
            raise RuntimeError("Sessão inválida")
        return self.usuario

    def alterar_senha(self, token, senha_atual, nova_senha):
        assert (token, senha_atual, nova_senha) == (
            "token-de-teste",
            "Senha#Atual2026",
            "Nova#Senha2026",
        )

    def listar_dispositivos(self, token):
        assert token == "token-de-teste"
        return [{
            "id": "15c65921-d172-450a-b00a-b4c253e49e89",
            "navegador": "Google Chrome",
            "sistema": "Windows",
            "tipo_dispositivo": "computador",
            "criada_em": "2026-07-28T12:00:00Z",
            "ultimo_acesso_em": "2026-07-28T15:00:00Z",
            "atual": True,
        }]

    def revogar_dispositivo(self, token, session_id):
        assert token == "token-de-teste"
        return session_id == "15c65921-d172-450a-b00a-b4c253e49e89"

    def revogar_outros_dispositivos(self, token):
        assert token == "token-de-teste"
        return 2


def test_rotas_de_autenticacao(monkeypatch):
    monkeypatch.setattr(auth_router, "get_auth_service", lambda: AuthServiceFalso())
    cadastro = client.post(
        "/auth/signup",
        json={
            "email": "maria@example.com",
            "senha": "senha-segura-123",
            "nome": "Maria",
            "avaliacao_inicial": {
                "uso_aplicativos": "as_vezes",
                "autonomia_duvidas": "peco_ajuda_as_vezes",
                "conclusao_tarefas": "consigo_com_calma",
            },
        },
    )
    assert cadastro.status_code == 201
    assert cadastro.json()["user"]["email"] == "maria@example.com"

    login = client.post("/auth/login", json={"email": "maria@example.com", "password": "senha-segura-123"})
    assert login.status_code == 200
    assert login.json()["access_token"] == "token-de-teste"

    renovacao = client.post("/auth/refresh", json={"refresh_token": "refresh-de-teste"})
    assert renovacao.status_code == 200
    assert renovacao.json()["access_token"] == "token-de-teste"

    perfil = client.get("/auth/me", headers={"Authorization": "Bearer token-de-teste"})
    assert perfil.status_code == 200
    assert perfil.json()["id"] == "usuario-1"


def test_login_com_email_nao_confirmado_exibe_orientacao(monkeypatch):
    class AuthServiceEmailPendente:
        def entrar(self, *_args):
            raise RuntimeError("Email not confirmed")

    monkeypatch.setattr(auth_router, "get_auth_service", lambda: AuthServiceEmailPendente())
    resposta = client.post(
        "/auth/login",
        json={"email": "maria@example.com", "senha": "senha-segura-123"},
    )

    assert resposta.status_code == 403
    assert "Confirme o e-mail" in resposta.json()["detail"]


def test_recuperacao_e_redefinicao_de_senha(monkeypatch):
    chamadas = []

    class AuthServiceRecuperacaoFalso:
        def solicitar_redefinicao_senha(self, email):
            chamadas.append(("solicitar", email))

        def redefinir_senha(self, token, senha):
            chamadas.append(("redefinir", token, senha))

    monkeypatch.setattr(auth_router, "get_auth_service", lambda: AuthServiceRecuperacaoFalso())

    solicitacao = client.post("/auth/password/forgot", json={"email": "maria@example.com"})
    assert solicitacao.status_code == 200
    assert "instrucoes" in solicitacao.json()["mensagem"]

    redefinicao = client.post(
        "/auth/password/reset",
        headers={"Authorization": "Bearer token-recuperacao"},
        json={"senha": "senha-nova-segura"},
    )
    assert redefinicao.status_code == 200
    assert chamadas == [
        ("solicitar", "maria@example.com"),
        ("redefinir", "token-recuperacao", "senha-nova-segura"),
    ]


def test_me_sem_token_retorna_401():
    resposta = client.get("/auth/me")
    assert resposta.status_code == 401


def test_troca_de_senha_e_dispositivos_conectados(monkeypatch):
    monkeypatch.setattr(auth_router, "get_auth_service", lambda: AuthServiceFalso())
    headers = {"Authorization": "Bearer token-de-teste"}

    alteracao = client.post(
        "/auth/password/change",
        headers=headers,
        json={"senha_atual": "Senha#Atual2026", "nova_senha": "Nova#Senha2026"},
    )
    assert alteracao.status_code == 200
    assert "Entre novamente" in alteracao.json()["mensagem"]

    dispositivos = client.get("/auth/sessions", headers=headers)
    assert dispositivos.status_code == 200
    assert dispositivos.json()["sessoes"][0]["atual"] is True
    assert dispositivos.json()["sessoes"][0]["navegador"] == "Google Chrome"

    removido = client.delete(
        "/auth/sessions/15c65921-d172-450a-b00a-b4c253e49e89", headers=headers
    )
    assert removido.status_code == 200

    outros = client.post("/auth/sessions/revoke-others", headers=headers)
    assert outros.status_code == 200
    assert "2 outro(s)" in outros.json()["mensagem"]


def test_seguranca_da_conta_exige_login():
    assert client.post(
        "/auth/password/change",
        json={"senha_atual": "Senha#Atual2026", "nova_senha": "Nova#Senha2026"},
    ).status_code == 401
    assert client.get("/auth/sessions").status_code == 401


def test_senha_forte_e_consultada_sem_enviar_a_senha(monkeypatch):
    senha = "Unica#Senha2026"
    digest = hashlib.sha1(senha.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
    requisicao = {}

    class RespostaFalsa:
        text = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0\n"

        def raise_for_status(self):
            return None

    def get_falso(url, headers, timeout):
        requisicao.update(url=url, headers=headers, timeout=timeout)
        return RespostaFalsa()

    monkeypatch.setattr("app.services.password_security_service.httpx.get", get_falso)
    PasswordSecurityService().validar(senha)

    assert requisicao["url"].endswith(digest[:5])
    assert senha not in requisicao["url"]
    assert requisicao["headers"]["Add-Padding"] == "true"


def test_senha_vazada_e_senha_fraca_sao_recusadas(monkeypatch):
    senha = "Vazada#Senha2026"
    digest = hashlib.sha1(senha.encode("utf-8"), usedforsecurity=False).hexdigest().upper()

    class RespostaVazada:
        text = f"{digest[5:]}:250\n"

        def raise_for_status(self):
            return None

    monkeypatch.setattr(
        "app.services.password_security_service.httpx.get",
        lambda *_args, **_kwargs: RespostaVazada(),
    )
    with pytest.raises(SenhaInseguraError, match="vazamentos conhecidos"):
        PasswordSecurityService().validar(senha)
    with pytest.raises(SenhaInseguraError, match="12 caracteres"):
        PasswordSecurityService().validar("curta")


def test_privacidade_exige_login():
    resposta = client.get("/privacidade")
    assert resposta.status_code == 401


def test_privacidade_resume_exporta_e_salva_consentimentos(monkeypatch):
    usuario = AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True)
    cliente_dados = {"id": 42, "nome": "Maria", "preferencias": {}}
    consentimentos = [
        {
            "tipo": tipo,
            "concedido": tipo in {"personalizacao", "historico"},
            "versao_politica": "1.0",
            "atualizado_em": "2026-07-28T12:00:00Z",
        }
        for tipo in ("personalizacao", "historico", "dados_uso_anonimos", "comunicacoes")
    ]

    class RepositorioPrivacidadeFalso:
        def listar_consentimentos(self, cliente_id):
            assert cliente_id == 42
            return consentimentos

        def salvar_consentimentos(self, cliente_id, alteracoes, _versao):
            assert cliente_id == 42
            for item in consentimentos:
                if item["tipo"] in alteracoes:
                    item["concedido"] = alteracoes[item["tipo"]]
            return consentimentos

        def atualizar_preferencias_consentimento(self, auth_user_id, preferencias):
            assert auth_user_id == "usuario-1"
            cliente_dados["preferencias"] = preferencias

        def exportar_dados(self, _cliente):
            return {
                "cliente": cliente_dados,
                "conversas": [{"id": 1}],
                "mensagens": [{"id": 2}],
                "eventos_digitais": [],
                "historico_ild": [],
                "solicitacoes_atendimento": [],
                "atendimento_eventos": [],
                "feedback_atendimento": [],
                "notificacoes": [],
                "consentimentos": consentimentos,
            }

    repositorio = RepositorioPrivacidadeFalso()
    monkeypatch.setattr(
        privacidade_router,
        "_contexto",
        lambda _credenciais: (Settings(), usuario, cliente_dados, repositorio, "token"),
    )

    resumo = client.get("/privacidade", headers={"Authorization": "Bearer token"})
    assert resumo.status_code == 200
    assert resumo.json()["totais"] == {
        "conversas": 1,
        "mensagens": 1,
        "eventos_digitais": 0,
        "notificacoes": 0,
    }

    alteracao = client.patch(
        "/privacidade/consentimentos",
        headers={"Authorization": "Bearer token"},
        json={"historico": False},
    )
    assert alteracao.status_code == 200
    assert cliente_dados["preferencias"]["salvar_historico"] is False

    download = client.get(
        "/privacidade/dados/download", headers={"Authorization": "Bearer token"}
    )
    assert download.status_code == 200
    assert "attachment" in download.headers["content-disposition"]
    assert download.json()["titular"]["email"] == "maria@example.com"
    assert "segredo-de-sessao" not in download.text


def test_limpeza_historico_exige_frase_e_remove_apenas_depois_da_confirmacao(monkeypatch):
    chamadas = []

    class RepositorioPrivacidadeFalso:
        def limpar_historico(self, cliente_id):
            chamadas.append(cliente_id)
            return {"conversas": 2, "mensagens": 5}

    monkeypatch.setattr(
        privacidade_router,
        "_contexto",
        lambda _credenciais: (
            Settings(),
            AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True),
            {"id": 42, "nome": "Maria"},
            RepositorioPrivacidadeFalso(),
            "token",
        ),
    )

    recusada = client.request(
        "DELETE",
        "/privacidade/historico",
        headers={"Authorization": "Bearer token"},
        json={"confirmacao": "apagar"},
    )
    assert recusada.status_code == 400
    assert chamadas == []

    confirmada = client.request(
        "DELETE",
        "/privacidade/historico",
        headers={"Authorization": "Bearer token"},
        json={"confirmacao": "APAGAR HISTORICO"},
    )
    assert confirmada.status_code == 200
    assert chamadas == [42]


def test_revogacao_de_sessoes_e_exclusao_de_conta_revalidam_titular(monkeypatch):
    chamadas = []
    usuario = AuthUserResponse(id="usuario-1", email="maria@example.com", email_confirmado=True)

    class RepositorioPrivacidadeFalso:
        def excluir_dados_conta(self, cliente_id):
            chamadas.append(("dados", cliente_id))
            return {"clientes": 1}

    class AuthPrivacidadeFalso:
        def confirmar_senha(self, email, senha, auth_user_id):
            chamadas.append(("senha", email, senha, auth_user_id))

        def revogar_todas_sessoes(self, token):
            chamadas.append(("revogar", token))

        def excluir_usuario(self, auth_user_id):
            chamadas.append(("usuario", auth_user_id))

    monkeypatch.setattr(privacidade_router, "AuthService", lambda _settings: AuthPrivacidadeFalso())
    monkeypatch.setattr(
        privacidade_router,
        "_contexto",
        lambda _credenciais: (
            Settings(), usuario, {"id": 42, "nome": "Maria"},
            RepositorioPrivacidadeFalso(), "token",
        ),
    )

    sessoes = client.post(
        "/privacidade/sessoes/revogar", headers={"Authorization": "Bearer token"}
    )
    assert sessoes.status_code == 200

    exclusao = client.request(
        "DELETE",
        "/privacidade/conta",
        headers={"Authorization": "Bearer token"},
        json={"confirmacao": "EXCLUIR MINHA CONTA", "senha": "senha-segura-123"},
    )
    assert exclusao.status_code == 200
    assert chamadas == [
        ("revogar", "token"),
        ("senha", "maria@example.com", "senha-segura-123", "usuario-1"),
        ("revogar", "token"),
        ("dados", 42),
        ("usuario", "usuario-1"),
    ]

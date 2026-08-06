from app.models.schemas import AvaliacaoInicial
from app.services.ild_service import calcular_ild, classificar_perfil


def definir_ild_inicial(avaliacao: AvaliacaoInicial) -> tuple[dict[str, int], int, str]:
    """Traduz respostas de onboarding em indicadores iniciais conservadores."""
    acessos = {"raramente": 0, "as_vezes": 3, "quase_todo_dia": 12}
    suporte = {"preciso_de_ajuda": 5, "peco_ajuda_as_vezes": 2, "tento_sozinho": 0}
    desempenho = {
        "desisto_com_facilidade": {"tempo_medio_tarefa": 6, "erros": 4, "tarefas_abandonadas": 3},
        "consigo_com_calma": {"tempo_medio_tarefa": 3, "erros": 2, "tarefas_abandonadas": 1},
        "consigo_sozinho": {"tempo_medio_tarefa": 1, "erros": 0, "tarefas_abandonadas": 0},
    }
    indicadores = {
        "acessos_app": acessos[avaliacao.uso_aplicativos],
        "chamadas_suporte": suporte[avaliacao.autonomia_duvidas],
    }
    indicadores.update(desempenho[avaliacao.conclusao_tarefas])
    ild = calcular_ild(indicadores)
    return indicadores, ild, classificar_perfil(ild)

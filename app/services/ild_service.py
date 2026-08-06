from typing import Literal


Perfil = Literal["iniciante", "intermediario", "avancado"]


def calcular_ild(cliente: dict) -> int:
    ild = 50
    ild += int(cliente.get("acessos_app", 0)) * 2
    ild -= int(cliente.get("chamadas_suporte", 0)) * 4
    ild -= int(cliente.get("tempo_medio_tarefa", 0)) * 2
    ild -= int(cliente.get("erros", 0)) * 3
    ild -= int(cliente.get("tarefas_abandonadas", 0)) * 5
    return max(0, min(100, ild))


def classificar_perfil(ild: int) -> Perfil:
    if ild <= 30:
        return "iniciante"
    if ild <= 70:
        return "intermediario"
    return "avancado"

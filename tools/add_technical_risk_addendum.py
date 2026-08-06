from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(r"C:\Users\arthu\OneDrive\Documentos\Vivo Adapt AI")
SOURCE = Path(r"C:\Users\arthu\Downloads\Vivo_AdaptAI_Livro_Tecnico_Completo.pdf")
OUT = ROOT / "output" / "pdf"
TMP = ROOT / "tmp" / "pdfs"
ADDENDUM = TMP / "vivo_adaptai_riscos_addendum.pdf"
FINAL = OUT / "Vivo_AdaptAI_Livro_Tecnico_Completo_Revisado.pdf"

PAGE_W, PAGE_H = A4
M = 48

PALETTE = {
    "bg": "#FBFAFF",
    "ink": "#241044",
    "muted": "#635A70",
    "line": "#E4D9F2",
    "vivo": "#660099",
    "violet": "#8A3FFC",
    "magenta": "#FF2DAA",
    "blue": "#236DFF",
    "cyan": "#22D3C5",
    "amber": "#F5A623",
    "red": "#E94B5F",
    "green": "#21A67A",
}


def hex_color(value: str, alpha: float = 1):
    value = value.lstrip("#")
    r, g, b = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return colors.Color(r, g, b, alpha=alpha)


def register_fonts():
    fonts = [
        ("SegoeUI", r"C:\Windows\Fonts\segoeui.ttf"),
        ("SegoeUISemibold", r"C:\Windows\Fonts\seguisb.ttf"),
        ("SegoeUIBold", r"C:\Windows\Fonts\segoeuib.ttf"),
    ]
    for name, path in fonts:
        if Path(path).exists():
            pdfmetrics.registerFont(TTFont(name, path))


register_fonts()
FONT = "SegoeUI" if "SegoeUI" in pdfmetrics.getRegisteredFontNames() else "Helvetica"
SEMIBOLD = "SegoeUISemibold" if "SegoeUISemibold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold"
BOLD = "SegoeUIBold" if "SegoeUIBold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold"


class Doc:
    def __init__(self, path: Path):
        self.c = canvas.Canvas(str(path), pagesize=A4)
        self.page = 0
        self.section = "Riscos, governanca e operacao"

    def start(self, title: str):
        self.page += 1
        c = self.c
        c.setFillColor(hex_color(PALETTE["bg"]))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        c.setFillColor(hex_color("#F2ECFF"))
        c.rect(0, PAGE_H - 210, PAGE_W, 112, fill=1, stroke=0)
        c.setFillColor(hex_color("#EAFEFF"))
        c.rect(0, PAGE_H - 132, PAGE_W, 46, fill=1, stroke=0)
        c.setStrokeColor(hex_color(PALETTE["line"]))
        c.line(M, PAGE_H - 54, PAGE_W - M, PAGE_H - 54)
        c.setFont(FONT, 8)
        c.setFillColor(hex_color(PALETTE["muted"]))
        c.drawString(M, PAGE_H - 37, "Vivo AdaptAI / Livro Tecnico de Produto, Design e Arquitetura")
        c.drawRightString(PAGE_W - M, PAGE_H - 37, self.section)
        self.h1(title, M, PAGE_H - 108)

    def end(self):
        c = self.c
        c.setStrokeColor(hex_color(PALETTE["line"]))
        c.line(M, 38, PAGE_W - M, 38)
        c.setFont(FONT, 8)
        c.setFillColor(hex_color(PALETTE["muted"]))
        c.drawString(M, 22, "Equipe Nexus - Desafio de Dados da Vivo")
        c.drawRightString(PAGE_W - M, 22, f"Addendum {self.page:02d}")
        c.showPage()

    def h1(self, text, x, y, size=22):
        self.c.setFont(BOLD, size)
        self.c.setFillColor(hex_color(PALETTE["ink"]))
        self.c.drawString(x, y, text)

    def h2(self, text, x, y, size=13):
        self.c.setFont(SEMIBOLD, size)
        self.c.setFillColor(hex_color(PALETTE["ink"]))
        self.c.drawString(x, y, text)

    def text(self, text, x, y, w, size=9.5, leading=13.5, color="muted", bold=False):
        style = ParagraphStyle(
            "p",
            fontName=SEMIBOLD if bold else FONT,
            fontSize=size,
            leading=leading,
            textColor=hex_color(PALETTE[color]),
        )
        p = Paragraph(text, style)
        _, h = p.wrap(w, 600)
        p.drawOn(self.c, x, y - h)
        return h

    def card(self, x, y, w, h, fill="#FFFFFF", stroke="line", radius=14):
        c = self.c
        c.setFillColor(hex_color("#3F2066", 0.06))
        c.roundRect(x + 2, y - 2, w, h, radius, fill=1, stroke=0)
        c.setFillColor(hex_color(fill))
        c.setStrokeColor(hex_color(PALETTE[stroke] if stroke in PALETTE else stroke))
        c.setLineWidth(0.7)
        c.roundRect(x, y, w, h, radius, fill=1, stroke=1)

    def chip(self, text, x, y, color_key="vivo", w=96):
        self.c.setFillColor(hex_color(PALETTE[color_key]))
        self.c.roundRect(x, y, w, 22, 11, fill=1, stroke=0)
        self.c.setFont(SEMIBOLD, 7.5)
        self.c.setFillColor(colors.white)
        self.c.drawCentredString(x + w / 2, y + 7, text)


def bullets(doc: Doc, items: list[str], x: float, y: float, w: float, gap=13.5):
    cur = y
    for item in items:
        doc.c.setFillColor(hex_color(PALETTE["violet"]))
        doc.c.circle(x + 4, cur - 5, 2.5, fill=1, stroke=0)
        h = doc.text(item, x + 14, cur, w - 14, 8.8, 12)
        cur -= max(h, 12) + gap - 10
    return cur


def page_intro(doc: Doc):
    doc.start("51. Riscos preventivos e robustez operacional")
    doc.text(
        "Esta seção complementa o livro técnico com decisões práticas para manter a demonstração estável em ambiente real de apresentação. O objetivo é reduzir dependências externas, antecipar falhas e garantir uma experiência contínua mesmo quando Render, Supabase, Gemini ou a rede apresentarem instabilidade.",
        M,
        682,
        490,
        10.5,
        15,
    )
    items = [
        ("Cold start no Render", "Alta", "Ping silencioso em /health ou /status ao carregar a página inicial."),
        ("Falha no Supabase", "Media", "Fallback automático para JSON local com dados simulados."),
        ("Limite da Gemini API", "Alta", "Modo Demo por variável de ambiente, com respostas por regras."),
        ("Erro de CORS", "Alta", "Middleware CORS restrito à URL final da Vercel e às origens locais de teste."),
    ]
    y = 520
    for risk, prio, action in items:
        doc.card(M, y, 500, 66)
        color = "red" if prio == "Alta" else "amber"
        doc.chip(prio, M + 18, y + 25, color, 58)
        doc.h2(risk, M + 92, y + 39, 11)
        doc.text(action, M + 92, y + 22, 360, 8.7, 12)
        y -= 86
    doc.end()


def page_eight_points(doc: Doc):
    doc.start("52. Oito pontos para blindar a entrega")
    points = [
        ("LGPD e governanca de dados", "Explicitar base legal, consentimento, dados coletados, dados nao coletados, retencao, exclusao e anonimizacao."),
        ("WCAG e acessibilidade formal", "Relacionar recursos do produto a criterios verificaveis: contraste, foco, teclado, leitores de tela, legendas, Libras e reducao de movimento."),
        ("Observabilidade e monitoramento", "Registrar tempo de resposta, taxa de erro, acionamento de fallback, abandono por etapa e uso por modalidade."),
        ("Seguranca tecnica", "Proteger chaves, limitar origens, usar HTTPS, reduzir exposicao de dados e tratar erros sem vazar detalhes internos."),
        ("Contrato de API formal", "Documentar endpoints, metodos, payloads, respostas, codigos de erro e exemplos JSON."),
        ("Deploy e rollback", "Definir publicacao, variaveis de ambiente, validacao pos-deploy e reversao caso a versao apresente falhas."),
        ("Riscos e mitigacoes", "Manter tabela de riscos com prioridade, impacto, responsavel e contorno."),
        ("Criterios de sucesso", "Definir metas de resolucao, satisfacao, tempo de resposta, acessibilidade usada e estabilidade da demo."),
    ]
    y = 640
    for i, (title, body) in enumerate(points):
        x = M + (i % 2) * 252
        yy = y - (i // 2) * 126
        doc.card(x, yy, 226, 92)
        doc.c.setFillColor(hex_color([PALETTE["magenta"], PALETTE["violet"], PALETTE["blue"], PALETTE["cyan"]][i % 4]))
        doc.c.circle(x + 24, yy + 58, 10, fill=1, stroke=0)
        doc.h2(title, x + 44, yy + 62, 9.6)
        doc.text(body, x + 20, yy + 42, 180, 8, 10.8)
    doc.end()


def page_render_supabase(doc: Doc):
    doc.start("53. Render, Supabase e continuidade da demo")
    doc.card(M, 508, 500, 128)
    doc.h2("Cold start no Render", M + 24, 600)
    bullets(
        doc,
        [
            "Ao carregar a pagina inicial, o front-end dispara uma requisicao silenciosa para /health ou /status.",
            "Enquanto a API acorda, a interface mostra 'Conectando ao sistema...' com spinner discreto.",
            "O chatbot so deve liberar o envio quando a API responder ou quando o modo fallback estiver ativo.",
        ],
        M + 24,
        574,
        444,
    )
    doc.card(M, 310, 500, 150)
    doc.h2("Dependencia do Supabase", M + 24, 426)
    bullets(
        doc,
        [
            "Chamadas ao banco devem ficar dentro de blocos try-except no backend.",
            "Se o Supabase falhar, o sistema registra o erro e carrega um arquivo JSON local com dados simulados.",
            "A resposta da API deve indicar a origem dos dados: supabase, json-local ou fallback.",
            "O usuario nao deve ver tela quebrada; o atendimento continua em modo demonstracao.",
        ],
        M + 24,
        400,
        444,
    )
    doc.card(M, 146, 500, 94, "#FFFCF4", "amber")
    doc.h2("Regra de apresentacao", M + 24, 208)
    doc.text("A demonstracao nunca deve depender de um unico servico externo. Para banca ou cliente, a versao local/simulada precisa estar pronta e validada antes do deploy publico.", M + 24, 184, 444, 9.3, 13)
    doc.end()


def page_gemini_cors(doc: Doc):
    doc.start("54. Gemini, CORS e contrato de integracao")
    doc.card(M, 496, 500, 150)
    doc.h2("Limites de taxa e custos da Gemini API", M + 24, 610)
    bullets(
        doc,
        [
            "Criar DEMO_MODE no backend para ignorar a chamada de IA quando necessario.",
            "Respostas simuladas devem variar por perfil, modalidade e intencao do usuario.",
            "Se a API exceder limite ou falhar, retornar resposta controlada com status fallback.",
        ],
        M + 24,
        582,
        444,
    )
    doc.card(M, 286, 500, 160)
    doc.h2("CORS entre Vercel e Render", M + 24, 410)
    bullets(
        doc,
        [
            "Configurar o middleware CORS do FastAPI com origins explicitas.",
            "Incluir a URL final da Vercel e as URLs locais usadas em desenvolvimento.",
            "Testar OPTIONS, GET /health e POST /chat antes de envolver Supabase ou IA.",
        ],
        M + 24,
        382,
        444,
    )
    doc.card(M, 128, 500, 96)
    doc.h2("Contrato minimo sugerido", M + 24, 190)
    doc.text('POST /chat recebe {"clienteId": "demo-01", "mensagem": "...", "modalidade": "texto|voz|libras|simplificado|adaptavel"} e retorna {"resposta": "...", "status": "ok|fallback|erro", "origem": "ia|demo|json-local"}.', M + 24, 166, 444, 8.9, 12.5)
    doc.end()


def page_tests(doc: Doc):
    doc.start("55. Primeiro teste de integracao")
    steps = [
        ("1. Ambiente local", "Rodar FastAPI em localhost e o front-end localmente ou na Vercel de preview."),
        ("2. Endpoint de echo", "Criar rota simples que retorna OK para validar conectividade antes de banco ou IA."),
        ("3. CORS inicial", "Permitir a origem de desenvolvimento do front-end desde o primeiro fetch."),
        ("4. Contrato JSON", "Definir payload e resposta esperada antes de integrar Supabase e Gemini."),
        ("5. Dados simulados", "Comecar por JSON local para reduzir variaveis de erro."),
        ("6. Logs abertos", "Manter terminal do backend visivel para acompanhar requisicoes e falhas em tempo real."),
    ]
    y = 620
    for i, (title, body) in enumerate(steps):
        x = M + (i % 2) * 252
        yy = y - (i // 2) * 132
        doc.card(x, yy, 226, 92)
        doc.h2(title, x + 20, yy + 58, 10.5)
        doc.text(body, x + 20, yy + 38, 180, 8.3, 11.5)
    doc.card(M, 118, 500, 76, "#F7F2FF")
    doc.text("Criterio de pronto: front-end consegue chamar /health, /status e /chat; backend responde com dados simulados; logs mostram origem da resposta; CORS nao bloqueia a requisicao.", M + 22, 164, 446, 9.2, 13)
    doc.end()


def page_documentation(doc: Doc):
    doc.start("56. Registro dos testes e alinhamento da equipe")
    items = [
        ("Issues ou Wiki no GitHub", "Registrar teste, status, erro encontrado, responsavel e decisao tomada."),
        ("Planilha de status", "Colunas: endpoint, responsavel, status, ambiente, observacoes e evidencia."),
        ("Sincronizacao de integracao", "Reuniao curta entre front-end e back-end para validar contrato JSON."),
        ("README da API", "Listar endpoints, metodos, exemplos de request/response, variaveis de ambiente e modo demo."),
    ]
    y = 600
    for title, body in items:
        doc.card(M, y, 500, 74)
        doc.h2(title, M + 24, y + 44, 11.5)
        doc.text(body, M + 24, y + 24, 430, 8.9, 12.5)
        y -= 98
    doc.card(M, 130, 500, 82, "#FFFCF4", "amber")
    doc.h2("Plano de contingencia para apresentacao", M + 24, 180, 12)
    doc.text("Gravar um video completo do fluxo, incluindo entrada, modalidades, atendimento, acessibilidade, conclusao e dashboard. Se internet, API ou banco falharem, a equipe mantem uma apresentacao profissional e clara.", M + 24, 158, 444, 9.2, 13)
    doc.end()


def page_success(doc: Doc):
    doc.start("57. Metricas, riscos e criterios de sucesso")
    metrics = [
        ("Disponibilidade da demo", "Fluxo principal acessivel mesmo com fallback ativo."),
        ("Tempo de resposta", "Resposta perceptivel ou feedback visual em ate 2 segundos."),
        ("Resolucao simulada", "Atendimento conclui sem depender de servicos externos."),
        ("Acessibilidade validada", "Teclado, contraste, legenda, voz, Libras e fonte maior testados."),
        ("Dados protegidos", "Preferencias e historico com consentimento e minimo necessario."),
        ("Operacao observavel", "Logs indicam origem, status, erro e fallback acionado."),
    ]
    y = 616
    for i, (title, body) in enumerate(metrics):
        x = M + (i % 2) * 252
        yy = y - (i // 2) * 128
        doc.card(x, yy, 226, 88)
        doc.c.setFillColor(hex_color([PALETTE["green"], PALETTE["blue"], PALETTE["violet"], PALETTE["cyan"], PALETTE["magenta"], PALETTE["amber"]][i]))
        doc.c.roundRect(x + 18, yy + 54, 42, 18, 9, fill=1, stroke=0)
        doc.h2(title, x + 72, yy + 62, 9.8)
        doc.text(body, x + 20, yy + 38, 180, 8.2, 11.5)
    doc.card(M, 120, 500, 80)
    doc.text("Essas metricas transformam a demonstracao em um produto avaliavel: a equipe consegue explicar nao apenas o que foi construido, mas como o sistema se comporta sob falha, como protege usuarios e como evolui apos a primeira versao.", M + 24, 170, 444, 9.3, 13)
    doc.end()


def build_addendum():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    doc = Doc(ADDENDUM)
    page_intro(doc)
    page_eight_points(doc)
    page_render_supabase(doc)
    page_gemini_cors(doc)
    page_tests(doc)
    page_documentation(doc)
    page_success(doc)
    doc.c.save()


def merge():
    source = PdfReader(str(SOURCE))
    addendum = PdfReader(str(ADDENDUM))
    writer = PdfWriter()
    insert_at = max(0, len(source.pages) - 1)
    for page in source.pages[:insert_at]:
        writer.add_page(page)
    for page in addendum.pages:
        writer.add_page(page)
    for page in source.pages[insert_at:]:
        writer.add_page(page)
    with FINAL.open("wb") as f:
        writer.write(f)


if __name__ == "__main__":
    build_addendum()
    merge()
    print(FINAL)

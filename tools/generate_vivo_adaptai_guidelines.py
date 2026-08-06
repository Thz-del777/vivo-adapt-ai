from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
TMP = ROOT / "tmp" / "pdfs"
ASSETS = TMP / "assets"
PDF_PATH = OUT / "Vivo_AdaptAI_Design_Guidelines_Equipe_Nexus.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 42

PALETTE = {
    "bg": "#F8F7FC",
    "ink": "#171022",
    "muted": "#635A70",
    "line": "#DED8EA",
    "surface": "#FFFFFF",
    "vivo": "#6D2BEA",
    "deep": "#2B164F",
    "violet": "#8C4DFF",
    "magenta": "#FF2FA3",
    "blue": "#236DFF",
    "cyan": "#25D6E8",
    "green": "#2CBF7B",
    "amber": "#F7B731",
    "red": "#E9435A",
}


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def col(value: str, alpha: float = 1):
    r, g, b = [x / 255 for x in hex_to_rgb(value)]
    return colors.Color(r, g, b, alpha=alpha)


def mix(c1: str, c2: str, t: float) -> str:
    a = hex_to_rgb(c1)
    b = hex_to_rgb(c2)
    return "#" + "".join(f"{round(a[i] * (1 - t) + b[i] * t):02X}" for i in range(3))


def ensure_dirs():
    OUT.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)


def register_fonts():
    candidates = [
        ("SegoeUI", r"C:\Windows\Fonts\segoeui.ttf"),
        ("SegoeUISemibold", r"C:\Windows\Fonts\seguisb.ttf"),
        ("SegoeUIBold", r"C:\Windows\Fonts\segoeuib.ttf"),
    ]
    for name, path in candidates:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont(name, path))
    return "SegoeUI" if "SegoeUI" in pdfmetrics.getRegisteredFontNames() else "Helvetica"


FONT = register_fonts()
BOLD = "SegoeUIBold" if "SegoeUIBold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold"
SEMIBOLD = "SegoeUISemibold" if "SegoeUISemibold" in pdfmetrics.getRegisteredFontNames() else BOLD


def gradient_image(name: str, size: tuple[int, int], stops: list[str], vertical=False, radius=0) -> Path:
    path = ASSETS / name
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    pix = img.load()
    rgbs = [hex_to_rgb(s) for s in stops]
    for y in range(h):
        for x in range(w):
            p = (y / max(1, h - 1)) if vertical else (x / max(1, w - 1))
            seg = min(len(rgbs) - 2, int(p * (len(rgbs) - 1)))
            local = p * (len(rgbs) - 1) - seg
            rgb = tuple(round(rgbs[seg][i] * (1 - local) + rgbs[seg + 1][i] * local) for i in range(3))
            pix[x, y] = (*rgb, 255)
    if radius:
        mask = Image.new("L", size, 0)
        d = ImageDraw.Draw(mask)
        d.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
        img.putalpha(mask)
    img.save(path)
    return path


def make_assets():
    gradient_image("adapt_gradient.png", (1200, 120), [PALETTE["magenta"], PALETTE["violet"], PALETTE["blue"], PALETTE["cyan"]], radius=40)
    gradient_image("hero_mist.png", (1600, 1000), ["#FFFFFF", "#F3EDFF", "#EAF8FF"], vertical=True)
    gradient_image("deep_gradient.png", (1200, 700), [PALETTE["deep"], PALETTE["vivo"], PALETTE["blue"]], radius=36)
    gradient_image("soft_panel.png", (1000, 700), ["#FFFFFF", "#F6F0FF", "#EAFBFF"], vertical=True, radius=40)
    make_mimo_assets()
    make_screen_assets()


def make_mimo_assets():
    for state, accent in [
        ("welcome", PALETTE["magenta"]),
        ("neutral", PALETTE["vivo"]),
        ("listening", PALETTE["cyan"]),
        ("processing", PALETTE["violet"]),
        ("responding", PALETTE["blue"]),
        ("done", PALETTE["green"]),
        ("error", PALETTE["red"]),
    ]:
        img = Image.new("RGBA", (560, 560), (0, 0, 0, 0))
        shadow = Image.new("RGBA", (560, 560), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.ellipse((108, 118, 452, 468), fill=(79, 45, 140, 36))
        shadow = shadow.filter(ImageFilter.GaussianBlur(24))
        img.alpha_composite(shadow)
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((118, 104, 442, 444), radius=108, fill=(255, 255, 255, 255), outline=hex_to_rgb("#E6DAF7") + (255,), width=5)
        d.rounded_rectangle((162, 172, 398, 330), radius=68, fill=hex_to_rgb(PALETTE["deep"]) + (255,))
        d.rounded_rectangle((182, 190, 378, 310), radius=54, fill=hex_to_rgb("#4E2A86") + (255,))
        eye_y = 248
        if state == "done":
            d.arc((204, 226, 250, 270), 200, 340, fill=hex_to_rgb(PALETTE["cyan"]) + (255,), width=7)
            d.arc((310, 226, 356, 270), 200, 340, fill=hex_to_rgb(PALETTE["cyan"]) + (255,), width=7)
        elif state == "error":
            d.line((214, 236, 242, 264), fill=hex_to_rgb(PALETTE["red"]) + (255,), width=7)
            d.line((242, 236, 214, 264), fill=hex_to_rgb(PALETTE["red"]) + (255,), width=7)
            d.line((318, 236, 346, 264), fill=hex_to_rgb(PALETTE["red"]) + (255,), width=7)
            d.line((346, 236, 318, 264), fill=hex_to_rgb(PALETTE["red"]) + (255,), width=7)
        else:
            d.ellipse((210, eye_y - 18, 246, eye_y + 18), fill=hex_to_rgb(PALETTE["cyan"]) + (255,))
            d.ellipse((314, eye_y - 18, 350, eye_y + 18), fill=hex_to_rgb(PALETTE["cyan"]) + (255,))
        if state in ("welcome", "responding", "done"):
            d.arc((238, 266, 322, 316), 15, 165, fill=hex_to_rgb("#FFFFFF") + (255,), width=5)
        elif state == "processing":
            for i, x in enumerate([246, 280, 314]):
                d.ellipse((x - 7, 287 - i * 4, x + 7, 301 - i * 4), fill=hex_to_rgb("#FFFFFF") + (210,))
        elif state == "listening":
            for r in [25, 42, 59]:
                d.arc((280 - r, 265 - r, 280 + r, 265 + r), 200, 340, fill=hex_to_rgb("#FFFFFF") + (140,), width=3)
        else:
            d.line((250, 292, 310, 292), fill=hex_to_rgb("#FFFFFF") + (230,), width=5)
        d.rounded_rectangle((230, 72, 330, 118), radius=23, fill=hex_to_rgb(accent) + (255,))
        d.ellipse((266, 28, 294, 56), fill=hex_to_rgb(accent) + (255,))
        d.line((280, 56, 280, 78), fill=hex_to_rgb(accent) + (255,), width=7)
        d.rounded_rectangle((92, 244, 132, 344), radius=20, fill=hex_to_rgb(PALETTE["vivo"]) + (255,))
        d.rounded_rectangle((428, 244, 468, 344), radius=20, fill=hex_to_rgb(PALETTE["blue"]) + (255,))
        d.rounded_rectangle((198, 424, 362, 476), radius=26, fill=hex_to_rgb(accent) + (255,))
        img.save(ASSETS / f"mimo_{state}.png")


def rounded_rect(draw, xy, r, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def make_screen_assets():
    specs = [
        ("institutional", "A Vivo que se adapta", ["Conhecer o Mimo", "Iniciar atendimento"], 0),
        ("chat_entry", "Como prefere conversar?", ["Texto", "Voz", "Libras", "Adaptável"], 1),
        ("chat", "Mimo em atendimento", ["Mensagem do usuário", "Resposta clara do Mimo"], 2),
        ("accessibility", "Preferências de acessibilidade", ["Fonte maior", "Alto contraste", "Libras", "Reduzir movimento"], 3),
        ("dashboard", "Dashboard Vivo AdaptAI", ["92% resolução", "4,8/5 satisfação", "18% menor tempo"], 4),
        ("history", "Histórico e continuidade", ["Últimos atendimentos", "Preferências salvas"], 5),
    ]
    for name, title, chips, seed in specs:
        img = Image.new("RGBA", (1100, 720), hex_to_rgb(PALETTE["bg"]) + (255,))
        d = ImageDraw.Draw(img)
        rounded_rect(d, (42, 42, 1058, 678), 34, (255, 255, 255, 255), hex_to_rgb("#E7DFF2") + (255,), 2)
        d.rounded_rectangle((42, 42, 1058, 126), radius=34, fill=hex_to_rgb("#FFFFFF") + (255,))
        d.text((84, 76), title, fill=hex_to_rgb(PALETTE["deep"]) + (255,))
        for i, c in enumerate([PALETTE["magenta"], PALETTE["violet"], PALETTE["blue"], PALETTE["cyan"]]):
            d.ellipse((878 + i * 38, 72, 900 + i * 38, 94), fill=hex_to_rgb(c) + (255,))
        if name == "dashboard":
            for i in range(3):
                x = 84 + i * 316
                rounded_rect(d, (x, 156, x + 276, 270), 24, hex_to_rgb("#FAF8FF") + (255,), hex_to_rgb("#E7DFF2") + (255,), 1)
                d.text((x + 28, 184), chips[i], fill=hex_to_rgb(PALETTE["deep"]) + (255,))
                d.rectangle((x + 28, 230, x + 220, 242), fill=hex_to_rgb([PALETTE["vivo"], PALETTE["blue"], PALETTE["cyan"]][i]) + (255,))
            points = [(100 + i * 70, 540 - int(130 + math.sin(i / 1.5 + seed) * 55 + i * 12)) for i in range(12)]
            d.line(points, fill=hex_to_rgb(PALETTE["blue"]) + (255,), width=8, joint="curve")
            for p in points:
                d.ellipse((p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8), fill=hex_to_rgb(PALETTE["cyan"]) + (255,))
            for i, h in enumerate([120, 180, 150, 220, 170]):
                d.rounded_rectangle((760 + i * 52, 548 - h, 790 + i * 52, 548), radius=8, fill=hex_to_rgb(mix(PALETTE["violet"], PALETTE["cyan"], i / 4)) + (255,))
        elif name == "chat":
            for i in range(5):
                y = 170 + i * 82
                right = i % 2
                x1 = 450 if right else 102
                x2 = 982 if right else 640
                fill = PALETTE["vivo"] if right else "#F1ECFA"
                rounded_rect(d, (x1, y, x2, y + 54), 22, hex_to_rgb(fill) + (255,), None)
            d.ellipse((84, 528, 168, 612), fill=hex_to_rgb(PALETTE["deep"]) + (255,))
            rounded_rect(d, (190, 540, 1014, 602), 28, hex_to_rgb("#F5F1FB") + (255,), hex_to_rgb("#E6DAF7") + (255,))
        else:
            for i, chip in enumerate(chips):
                x = 86 + (i % 2) * 474
                y = 170 + (i // 2) * 122
                rounded_rect(d, (x, y, x + 410, y + 88), 24, hex_to_rgb("#F8F4FF") + (255,), hex_to_rgb("#E7DFF2") + (255,), 1)
                d.ellipse((x + 26, y + 24, x + 66, y + 64), fill=hex_to_rgb([PALETTE["magenta"], PALETTE["violet"], PALETTE["blue"], PALETTE["cyan"]][i % 4]) + (255,))
                d.text((x + 86, y + 34), chip, fill=hex_to_rgb(PALETTE["deep"]) + (255,))
            for i in range(6):
                d.rounded_rectangle((94 + i * 154, 466, 202 + i * 154, 580 - (i % 3) * 28), radius=18, fill=hex_to_rgb(mix(PALETTE["vivo"], PALETTE["cyan"], i / 5)) + (210,))
        img.save(ASSETS / f"screen_{name}.png")


class PDF:
    def __init__(self):
        self.c = canvas.Canvas(str(PDF_PATH), pagesize=A4)
        self.page = 0
        self.section = ""

    def bg(self, title=None, section=None):
        self.page += 1
        if section:
            self.section = section
        c = self.c
        c.setFillColor(col(PALETTE["bg"]))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        c.drawImage(ImageReader(str(ASSETS / "hero_mist.png")), 0, PAGE_H - 310, width=PAGE_W, height=310, mask="auto")
        c.setStrokeColor(col("#E8E0F3"))
        c.setLineWidth(0.6)
        c.line(MARGIN, PAGE_H - 54, PAGE_W - MARGIN, PAGE_H - 54)
        c.setFont(SEMIBOLD, 8)
        c.setFillColor(col(PALETTE["muted"]))
        c.drawString(MARGIN, PAGE_H - 38, "Vivo AdaptAI Design Guidelines")
        c.drawRightString(PAGE_W - MARGIN, PAGE_H - 38, self.section)
        if title:
            self.h1(title, MARGIN, PAGE_H - 102, 22)

    def footer(self):
        c = self.c
        c.setStrokeColor(col("#E8E0F3"))
        c.line(MARGIN, 34, PAGE_W - MARGIN, 34)
        c.setFont(FONT, 8)
        c.setFillColor(col(PALETTE["muted"]))
        c.drawString(MARGIN, 20, "Equipe Nexus - Desafio de Dados da Vivo")
        c.drawRightString(PAGE_W - MARGIN, 20, f"{self.page:02d}")

    def show(self):
        self.footer()
        self.c.showPage()

    def h1(self, text, x, y, size=30, color=PALETTE["deep"]):
        self.c.setFont(BOLD, size)
        self.c.setFillColor(col(color))
        self.c.drawString(x, y, text)

    def h2(self, text, x, y, size=16, color=PALETTE["deep"]):
        self.c.setFont(SEMIBOLD, size)
        self.c.setFillColor(col(color))
        self.c.drawString(x, y, text)

    def txt(self, text, x, y, w, size=10.2, leading=14, color=PALETTE["muted"], bold=False):
        style = ParagraphStyle(
            "body",
            fontName=SEMIBOLD if bold else FONT,
            fontSize=size,
            leading=leading,
            textColor=col(color),
            spaceAfter=0,
        )
        p = Paragraph(text, style)
        _, h = p.wrap(w, 400)
        p.drawOn(self.c, x, y - h)
        return h

    def card(self, x, y, w, h, fill="#FFFFFF", stroke="#E7DFF2", r=18):
        c = self.c
        c.setFillColor(col("#4C2D7D", 0.08))
        c.roundRect(x + 2, y - 3, w, h, r, fill=1, stroke=0)
        c.setFillColor(col(fill))
        c.setStrokeColor(col(stroke))
        c.setLineWidth(0.7)
        c.roundRect(x, y, w, h, r, fill=1, stroke=1)

    def pill(self, text, x, y, w, fill=PALETTE["vivo"], text_color="#FFFFFF"):
        self.c.setFillColor(col(fill))
        self.c.roundRect(x, y, w, 24, 12, fill=1, stroke=0)
        self.c.setFont(SEMIBOLD, 8)
        self.c.setFillColor(col(text_color))
        self.c.drawCentredString(x + w / 2, y + 8, text)

    def image(self, filename, x, y, w, h):
        self.c.drawImage(ImageReader(str(ASSETS / filename)), x, y, width=w, height=h, preserveAspectRatio=True, mask="auto")


def page_cover(pdf: PDF):
    c = pdf.c
    pdf.page += 1
    c.setFillColor(col(PALETTE["bg"]))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.drawImage(ImageReader(str(ASSETS / "hero_mist.png")), 0, 0, width=PAGE_W, height=PAGE_H, mask="auto")
    c.drawImage(ImageReader(str(ASSETS / "deep_gradient.png")), 55, 430, width=485, height=312, mask="auto")
    c.drawImage(ImageReader(str(ASSETS / "mimo_welcome.png")), 332, 472, width=155, height=155, mask="auto")
    c.setFont(BOLD, 34)
    c.setFillColor(col(PALETTE["deep"]))
    c.drawString(56, 356, "Vivo AdaptAI")
    c.setFont(BOLD, 25)
    c.drawString(56, 316, "A Vivo que se adapta")
    c.drawImage(ImageReader(str(ASSETS / "adapt_gradient.png")), 343, 306, width=135, height=28, mask="auto")
    c.setFont(BOLD, 25)
    c.setFillColor(colors.white)
    c.drawString(356, 312, "a você")
    pdf.txt("Design system, identidade visual, UX/UI, arquitetura e experiência do usuário.", 58, 254, 410, 13, 18, PALETTE["muted"])
    pdf.pill("Produto digital inclusivo", 58, 205, 146, PALETTE["vivo"])
    pdf.pill("Equipe Nexus", 218, 205, 106, PALETTE["magenta"])
    pdf.pill("Desafio de Dados da Vivo", 338, 205, 158, PALETTE["blue"])
    c.setFont(FONT, 9)
    c.setFillColor(col(PALETTE["muted"]))
    c.drawString(56, 60, "Documento oficial de Product Design - versão executiva")
    c.drawRightString(PAGE_W - 56, 60, "2026")
    c.showPage()


def page_manifesto(pdf: PDF):
    pdf.bg("Visão do Produto", "Fundamentos")
    pdf.txt("O Vivo AdaptAI nasce do princípio de que a interface deve se ajustar à pessoa, e não o contrário. O sistema combina IA conversacional, preferências persistentes e recursos de acessibilidade para reduzir barreiras digitais em canais de atendimento.", MARGIN, 690, 500, 12.5, 18)
    items = [
        ("Personalização", "Atendimento moldado por preferências de canal, leitura, contraste e linguagem."),
        ("Clareza", "Fluxos com mensagens curtas, hierarquia evidente e decisões sempre explicadas."),
        ("Inclusão", "Texto, voz, Libras, simplificação textual e modo adaptável como escolhas equivalentes."),
        ("Confiança", "Estados visíveis, confirmação de ações e continuidade de contexto."),
    ]
    y = 540
    for i, (t, b) in enumerate(items):
        x = MARGIN + (i % 2) * 258
        yy = y - (i // 2) * 142
        pdf.card(x, yy, 226, 104)
        pdf.c.setFillColor(col([PALETTE["magenta"], PALETTE["violet"], PALETTE["blue"], PALETTE["cyan"]][i]))
        pdf.c.circle(x + 28, yy + 68, 13, fill=1, stroke=0)
        pdf.h2(t, x + 54, yy + 72, 13)
        pdf.txt(b, x + 22, yy + 54, 182, 8.8, 12.5)
    pdf.card(MARGIN, 162, 510, 118, "#FBFAFF")
    pdf.h2("Linguagem de experiência", 70, 238, 15)
    pdf.txt("Humana, objetiva e acessível. O tom visual usa superfícies claras, gradientes discretos e componentes familiares para comunicar inovação sem criar ruído ou intimidar usuários com baixa familiaridade digital.", 70, 216, 450, 10.5, 15)
    pdf.show()


def page_palette(pdf: PDF):
    pdf.bg("Paleta Oficial", "Identidade Visual")
    colors_data = [
        ("Roxo Vivo", PALETTE["vivo"], "Ações principais, foco e elementos de marca."),
        ("Roxo Profundo", PALETTE["deep"], "Texto principal, fundos institucionais e contraste."),
        ("Violeta Tecnológico", PALETTE["violet"], "Estados inteligentes, IA e destaques secundários."),
        ("Magenta Adaptativo", PALETTE["magenta"], "Personalização, calor humano e chamada 'a você'."),
        ("Azul Digital", PALETTE["blue"], "Confiança, dados, navegação e painéis."),
        ("Ciano Inclusivo", PALETTE["cyan"], "Acessibilidade, feedback positivo e suporte assistivo."),
    ]
    y = 635
    for i, (name, hx, desc) in enumerate(colors_data):
        x = MARGIN + (i % 2) * 258
        yy = y - (i // 2) * 154
        pdf.card(x, yy, 226, 116)
        pdf.c.setFillColor(col(hx))
        pdf.c.roundRect(x + 18, yy + 56, 52, 42, 14, fill=1, stroke=0)
        pdf.h2(name, x + 84, yy + 88, 12)
        pdf.c.setFont(SEMIBOLD, 9)
        pdf.c.setFillColor(col(PALETTE["muted"]))
        pdf.c.drawString(x + 84, yy + 70, hx)
        pdf.txt(desc, x + 18, yy + 44, 186, 8.7, 12)
    pdf.card(MARGIN, 93, 510, 92, "#FFFFFF")
    pdf.c.drawImage(ImageReader(str(ASSETS / "adapt_gradient.png")), 70, 132, width=202, height=24, mask="auto")
    pdf.h2("Gradiente de adaptação", 295, 158, 14)
    pdf.txt("Uso reservado para a expressão 'a você', estados de adaptação e transições de alto valor. Deve ser suave, sem brilho excessivo.", 295, 138, 210, 9.3, 13)
    pdf.show()


def page_typography(pdf: PDF):
    pdf.bg("Tipografia e Hierarquia", "Identidade Visual")
    pdf.card(MARGIN, 504, 510, 178)
    pdf.h1("Segoe UI", 72, 622, 32)
    pdf.txt("Família tipográfica de interface escolhida pela clareza, familiaridade e excelente leitura em produtos digitais. O sistema prioriza pesos Regular, Semibold e Bold.", 72, 584, 420, 11, 16)
    levels = [("Display", 34, "Capas e grandes mensagens institucionais"), ("H1", 24, "Títulos de páginas"), ("H2", 16, "Seções e cards amplos"), ("Body", 10.5, "Texto de apoio e explicações"), ("Caption", 8, "Metadados, rótulos e estados")]
    y = 432
    for label, size, use in levels:
        pdf.c.setFont(BOLD if size >= 16 else FONT, size)
        pdf.c.setFillColor(col(PALETTE["deep"]))
        pdf.c.drawString(MARGIN, y, label)
        pdf.c.setFont(FONT, 9)
        pdf.c.setFillColor(col(PALETTE["muted"]))
        pdf.c.drawString(178, y + 2, use)
        pdf.c.setStrokeColor(col("#E1D9ED"))
        pdf.c.line(MARGIN, y - 16, PAGE_W - MARGIN, y - 16)
        y -= 64
    pdf.show()


def page_layout(pdf: PDF):
    pdf.bg("Grid, Espaçamento e Superfícies", "Sistema Visual")
    pdf.txt("A interface usa grid de 12 colunas no desktop, margens amplas e blocos modulares com raio consistente. O espaço em branco é parte ativa da experiência: separa decisões, reduz ansiedade e favorece leitura.", MARGIN, 682, 500, 11.3, 16)
    pdf.card(60, 405, 475, 210)
    for i in range(12):
        x = 82 + i * 35
        pdf.c.setFillColor(col(mix("#F1ECFA", "#E4FAFF", i / 11)))
        pdf.c.roundRect(x, 435, 24, 146, 7, fill=1, stroke=0)
    pdf.h2("12 colunas - 24 px de respiro interno", 86, 388, 13)
    for i, (name, val) in enumerate([("Raio base", "16-24 px"), ("Gap", "16/24/32 px"), ("Sombra", "8-24 px suave"), ("Borda", "#E7DFF2")]):
        x = 64 + (i % 2) * 250
        y = 245 - (i // 2) * 82
        pdf.card(x, y, 218, 58)
        pdf.h2(name, x + 18, y + 34, 11)
        pdf.txt(val, x + 126, y + 38, 70, 9, 12, PALETTE["vivo"], True)
    pdf.show()


def page_components(pdf: PDF):
    pdf.bg("Componentes Base", "Design System")
    comps = [
        ("Botão primário", "Roxo Vivo, altura 48, texto semibold e foco visível."),
        ("Botão secundário", "Superfície clara, borda sutil e texto Roxo Profundo."),
        ("Cards", "Raio 18, sombra discreta e conteúdo escaneável."),
        ("Campos", "Rótulo persistente, ajuda contextual e validação clara."),
        ("Menus", "Opções por modalidade com ícone e descrição curta."),
        ("Badges", "Estados, preferências e métricas em leitura rápida."),
    ]
    y = 620
    for i, (t, b) in enumerate(comps):
        x = MARGIN + (i % 2) * 258
        yy = y - (i // 2) * 134
        pdf.card(x, yy, 226, 94)
        pdf.h2(t, x + 20, yy + 62, 12)
        pdf.txt(b, x + 20, yy + 42, 176, 8.8, 12)
        pdf.c.setFillColor(col([PALETTE["vivo"], "#FFFFFF", "#FFFFFF", "#FFFFFF", PALETTE["violet"], PALETTE["cyan"]][i]))
        pdf.c.roundRect(x + 20, yy + 16, 88, 20, 10, fill=1, stroke=0)
    pdf.show()


def page_buttons_forms(pdf: PDF):
    pdf.bg("Botões, Campos e Feedback", "Design System")
    pdf.card(58, 496, 225, 140)
    pdf.c.setFillColor(col(PALETTE["vivo"]))
    pdf.c.roundRect(88, 580, 150, 36, 18, fill=1, stroke=0)
    pdf.c.setFillColor(colors.white)
    pdf.c.setFont(SEMIBOLD, 10)
    pdf.c.drawCentredString(163, 592, "Iniciar atendimento")
    pdf.c.setFillColor(col("#FFFFFF"))
    pdf.c.setStrokeColor(col(PALETTE["line"]))
    pdf.c.roundRect(88, 528, 150, 36, 18, fill=1, stroke=1)
    pdf.c.setFillColor(col(PALETTE["deep"]))
    pdf.c.drawCentredString(163, 540, "Conhecer o Mimo")
    pdf.card(312, 496, 225, 140)
    pdf.c.setStrokeColor(col(PALETTE["violet"]))
    pdf.c.setFillColor(colors.white)
    pdf.c.roundRect(342, 573, 158, 38, 13, fill=1, stroke=1)
    pdf.c.setFont(FONT, 8)
    pdf.c.setFillColor(col(PALETTE["muted"]))
    pdf.c.drawString(356, 598, "Como podemos ajudar?")
    pdf.c.setStrokeColor(col(PALETTE["line"]))
    pdf.c.roundRect(342, 522, 158, 38, 13, fill=1, stroke=1)
    pdf.c.drawString(356, 547, "CPF ou protocolo")
    states = [("Sucesso", PALETTE["green"]), ("Atenção", PALETTE["amber"]), ("Erro", PALETTE["red"]), ("IA processando", PALETTE["violet"])]
    for i, (name, color) in enumerate(states):
        pdf.card(58 + (i % 2) * 254, 330 - (i // 2) * 92, 225, 58)
        pdf.c.setFillColor(col(color))
        pdf.c.circle(80 + (i % 2) * 254, 360 - (i // 2) * 92, 8, fill=1, stroke=0)
        pdf.h2(name, 98 + (i % 2) * 254, 356 - (i // 2) * 92, 11)
        pdf.txt("Mensagem curta, específica e com próximo passo.", 98 + (i % 2) * 254, 342 - (i // 2) * 92, 150, 8, 11)
    pdf.show()


def page_icons(pdf: PDF):
    pdf.bg("Ícones e Linguagem Gráfica", "Design System")
    labels = ["Texto", "Voz", "Libras", "Fonte", "Contraste", "Histórico", "Dados", "Segurança", "Concluir"]
    for i, label in enumerate(labels):
        x = 66 + (i % 3) * 168
        y = 560 - (i // 3) * 130
        pdf.card(x, y, 126, 92)
        pdf.c.setFillColor(col([PALETTE["magenta"], PALETTE["violet"], PALETTE["blue"], PALETTE["cyan"]][i % 4]))
        pdf.c.circle(x + 63, y + 56, 22, fill=1, stroke=0)
        pdf.c.setFillColor(colors.white)
        pdf.c.setFont(BOLD, 16)
        pdf.c.drawCentredString(x + 63, y + 50, label[0])
        pdf.c.setFillColor(col(PALETTE["deep"]))
        pdf.c.setFont(SEMIBOLD, 9)
        pdf.c.drawCentredString(x + 63, y + 18, label)
    pdf.txt("O sistema privilegia ícones simples, arredondados e acompanhados de rótulo textual nos pontos críticos. Ícone sozinho aparece apenas em ações recorrentes e sempre com alternativa acessível.", 70, 142, 455, 10.2, 15)
    pdf.show()


def page_architecture(pdf: PDF):
    pdf.bg("Arquitetura do Site", "Arquitetura")
    nodes = [
        ("Página institucional", 70, 590, PALETTE["vivo"]),
        ("Entrada do chatbot", 315, 590, PALETTE["magenta"]),
        ("Escolha de modalidade", 315, 470, PALETTE["violet"]),
        ("Atendimento Mimo", 70, 350, PALETTE["blue"]),
        ("Acessibilidade", 315, 350, PALETTE["cyan"]),
        ("Histórico", 70, 230, PALETTE["deep"]),
        ("Conclusão", 315, 230, PALETTE["green"]),
    ]
    for text, x, y, color in nodes:
        pdf.card(x, y, 190, 64)
        pdf.c.setFillColor(col(color))
        pdf.c.circle(x + 24, y + 33, 10, fill=1, stroke=0)
        pdf.h2(text, x + 44, y + 38, 10.5)
    pdf.c.setStrokeColor(col(PALETTE["violet"]))
    pdf.c.setLineWidth(2)
    for x1, y1, x2, y2 in [(260, 622, 315, 622), (410, 590, 410, 534), (315, 502, 260, 382), (410, 470, 410, 414), (165, 350, 165, 294), (260, 262, 315, 262)]:
        pdf.c.line(x1, y1, x2, y2)
    pdf.txt("A navegação organiza descoberta, escolha de canal, atendimento e encerramento como um fluxo contínuo. Preferências acompanham o usuário entre etapas e reduzem repetição de informações.", 70, 145, 455, 10.5, 15)
    pdf.show()


def page_screens(pdf: PDF, title, filename, caption, section="Interfaces"):
    pdf.bg(title, section)
    pdf.image(filename, 54, 308, 488, 319)
    pdf.card(70, 124, 455, 124, "#FFFFFF")
    pdf.txt(caption, 94, 214, 402, 10.4, 15)
    pdf.show()


def page_modalities(pdf: PDF):
    pdf.bg("Modalidades de Atendimento", "Experiência")
    items = [
        ("Conversa por texto", "Para quem prefere leitura, registro e autonomia silenciosa.", PALETTE["vivo"]),
        ("Conversa por voz", "Reduz esforço de digitação e apoia mobilidade ou baixa visão.", PALETTE["blue"]),
        ("Texto simplificado", "Traduz termos técnicos em linguagem direta e menos carregada.", PALETTE["magenta"]),
        ("Libras", "Atendimento visual com intérprete/avatar e conteúdo legendado.", PALETTE["cyan"]),
        ("Modo adaptável", "Sem preferência: o sistema aprende sinais e sugere o melhor canal.", PALETTE["violet"]),
    ]
    y = 624
    for i, (t, b, color) in enumerate(items):
        pdf.card(64, y - i * 98, 466, 70)
        pdf.c.setFillColor(col(color))
        pdf.c.roundRect(86, y + 18 - i * 98, 48, 32, 16, fill=1, stroke=0)
        pdf.c.setFillColor(colors.white)
        pdf.c.setFont(BOLD, 13)
        pdf.c.drawCentredString(110, y + 27 - i * 98, str(i + 1))
        pdf.h2(t, 154, y + 42 - i * 98, 12.5)
        pdf.txt(b, 154, y + 24 - i * 98, 330, 8.8, 12)
    pdf.show()


def page_accessibility(pdf: PDF):
    pdf.bg("Acessibilidade como Sistema", "Acessibilidade")
    items = [
        "Aumento de fonte", "Alto contraste", "Leitura em voz alta", "Legendas",
        "Navegação por teclado", "Libras", "Redução de movimentos", "Tema claro e escuro",
        "Persistência das preferências",
    ]
    for i, item in enumerate(items):
        x = 62 + (i % 3) * 166
        y = 580 - (i // 3) * 118
        pdf.card(x, y, 130, 82)
        pdf.c.setFillColor(col([PALETTE["vivo"], PALETTE["magenta"], PALETTE["blue"], PALETTE["cyan"]][i % 4]))
        pdf.c.roundRect(x + 18, y + 48, 34, 18, 9, fill=1, stroke=0)
        pdf.h2(item, x + 18, y + 32, 9.6)
    pdf.card(64, 112, 466, 98, "#FBFAFF")
    pdf.txt("A preferência do usuário é tratada como dado de experiência: permanece salva, pode ser alterada a qualquer momento e nunca bloqueia alternativas. O objetivo é oferecer controle sem exigir configuração técnica.", 90, 176, 410, 10.2, 15)
    pdf.show()


def page_mimo_intro(pdf: PDF):
    pdf.bg("Mimo: Assistente Vivo AdaptAI", "Mimo")
    pdf.image("mimo_welcome.png", 60, 394, 230, 230)
    pdf.card(310, 424, 220, 170)
    pdf.h2("Personalidade", 334, 558, 15)
    pdf.txt("Calmo, claro, paciente e resolutivo. Mimo traduz o atendimento em pequenos passos, confirma o entendimento e adapta linguagem, canal e ritmo ao usuário.", 334, 532, 160, 10, 14)
    pdf.card(70, 160, 455, 150)
    pdf.h2("Função no produto", 94, 274, 15)
    pdf.txt("Mimo é a camada de interação do Vivo AdaptAI: recebe intenção, identifica barreiras, oferece modalidade adequada, conduz o fluxo de atendimento e mantém feedback visual constante para que o usuário nunca se sinta perdido.", 94, 248, 400, 10.5, 15.5)
    pdf.show()


def page_mimo_states(pdf: PDF):
    pdf.bg("Estados Visuais do Mimo", "Mimo")
    states = [
        ("Boas-vindas", "welcome"), ("Neutro", "neutral"), ("Ouvindo", "listening"),
        ("Processando", "processing"), ("Respondendo", "responding"), ("Concluído", "done"),
        ("Erro", "error"),
    ]
    for i, (label, key) in enumerate(states):
        x = 58 + (i % 4) * 124
        y = 528 - (i // 4) * 190
        pdf.card(x, y, 104, 136)
        pdf.image(f"mimo_{key}.png", x + 10, y + 40, 84, 84)
        pdf.c.setFont(SEMIBOLD, 8.5)
        pdf.c.setFillColor(col(PALETTE["deep"]))
        pdf.c.drawCentredString(x + 52, y + 20, label)
    pdf.txt("Os estados preservam a mesma silhueta para reforçar reconhecimento. A variação aparece em expressão, cor de acento e microfeedback, mantendo consistência visual e leitura imediata.", 70, 196, 455, 10.2, 15)
    pdf.show()


def page_mimo_interaction(pdf: PDF):
    pdf.bg("Modelo de Interação do Mimo", "Mimo")
    steps = [
        ("Escuta", "Identifica intenção, canal e sinais de acessibilidade."),
        ("Adapta", "Ajusta linguagem, ritmo, contraste e modalidade."),
        ("Orienta", "Mostra próximos passos em mensagens curtas."),
        ("Confirma", "Valida entendimento, resultado e continuidade."),
    ]
    for i, (t, b) in enumerate(steps):
        x = 76 + i * 116
        pdf.c.setStrokeColor(col(PALETTE["line"]))
        if i < 3:
            pdf.c.line(x + 82, 486, x + 116, 486)
        pdf.card(x, 420, 92, 132)
        pdf.image(["mimo_listening.png", "mimo_processing.png", "mimo_responding.png", "mimo_done.png"][i], x + 18, 486, 56, 56)
        pdf.h2(t, x + 16, 468, 10.4)
        pdf.txt(b, x + 16, 448, 62, 7.5, 10.5)
    pdf.card(70, 176, 455, 130)
    pdf.txt("Mimo não substitui escolhas do usuário: ele sugere, explica e permite troca de modalidade a qualquer momento. Essa postura aumenta confiança e evita a sensação de atendimento automatizado imposto.", 96, 260, 400, 10.4, 15)
    pdf.show()


def page_dashboard(pdf: PDF):
    page_screens(pdf, "Dashboard Vivo AdaptAI", "screen_dashboard.png", "O dashboard consolida indicadores de atendimento, qualidade da IA, acessibilidade e desempenho operacional. KPIs no topo ajudam gestão executiva; gráficos mostram tendência e distribuição para tomada de decisão rápida.", "Dashboard")


def page_kpis(pdf: PDF):
    pdf.bg("KPIs e Métricas Gerenciais", "Dashboard")
    kpis = [
        ("Resolução no primeiro contato", "92%", PALETTE["vivo"]),
        ("Satisfação média", "4,8/5", PALETTE["magenta"]),
        ("Tempo médio reduzido", "-18%", PALETTE["blue"]),
        ("Uso de acessibilidade", "37%", PALETTE["cyan"]),
        ("Precisão da IA", "94%", PALETTE["violet"]),
        ("Continuidade de contexto", "89%", PALETTE["green"]),
    ]
    for i, (name, val, color) in enumerate(kpis):
        x = 60 + (i % 2) * 254
        y = 590 - (i // 2) * 132
        pdf.card(x, y, 222, 94)
        pdf.c.setFont(BOLD, 24)
        pdf.c.setFillColor(col(color))
        pdf.c.drawString(x + 22, y + 48, val)
        pdf.txt(name, x + 22, y + 32, 170, 8.8, 12, PALETTE["muted"])
    pdf.show()


def page_principles(pdf: PDF):
    pdf.bg("Princípios de UX Aplicados", "UX")
    principles = [
        "Hierarquia visual", "Clareza", "Consistência", "Feedback imediato",
        "Redução da carga cognitiva", "Personalização", "Inclusão", "Acessibilidade",
        "Continuidade de contexto",
    ]
    for i, p in enumerate(principles):
        x = 66 + (i % 3) * 166
        y = 594 - (i // 3) * 126
        pdf.card(x, y, 130, 88)
        pdf.c.setFillColor(col(mix(PALETTE["magenta"], PALETTE["cyan"], i / 8)))
        pdf.c.circle(x + 24, y + 58, 10, fill=1, stroke=0)
        pdf.txt(p, x + 22, y + 42, 86, 9.2, 12.5, PALETTE["deep"], True)
    pdf.txt("Cada princípio aparece como decisão concreta de interface: menos etapas, rótulos diretos, estados visíveis, canal flexível e preferências preservadas.", 74, 166, 440, 10.5, 15)
    pdf.show()


def page_journey(pdf: PDF):
    pdf.bg("Jornada do Usuário", "UX")
    steps = ["Descobre", "Escolhe", "Conversa", "Adapta", "Resolve", "Continua"]
    for i, s in enumerate(steps):
        x = 54 + i * 82
        pdf.c.setFillColor(col(mix(PALETTE["vivo"], PALETTE["cyan"], i / 5)))
        pdf.c.circle(x + 35, 492, 29, fill=1, stroke=0)
        pdf.c.setFillColor(colors.white)
        pdf.c.setFont(BOLD, 12)
        pdf.c.drawCentredString(x + 35, 487, str(i + 1))
        pdf.h2(s, x + 2, 426, 10.5)
        if i < 5:
            pdf.c.setStrokeColor(col(PALETTE["line"]))
            pdf.c.line(x + 66, 492, x + 82, 492)
    pdf.card(70, 198, 455, 118)
    pdf.txt("A jornada evita bifurcações complexas. O usuário pode começar por qualquer modalidade, receber apoio do Mimo e finalizar com confirmação, resumo e opção de retomar o atendimento depois.", 96, 270, 400, 10.5, 15)
    pdf.show()


def page_states(pdf: PDF):
    pdf.bg("Estados do Sistema", "UX")
    states = [
        ("Carregando", "Skeleton leve, sem bloquear leitura."),
        ("Vazio", "Explica o que falta e oferece ação clara."),
        ("Erro", "Mensagem humana, causa provável e recuperação."),
        ("Sem conexão", "Mantém dados locais e orienta tentativa."),
        ("Sucesso", "Confirma resultado e mostra próximo passo."),
        ("Transferência", "Informa mudança para humano sem perda de contexto."),
    ]
    for i, (t, b) in enumerate(states):
        x = MARGIN + (i % 2) * 258
        y = 606 - (i // 2) * 126
        pdf.card(x, y, 226, 86)
        pdf.h2(t, x + 20, y + 54, 11.5)
        pdf.txt(b, x + 20, y + 34, 174, 8.8, 12)
    pdf.show()


def page_voice_libras(pdf: PDF):
    pdf.bg("Voz, Libras e Texto Simplificado", "Experiência")
    pdf.card(64, 476, 466, 128)
    pdf.h2("Voz", 92, 570, 14)
    pdf.txt("Entrada por fala, leitura em voz alta, confirmação antes de ações sensíveis e controle de velocidade. Apoia usuários com baixa visão, mobilidade reduzida ou preferência oral.", 92, 546, 390, 9.8, 14)
    pdf.card(64, 318, 466, 128)
    pdf.h2("Libras", 92, 412, 14)
    pdf.txt("Interface visual com área dedicada, legendas e mensagens complementares. A experiência evita esconder informações essenciais apenas em áudio ou texto longo.", 92, 388, 390, 9.8, 14)
    pdf.card(64, 160, 466, 128)
    pdf.h2("Texto simplificado", 92, 254, 14)
    pdf.txt("Resumo em linguagem direta, frases curtas, termos técnicos explicados e estrutura de pergunta-resposta. Reduz carga cognitiva sem infantilizar o usuário.", 92, 230, 390, 9.8, 14)
    pdf.show()


def page_dark_theme(pdf: PDF):
    pdf.bg("Tema Claro e Escuro", "Acessibilidade")
    pdf.card(58, 358, 225, 234, "#FFFFFF")
    pdf.h2("Claro", 88, 552, 14)
    pdf.c.setFillColor(col(PALETTE["bg"]))
    pdf.c.roundRect(88, 398, 150, 120, 20, fill=1, stroke=0)
    pdf.c.setFillColor(col(PALETTE["vivo"]))
    pdf.c.roundRect(110, 480, 106, 20, 10, fill=1, stroke=0)
    pdf.c.setFillColor(col("#FFFFFF"))
    pdf.c.roundRect(110, 430, 106, 36, 12, fill=1, stroke=0)
    pdf.card(312, 358, 225, 234, "#2B164F", "#3C236D")
    pdf.c.setFillColor(colors.white)
    pdf.c.setFont(SEMIBOLD, 14)
    pdf.c.drawString(342, 552, "Escuro")
    pdf.c.setFillColor(col("#130B25"))
    pdf.c.roundRect(342, 398, 150, 120, 20, fill=1, stroke=0)
    pdf.c.setFillColor(col(PALETTE["cyan"]))
    pdf.c.roundRect(364, 480, 106, 20, 10, fill=1, stroke=0)
    pdf.c.setFillColor(col("#2B164F"))
    pdf.c.roundRect(364, 430, 106, 36, 12, fill=1, stroke=0)
    pdf.txt("O tema escuro preserva contraste e semântica cromática, mas evita fundos pretos puros. A alternância é uma preferência persistente, não apenas um recurso estético.", 76, 252, 440, 10.5, 15)
    pdf.show()


def page_governance(pdf: PDF):
    pdf.bg("Governança do Design System", "Entrega")
    pdf.txt("O sistema foi estruturado para crescer por tokens, componentes e padrões de UX documentados. Novas telas devem reutilizar paleta, espaçamento, estados e linguagem antes de propor variações.", MARGIN, 668, 500, 11, 16)
    rows = [("Tokens", "Cor, tipografia, raio, sombra e espaçamento."), ("Componentes", "Botões, cards, menus, campos e feedback."), ("Padrões", "Fluxos de atendimento, acessibilidade e estados."), ("Métricas", "Uso, satisfação, resolução e desempenho da IA.")]
    for i, (a, b) in enumerate(rows):
        pdf.card(70, 532 - i * 92, 455, 58)
        pdf.h2(a, 94, 566 - i * 92, 12)
        pdf.txt(b, 202, 566 - i * 92, 280, 9.2, 12.5)
    pdf.show()


def page_final(pdf: PDF):
    pdf.bg("Produto pronto para apresentação", "Entrega")
    pdf.image("mimo_done.png", 408, 442, 118, 118)
    pdf.h1("Vivo AdaptAI", 70, 560, 30)
    pdf.txt("Um ecossistema de atendimento que une inteligência artificial, acessibilidade e personalização para entregar a Vivo que se adapta a cada pessoa.", 70, 512, 310, 13, 18)
    pdf.card(70, 252, 455, 120, "#FFFFFF")
    pdf.txt("A Equipe Nexus entrega um produto digital com identidade consistente, arquitetura clara, componentes escaláveis e uma experiência centrada em inclusão. O resultado é corporativo, confiável e preparado para evoluir em ambiente real.", 96, 328, 400, 11, 16)
    pdf.pill("Equipe Nexus", 70, 170, 112, PALETTE["vivo"])
    pdf.pill("Desafio de Dados da Vivo", 194, 170, 160, PALETTE["blue"])
    pdf.show()


def build():
    ensure_dirs()
    make_assets()
    pdf = PDF()
    page_cover(pdf)
    page_manifesto(pdf)
    page_palette(pdf)
    page_typography(pdf)
    page_layout(pdf)
    page_components(pdf)
    page_buttons_forms(pdf)
    page_icons(pdf)
    page_architecture(pdf)
    page_screens(pdf, "Página Institucional", "screen_institutional.png", "A página institucional apresenta o propósito do produto, a assinatura 'A Vivo que se adapta a você' e chamadas claras para conhecer o Mimo ou iniciar atendimento.")
    page_screens(pdf, "Entrada do Chatbot", "screen_chat_entry.png", "A entrada prioriza escolha de modalidade com cards equivalentes. Nenhuma opção é tratada como secundária, reforçando inclusão e autonomia.")
    page_screens(pdf, "Atendimento Conversacional", "screen_chat.png", "O atendimento organiza mensagens por turnos, mostra presença do Mimo e mantém campo de entrada claro, com suporte para voz, texto e preferências.")
    page_screens(pdf, "Painel Conhecer o Mimo", "screen_institutional.png", "O painel apresenta função, personalidade e estados do assistente antes do atendimento. Isso reduz incerteza e cria confiança inicial.", "Mimo")
    page_modalities(pdf)
    page_voice_libras(pdf)
    page_accessibility(pdf)
    page_screens(pdf, "Preferências de Acessibilidade", "screen_accessibility.png", "O painel concentra ajustes essenciais e os comunica como preferências pessoais. Alterações têm feedback imediato e são persistidas entre sessões.", "Acessibilidade")
    page_dark_theme(pdf)
    page_screens(pdf, "Histórico e Continuidade", "screen_history.png", "O histórico preserva contexto, protocolos e preferências. O usuário retoma conversas sem explicar tudo de novo, e a gestão acompanha recorrência.")
    page_screens(pdf, "Conclusão do Atendimento", "screen_chat.png", "A conclusão combina resumo, confirmação de resolução, avaliação e próximos passos. O encerramento é claro e deixa portas abertas para continuidade.")
    page_states(pdf)
    page_mimo_intro(pdf)
    page_mimo_states(pdf)
    page_mimo_interaction(pdf)
    page_dashboard(pdf)
    page_kpis(pdf)
    page_principles(pdf)
    page_journey(pdf)
    page_governance(pdf)
    page_final(pdf)
    pdf.c.save()
    print(PDF_PATH)


if __name__ == "__main__":
    build()

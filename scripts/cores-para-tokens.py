"""Troca cores fixas do Tailwind por tokens do tema (Jorgeus, 24/11/2026).

1) Neutros (branco/cinzas) -> tokens que mudam com claro/escuro.
2) Azul usado como "cor principal" -> primary (segue o perfil Brasil!/Tech).
3) Cores de status (verde, vermelho, âmbar...) ganham variante dark:
   quando a lista de classes ainda não tem nenhuma.

Uso: python scripts/cores-para-tokens.py [--aplicar]   (sem --aplicar só conta)
"""
import re
import sys
from collections import Counter
from pathlib import Path

APLICAR = "--aplicar" in sys.argv
RAIZ = Path("src")
IGNORAR = {"LandingPage.tsx", "Login.tsx", "Marca.tsx",
           # captura em PDF precisa de fundo branco; telas que imitam o WhatsApp (ocultas)
           "ExportarMapaModal.tsx", "WhatsApp.tsx", "WhatsAppManager.tsx"}
# no mapa o azul marca tipo de ponto/camada: não vira "cor principal"
SEM_PRINCIPAL = ("mapa", "Mapa", "/map/", "DemandaAtividadesTab", "MunicipeProntuarioTab")

# prefixos permitidos antes da classe (variantes de estado/responsivo), nunca "dark:"
PRE = r"(?<![\w-])((?:(?:hover|focus|focus-visible|active|group-hover|disabled|data-\[state=\w+\]|sm|md|lg|xl):)*)"

NEUTROS = [
    (r"bg-white(?!/)", "bg-card"),  # bg-white/20 (sobre cor) fica
    (r"bg-(?:gray|slate|zinc|neutral)-50", "bg-muted/60"),
    (r"bg-(?:gray|slate|zinc|neutral)-100", "bg-muted"),
    (r"bg-(?:gray|slate|zinc|neutral)-200", "bg-muted"),
    (r"text-(?:gray|slate|zinc|neutral)-(?:900|800)", "text-foreground"),
    (r"text-(?:gray|slate|zinc|neutral)-(?:700|600|500|400)", "text-muted-foreground"),
    (r"text-black", "text-foreground"),
    (r"border-(?:gray|slate|zinc|neutral)-(?:100|200|300)", "border-border"),
    (r"divide-(?:gray|slate|zinc|neutral)-(?:100|200|300)", "divide-border"),
    (r"ring-(?:gray|slate)-(?:200|300)", "ring-border"),
    (r"placeholder-(?:gray|slate)-(?:400|500)", "placeholder:text-muted-foreground"),
]

PRINCIPAL = [
    (r"bg-blue-(?:600|700)", "bg-primary"),
    (r"bg-blue-500", "bg-primary"),
    (r"text-blue-(?:500|600|700|800)", "text-primary"),
    (r"bg-blue-50", "bg-primary/10"),
    (r"bg-blue-100", "bg-primary/15"),
    (r"border-blue-(?:200|300)", "border-primary/30"),
    (r"border-blue-(?:400|500|600)", "border-primary"),
    (r"ring-blue-(?:400|500)", "ring-primary"),
    (r"from-blue-(?:500|600)", "from-primary"),
    (r"to-blue-(?:500|600|700)", "to-primary"),
]

# variantes escuras para cores de status em listas sem nenhuma "dark:"
STATUS = "green|emerald|red|rose|amber|yellow|orange|purple|violet|indigo|teal|cyan|sky|pink|lime|fuchsia"
DARK = [
    (rf"(?<![\w:-])bg-({STATUS})-(50|100)(?![\w/-])", lambda m: f"dark:bg-{m.group(1)}-950/40"),
    (rf"(?<![\w:-])bg-({STATUS})-200(?![\w/-])", lambda m: f"dark:bg-{m.group(1)}-900/50"),
    (rf"(?<![\w:-])text-({STATUS})-(700|800|900)(?![\w/-])", lambda m: f"dark:text-{m.group(1)}-300"),
    (rf"(?<![\w:-])text-({STATUS})-600(?![\w/-])", lambda m: f"dark:text-{m.group(1)}-400"),
    (rf"(?<![\w:-])border-({STATUS})-(100|200|300)(?![\w/-])", lambda m: f"dark:border-{m.group(1)}-800"),
]

STRING = re.compile(r'"[^"\n]{3,600}"|`[^`]{3,1200}`|\'[^\'\n]{3,400}\'')

stats = Counter()


def trocar_simples(texto: str, regras) -> str:
    for padrao, novo in regras:
        rx = re.compile(PRE + padrao + r"(?![\w-])")

        def sub(m):
            stats[padrao] += 1
            return m.group(1) + novo
        texto = rx.sub(sub, texto)
    return texto


def com_dark(lit: str) -> str:
    if "dark:" in lit:
        return lit
    extras = []
    for padrao, f in DARK:
        for m in re.finditer(padrao, lit):
            extras.append(f(m))
    if not extras:
        return lit
    stats["(variantes escuras)"] += len(extras)
    unicos = " ".join(dict.fromkeys(extras))
    return lit[:-1] + " " + unicos + lit[-1]


TOKENS = re.compile(r"(?<![\w:-])(bg-card|bg-muted|text-foreground|text-muted-foreground|border-border)(?![\w-])")
DARK_NEUTRO = re.compile(r"\s?dark:(?:hover:)?(?:bg|text|border|divide)-(?:gray|slate|zinc|neutral)-\d{2,3}(?:/\d+)?(?![\w-])")


def processar(src: str, principal: bool) -> str:
    def em_string(m):
        lit = m.group(0)
        if not re.search(r"\b(bg|text|border|divide|ring|from|to|placeholder)-", lit):
            return lit
        lit = trocar_simples(lit, NEUTROS)
        if principal:
            lit = trocar_simples(lit, PRINCIPAL)
        # o token já resolve claro/escuro: some o "dark:" cinza antigo
        if TOKENS.search(lit):
            novo = DARK_NEUTRO.sub("", lit)
            if novo != lit:
                stats["(dark: cinza removido)"] += 1
                lit = novo
        return com_dark(lit)
    return STRING.sub(em_string, src)


mudados = []
for p in sorted(RAIZ.rglob("*.tsx")):
    if p.name in IGNORAR or "components/ui" in p.as_posix():
        continue
    antes = p.read_text(encoding="utf-8")
    depois = processar(antes, principal=not any(x in p.as_posix() for x in SEM_PRINCIPAL))
    if depois != antes:
        mudados.append(p)
        if APLICAR:
            p.write_text(depois, encoding="utf-8")

print(f"arquivos alterados: {len(mudados)}")
for k, v in stats.most_common():
    print(f"  {v:5d}  {k}")
print("APLICADO" if APLICAR else "(simulação — rode com --aplicar)")

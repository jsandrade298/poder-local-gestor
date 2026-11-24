"""Gera os arquivos da marca Jorgeus (sem fundo) a partir dos JPG enviados.

Uso: python scripts/gerar-marca.py design/marca/originais public   (precisa de pillow e numpy)

Entradas (pasta IMG):
  1 Brasil logo claro · 3 Brasil ícone claro · 5 Jovem ícone claro · 8 Jovem logo claro
  2 Brasil ícone escuro (fundo navy, para ícone do app)
Saídas (pasta OUT = public/brand e public/icons):
  brasil|jovem -icone.png, -logo-claro.png, -logo-escuro.png
  favicon, apple-touch, ícones do PWA (Brasil!).
"""
import sys
import numpy as np
from PIL import Image

IMG, PUB = sys.argv[1], sys.argv[2]


def cor_para_alfa(im: Image.Image, fundo=(255, 255, 255)) -> Image.Image:
    """Remove um fundo de cor sólida mantendo bordas suaves (estilo 'color to alpha')."""
    a = np.asarray(im.convert("RGB")).astype(np.float64) / 255.0
    bg = np.array(fundo, dtype=np.float64) / 255.0
    # alfa mínimo que explica o pixel como mistura de uma cor válida com o fundo
    alfa = np.zeros(a.shape[:2])
    for c in range(3):
        d = a[..., c] - bg[c]
        lim = np.where(d > 0, (1 - bg[c]), bg[c])
        lim = np.where(lim == 0, 1e-6, lim)
        alfa = np.maximum(alfa, np.abs(d) / lim)
    alfa0 = np.clip(alfa, 0, 1)
    # A arte é sólida: o miolo fica 100% opaco com a cor original; só a borda
    # (antisserrilhado) fica semitransparente, com a cor "tirando o branco".
    seguro = np.where(alfa0 == 0, 1, alfa0)[..., None]
    sem_fundo = np.clip((a - bg * (1 - alfa0[..., None])) / seguro, 0, 1)
    # quase binário: só a borda fina (alfa0 < ~0.15) fica translúcida
    alfa = np.clip((alfa0 - 0.03) / 0.12, 0, 1)
    rgb = np.where((alfa >= 1)[..., None], a, sem_fundo)
    out = np.dstack([rgb, alfa])
    return Image.fromarray((out * 255).round().astype(np.uint8), "RGBA")


def aparar(im: Image.Image, margem=0.02) -> Image.Image:
    caixa = im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(caixa)
    m = int(max(im.size) * margem)
    novo = Image.new("RGBA", (im.width + 2 * m, im.height + 2 * m), (0, 0, 0, 0))
    novo.paste(im, (m, m))
    return novo


def versao_escura(logo: Image.Image, inicio_texto: float) -> Image.Image:
    """Texto azul-marinho/cinza vira branco/cinza-claro; o símbolo colorido fica igual."""
    a = np.asarray(logo).astype(np.float64)
    rgb, al = a[..., :3], a[..., 3]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    croma = mx - mn  # navy (10,25,47) tem croma ~37; dourado/verde/roxo > 150
    x = np.arange(a.shape[1])[None, :].repeat(a.shape[0], axis=0)
    no_texto = x > a.shape[1] * inicio_texto
    lum = rgb.mean(axis=2)
    # logotipo: navy escuro; tagline: cinza neutro (o degradê do "E" tem croma maior)
    neutro = no_texto & (al > 0) & (((croma < 60) & (lum < 70)) | ((croma < 22) & (lum < 170)))
    # navy escuro (logotipo) -> branco; cinza da tagline -> cinza claro azulado
    cor = np.where((lum < 70)[..., None], [255, 255, 255], [203, 213, 225])
    rgb = np.where(neutro[..., None], cor, rgb)
    return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), "RGBA")


def quadrado(im: Image.Image, lado: int, fundo=None, folga=0.12) -> Image.Image:
    base = Image.new("RGBA", (lado, lado), fundo or (0, 0, 0, 0))
    interno = int(lado * (1 - 2 * folga))
    c = im.copy()
    c.thumbnail((interno, interno), Image.LANCZOS)
    base.alpha_composite(c, ((lado - c.width) // 2, (lado - c.height) // 2))
    return base


def abrir(n):
    return Image.open(f"{IMG}/{n}.jpg")


marca = f"{PUB}/brand"
import os
os.makedirs(marca, exist_ok=True)

# Ícones (monograma J)
icone = {"brasil": aparar(cor_para_alfa(abrir("brasil-icone-claro"))), "jovem": aparar(cor_para_alfa(abrir("jovem-icone-claro")))}
for p, im in icone.items():
    quadrado(im, 512, folga=0.02).save(f"{marca}/{p}-icone.png", optimize=True)

# Logos completos
for p, n in (("brasil", "brasil-logo-claro"), ("jovem", "jovem-logo-claro")):
    claro = aparar(cor_para_alfa(abrir(n)), margem=0.01)
    claro.thumbnail((1400, 1400), Image.LANCZOS)
    claro.save(f"{marca}/{p}-logo-claro.png", optimize=True)
    escuro = versao_escura(claro, inicio_texto=0.27)
    escuro.save(f"{marca}/{p}-logo-escuro.png", optimize=True)
    # Só a palavra JORGEUS (sem símbolo e sem a frase), para a barra lateral
    al = np.asarray(claro.getchannel("A")) > 10
    # o texto começa depois da primeira faixa vazia de colunas que vem após o símbolo
    # (o maior vão de colunas vazias na metade esquerda separa símbolo e texto)
    cols = al.sum(axis=0) > 0
    melhor, x, n = (0, 0), 0, int(len(cols) * 0.5)
    while x < n:
        if not cols[x]:
            ini = x
            while x < n and not cols[x]:
                x += 1
            if ini > 0 and x - ini > melhor[1] - melhor[0]:
                melhor = (ini, x)
        x += 1
    x0 = melhor[1]
    linhas = al[:, x0:].sum(axis=1) > 0
    ys = np.where(linhas)[0]
    topo = ys[0]
    # primeira faixa vazia depois do topo separa a palavra da frase
    fim = topo
    while fim < len(linhas) and linhas[fim]:
        fim += 1
    for nome, im in (("claro", claro), ("escuro", escuro)):
        palavra = aparar(im.crop((x0, topo, im.width, fim)), margem=0.01)
        palavra.save(f"{marca}/{p}-palavra-{nome}.png", optimize=True)

# Ícones do app (Brasil!): fundo azul-marinho do manual, cantos retos (o sistema arredonda)
navy = (8, 24, 43, 255)
app = icone["brasil"]
for lado in (72, 96, 128, 144, 152, 192, 384, 512):
    quadrado(app, lado, fundo=navy, folga=0.16).convert("RGB").save(f"{PUB}/icons/icon-{lado}x{lado}.png", optimize=True)
quadrado(app, 180, fundo=navy, folga=0.16).convert("RGB").save(f"{PUB}/apple-touch-icon.png", optimize=True)
quadrado(app, 32, folga=0.02).save(f"{PUB}/favicon-32x32.png", optimize=True)
fav = quadrado(app, 64, folga=0.02)
fav.save(f"{PUB}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
quadrado(app, 1200, fundo=navy, folga=0.3).convert("RGB").save(f"{marca}/og-imagem.png", optimize=True)
print("ok")

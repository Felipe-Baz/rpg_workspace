"""Converte as-cinco-marcas.md em lore-marcas.json (formato do importador do Mestre).

Uso: python scripts/gerar-lore.py
O JSON gerado é SPOILER: fica na raiz do projeto, fora de src/ e public/, e nunca deve ser importado pelo código.
"""
import json, re, sys, pathlib

raiz = pathlib.Path(__file__).resolve().parent.parent
md = (raiz / "as-cinco-marcas.md").read_text(encoding="utf8")

IDS = ["eco-vazio","maos-que-lembram","sangue-que-nega","voz-perdida","reflexo-partido","juramento-cinzento",
       "segundo-pacto","pagina-que-esquece","sono-roubado","fome-eterna","coracao-de-ferro","maos-manchadas",
       "tempo-perdido","fera-interior","silencio-divino","sombra-viva","preco-justo","pele-de-vidro",
       "ultimo-suspiro","coro-silencioso"]

blocos = re.split(r"^## (\d+)\. Marca .*$", md, flags=re.M)
# blocos = [pre, num, corpo, num, corpo, ...]
saida, erros = {}, []
for i in range(1, len(blocos), 2):
    n = int(blocos[i]); corpo = blocos[i + 1]
    corpo = re.split(r"^## (?!\d)", corpo, flags=re.M)[0]  # corta seções finais (Cobertura, Notas)
    mid = IDS[n - 1]

    def campo(rotulo):
        m = re.search(rf"^\*\*{rotulo}(?: — (.+?))?:\*\*\s*(.*?)(?=^\*\*[A-ZÇ]|^###|^---|\Z)", corpo, flags=re.M | re.S)
        return (m.group(1) or "", m.group(2).strip()) if m else ("", "")

    _, vendido = campo("O que foi vendido")
    pn, passiva = campo("Passiva")
    _, fardo = campo("Fardo")
    hn, hab = campo("Habilidade")
    _, remocao = campo("Remoção")

    circles = []
    for linha in corpo.splitlines():
        if re.match(r"^\| \*\*[IVX]+ — ", linha):
            cel = [c.strip() for c in linha.strip().strip("|").split("|")]
            if len(cel) == 3:
                circles.append({"circulo": cel[0].strip("*"), "gatilho": cel[1], "mudanca": cel[2]})

    if len(circles) != 9 or not (passiva and fardo and hab and remocao and pn and hn):
        erros.append(f"{n} {mid}: circles={len(circles)} passiva={bool(passiva)} fardo={bool(fardo)} hab={bool(hab)} rem={bool(remocao)}")
    saida[mid] = {"sold": vendido, "passivaNome": pn, "passiva": passiva, "fardo": fardo,
                  "habilidadeNome": hn, "habilidade": hab, "circles": circles, "remocao": remocao}

if len(saida) != 20:
    erros.append(f"esperava 20 Marcas, achei {len(saida)}")
(raiz / "lore-marcas.json").write_text(json.dumps(saida, ensure_ascii=False, indent=2), encoding="utf8")
print(f"{len(saida)} Marcas gravadas em lore-marcas.json")
if erros:
    print("PROBLEMAS:\n" + "\n".join(erros)); sys.exit(1)

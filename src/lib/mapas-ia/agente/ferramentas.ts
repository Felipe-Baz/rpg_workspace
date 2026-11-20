// Catálogo de ferramentas do agente. Cada ferramenta valida os argumentos e devolve SOMENTE comandos
// já suportados pela cena (adicionar/atualizar/remover objeto, camada, grid, fundo). Módulo puro.
import type { Comando } from "../../cena/comandos.ts";
import { baseDoObjeto } from "../../cena/geometria.ts";
import { ASSET_LUZ, ASSET_ROTULO, type Asset, type Camada, type Cena, type ObjetoCena, type TipoAsset, type TipoCamada } from "../../cena/tipos.ts";
import { filtrarAssets, normalizarTags, normalizarTexto, sugerirReuso, tagsDe, tipoDe } from "../assets/biblioteca.ts";
import { validarPedido } from "../assets/jobs.ts";
import { chaveOrdem, obterPerspectiva } from "../perspectivas/registro.ts";
import { poissonDisco, rng, sementeDe } from "./aleatorio.ts";
import { dentroDaCaixa, deEscala, deFracao, paraCaixa, paraEscala, paraFracao, type Caixa, type Regiao } from "./coords.ts";
import { ErroFerramenta, type EstadoAgente, type Ferramenta, type ResultadoFerramenta, type Schema } from "./tipos.ts";

// ---------- Limites por chamada ----------
export const MAX_ESPALHAR = 300;
export const MAX_PECAS_CAMINHO = 400;
export const MAX_LADRILHOS = 400;
export const MAX_GERACOES = 8;
/** Interseção acima desta fração do menor objeto conta como colisão. */
export const LIMITE_COLISAO = 0.5;
export const PREFIXO_PROVISORIO = "pendente-";

// ---------- Schemas reutilizados ----------
const num = (description: string, extra: Partial<Schema> = {}): Schema => ({ type: "number", description, ...extra });
const str = (description: string, extra: Partial<Schema> = {}): Schema => ({ type: "string", description, ...extra });
const regiaoSchema: Schema = {
  type: "object",
  description: "Retângulo nas unidades do mapa (canto superior esquerdo + tamanho). Em grid, cobre as células inteiras.",
  properties: {
    x: num("Coluna (grid) ou % (cenário) do canto esquerdo."),
    y: num("Linha (grid) ou % (cenário) do topo."),
    largura: num("Largura em células ou %.", { minimum: 0 }),
    altura: num("Altura em células ou %.", { minimum: 0 }),
    forma: str("Forma dentro do retângulo.", { enum: ["retangulo", "elipse"] }),
  },
  required: ["x", "y", "largura", "altura"],
};
const idsSchema: Schema = {
  type: "array",
  description: 'Ids dos objetos. Use ["selecao"] para os objetos selecionados pelo mestre.',
  items: { type: "string" },
  minItems: 1,
  maxItems: 500,
};
const corSchema = str("Cor CSS #rrggbb.", { maxLength: 9 });

// ---------- Utilidades ----------
const CAMADA_POR_TIPO: Record<TipoAsset, TipoCamada> = { sprite: "objetos", textura: "terreno", pincel: "caminhos", decal: "decals" };
const ehCor = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
const graus = (rad: number) => Math.round((rad * 180) / Math.PI);
const rad = (g: number) => (g * Math.PI) / 180;

const mapaAssets = (e: EstadoAgente) => new Map(e.assets.map((a) => [a.id, a]));

function asset(e: EstadoAgente, id: unknown): Asset {
  const a = e.assets.find((x) => x.id === id);
  if (!a) throw new ErroFerramenta(`Asset "${String(id)}" não existe na biblioteca da mesa. Use buscar_asset para achar ids válidos.`);
  return a;
}

/** Camada pelo id ou nome (padrão: a do tipo indicado). Camada oculta ou travada é recusada. */
function camada(cena: Cena, ref: unknown, tipoPadrao: TipoCamada): Camada {
  const c =
    typeof ref === "string" && ref
      ? cena.camadas.find((x) => x.id === ref || normalizarTexto(x.nome) === normalizarTexto(ref) || x.tipo === ref)
      : cena.camadas.find((x) => x.tipo === tipoPadrao);
  if (!c) throw new ErroFerramenta(`Camada "${String(ref ?? tipoPadrao)}" não existe. Camadas: ${cena.camadas.map((x) => x.nome).join(", ")}.`);
  if (c.travada) throw new ErroFerramenta(`A camada "${c.nome}" está travada pelo mestre.`);
  return c;
}

const proximoZ = (cena: Cena, camadaId: string) => Math.max(-1, ...cena.objetos.filter((o) => o.camadaId === camadaId).map((o) => o.z)) + 1;

/** Ids informados; "selecao" vira a seleção atual do editor. */
function resolverIds(e: EstadoAgente, ids: unknown): string[] {
  const lista = (ids as string[]).flatMap((id) => (id === "selecao" ? e.selecao : [id]));
  if ((ids as string[]).includes("selecao") && !e.selecao.length) throw new ErroFerramenta("Não há objetos selecionados no editor.");
  const faltando = lista.filter((id) => !e.cena.objetos.some((o) => o.id === id));
  if (faltando.length) throw new ErroFerramenta(`Objetos inexistentes: ${faltando.slice(0, 5).join(", ")}. Use listar_objetos.`);
  return [...new Set(lista)];
}

/** Caixa (px do canvas, sem rotação) de um objeto. */
function caixaPx(cena: Cena, o: Pick<ObjetoCena, "x" | "y" | "escala" | "assetId" | "rotulo">, assets: Map<string, Asset>) {
  const b = baseDoObjeto(o as ObjetoCena, assets) ?? { largura: 1, altura: 1 };
  const w = o.escala * cena.largura;
  const h = w * (b.altura / b.largura);
  return { x0: o.x * cena.largura - w / 2, y0: o.y * cena.altura - h / 2, x1: o.x * cena.largura + w / 2, y1: o.y * cena.altura + h / 2 };
}

/** Objeto da mesma camada com que o novo colide (interseção > LIMITE_COLISAO do menor). */
function colisao(cena: Cena, novo: ObjetoCena, assets: Map<string, Asset>): ObjetoCena | undefined {
  const a = caixaPx(cena, novo, assets);
  const area = (c: typeof a) => Math.max(0, c.x1 - c.x0) * Math.max(0, c.y1 - c.y0);
  return cena.objetos.find((o) => {
    if (o.camadaId !== novo.camadaId || o.assetId === ASSET_LUZ || o.assetId === ASSET_ROTULO) return false;
    const b = caixaPx(cena, o, assets);
    const inter = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    return inter > LIMITE_COLISAO * Math.min(area(a), area(b));
  });
}

/** Aviso de consistência de estilo: asset de outro tema (ou sem tema numa cena com tema). */
function avisoTema(e: EstadoAgente, a: Asset): string[] {
  if (!e.cena.temaId || a.temaId === e.cena.temaId) return [];
  return [`"${a.nome}" não pertence ao tema da cena${a.temaId ? " (é de outro tema)" : " (sem tema)"}.`];
}

/** Rotação só faz sentido em top-down (isométrico depende do ângulo da câmera). */
const permiteRotacao = (cena: Cena) => obterPerspectiva(cena.perspectiva)?.ordenacao !== "porY";

/** Em perspectivas ordenadas por Y, z fica 0: quem está mais abaixo aparece na frente. */
const zPara = (cena: Cena, camadaId: string) => (obterPerspectiva(cena.perspectiva)?.ordenacao === "porY" ? 0 : proximoZ(cena, camadaId));

const nomeAsset = (e: EstadoAgente, id: string) =>
  id === ASSET_LUZ ? "luz" : id === ASSET_ROTULO ? "rótulo" : (e.assets.find((a) => a.id === id)?.nome ?? id);

function descreverObjeto(e: EstadoAgente, o: ObjetoCena) {
  const p = deFracao(e.cena, o);
  return {
    id: o.id,
    asset: nomeAsset(e, o.assetId),
    assetId: o.assetId,
    camada: e.cena.camadas.find((c) => c.id === o.camadaId)?.nome,
    x: p.x,
    y: p.y,
    tamanho: deEscala(e.cena, o.escala),
    ...(o.rotacao ? { rotacao: graus(o.rotacao) } : {}),
    ...(o.rotulo ? { texto: o.rotulo.texto } : {}),
  };
}

/** Filtro comum de listar_objetos e remover. */
function filtrarObjetos(e: EstadoAgente, a: { regiao?: Regiao; busca?: string; camada?: string; assetId?: string }): ObjetoCena[] {
  const caixa: Caixa | null = a.regiao ? paraCaixa(e.cena, a.regiao) : null;
  const termos = a.busca ? tagsDe(a.busca, 8) : [];
  const camadaId = a.camada ? camada(e.cena, a.camada, "objetos").id : undefined;
  return e.cena.objetos.filter((o) => {
    if (camadaId && o.camadaId !== camadaId) return false;
    if (a.assetId && o.assetId !== a.assetId) return false;
    if (caixa && !dentroDaCaixa(caixa, o)) return false;
    if (termos.length) {
      const as = e.assets.find((x) => x.id === o.assetId);
      const texto = normalizarTexto([nomeAsset(e, o.assetId), ...(as?.tags ?? []), o.rotulo?.texto ?? ""].join(" "));
      if (!termos.every((t) => texto.includes(t))) return false;
    }
    return true;
  });
}

// ---------- Ferramentas ----------

const buscarAsset: Ferramenta = {
  nome: "buscar_asset",
  consulta: true,
  descricao:
    "Busca assets na biblioteca da mesa por nome/tags, já filtrados pela perspectiva e pelo tema da cena. SEMPRE use antes de gerar um asset novo.",
  schemaArgs: {
    type: "object",
    properties: {
      termo: str("O que procurar, ex.: 'mesa de madeira'.", { maxLength: 200 }),
      tipo: str("Tipo de asset.", { enum: ["sprite", "textura", "pincel", "decal"] }),
      incluirOutrosTemas: { type: "boolean", description: "Inclui assets de outros temas (exige avisar o mestre)." },
    },
    required: ["termo"],
  },
  executar(e, a) {
    const termo = String(a.termo);
    e.buscas.push(termo);
    const temaId = e.cena.temaId;
    const base = filtrarAssets(e.assets, { busca: termo, tipo: (a.tipo as TipoAsset) ?? "", perspectivaId: e.cena.perspectiva });
    const doTema = base.filter((x) => !temaId || x.temaId === temaId);
    const outros = a.incluirOutrosTemas && temaId ? base.filter((x) => x.temaId !== temaId) : [];
    const fmt = (x: Asset, outroTema = false) => ({
      id: x.id,
      nome: x.nome,
      tipo: tipoDe(x),
      tags: x.tags ?? [],
      tamanhoSugerido: x.escalaBase ?? 1,
      ...(x.id.startsWith(PREFIXO_PROVISORIO) ? { pendente: true } : {}),
      ...(outroTema ? { outroTema: true } : {}),
    });
    return { resposta: { assets: [...doTema.slice(0, 20).map((x) => fmt(x)), ...outros.slice(0, 10).map((x) => fmt(x, true))] } };
  },
};

const listarObjetos: Ferramenta = {
  nome: "listar_objetos",
  consulta: true,
  descricao: "Lista objetos da cena (id, asset, posição, tamanho), opcionalmente filtrados por região, texto ou camada.",
  schemaArgs: {
    type: "object",
    properties: { regiao: regiaoSchema, busca: str("Filtra pelo nome/tags do asset.", { maxLength: 200 }), camada: str("Nome ou id da camada.") },
  },
  executar(e, a) {
    const lista = filtrarObjetos(e, a as never);
    return { resposta: { total: lista.length, objetos: lista.slice(0, 150).map((o) => descreverObjeto(e, o)) } };
  },
};

const novoPasso: Ferramenta = {
  nome: "novo_passo",
  descricao:
    "Abre um novo passo do plano (ex.: 'Paredes', 'Mobília'). As ações seguintes entram nele. O mestre pode aplicar ou reverter cada passo.",
  schemaArgs: { type: "object", properties: { titulo: str("Título curto do passo.", { maxLength: 80 }) }, required: ["titulo"] },
  executar(e, a) {
    e.passos.push({ id: e.novoId(), titulo: String(a.titulo).trim() || `Passo ${e.passos.length + 1}`, comandos: [], resumo: [], geracoes: [], avisos: [] });
    return { resposta: { ok: true, passo: e.passos.length } };
  },
};

const colocarObjeto: Ferramenta = {
  nome: "colocar_objeto",
  descricao: "Coloca UM asset no mapa. Posição nas unidades do mapa; tamanho = largura em células (grid) ou % da largura (cenário).",
  schemaArgs: {
    type: "object",
    properties: {
      assetId: str("Id do asset (de buscar_asset ou gerar_asset)."),
      x: num("Coluna (grid) ou % (cenário)."),
      y: num("Linha (grid) ou % (cenário)."),
      tamanho: num("Largura; padrão = tamanho sugerido do asset.", { minimum: 0.05, maximum: 100 }),
      rotacao: num("Graus (só top-down).", { minimum: -360, maximum: 360 }),
      espelhado: { type: "boolean", description: "Espelha horizontalmente." },
      camada: str("Nome da camada; padrão conforme o tipo do asset."),
      permitirSobreposicao: { type: "boolean", description: "Permite sobrepor outro objeto da mesma camada." },
    },
    required: ["assetId", "x", "y"],
  },
  executar(e, a) {
    const as = asset(e, a.assetId);
    const cena = e.cena;
    const cam = camada(cena, a.camada, CAMADA_POR_TIPO[tipoDe(as)]);
    const pos = paraFracao(cena, a.x as number, a.y as number);
    const escala = paraEscala(cena, (a.tamanho as number | undefined) ?? (cena.grid ? (as.escalaBase ?? 1) : 10 * (as.escalaBase ?? 1)));
    if (escala > 2) throw new ErroFerramenta("Tamanho maior que o dobro do mapa.");
    const objeto: ObjetoCena = {
      id: e.novoId(),
      assetId: as.id,
      camadaId: cam.id,
      ...pos,
      escala,
      rotacao: a.rotacao !== undefined && permiteRotacao(cena) ? rad(a.rotacao as number) : 0,
      espelhado: a.espelhado === true,
      z: zPara(cena, cam.id),
    };
    const assets = mapaAssets(e);
    const outro = a.permitirSobreposicao ? undefined : colisao(cena, objeto, assets);
    if (outro) throw new ErroFerramenta(`Colide com "${nomeAsset(e, outro.assetId)}" (${outro.id}). Escolha outra posição ou use permitirSobreposicao.`);
    return {
      comandos: [{ tipo: "adicionarObjeto", objeto }],
      resumo: [`Colocar ${as.nome}`],
      avisos: avisoTema(e, as),
      resposta: { ok: true, id: objeto.id },
    };
  },
};

const editarObjeto: Ferramenta = {
  nome: "editar_objeto",
  descricao:
    "Altera SÓ os objetos indicados (posição, tamanho, rotação, espelhamento, ordem, troca de asset). Use ids=['selecao'] para a seleção do mestre.",
  schemaArgs: {
    type: "object",
    properties: {
      ids: idsSchema,
      fatorTamanho: num("Multiplica o tamanho (ex.: 1.5 = 50% maior).", { minimum: 0.05, maximum: 20 }),
      tamanho: num("Novo tamanho absoluto.", { minimum: 0.05, maximum: 100 }),
      x: num("Nova coluna/%."),
      y: num("Nova linha/%."),
      dx: num("Desloca na horizontal (células ou %)."),
      dy: num("Desloca na vertical (células ou %)."),
      rotacao: num("Nova rotação em graus.", { minimum: -360, maximum: 360 }),
      espelhado: { type: "boolean" },
      frente: { type: "boolean", description: "true = trazer para a frente; false = enviar para trás." },
      assetId: str("Troca o asset mantendo posição e tamanho."),
    },
    required: ["ids"],
  },
  executar(e, a) {
    const ids = resolverIds(e, a.ids);
    const cena = e.cena;
    const novoAsset = a.assetId !== undefined ? asset(e, a.assetId) : undefined;
    const comandos: Comando[] = [];
    for (const id of ids) {
      const o = cena.objetos.find((x) => x.id === id)!;
      const patch: Partial<ObjetoCena> = {};
      if (a.tamanho !== undefined) patch.escala = paraEscala(cena, a.tamanho as number);
      if (a.fatorTamanho !== undefined) patch.escala = (patch.escala ?? o.escala) * (a.fatorTamanho as number);
      if (a.x !== undefined || a.y !== undefined) {
        const atual = deFracao(cena, o);
        Object.assign(patch, paraFracao(cena, (a.x as number | undefined) ?? atual.x, (a.y as number | undefined) ?? atual.y));
      }
      if (a.dx !== undefined || a.dy !== undefined) {
        const atual = deFracao(cena, { x: patch.x ?? o.x, y: patch.y ?? o.y });
        Object.assign(patch, paraFracao(cena, atual.x + ((a.dx as number) ?? 0), atual.y + ((a.dy as number) ?? 0)));
      }
      if (a.rotacao !== undefined) {
        if (!permiteRotacao(cena)) throw new ErroFerramenta("Nesta perspectiva os objetos não são girados.");
        patch.rotacao = rad(a.rotacao as number);
      }
      if (a.espelhado !== undefined) patch.espelhado = a.espelhado as boolean;
      if (a.frente !== undefined) patch.z = o.z + (a.frente ? 1 : -1) * (cena.objetos.length + 1);
      if (novoAsset) patch.assetId = novoAsset.id;
      if ((patch.escala ?? 0) > 2) throw new ErroFerramenta("Tamanho maior que o dobro do mapa.");
      if (!Object.keys(patch).length) throw new ErroFerramenta("Nenhuma alteração informada.");
      comandos.push({ tipo: "atualizarObjeto", id, patch });
    }
    return {
      comandos,
      resumo: [`Editar ${ids.length} objeto(s)`],
      avisos: novoAsset ? avisoTema(e, novoAsset) : [],
      resposta: { ok: true, alterados: ids },
    };
  },
};

const remover: Ferramenta = {
  nome: "remover",
  descricao:
    "Remove objetos por ids e/ou por filtro (região + texto + camada). Só os objetos que casam são removidos; o resto da cena fica intacto.",
  schemaArgs: {
    type: "object",
    properties: {
      ids: idsSchema,
      regiao: regiaoSchema,
      busca: str("Nome/tag do asset, ex.: 'mesa'.", { maxLength: 200 }),
      camada: str("Nome ou id da camada."),
    },
  },
  executar(e, a) {
    if (!a.ids && !a.regiao && !a.busca && !a.camada) throw new ErroFerramenta("Informe ids ou um filtro (regiao, busca, camada).");
    const porId = a.ids ? new Set(resolverIds(e, a.ids)) : null;
    const filtro = a.regiao || a.busca || a.camada ? new Set(filtrarObjetos(e, a as never).map((o) => o.id)) : null;
    const alvo = e.cena.objetos.filter((o) => (!porId || porId.has(o.id)) && (!filtro || filtro.has(o.id)));
    if (!alvo.length) throw new ErroFerramenta("Nenhum objeto corresponde ao filtro.");
    return {
      comandos: alvo.map((o) => ({ tipo: "removerObjeto", id: o.id })),
      resumo: [`Remover ${alvo.length} objeto(s)`],
      resposta: { ok: true, removidos: alvo.map((o) => o.id) },
    };
  },
};

const pintarTerreno: Ferramenta = {
  nome: "pintar_terreno",
  descricao:
    "Pinta o terreno: com uma textura (assetId), ladrilha a região na camada Terreno; só com cor (sem região), muda a cor de fundo do mapa.",
  schemaArgs: {
    type: "object",
    properties: {
      assetId: str("Id de um asset do tipo textura."),
      cor: corSchema,
      regiao: regiaoSchema,
      tamanhoLadrilho: num("Lado do ladrilho em células/%; padrão automático.", { minimum: 0.25, maximum: 100 }),
    },
  },
  executar(e, a) {
    const cena = e.cena;
    if (!a.assetId) {
      if (!ehCor(a.cor)) throw new ErroFerramenta("Informe assetId (textura) ou cor (#rrggbb).");
      if (a.regiao) throw new ErroFerramenta("Cor sem textura só vale para o mapa todo (fundo). Para uma região, use uma textura.");
      return { comandos: [{ tipo: "definirFundo", fundo: a.cor.toLowerCase() }], resumo: [`Fundo ${a.cor}`], resposta: { ok: true } };
    }
    const as = asset(e, a.assetId);
    if (tipoDe(as) !== "textura") throw new ErroFerramenta(`"${as.nome}" não é uma textura.`);
    const cam = camada(cena, undefined, "terreno");
    const caixa = paraCaixa(cena, a.regiao as Regiao | undefined);
    const W = cena.largura;
    const H = cena.altura;
    const larg = (caixa.x1 - caixa.x0) * W;
    const alt = (caixa.y1 - caixa.y0) * H;
    const prop = as.altura / as.largura;
    // Lado do ladrilho em px: o pedido ou o menor que mantém a contagem dentro do limite.
    let lado = a.tamanhoLadrilho ? paraEscala(cena, a.tamanhoLadrilho as number) * W : cena.grid ? paraEscala(cena, Math.max(1, as.escalaBase ?? 2)) * W : Math.max(larg, alt) / 6;
    while (Math.ceil(larg / lado) * Math.ceil(alt / (lado * prop)) > MAX_LADRILHOS) lado *= 1.25;
    const comandos: Comando[] = [];
    let z = proximoZ(cena, cam.id);
    const sobra = 1.02; // leve sobreposição para não aparecer emenda
    for (let y = caixa.y0 * H + (lado * prop) / 2; y - (lado * prop) / 2 < caixa.y1 * H - 0.5; y += lado * prop)
      for (let x = caixa.x0 * W + lado / 2; x - lado / 2 < caixa.x1 * W - 0.5; x += lado) {
        const p = { x: x / W, y: y / H };
        if (!dentroDaCaixa(caixa, p)) continue;
        comandos.push({
          tipo: "adicionarObjeto",
          objeto: { id: e.novoId(), assetId: as.id, camadaId: cam.id, x: p.x, y: p.y, escala: (lado * sobra) / W, rotacao: 0, espelhado: false, z: z++ },
        });
      }
    if (!comandos.length) throw new ErroFerramenta("A região é pequena demais para a textura.");
    return { comandos, resumo: [`Pintar terreno com ${as.nome} (${comandos.length} ladrilhos)`], avisos: avisoTema(e, as), resposta: { ok: true, ladrilhos: comandos.length } };
  },
};

const tracarCaminho: Ferramenta = {
  nome: "tracar_caminho",
  descricao:
    "Traça paredes, rios ou estradas ao longo de uma linha de pontos, repetindo um asset (pincel ou sprite) e girando-o na direção de cada trecho. Em grid, x=-0.5 é a borda esquerda da coluna 0.",
  schemaArgs: {
    type: "object",
    properties: {
      assetId: str("Id do asset do traçado (pincel ou sprite de parede)."),
      pontos: {
        type: "array",
        description: "Pontos do traçado, em ordem.",
        minItems: 2,
        maxItems: 100,
        items: { type: "object", properties: { x: num("Coluna/%."), y: num("Linha/%.") }, required: ["x", "y"] },
      },
      espessura: num("Espessura em células/% (padrão: 1 célula ou 3%).", { minimum: 0.05, maximum: 50 }),
      tipo: str("O que é o traçado.", { enum: ["parede", "rio", "estrada", "outro"] }),
      camada: str("Nome da camada; padrão Caminhos."),
    },
    required: ["assetId", "pontos"],
  },
  executar(e, a) {
    const cena = e.cena;
    const as = asset(e, a.assetId);
    const cam = camada(cena, a.camada, "caminhos");
    const W = cena.largura;
    const H = cena.altura;
    const pts = (a.pontos as { x: number; y: number }[]).map((p) => paraFracao(cena, p.x, p.y)).map((p) => ({ x: p.x * W, y: p.y * H }));
    const prop = as.altura / as.largura;
    const esp = paraEscala(cena, (a.espessura as number | undefined) ?? (cena.grid ? 1 : 3)) * W;
    const compPeca = esp / prop; // largura do asset com a altura = espessura
    const comandos: Comando[] = [];
    let z = proximoZ(cena, cam.id);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (len < 1e-6) continue;
      const n = Math.max(1, Math.round(len / compPeca));
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        comandos.push({
          tipo: "adicionarObjeto",
          objeto: {
            id: e.novoId(),
            assetId: as.id,
            camadaId: cam.id,
            x: (p0.x + (p1.x - p0.x) * t) / W,
            y: (p0.y + (p1.y - p0.y) * t) / H,
            escala: (len / n) / W,
            rotacao: ang,
            espelhado: false,
            z: z++,
          },
        });
        if (comandos.length > MAX_PECAS_CAMINHO) throw new ErroFerramenta(`Traçado longo demais (mais de ${MAX_PECAS_CAMINHO} peças). Aumente a espessura ou divida o traçado.`);
      }
    }
    if (!comandos.length) throw new ErroFerramenta("O traçado não tem comprimento.");
    const rotulo = { parede: "Parede", rio: "Rio", estrada: "Estrada", outro: "Caminho" }[(a.tipo as string) ?? "outro"] ?? "Caminho";
    return { comandos, resumo: [`${rotulo} com ${as.nome} (${comandos.length} peças)`], avisos: avisoTema(e, as), resposta: { ok: true, pecas: comandos.length } };
  },
};

const DENSIDADE: Record<string, number> = { baixa: 3, media: 1.8, alta: 1.15 };

const espalhar: Ferramenta = {
  nome: "espalhar",
  descricao:
    "Espalha vários objetos numa região sem sobreposição (amostragem de Poisson), alternando entre os assets dados. Reproduzível: mesma semente = mesmo resultado.",
  schemaArgs: {
    type: "object",
    properties: {
      assetIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10, description: "Assets a alternar." },
      regiao: regiaoSchema,
      densidade: str("Quão denso.", { enum: ["baixa", "media", "alta"] }),
      tamanho: num("Largura de cada objeto (células/%); padrão = sugerido do asset.", { minimum: 0.05, maximum: 100 }),
      semente: { type: "integer", description: "Semente; repita para obter o mesmo resultado.", minimum: 0 },
      variarTamanho: { type: "boolean", description: "Varia o tamanho em ±15%." },
      girar: { type: "boolean", description: "Rotação aleatória (só top-down)." },
      evitarObjetos: { type: "boolean", description: "Não coloca em cima de objetos existentes da camada (padrão: true)." },
      camada: str("Nome da camada; padrão conforme o tipo do asset."),
    },
    required: ["assetIds", "densidade"],
  },
  executar(e, a) {
    const cena = e.cena;
    const lista = (a.assetIds as string[]).map((id) => asset(e, id));
    const cam = camada(cena, a.camada, CAMADA_POR_TIPO[tipoDe(lista[0])]);
    const caixa = paraCaixa(cena, a.regiao as Regiao | undefined);
    const W = cena.largura;
    const H = cena.altura;
    const tamanhoBase = (a.tamanho as number | undefined) ?? (cena.grid ? (lista[0].escalaBase ?? 1) : 6 * (lista[0].escalaBase ?? 1));
    const escala = paraEscala(cena, tamanhoBase);
    const dist = escala * W * (DENSIDADE[a.densidade as string] ?? DENSIDADE.media);
    const semente = (a.semente as number | undefined) ?? sementeDe(JSON.stringify({ ...a, cena: cena.id }));
    const aleatorio = rng(semente);
    const ox = caixa.x0 * W;
    const oy = caixa.y0 * H;
    const evitar = a.evitarObjetos !== false;
    const assets = mapaAssets(e);
    const ocupados = evitar ? cena.objetos.filter((o) => o.camadaId === cam.id).map((o) => caixaPx(cena, o, assets)) : [];
    const pontos = poissonDisco(
      (caixa.x1 - caixa.x0) * W,
      (caixa.y1 - caixa.y0) * H,
      dist,
      aleatorio,
      (p) => {
        const abs = { x: p.x + ox, y: p.y + oy };
        if (!dentroDaCaixa(caixa, { x: abs.x / W, y: abs.y / H })) return false;
        return !ocupados.some((c) => abs.x >= c.x0 && abs.x <= c.x1 && abs.y >= c.y0 && abs.y <= c.y1);
      },
      MAX_ESPALHAR,
    );
    if (!pontos.length) throw new ErroFerramenta("Não coube nenhum objeto na região (pequena demais ou ocupada).");
    const girar = a.girar === true && permiteRotacao(cena);
    const porY = !permiteRotacao(cena);
    let z = proximoZ(cena, cam.id);
    const comandos: Comando[] = pontos.map((p) => {
      const as = lista[Math.floor(aleatorio() * lista.length)];
      const fator = a.variarTamanho ? 0.85 + aleatorio() * 0.3 : 1;
      const rot = girar ? aleatorio() * Math.PI * 2 : 0;
      const esp = aleatorio() < 0.5;
      return {
        tipo: "adicionarObjeto",
        objeto: { id: e.novoId(), assetId: as.id, camadaId: cam.id, x: (p.x + ox) / W, y: (p.y + oy) / H, escala: escala * fator, rotacao: rot, espelhado: esp, z: porY ? 0 : z++ },
      };
    });
    return {
      comandos,
      resumo: [`Espalhar ${lista.map((x) => x.nome).join(", ")} (${comandos.length})`],
      avisos: lista.flatMap((x) => avisoTema(e, x)),
      resposta: { ok: true, quantidade: comandos.length, semente },
    };
  },
};

const definirGrid: Ferramenta = {
  nome: "definir_grid",
  descricao:
    "Liga, ajusta ou remove o grid. A proporção do mapa é fixa: as linhas são derivadas das colunas quando não informadas. Só mapas top-down têm grid.",
  schemaArgs: {
    type: "object",
    properties: {
      tipo: str("Tipo de célula.", { enum: ["quadrado", "hex"] }),
      colunas: { type: "integer", minimum: 2, maximum: 200 },
      linhas: { type: "integer", minimum: 2, maximum: 200 },
      noRender: { type: "boolean", description: "Se o grid aparece na imagem final." },
      remover: { type: "boolean", description: "Remove o grid (vira cenário)." },
    },
  },
  executar(e, a) {
    const cena = e.cena;
    if (a.remover) return { comandos: [{ tipo: "definirGrid", grid: undefined }], resumo: ["Remover grid"], resposta: { ok: true } };
    if (!obterPerspectiva(cena.perspectiva)?.permiteGrid) throw new ErroFerramenta("Esta perspectiva não permite grid (grid é sempre top-down).");
    const tipo = (a.tipo as "quadrado" | "hex" | undefined) ?? cena.grid?.tipo ?? "quadrado";
    const colunas = (a.colunas as number | undefined) ?? cena.grid?.colunas;
    if (!colunas) throw new ErroFerramenta("Informe o número de colunas.");
    const linhasEsperadas =
      tipo === "quadrado"
        ? Math.round(cena.altura / (cena.largura / colunas))
        : Math.round((cena.altura / (cena.largura / ((colunas + 0.5) * Math.sqrt(3))) - 0.5) / 1.5);
    const linhas = (a.linhas as number | undefined) ?? linhasEsperadas;
    if (Math.abs(linhas - linhasEsperadas) > 1)
      throw new ErroFerramenta(`Com ${colunas} colunas, a proporção do mapa comporta ${linhasEsperadas} linhas (não ${linhas}). A proporção é travada.`);
    const grid = { tipo, colunas, linhas, noRender: (a.noRender as boolean | undefined) ?? cena.grid?.noRender ?? true };
    return { comandos: [{ tipo: "definirGrid", grid }], resumo: [`Grid ${tipo} ${colunas}x${linhas}`], resposta: { ok: true, grid } };
  },
};

const rotular: Ferramenta = {
  nome: "rotular",
  descricao: "Escreve um rótulo de texto no mapa (camada Rótulos).",
  schemaArgs: {
    type: "object",
    properties: {
      texto: str("Texto do rótulo.", { maxLength: 60 }),
      x: num("Coluna/% do centro."),
      y: num("Linha/% do centro."),
      tamanho: num("Largura do texto em células/% (padrão proporcional ao texto).", { minimum: 0.2, maximum: 100 }),
      cor: corSchema,
    },
    required: ["texto", "x", "y"],
  },
  executar(e, a) {
    const cena = e.cena;
    const texto = String(a.texto).trim();
    if (!texto) throw new ErroFerramenta("Rótulo vazio.");
    const cam = camada(cena, undefined, "rotulos");
    const pos = paraFracao(cena, a.x as number, a.y as number);
    const padrao = cena.grid ? 0.6 * texto.length : 1.8 * texto.length;
    const objeto: ObjetoCena = {
      id: e.novoId(),
      assetId: ASSET_ROTULO,
      camadaId: cam.id,
      ...pos,
      escala: paraEscala(cena, (a.tamanho as number | undefined) ?? padrao),
      rotacao: 0,
      espelhado: false,
      z: proximoZ(cena, cam.id),
      rotulo: { texto, cor: ehCor(a.cor) ? a.cor.toLowerCase() : "#1f1a14" },
    };
    return { comandos: [{ tipo: "adicionarObjeto", objeto }], resumo: [`Rótulo "${texto}"`], resposta: { ok: true, id: objeto.id } };
  },
};

const NOME_CAMADA_LUZ = "Luz";

const adicionarLuz: Ferramenta = {
  nome: "adicionar_luz",
  descricao: "Adiciona uma fonte de luz (brilho colorido) numa camada própria 'Luz', acima dos objetos. Não é iluminação dinâmica.",
  schemaArgs: {
    type: "object",
    properties: {
      x: num("Coluna/% do centro."),
      y: num("Linha/% do centro."),
      raio: num("Raio em células/%.", { minimum: 0.1, maximum: 100 }),
      cor: corSchema,
      intensidade: num("0 a 1 (padrão 0.6).", { minimum: 0, maximum: 1 }),
    },
    required: ["x", "y", "raio"],
  },
  executar(e, a) {
    const cena = e.cena;
    const comandos: Comando[] = [];
    let cam = cena.camadas.find((c) => normalizarTexto(c.nome) === normalizarTexto(NOME_CAMADA_LUZ));
    if (cam?.travada) throw new ErroFerramenta("A camada Luz está travada pelo mestre.");
    if (!cam) {
      cam = { id: e.novoId(), nome: NOME_CAMADA_LUZ, tipo: "decals", visivel: true, travada: false, opacidade: 1 };
      const iRot = cena.camadas.findIndex((c) => c.tipo === "rotulos");
      comandos.push({ tipo: "adicionarCamada", camada: cam, indice: iRot < 0 ? undefined : iRot });
    }
    const pos = paraFracao(cena, a.x as number, a.y as number);
    const objeto: ObjetoCena = {
      id: e.novoId(),
      assetId: ASSET_LUZ,
      camadaId: cam.id,
      ...pos,
      escala: 2 * paraEscala(cena, a.raio as number),
      rotacao: 0,
      espelhado: false,
      z: 0,
      luz: { cor: ehCor(a.cor) ? a.cor.toLowerCase() : "#ffb347", intensidade: (a.intensidade as number | undefined) ?? 0.6 },
    };
    comandos.push({ tipo: "adicionarObjeto", objeto });
    return { comandos, resumo: ["Luz"], resposta: { ok: true, id: objeto.id } };
  },
};

const gerarAsset: Ferramenta = {
  nome: "gerar_asset",
  descricao:
    "Pede a geração de um asset NOVO no tema da cena (custa créditos; o mestre confirma antes). Só use depois de buscar_asset sem resultado adequado. Devolve um id provisório que já pode ser usado nas outras ferramentas.",
  schemaArgs: {
    type: "object",
    properties: {
      descricao: str("Descrição do objeto, ex.: 'mesa redonda de carvalho'.", { maxLength: 300 }),
      tipo: str("Tipo de asset.", { enum: ["sprite", "textura", "pincel", "decal"] }),
      nome: str("Nome curto.", { maxLength: 80 }),
      tags: { type: "array", items: { type: "string" }, maxItems: 10 },
      tamanhoSugerido: num("Largura sugerida em células.", { minimum: 0.25, maximum: 10 }),
      forcar: { type: "boolean", description: "Gera mesmo havendo um asset parecido (o mestre verá o aviso)." },
    },
    required: ["descricao", "tipo"],
  },
  executar(e, a): ResultadoFerramenta {
    const descricao = String(a.descricao);
    const tipo = a.tipo as TipoAsset;
    const buscou = e.buscas.some((b) => tagsDe(b).some((t) => tagsDe(descricao).includes(t)));
    if (!buscou) throw new ErroFerramenta("Antes de gerar, use buscar_asset com um termo parecido: a biblioteca pode já ter o asset.");
    const reuso = sugerirReuso(e.assets, descricao, { temaId: e.cena.temaId, perspectivaId: e.cena.perspectiva, tipo });
    const igual = reuso.find((r) => r.pontos >= 1);
    if (igual) {
      return {
        resposta: { ok: true, reutilizado: true, id: igual.asset.id, nome: igual.asset.nome, mensagem: "Já existe um asset compatível; use este id (nada foi gerado)." },
      };
    }
    if (reuso.length && a.forcar !== true) {
      throw new ErroFerramenta(
        `Há assets parecidos: ${reuso.map((r) => `${r.asset.nome} (${r.asset.id})`).join(", ")}. Reutilize um deles ou chame de novo com forcar=true.`,
      );
    }
    const pendentes = e.passos.reduce((n, p) => n + p.geracoes.length, 0);
    if (pendentes >= MAX_GERACOES) throw new ErroFerramenta(`Limite de ${MAX_GERACOES} assets novos por pedido.`);
    let pedido;
    try {
      pedido = validarPedido({
        tipo,
        descricao,
        nome: a.nome,
        tags: normalizarTags((a.tags as string[] | undefined) ?? []),
        escalaBase: a.tamanhoSugerido ?? 1,
        quantidade: 1,
        temaId: e.cena.temaId,
        perspectivaId: e.cena.perspectiva,
      });
    } catch (err) {
      throw new ErroFerramenta((err as Error).message);
    }
    const idProvisorio = `${PREFIXO_PROVISORIO}${e.novoId()}`;
    // Asset provisório (quadrado) para as próximas ferramentas; o real substitui o id antes de aplicar.
    e.assets.push({
      id: idProvisorio,
      nome: pedido.nome,
      url: "",
      largura: 512,
      altura: 512,
      origem: "ia",
      tipo,
      tags: pedido.tags,
      temaId: pedido.temaId,
      perspectivaId: pedido.perspectivaId,
      escalaBase: pedido.escalaBase,
      criadoEm: 0,
    });
    return {
      geracoes: [{ idProvisorio, pedido }],
      resumo: [`Gerar asset "${pedido.nome}"`],
      avisos: reuso.length ? [`Gerando "${pedido.nome}" apesar de haver assets parecidos.`] : [],
      resposta: { ok: true, id: idProvisorio, pendente: true },
    };
  },
};

export const FERRAMENTAS: Ferramenta[] = [
  buscarAsset,
  listarObjetos,
  novoPasso,
  colocarObjeto,
  editarObjeto,
  remover,
  pintarTerreno,
  tracarCaminho,
  espalhar,
  definirGrid,
  rotular,
  adicionarLuz,
  gerarAsset,
];

export const obterFerramenta = (nome: string) => FERRAMENTAS.find((f) => f.nome === nome);

/** Formato neutro para o `ProvedorLlm`. */
export const ferramentasNeutras = () =>
  FERRAMENTAS.map((f) => ({ nome: f.nome, descricao: f.descricao, parametros: f.schemaArgs as { type: "object"; properties: Record<string, unknown>; required?: string[] } }));

/** Ordem de desenho (para testes e prévia): chave da perspectiva dentro de cada camada. */
export function ordemDesenho(cena: Cena): string[] {
  const persp = obterPerspectiva(cena.perspectiva);
  const ic = new Map(cena.camadas.map((c, i) => [c.id, i]));
  return cena.objetos
    .map((o, i) => ({ o, k: chaveOrdem(persp, o, i) }))
    .sort((a, b) => ic.get(a.o.camadaId)! - ic.get(b.o.camadaId)! || a.k - b.k)
    .map((x) => x.o.id);
}


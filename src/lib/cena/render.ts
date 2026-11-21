"use client";

import type { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { ASSET_LUZ, ASSET_ROTULO, type Asset, type Cena, type ObjetoCena } from "./tipos";
import { baseDoObjeto, geometriaSelecao, medidasGrid, tamanhoExport } from "./geometria";
import { chaveOrdem, obterPerspectiva } from "../mapas-ia/perspectivas/registro";

type Pixi = typeof import("pixi.js");

export type OpcoesRender = {
  selecionadoId?: string | null;
  mostrarGrid?: boolean;
  /** px do canvas por px da tela (para alças com tamanho constante na tela). */
  pxPorTela?: number;
  /** Objetos com contorno de destaque (prévia do plano, ações da IA). */
  destacados?: string[];
  /** Mostra as paredes (só no editor; nunca entram no render final). */
  mostrarParedes?: boolean;
  /** Parede sendo desenhada (fração do canvas). */
  rascunhoParede?: { x: number; y: number }[];
};

export type OpcoesExport = {
  formato?: "jpg" | "png";
  /** Desenha o grid. Padrão: `grid.noRender` da cena. */
  grade?: boolean;
  /** Grid a desenhar no lugar do da cena (ex.: grade de exportação de um cenário livre). */
  grid?: Cena["grid"];
  /** Largura final em px (a altura segue a proporção). Padrão: limitada a 4096 no lado maior. */
  largura?: number;
};

/** Objeto embutido (luz ou rótulo): redesenhado só quando `chave` muda. */
type Embutido = { g: Graphics | Text; chave: string };

/**
 * Renderizador da cena em PixiJS (WebGL). Carregado sob demanda (import dinâmico), só no editor.
 * Redesenha apenas quando algo muda (sem ticker contínuo).
 */
export class RenderCena {
  private texturas = new Map<string, Texture>();
  private carregando = new Map<string, Promise<void>>();
  private sprites = new Map<string, Sprite>();
  private embutidos = new Map<string, Embutido>();
  private camadas = new Map<string, Container>();
  private fundo: Graphics;
  private grade: Graphics;
  private selecao: Graphics;
  private paredes: Graphics;
  private ultima?: { cena: Cena; assets: Map<string, Asset>; opc: OpcoesRender };
  private destruido = false;

  private constructor(private pixi: Pixi, private app: Application, readonly canvas: HTMLCanvasElement) {
    this.fundo = new pixi.Graphics();
    this.grade = new pixi.Graphics();
    this.selecao = new pixi.Graphics();
    this.paredes = new pixi.Graphics();
    app.stage.addChild(this.fundo, this.grade, this.paredes, this.selecao);
  }

  /** Cria o canvas dentro de `host` (e o remove em `destruir`). */
  static async criar(host: HTMLElement, cena: Cena): Promise<RenderCena> {
    const pixi = await import("pixi.js");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
    host.appendChild(canvas);
    const app = new pixi.Application();
    await app.init({
      canvas,
      width: cena.largura,
      height: cena.altura,
      antialias: true,
      resolution: 1,
      autoStart: false,
      backgroundAlpha: 0,
    });
    app.ticker.stop();
    return new RenderCena(pixi, app, canvas);
  }

  /** Sincroniza a cena com o palco e desenha. */
  atualizar(cena: Cena, assets: Map<string, Asset>, opc: OpcoesRender = {}) {
    if (this.destruido) return;
    this.ultima = { cena, assets, opc };
    const { pixi, app } = this;
    if (app.renderer.width !== cena.largura || app.renderer.height !== cena.altura) app.renderer.resize(cena.largura, cena.altura);

    this.fundo.clear().rect(0, 0, cena.largura, cena.altura).fill(cena.fundo);

    // Camadas (ordem = ordem da lista; a primeira fica embaixo).
    const vivas = new Set(cena.camadas.map((c) => c.id));
    for (const [id, cont] of this.camadas) {
      if (!vivas.has(id)) {
        cont.destroy({ children: true });
        this.camadas.delete(id);
      }
    }
    cena.camadas.forEach((c, i) => {
      let cont = this.camadas.get(c.id);
      if (!cont) {
        cont = new pixi.Container();
        cont.sortableChildren = true;
        this.camadas.set(c.id, cont);
        app.stage.addChild(cont);
      }
      cont.visible = c.visivel;
      cont.alpha = c.opacidade;
      app.stage.setChildIndex(cont, 1 + i); // depois do fundo
    });
    app.stage.setChildIndex(this.grade, app.stage.children.length - 3);
    app.stage.setChildIndex(this.paredes, app.stage.children.length - 2);
    app.stage.setChildIndex(this.selecao, app.stage.children.length - 1);

    // Objetos.
    const persp = obterPerspectiva(cena.perspectiva);
    const objetosVivos = new Set<string>();
    cena.objetos.forEach((o, i) => {
      const cont = this.camadas.get(o.camadaId);
      if (cont && (o.assetId === ASSET_LUZ || o.assetId === ASSET_ROTULO)) {
        objetosVivos.add(o.id);
        this.desenharEmbutido(cena, o, cont, chaveOrdem(persp, o, i));
        return;
      }
      const asset = assets.get(o.assetId);
      if (!asset || !cont) return;
      objetosVivos.add(o.id);
      const tex = this.textura(asset);
      let s = this.sprites.get(o.id);
      if (!s) {
        s = new pixi.Sprite(tex ?? pixi.Texture.EMPTY);
        s.anchor.set(0.5);
        this.sprites.set(o.id, s);
      }
      if (tex && s.texture !== tex) s.texture = tex;
      if (s.parent !== cont) cont.addChild(s);
      const larg = o.escala * cena.largura;
      const esc = tex ? larg / tex.width : 0;
      s.position.set(o.x * cena.largura, o.y * cena.altura);
      s.scale.set(o.espelhado ? -esc : esc, esc);
      s.rotation = o.rotacao;
      s.zIndex = chaveOrdem(persp, o, i);
      s.visible = !!tex;
    });
    for (const [id, s] of this.sprites) {
      if (!objetosVivos.has(id)) {
        s.destroy();
        this.sprites.delete(id);
      }
    }
    for (const [id, e] of this.embutidos) {
      if (!objetosVivos.has(id)) {
        e.g.destroy();
        this.embutidos.delete(id);
      }
    }

    this.desenharGrade(cena, opc.mostrarGrid ?? true);
    this.desenharParedes(cena, opc);
    this.desenharSelecao(cena, assets, opc);
    app.render();
  }

  /** Luz = brilho radial aditivo (círculos concêntricos); rótulo = texto com contorno. */
  private desenharEmbutido(cena: Cena, o: ObjetoCena, cont: Container, zIndex: number) {
    const { pixi } = this;
    const larg = o.escala * cena.largura;
    const chave = JSON.stringify([o.assetId, o.luz, o.rotulo, o.assetId === ASSET_LUZ ? larg : 0]);
    let e = this.embutidos.get(o.id);
    if (e && e.chave !== chave) {
      e.g.destroy();
      this.embutidos.delete(o.id);
      e = undefined;
    }
    if (!e) {
      if (o.assetId === ASSET_LUZ) {
        const g = new pixi.Graphics();
        const cor = o.luz?.cor ?? "#ffb347";
        const aneis = 14;
        const intensidade = o.luz?.intensidade ?? 0.6;
        for (let k = 0; k < aneis; k++) {
          const r = (larg / 2) * (1 - k / aneis);
          g.circle(0, 0, Math.max(1, r)).fill({ color: cor, alpha: (intensidade / aneis) * 1.6 });
        }
        g.blendMode = "add";
        e = { g, chave };
      } else {
        const t = new pixi.Text({
          text: o.rotulo?.texto ?? "",
          style: { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 96, fontWeight: "bold", fill: o.rotulo?.cor ?? "#1f1a14", stroke: { color: "#f4ecd8", width: 10 } },
        });
        t.anchor.set(0.5);
        e = { g: t, chave };
      }
      this.embutidos.set(o.id, e);
    }
    const g = e.g;
    if (g.parent !== cont) cont.addChild(g);
    g.position.set(o.x * cena.largura, o.y * cena.altura);
    if (o.assetId === ASSET_ROTULO) {
      const esc = larg / Math.max(1, g.getLocalBounds().width);
      g.scale.set(o.espelhado ? -esc : esc, esc);
    }
    g.rotation = o.rotacao;
    g.zIndex = zIndex;
  }

  private textura(asset: Asset): Texture | undefined {
    const t = this.texturas.get(asset.url);
    if (t) return t;
    if (!this.carregando.has(asset.url)) {
      const p = fetch(asset.url, { mode: "cors" })
        .then((r) => r.blob())
        .then((b) => createImageBitmap(b))
        .then((bmp) => {
          if (this.destruido) return;
          this.texturas.set(asset.url, this.pixi.Texture.from(bmp));
          if (this.ultima) this.atualizar(this.ultima.cena, this.ultima.assets, this.ultima.opc);
        })
        .catch((e) => {
          console.error("textura:", e);
          this.carregando.delete(asset.url); // permite tentar de novo
        });
      this.carregando.set(asset.url, p);
    }
    return undefined;
  }

  private desenharGrade(cena: Cena, visivel: boolean) {
    const g = this.grade.clear();
    const m = medidasGrid(cena);
    this.grade.visible = !!m && visivel;
    if (!m) return;
    if (m.tipo === "quadrado") {
      for (let c = 0; c <= m.colunas; c++) g.moveTo(c * m.celula, 0).lineTo(c * m.celula, m.linhas * m.celula);
      for (let l = 0; l <= m.linhas; l++) g.moveTo(0, l * m.celula).lineTo(m.colunas * m.celula, l * m.celula);
    } else {
      for (let l = 0; l < m.linhas; l++) {
        for (let c = 0; c < m.colunas; c++) {
          const cx = m.larg / 2 + c * m.larg + (l % 2) * (m.larg / 2);
          const cy = m.raio + l * 1.5 * m.raio;
          const pts: number[] = [];
          for (let k = 0; k < 6; k++) {
            const ang = (Math.PI / 180) * (60 * k - 30);
            pts.push(cx + m.raio * Math.cos(ang), cy + m.raio * Math.sin(ang));
          }
          g.poly(pts, true);
        }
      }
    }
    g.stroke({ width: Math.max(1, cena.largura / 1500), color: 0x000000, alpha: 0.3 });
  }

  private desenharParedes(cena: Cena, opc: OpcoesRender) {
    const g = this.paredes.clear();
    const k = opc.pxPorTela ?? 1;
    const linha = (pts: { x: number; y: number }[], cor: number) => {
      if (pts.length < 1) return;
      g.moveTo(pts[0].x * cena.largura, pts[0].y * cena.altura);
      for (const p of pts.slice(1)) g.lineTo(p.x * cena.largura, p.y * cena.altura);
      g.stroke({ width: 4 * k, color: cor, alpha: 0.9 });
      for (const p of pts) g.circle(p.x * cena.largura, p.y * cena.altura, 4 * k).fill(cor);
    };
    if (opc.mostrarParedes) for (const p of cena.paredes ?? []) linha(p.pontos, 0xf97316);
    if (opc.rascunhoParede?.length) linha(opc.rascunhoParede, 0xfacc15);
  }

  private desenharSelecao(cena: Cena, assets: Map<string, Asset>, opc: OpcoesRender) {
    const g = this.selecao.clear();
    const k = opc.pxPorTela ?? 1;
    if (opc.destacados?.length) {
      const ids = new Set(opc.destacados);
      for (const d of cena.objetos) {
        const b = ids.has(d.id) ? baseDoObjeto(d, assets) : undefined;
        if (!b) continue;
        const s = geometriaSelecao(cena, d, b, k);
        g.poly(s.cantos.flatMap((p) => [p.x, p.y]), true).stroke({ width: 1.5 * k, color: 0x22d3ee, alpha: 0.9 });
      }
    }
    const o = cena.objetos.find((x) => x.id === opc.selecionadoId);
    const a = o && baseDoObjeto(o, assets);
    if (!o || !a) return;
    const s = geometriaSelecao(cena, o, a, k);
    g.poly(s.cantos.flatMap((p) => [p.x, p.y]), true).stroke({ width: 2 * k, color: 0x7c3aed });
    g.moveTo(s.topo.x, s.topo.y).lineTo(s.alcaRotacao.x, s.alcaRotacao.y).stroke({ width: 1.5 * k, color: 0x7c3aed });
    g.circle(s.alcaRotacao.x, s.alcaRotacao.y, 7 * k).fill(0xffffff).stroke({ width: 2 * k, color: 0x7c3aed });
    g.rect(s.alcaEscala.x - 6 * k, s.alcaEscala.y - 6 * k, 12 * k, 12 * k).fill(0xffffff).stroke({ width: 2 * k, color: 0x7c3aed });
  }

  /**
   * Render final, sem seleção nem paredes. Padrão: JPEG, grade só se `grid.noRender`, lado maior limitado a 4096 px.
   * Espera as texturas carregarem antes de desenhar.
   */
  async exportar(cena: Cena, opc: OpcoesExport = {}): Promise<Blob> {
    await this.aguardarTexturas();
    if (this.ultima) this.atualizar(this.ultima.cena, this.ultima.assets, this.ultima.opc);
    const largura = opc.largura ?? tamanhoExport(cena).largura;
    const vis = [this.selecao.visible, this.grade.visible, this.paredes.visible];
    this.selecao.visible = false;
    this.paredes.visible = false;
    const comGrade = opc.grade ?? !!cena.grid?.noRender;
    if (comGrade && opc.grid) this.desenharGrade({ ...cena, grid: opc.grid }, true);
    else this.grade.visible = comGrade && !!cena.grid;
    try {
      const url = await this.app.renderer.extract.base64({
        target: this.app.stage,
        frame: new this.pixi.Rectangle(0, 0, cena.largura, cena.altura),
        resolution: largura / cena.largura,
        format: opc.formato ?? "jpg",
        quality: 0.92,
      });
      return await (await fetch(url)).blob();
    } finally {
      [this.selecao.visible, this.grade.visible, this.paredes.visible] = vis;
      if (this.ultima) this.atualizar(this.ultima.cena, this.ultima.assets, this.ultima.opc);
      else this.app.render();
    }
  }

  /** Espera as texturas em carregamento terminarem. */
  async aguardarTexturas() {
    await Promise.all([...this.carregando.values()]);
  }

  /** Tempo médio (ms) de `n` redesenhos completos, esperando a GPU terminar (gl.finish) e contando os sprites visíveis. */
  medirQuadros(n = 60): { ms: number; sprites: number } {
    const gl = (this.app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
    const esperar = () => {
      gl?.finish();
      gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // força a sincronização
    };
    this.app.render();
    esperar();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      this.app.render();
      esperar();
    }
    const ms = (performance.now() - t0) / n;
    const sprites = [...this.sprites.values()].filter((s) => s.visible && s.texture.width > 1).length;
    return { ms, sprites };
  }

  destruir() {
    this.destruido = true;
    this.app.destroy(true, { children: true });
  }
}

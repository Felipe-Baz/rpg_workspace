"use client";

import type { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { Asset, Cena } from "./tipos";
import { geometriaSelecao, medidasGrid, tamanhoExport } from "./geometria";

type Pixi = typeof import("pixi.js");

export type OpcoesRender = {
  selecionadoId?: string | null;
  mostrarGrid?: boolean;
  /** px do canvas por px da tela (para alças com tamanho constante na tela). */
  pxPorTela?: number;
};

/**
 * Renderizador da cena em PixiJS (WebGL). Carregado sob demanda (import dinâmico), só no editor.
 * Redesenha apenas quando algo muda (sem ticker contínuo).
 */
export class RenderCena {
  private texturas = new Map<string, Texture>();
  private carregando = new Map<string, Promise<void>>();
  private sprites = new Map<string, Sprite>();
  private camadas = new Map<string, Container>();
  private fundo: Graphics;
  private grade: Graphics;
  private selecao: Graphics;
  private ultima?: { cena: Cena; assets: Map<string, Asset>; opc: OpcoesRender };
  private destruido = false;

  private constructor(private pixi: Pixi, private app: Application, readonly canvas: HTMLCanvasElement) {
    this.fundo = new pixi.Graphics();
    this.grade = new pixi.Graphics();
    this.selecao = new pixi.Graphics();
    app.stage.addChild(this.fundo, this.grade, this.selecao);
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
    app.stage.setChildIndex(this.grade, app.stage.children.length - 2);
    app.stage.setChildIndex(this.selecao, app.stage.children.length - 1);

    // Objetos.
    const objetosVivos = new Set<string>();
    cena.objetos.forEach((o, i) => {
      const asset = assets.get(o.assetId);
      const cont = this.camadas.get(o.camadaId);
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
      s.zIndex = o.z * 100000 + i;
      s.visible = !!tex;
    });
    for (const [id, s] of this.sprites) {
      if (!objetosVivos.has(id)) {
        s.destroy();
        this.sprites.delete(id);
      }
    }

    this.desenharGrade(cena, opc.mostrarGrid ?? true);
    this.desenharSelecao(cena, assets, opc);
    app.render();
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

  private desenharSelecao(cena: Cena, assets: Map<string, Asset>, opc: OpcoesRender) {
    const g = this.selecao.clear();
    const o = cena.objetos.find((x) => x.id === opc.selecionadoId);
    const a = o && assets.get(o.assetId);
    if (!o || !a) return;
    const k = opc.pxPorTela ?? 1;
    const s = geometriaSelecao(cena, o, a, k);
    g.poly(s.cantos.flatMap((p) => [p.x, p.y]), true).stroke({ width: 2 * k, color: 0x7c3aed });
    g.moveTo(s.topo.x, s.topo.y).lineTo(s.alcaRotacao.x, s.alcaRotacao.y).stroke({ width: 1.5 * k, color: 0x7c3aed });
    g.circle(s.alcaRotacao.x, s.alcaRotacao.y, 7 * k).fill(0xffffff).stroke({ width: 2 * k, color: 0x7c3aed });
    g.rect(s.alcaEscala.x - 6 * k, s.alcaEscala.y - 6 * k, 12 * k, 12 * k).fill(0xffffff).stroke({ width: 2 * k, color: 0x7c3aed });
  }

  /** Render final (sem seleção; grade só se `grid.noRender`) em JPEG, com o lado maior limitado a 4096 px. */
  async exportar(cena: Cena): Promise<Blob> {
    const t = tamanhoExport(cena);
    const selVis = this.selecao.visible;
    const gradeVis = this.grade.visible;
    this.selecao.visible = false;
    this.grade.visible = !!cena.grid?.noRender;
    try {
      const url = await this.app.renderer.extract.base64({
        target: this.app.stage,
        frame: new this.pixi.Rectangle(0, 0, cena.largura, cena.altura),
        resolution: t.largura / cena.largura,
        format: "jpg",
        quality: 0.92,
      });
      return await (await fetch(url)).blob();
    } finally {
      this.selecao.visible = selVis;
      this.grade.visible = gradeVis;
      this.app.render();
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

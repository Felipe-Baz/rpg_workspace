// Desenho 3D dos dados (three.js + cannon-es). Só roda no navegador: importe com `import()` para não pesar o carregamento.
//
// A rolagem é uma simulação física de verdade (gravidade, quiques, atrito, rolagem, colisão entre dados e com as bordas da
// área), feita a partir de uma semente: o mesmo arremesso em todos os navegadores. O número já foi sorteado antes
// (`dados3d.ts`), então, depois de simulado o arremesso, os números impressos nas faces são trocados de lugar para que a
// face que ficou para cima mostre o valor sorteado. Dados regulares são simétricos: ninguém percebe a troca, a física
// continua 100% natural e, mesmo que o motor divirja um pouco entre navegadores, o resultado exibido é sempre o mesmo.
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { poliedro, type V3 } from "./geometria-dados.ts";
import type { Jogada } from "./dados3d.ts";

const ESCALA: Record<number, number> = { 4: 1.45, 6: 1.2, 8: 1.25, 10: 1.25, 12: 1.25, 20: 1.3, 100: 1.3 };
const COR_CORPO: Record<number, number> = { 4: 0x2a1a33, 6: 0x2b1220, 8: 0x1b2433, 10: 0x1d2a22, 12: 0x2e2416, 20: 0x2b1220, 100: 0x161018 };
const COR_NUMERO = "#f0cf84";
const ELEVACAO = (66 * Math.PI) / 180;
const FOV = 38;

// Física (unidades do mundo: um dado tem ~2,8 de diâmetro)
const GRAVIDADE = 75;
const PASSO = 1 / 120;
const FPS = 60;
const ATRITO = 0.42;
const MAX_SIMULACAO_S = 4.5;
const PAUSA_FINAL_S = 0.25;

/** Fração do menor lado da tela que um dado ocupa (com limites em pixels, para celular e monitor grande). */
const FRACAO_TELA = 0.13;
const DADO_MIN_PX = 68;
const DADO_MAX_PX = 140;
const DIAMETRO_MUNDO = 2.8;

/** PRNG pequeno e determinístico (mulberry32): a mesma semente gera sempre a mesma sequência. */
export function prng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const texturas = new Map<string, THREE.CanvasTexture>();
function textura(chave: string, desenhar: (c: CanvasRenderingContext2D, t: number) => void, tam = 128): THREE.CanvasTexture {
  let t = texturas.get(chave);
  if (!t) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = tam;
    const c = cv.getContext("2d")!;
    c.clearRect(0, 0, tam, tam);
    desenhar(c, tam);
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texturas.set(chave, t);
  }
  return t;
}

function numero(c: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number, angulo = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(angulo);
  c.fillStyle = COR_NUMERO;
  c.strokeStyle = COR_NUMERO;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `700 ${tam}px Georgia, "Times New Roman", serif`;
  c.shadowColor = "rgba(0,0,0,0.6)";
  c.shadowBlur = tam * 0.08;
  c.fillText(texto, 0, 0);
  if (texto === "6" || texto === "9") { // sublinhado para não confundir 6 com 9
    const w = c.measureText(texto).width;
    c.lineWidth = tam * 0.07;
    c.beginPath();
    c.moveTo(-w / 2, tam * 0.5);
    c.lineTo(w / 2, tam * 0.5);
    c.stroke();
  }
  c.restore();
}

const v3 = (v: V3) => new THREE.Vector3(v[0], v[1], v[2]);

/** Números impressos no dado, na ordem de `poliedro(lados).faces` (ou, no d4, na ordem dos vértices). */
type Rotulos = number[];

/** Monta o dado (corpo + números nas faces) com os números dados. */
function criarDado(lados: number, rotulos: Rotulos): THREE.Group {
  const p = poliedro(lados);
  const esc = ESCALA[lados] ?? 1;
  const pos: number[] = [];
  for (const f of p.faces) {
    for (let i = 1; i < f.idx.length - 1; i++) {
      for (const k of [f.idx[0], f.idx[i], f.idx[i + 1]]) pos.push(p.vertices[k][0] * esc, p.vertices[k][1] * esc, p.vertices[k][2] * esc);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.userData.rotulos = rotulos;
  const corpo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COR_CORPO[lados] ?? 0x2b1220, roughness: 0.38, metalness: 0.15, flatShading: true }));
  corpo.castShadow = true;
  g.add(corpo);

  p.faces.forEach((f, fi) => {
    const centro = v3(f.centro).multiplyScalar(esc);
    const normal = v3(f.normal);
    const vs = f.idx.map((k) => v3(p.vertices[k]).multiplyScalar(esc));
    const cima = vs[0].clone().sub(centro).normalize(); // "alto" do texto: em direção a um vértice
    const direita = new THREE.Vector3().crossVectors(cima, normal).normalize();
    const raio = Math.max(...vs.map((v) => v.distanceTo(centro)));
    const apotema = Math.min(...vs.map((v, i) => { const w = vs[(i + 1) % vs.length]; return centro.distanceTo(v.clone().add(w).multiplyScalar(0.5)); }));

    let mat: THREE.MeshBasicMaterial;
    let lado: number;
    if (p.valoresVertice) {
      // d4: três números por face, um em cada canto; vale o do canto que fica para cima
      lado = raio * 2.1;
      const nums = f.idx.map((k) => rotulos[k]);
      const tex = textura(`d4:${nums.join("-")}:${f.idx.join("-")}`, (c, tam) => {
        f.idx.forEach((_, i) => {
          const rel = vs[i].clone().sub(centro);
          const x = rel.dot(direita), y = rel.dot(cima);
          const px = tam / 2 + (x * 0.6 / lado) * tam, py = tam / 2 - (y * 0.6 / lado) * tam;
          numero(c, String(nums[i]), px, py, tam * 0.2, Math.atan2(x, y));
        });
      }, 256);
      mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    } else {
      lado = apotema * 1.5;
      const texto = lados === 100 ? String(rotulos[fi]).padStart(2, "0") : String(rotulos[fi]); // dezenas do percentil: 00, 10 … 90
      const tex = textura(`n:${lados}:${texto}`, (c, tam) => numero(c, texto, tam / 2, tam / 2, texto.length >= 3 ? tam * 0.38 : texto.length === 2 ? tam * 0.5 : tam * 0.64));
      mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    }
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(lado, lado), mat);
    plano.position.copy(centro).addScaledVector(normal, 0.004);
    plano.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(direita, cima, normal));
    g.add(plano);
  });
  return g;
}

type Peca = {
  lados: number;
  grupo: THREE.Group;
  /** Um quadro a cada 1/FPS s: x, y, z, qx, qy, qz, qw. */
  quadros: Float32Array;
};

/** Sorteia a posição/rotação inicial, simula o arremesso e devolve os quadros de cada dado. */
function simular(jogada: Jogada, ax: number, az: number): { quadros: Float32Array[]; n: number } {
  const rnd = prng(jogada.semente);
  const mundo = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVIDADE, 0) });
  mundo.allowSleep = true;
  (mundo.solver as CANNON.GSSolver).iterations = 14;
  const material = new CANNON.Material("dado");
  mundo.defaultContactMaterial = new CANNON.ContactMaterial(material, material, { friction: ATRITO, restitution: 0.38 });
  mundo.defaultMaterial = material;

  // chão e paredes invisíveis (mantêm os dados na tela)
  const estatico = (rot: CANNON.Quaternion, pos: CANNON.Vec3) => {
    const b = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material });
    b.quaternion.copy(rot);
    b.position.copy(pos);
    mundo.addBody(b);
  };
  const giro = (x: number, y: number) => new CANNON.Quaternion().setFromEuler(x, y, 0);
  estatico(giro(-Math.PI / 2, 0), new CANNON.Vec3(0, 0, 0));
  estatico(giro(0, -Math.PI / 2), new CANNON.Vec3(ax, 0, 0));
  estatico(giro(0, Math.PI / 2), new CANNON.Vec3(-ax, 0, 0));
  estatico(giro(0, Math.PI), new CANNON.Vec3(0, 0, az));
  estatico(giro(0, 0), new CANNON.Vec3(0, 0, -az));

  const n = jogada.dados.length;
  const corpos = jogada.dados.map((d, i) => {
    const p = poliedro(d.lados);
    const esc = ESCALA[d.lados] ?? 1;
    const forma = new CANNON.ConvexPolyhedron({
      vertices: p.vertices.map((v) => new CANNON.Vec3(v[0] * esc, v[1] * esc, v[2] * esc)),
      faces: p.faces.map((f) => [...f.idx]),
    });
    const b = new CANNON.Body({ mass: 1, shape: forma, material });
    const lado = rnd() < 0.5 ? -1 : 1;
    const faixa = n > 1 ? ((i + 0.5) / n - 0.5) * az * 1.5 : 0;
    b.position.set(lado * (ax - 1.6), 7 + (i % 6) * 2.6 + rnd() * 2, faixa + (rnd() - 0.5) * 1.2);
    // velocidade para o dado chegar perto do centro, mesmo perdendo energia no atrito e nos quiques
    const destino = (rnd() - 0.5) * ax * 0.8;
    const dist = Math.abs(b.position.x - destino);
    b.velocity.set(-lado * Math.sqrt(2 * ATRITO * GRAVIDADE * dist) * (1.0 + rnd() * 0.3), -2 - rnd() * 4, (rnd() - 0.5) * 8);
    b.quaternion.setFromEuler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
    const w = 14 + rnd() * 16;
    const eixo = new CANNON.Vec3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
    eixo.normalize();
    b.angularVelocity.set(eixo.x * w, eixo.y * w, eixo.z * w);
    b.linearDamping = 0.08;
    b.angularDamping = 0.1;
    b.allowSleep = true;
    b.sleepSpeedLimit = 2;
    b.sleepTimeLimit = 0.2;
    mundo.addBody(b);
    return b;
  });

  const quadros: number[][] = corpos.map(() => []);
  const gravar = () => corpos.forEach((b, i) => quadros[i].push(b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w));
  gravar();
  const porQuadro = Math.round(1 / PASSO / FPS);
  let t = 0, passos = 0, paradoDesde = -1;
  while (t < MAX_SIMULACAO_S) {
    if (t > 2.0) corpos.forEach((b) => { b.linearDamping = 0.5; b.angularDamping = 0.5; }); // fecha a rolagem se algum dado insistir em rolar
    mundo.step(PASSO);
    t += PASSO;
    passos++;
    if (passos % porQuadro === 0) {
      gravar();
      const parados = corpos.every((b) => b.sleepState === CANNON.Body.SLEEPING);
      if (parados && paradoDesde < 0) paradoDesde = t;
      if (!parados) paradoDesde = -1;
      if (paradoDesde >= 0 && t - paradoDesde >= PAUSA_FINAL_S) break;
    }
  }
  return { quadros: quadros.map((q) => Float32Array.from(q)), n: quadros[0].length / 7 };
}

/** Troca os números de lugar para o dado que parou mostrar `valor` no topo. */
function rotular(lados: number, valor: number, q: THREE.Quaternion): Rotulos {
  const p = poliedro(lados);
  const nums: number[] = p.valoresVertice ? [...p.valoresVertice] : p.faces.map((f) => f.valor);
  const dirs = p.valoresVertice ? p.vertices : p.faces.map((f) => f.normal);
  let topo = 0, melhor = -Infinity;
  dirs.forEach((d, i) => { const y = v3(d).applyQuaternion(q).y; if (y > melhor) { melhor = y; topo = i; } });
  const alvo = nums.indexOf(valor);
  if (alvo >= 0 && alvo !== topo) [nums[topo], nums[alvo]] = [nums[alvo], nums[topo]];
  return nums;
}

export class CenaDados {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
  private sol = new THREE.DirectionalLight(0xffffff, 2.6);
  private pecas: Peca[] = [];
  private total = 0; // quadros da simulação
  private raf = 0;
  private t0 = 0;
  private fim: (() => void) | null = null;
  private escalaVisivel = 28; // menor lado da tela, em unidades do mundo
  private onResize = () => this.ajustarTamanho();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.cena.add(new THREE.HemisphereLight(0xfff1dd, 0x20141f, 1.35));
    this.sol.position.set(-2.5, 14, 4);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(1024, 1024);
    this.sol.shadow.radius = 4;
    this.cena.add(this.sol);
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.4 }));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    this.cena.add(chao);
    window.addEventListener("resize", this.onResize);
    this.ajustarTamanho();
  }

  private ajustarTamanho() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.enquadrar();
  }

  /** Escala do mundo para que o dado ocupe uma fração do menor lado da tela (e não passe de certo tamanho em pixels). */
  private escalaParaTela(): number {
    const menor = Math.min(window.innerWidth, window.innerHeight);
    const px = Math.min(DADO_MAX_PX, Math.max(DADO_MIN_PX, menor * FRACAO_TELA));
    return (DIAMETRO_MUNDO * menor) / px;
  }

  /** Área visível sobre o chão (largura, profundidade), dada a escala atual. */
  private areaVisivel(escala: number) {
    const a = this.camera.aspect;
    const altura = a >= 1 ? escala : escala / a;
    return { largura: altura * a, profundidade: altura / Math.sin(ELEVACAO) };
  }

  private enquadrar() {
    const altura = this.camera.aspect >= 1 ? this.escalaVisivel : this.escalaVisivel / this.camera.aspect;
    const d = altura / 2 / Math.tan((FOV / 2) * (Math.PI / 180));
    this.camera.position.set(0, d * Math.sin(ELEVACAO), d * Math.cos(ELEVACAO));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    const raio = Math.max(this.escalaVisivel * Math.max(1, this.camera.aspect), this.escalaVisivel) * 0.9;
    Object.assign(this.sol.shadow.camera, { left: -raio, right: raio, top: raio, bottom: -raio, near: 1, far: 80 });
    this.sol.shadow.camera.updateProjectionMatrix();
  }

  /** Larga os dados na tela e resolve quando eles terminam de parar (a cena continua visível até `limpar()`). */
  jogar(jogada: Jogada): Promise<void> {
    this.limpar();
    const n = jogada.dados.length;
    // tamanho dos dados proporcional à tela; com muitos dados a área cresce até caberem todos
    this.escalaVisivel = this.escalaParaTela();
    let area = this.areaVisivel(this.escalaVisivel);
    for (let i = 0; i < 40 && area.largura * 0.78 * area.profundidade * 0.7 < n * 12; i++) {
      this.escalaVisivel *= 1.1;
      area = this.areaVisivel(this.escalaVisivel);
    }
    this.enquadrar();
    const ax = (area.largura * 0.78) / 2, az = (area.profundidade * 0.7) / 2;

    const sim = simular(jogada, ax, az);
    this.total = sim.n;
    const q = new THREE.Quaternion();
    jogada.dados.forEach((d, i) => {
      const quadros = sim.quadros[i];
      const k = (sim.n - 1) * 7;
      q.set(quadros[k + 3], quadros[k + 4], quadros[k + 5], quadros[k + 6]);
      const grupo = criarDado(d.lados, rotular(d.lados, d.valor, q));
      this.cena.add(grupo);
      this.pecas.push({ lados: d.lados, grupo, quadros });
    });

    this.t0 = performance.now();
    cancelAnimationFrame(this.raf);
    const laco = () => {
      const quadro = ((performance.now() - this.t0) / 1000) * FPS;
      this.desenhar(quadro);
      if (quadro >= this.total - 1 && this.fim) { const f = this.fim; this.fim = null; f(); }
      this.raf = requestAnimationFrame(laco);
    };
    this.raf = requestAnimationFrame(laco);
    return new Promise((ok) => { this.fim = ok; });
  }

  private desenhar(quadro: number) {
    const i0 = Math.min(this.total - 1, Math.max(0, Math.floor(quadro)));
    const i1 = Math.min(this.total - 1, i0 + 1);
    const f = Math.min(1, Math.max(0, quadro - i0));
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    for (const p of this.pecas) {
      const a = i0 * 7, b = i1 * 7, d = p.quadros;
      p.grupo.position.set(d[a] + (d[b] - d[a]) * f, d[a + 1] + (d[b + 1] - d[a + 1]) * f, d[a + 2] + (d[b + 2] - d[a + 2]) * f);
      qa.set(d[a + 3], d[a + 4], d[a + 5], d[a + 6]);
      qb.set(d[b + 3], d[b + 4], d[b + 5], d[b + 6]);
      p.grupo.quaternion.copy(qa.slerp(qb, f));
    }
    this.renderer.render(this.cena, this.camera);
  }

  /** Posições finais (x, z) normalizadas pela metade da área jogável, para calibrar a física. */
  posicoesFinais(): [number, number][] {
    return this.pecas.map((p) => { const k = (this.total - 1) * 7; return [p.quadros[k], p.quadros[k + 2]]; });
  }

  /** Número que cada dado mostra no topo no último quadro (para conferir com o sorteio). */
  valoresNoTopo(): number[] {
    const q = new THREE.Quaternion();
    return this.pecas.map((p) => {
      const k = (this.total - 1) * 7, d = p.quadros;
      q.set(d[k + 3], d[k + 4], d[k + 5], d[k + 6]);
      const pol = poliedro(p.lados);
      const dirs = pol.valoresVertice ? pol.vertices : pol.faces.map((f) => f.normal);
      const rotulos = (p.grupo.userData.rotulos ?? []) as number[];
      let topo = 0, melhor = -Infinity;
      dirs.forEach((dir, i) => { const y = v3(dir).applyQuaternion(q).y; if (y > melhor) { melhor = y; topo = i; } });
      return rotulos[topo];
    });
  }

  /** Tira os dados da cena (e para de desenhar). */
  limpar() {
    cancelAnimationFrame(this.raf);
    this.fim = null;
    for (const p of this.pecas) {
      this.cena.remove(p.grupo);
      p.grupo.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat) mat.dispose(); // as texturas ficam no cache
      });
    }
    this.pecas = [];
    this.total = 0;
    this.renderer.clear();
  }

  destruir() {
    this.limpar();
    window.removeEventListener("resize", this.onResize);
    texturas.forEach((t) => t.dispose());
    texturas.clear();
    this.renderer.dispose();
  }
}

/**
 * Vitrine: um único dado 3D girando no lugar (vários eixos ao mesmo tempo) dentro de um canvas pequeno, que desacelera e
 * para com uma face virada para a câmera. Usado nas telas de carregamento. Não tem física nem resultado de jogo.
 */
export class VitrineDado {
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private dado: THREE.Group | null = null;
  private raf = 0;
  private t0 = 0;
  private dur = 1500;
  private qFinal = new THREE.Quaternion();
  private giro = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, tamanho = 160) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(tamanho, tamanho, false);
    this.cena.add(new THREE.HemisphereLight(0xfff1dd, 0x20141f, 1.5));
    const luz = new THREE.DirectionalLight(0xffffff, 2.4);
    luz.position.set(-3, 5, 7);
    this.cena.add(luz);
    this.camera.position.set(0, 0, 8.5);
    this.camera.lookAt(0, 0, 0);
    const laco = () => { this.quadro(); this.raf = requestAnimationFrame(laco); };
    this.raf = requestAnimationFrame(laco);
  }

  /** Troca o dado e começa um novo giro; ele para mostrando uma face (número) de frente. */
  mostrar(lados: number, duracaoMs = 1500) {
    this.remover();
    const p = poliedro(lados);
    const rotulos: Rotulos = p.valoresVertice ? [...p.valoresVertice] : p.faces.map((f) => f.valor);
    const g = criarDado(lados, rotulos);
    this.cena.add(g);
    this.dado = g;

    const f = p.faces[Math.floor(Math.random() * p.faces.length)];
    const q1 = new THREE.Quaternion().setFromUnitVectors(v3(f.normal).normalize(), new THREE.Vector3(0, 0, 1));
    const cima = v3(p.vertices[f.idx[0]]).sub(v3(f.centro)).applyQuaternion(q1);
    const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 - Math.atan2(cima.y, cima.x));
    this.qFinal.copy(roll.multiply(q1));

    const sinal = () => (Math.random() < 0.5 ? -1 : 1);
    const volta = Math.PI * 2;
    this.giro.set(sinal() * volta * 2.5, sinal() * volta * 2, sinal() * volta * 1.5);
    this.dur = duracaoMs;
    this.t0 = performance.now();
  }

  private quadro() {
    if (!this.dado) return;
    const t = Math.min(1, (performance.now() - this.t0) / this.dur);
    const r = Math.pow(1 - t, 3); // desacelera até parar
    const giro = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.giro.x * r, this.giro.y * r, this.giro.z * r));
    this.dado.quaternion.copy(giro.multiply(this.qFinal));
    this.dado.scale.setScalar(0.6 + 0.4 * Math.min(1, t * 3.5));
    this.renderer.render(this.cena, this.camera);
  }

  private remover() {
    if (!this.dado) return;
    this.cena.remove(this.dado);
    this.dado.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose(); // as texturas ficam no cache
    });
    this.dado = null;
  }

  destruir() {
    cancelAnimationFrame(this.raf);
    this.remover();
    this.renderer.dispose();
  }
}

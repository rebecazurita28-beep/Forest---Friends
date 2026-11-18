// Intermedio narrativo "La montaña más alta" (paramo.glb + fresas.glb). Es una CINEMÁTICA, no un nivel jugable:
//   Parte A: llegada a la montaña → hallazgo de la canasta de fresas → celebración → ventana "¡Lo lograron!" (botón Continuar)
//   Parte B: deciden tomar un atajo → caminan hacia la cueva → fundido a negro → Nivel 3.
// Mismo lenguaje que la intro: Sequencer + subtítulos con máquina de escribir + cámara por planos + animación procedural.
import * as THREE from 'three';
import { Sequencer } from './sequencer.js';
import { WorldQueries } from './world.js';
import { PARTY } from './config.js';
import { TRAIL_X, BASKET, LANES, CAMS, T, CONGRATS, DUR, WALK_AWAY, FOG } from './story.js';

const ease = p => p * p * (3 - 2 * p);
const lerp = (a, b, k) => a + (b - a) * k;
const V = a => new THREE.Vector3(a[0], a[1], a[2]);

export class Mountain {
  constructor(game) {
    this.game = game;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd9e6ea);
    scene.fog = new THREE.Fog(0xd9e6ea, FOG.near, FOG.far);   // el borde lejano del terreno se funde con el fondo
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b09a, 1.55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(10, 20, -6); scene.add(sun);
    this.root = game.models.paramo; scene.add(this.root); this.root.updateMatrixWorld(true);
    // Suelo para apoyar a los personajes: terreno y sendero (las montañas y los árboles son decorado)
    this.world = new WorldQueries(this.root, { walkable: /Terreno_principal|Sendero_de_tierra/, killY: -99 });
    this.basket = new THREE.Group(); this.basket.name = 'canasta';
    this.look = new THREE.Vector3(); this.phase = 'idle'; this.seq = null; this._n = -1; this.t = 0;
  }

  groundY(x, z) { const g = this.world.groundAt(x, z, 6); return g ? g.y : 0; }
  get running() { return this.phase === 'A' || this.phase === 'B'; }

  /** Apaga todo lo propio de la cinemática (al volver al menú). */
  reset() {
    this.seq = null; this.phase = 'idle'; this._fade = false;
    const g = this.game; g.hideModel('fresas'); this.basket.removeFromParent();
    g.ui.caption(null); g.ui.show('skip', false); g.ui.closeComplete();
  }

  // ---------- utilidades de cinemática ----------
  _type(text, p) {                                   // máquina de escribir durante el 60 % del paso (como la intro)
    const n = Math.ceil(text.length * Math.min(1, p / 0.6));
    if (n !== this._n) { this._n = n; this.game.ui.caption(text.slice(0, n)); }
  }
  _shot(c, p) {
    const e = ease(p), cam = this.game.camera;
    cam.position.set(lerp(c.from[0], c.to[0], e), lerp(c.from[1], c.to[1], e), lerp(c.from[2], c.to[2], e));
    this.look.set(lerp(c.lf[0], c.lt[0], e), lerp(c.lf[1], c.lt[1], e), lerp(c.lf[2], c.lt[2], e)); cam.lookAt(this.look);
  }
  _orbit(p) {
    const c = CAMS.A5, a = Math.PI * lerp(c.a0, c.a1, ease(p)), cam = this.game.camera;
    cam.position.set(c.center[0] + c.radius * Math.cos(a), c.center[1] + c.h, c.center[2] + c.radius * Math.sin(a));
    this.look.set(c.center[0], c.center[1], c.center[2]); cam.lookAt(this.look);
  }
  /** Coloca a un personaje sobre el sendero en la profundidad z (moving → animación de caminar). */
  _at(n, z, yaw, moving = false, dx = null) {
    const c = this.game.chars[n], x = TRAIL_X(z) + (dx ?? LANES[n].dx);
    const b = c.body; b.x = x; b.z = z; b.y = this.groundY(x, z); b.yaw = yaw; b.speed01 = moving ? 0.55 : 0; b.grounded = true;
  }
  _party(fn) { PARTY.forEach((n, i) => fn(n, this.game.chars[n], i)); }
  _basketBob(t, amp = 0.05) {
    const b = this.basket; b.position.y = this.groundY(BASKET.x, BASKET.z) + 0.02 + Math.abs(Math.sin(t * 2.2)) * amp; b.rotation.y += 0.01;
  }

  // ---------- parte A ----------
  start() {
    const g = this.game, ui = g.ui;
    g.chars.Berry.holder.removeFromParent();                      // Berry se queda en el bosque esperando el pastel
    this._party((n, c) => { this.scene.add(c.holder); c.holder.visible = true; c.fallAnim = false; c.spin = 0; c.dip = 0; this._at(n, LANES[n].z0, 0); c.sync(); });
    g.showModel('fresas', this.basket); this.scene.add(this.basket);
    this.basket.scale.setScalar(BASKET.scale); this.basket.position.set(BASKET.x, this.groundY(BASKET.x, BASKET.z), BASKET.z); this.basket.rotation.y = 0.5;
    g.tpc.enabled = false; ui.show('hud', false); ui.closeComplete(); ui.closeDialog(); ui.prompt(null); ui.progress(null);
    this.phase = 'A'; this._fade = false; this.t = 0;
    let hops = 0;
    const walk = (p0, p1, p) => this._party((n, c) => { const L = LANES[n]; this._at(n, lerp(L.z0, L.zMid, lerp(p0, p1, p)), 0, true); });
    const steps = [
      { dur: DUR.A[0], enter: () => { this._n = -1; },
        update: p => { this._shot(CAMS.A1, p); walk(0, 0.5, p); this._type(T.a1, p); } },
      { dur: DUR.A[1], enter: () => { this._n = -1; g.chars.Bobby.hopNow(); },
        update: p => { this._shot(CAMS.A2, p); walk(0.5, 1, p); this._type(T.a2, p); } },
      { dur: DUR.A[2], enter: () => { this._n = -1; this._party((n, c) => { this._at(n, LANES[n].zMid, 0, false); }); g.chars.Cookie.hopNow(); },
        update: (p, t) => { this._shot(CAMS.A3, p); this._type(T.a3, p); this._basketBob(t, 0.08); } },
      { dur: DUR.A[3], enter: () => { this._n = -1; },
        update: (p, t) => {
          this._shot(CAMS.A4, p); this._type(T.a4, p);
          const k = Math.min(1, p / 0.8); this._party((n) => { const L = LANES[n]; this._at(n, lerp(L.zMid, L.zEnd, ease(k)), 0, k < 1); });
          this._basketBob(t, 0.08); if (p > 0.85 && p < 0.87) g.chars.Toffee.hopNow();
        } },
      { dur: DUR.A[4], enter: () => { this._n = -1; hops = 0; this._party((n) => this._at(n, LANES[n].zEnd, 0, false)); },
        update: (p, t) => {
          this._orbit(p); this._type(T.a5, p);
          this._party((n, c, i) => { this._at(n, LANES[n].zEnd, ease(p) * Math.PI * 2, false); if (t > hops * 0.5 + 0.2 + i * 0.1 && i === hops % 3) { c.hopNow(); hops++; } });
          this._basketBob(t, 0.16);
        } },
    ];
    this.seq = new Sequencer(steps, () => this._arrivedA());
    this.seq.start(); ui.show('skip');
  }

  _arrivedA() {
    const g = this.game, ui = g.ui;
    this.phase = 'congrats'; this.seq = null;
    this._party(n => this._at(n, LANES[n].zEnd, 0, false));
    this._orbit(1);
    ui.caption(null); ui.show('skip', false);
    ui.complete(CONGRATS.title, CONGRATS.text, [{ label: CONGRATS.button, big: true, onClick: () => this.startB() }]);
  }

  // ---------- parte B ----------
  startB() {
    if (this.phase !== 'congrats') return;
    const g = this.game, ui = g.ui, ch = g.chars;
    ui.closeComplete(); this.phase = 'B'; this.t = 0;
    const carry = (k = 1) => {                                 // Toffee lleva la canasta delante de él
      const b = ch.Toffee.body, off = 0.5 * k;
      this.basket.position.set(b.x + Math.sin(b.yaw) * off, b.y + 0.5 * k, b.z + Math.cos(b.yaw) * off);
      this.basket.scale.setScalar(lerp(BASKET.scale, 1.0, k));
    };
    const stand = (yawFor) => this._party((n, c, i) => this._at(n, LANES[n].zEnd, yawFor(n), false));
    const steps = [
      { dur: DUR.B[0], enter: () => { this._n = -1; ch.Toffee.hopNow(); this._b0 = this.basket.position.clone(); },
        update: (p, t) => {
          this._shot(CAMS.B1, p); this._type(T.b1, p); stand(() => 0);
          const k = ease(Math.min(1, t / 1.2)), b = ch.Toffee.body;                                 // la canasta pasa a manos de Toffee
          const tx = b.x, ty = b.y + 0.5, tz = b.z + 0.5;
          this.basket.position.set(lerp(this._b0.x, tx, k), lerp(this._b0.y, ty, k), lerp(this._b0.z, tz, k)); this.basket.scale.setScalar(lerp(BASKET.scale, 1.0, k));
        } },
      { dur: DUR.B[1], enter: () => { this._n = -1; ch.Cookie.hopNow(); },
        update: p => { this._shot(CAMS.B2, p); this._type(T.b2, p); stand(() => 0); carry(); } },
      { dur: DUR.B[2], enter: () => { this._n = -1; ch.Bobby.hopNow(); },
        update: p => { this._shot(CAMS.B3, p); this._type(T.b3, p); stand(n => (n === 'Bobby' ? Math.PI * ease(Math.min(1, p * 2)) : 0)); carry(); } },
      { dur: DUR.B[3], enter: () => { this._n = -1; this._party((n, c) => c.hopNow()); },
        update: p => { this._shot(CAMS.B4, p); this._type(T.b4, p); stand(n => (n === 'Bobby' ? Math.PI : Math.PI * ease(Math.min(1, p * 1.6)))); carry(); } },
      { dur: DUR.B[4], enter: () => { this._n = -1; },
        update: p => {
          this._shot(CAMS.B5, p); this._type(T.b5, p);
          const e = ease(p);
          this._party((n) => this._at(n, LANES[n].zEnd - WALK_AWAY * e, Math.PI, p < 0.97));               // caminan hacia la cueva (hacia las montañas)
          carry();
          if (p > 0.8 && !this._fade) { this._fade = true; ui.fade(true); }
        } },
    ];
    this.seq = new Sequencer(steps, () => this._finish());
    this.seq.start(); ui.show('skip');
  }

  _finish() {
    const g = this.game;
    this.seq = null; this.phase = 'done';
    g.ui.caption(null); g.ui.show('skip', false);
    g.saveProgress({ mountain: true });
    g.beginLevel3();
  }

  skip() { if (this.running) this.seq?.skip(); }

  update(dt) {
    this.t += dt;
    if (this.seq) this.seq.update(dt);
    else if (this.phase === 'congrats') {               // ventana abierta: los tres siguen celebrando suavemente
      this._basketBob(this.t, 0.1);
      this._party((n, c, i) => { if (Math.floor(this.t / 1.2 + i * 0.4) !== Math.floor((this.t - dt) / 1.2 + i * 0.4)) c.hopNow(); });
    }
    this._party((n, c) => c.update(dt));
  }
}

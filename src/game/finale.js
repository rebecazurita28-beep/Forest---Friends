// Cinemática final "De vuelta en el bosque" (NO es un nivel jugable). Se lanza al pulsar Continuar en la ventana del Nivel 3.
//   1 · Fundido a negro con el texto del regreso → el bosque del nivel 1 (puente.glb) y los tres amigos llegando con la canasta (fresas.glb)
//   2 · Berry los ve, corre a recibirlos y se reúnen (diálogos)
//   3 · Preparación del pastel: pantalla en negro con una pequeña secuencia de iconos/subtítulos
//   4 · Revelación de Pastel_de_fresas.glb sobre una mesa baja y los cuatro amigos a su alrededor → celebración con confeti suave
//   5 · Pantalla «¡AVENTURA COMPLETADA!» (logo, frase, Volver a jugar, Menú principal y créditos) sobre la escena que sigue celebrando
// Mismo lenguaje que intro.js / mountain.js: Sequencer + subtítulos con máquina de escribir + cámara por planos + animación procedural.
import * as THREE from 'three';
import { Sequencer } from './sequencer.js';
import { FIN, T, COOK, DUR, CAMS, CONFETTI, END, CREDITS } from './storyEnd.js';

const ease = p => p * p * (3 - 2 * p);
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const backOut = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const NAMES = ['Toffee', 'Berry', 'Cookie', 'Bobby'];
const TRIO = ['Toffee', 'Cookie', 'Bobby'];
const PATH_RE = /Winding_Sandy_Path/;
const flat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const cyl = (rt, rb, h, color, y = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), flat(color)); m.position.y = y + h / 2; return m; };
// ritmo de salto de cada amigo en la celebración: [periodo (s), desfase (s), altura (m)]
const HOP = { Toffee: [1.7, 0.0, 0.28], Berry: [1.3, 0.45, 0.36], Cookie: [1.1, 0.9, 0.36], Bobby: [0.95, 0.25, 0.3] };

export class Finale {
  constructor(game) {
    this.game = game; this.phase = 'idle'; this.seq = null; this.look = new THREE.Vector3(); this._n = -1;
    this.basket = new THREE.Group(); this.basket.name = 'canasta_final';
    this.cakeG = new THREE.Group(); this.cakeG.name = 'pastel_final';
    this.table = null; this.conf = null; this.confOn = false; this.cakeReady = false; this.t = 0; this.pop = 0;
  }
  get running() { return this.phase === 'seq'; }
  get active() { return this.phase !== 'idle'; }

  // ---------- geometría de la escena ----------
  _cx(z) {                                          // línea central del sendero a la profundidad z (tabla precalculada en start)
    const T_ = this._cl; if (!T_) return this.S.x;
    const k = clamp01((z - T_.z0) / (T_.step * (T_.v.length - 1))) * (T_.v.length - 1), i = Math.min(T_.v.length - 2, Math.floor(k));
    return lerp(T_.v[i], T_.v[i + 1], k - i);
  }
  _buildCenterline() {
    const L = this.game.level1, S = this.S, z0 = S.z - 2, step = 1, v = [];
    for (let i = 0; i <= 26; i++) { const x = L.world?.centerlineX?.(PATH_RE, z0 + i * step); v.push(Number.isFinite(x) ? x : (v.length ? v[v.length - 1] : S.x)); }
    this._cl = { z0, step, v };
  }
  _ground(x, z) { return this.game.level1.groundY(x, z); }
  /** Coloca a un personaje: dz desde S, dx respecto a la línea central de esa profundidad. */
  _put(n, dz, dx, yaw, speed = 0) {
    const c = this.game.chars[n], z = this.S.z + dz, x = this._cx(z) + dx, b = c.body;
    b.x = x; b.z = z; b.y = this._ground(x, z); b.yaw = yaw; b.speed01 = speed; b.grounded = true;
  }
  _ring(n) { const [dx, dz] = FIN.ring[n], C = this.C; return { x: C.x + dx, z: C.z + dz, yaw: Math.atan2(FIN.faceAt[0] - dx, FIN.faceAt[1] - dz) }; }

  // ---------- cámara ----------
  _base(kind) { return kind === 'cake' ? this.C : { x: this._cx(this.S.z + FIN.cakeDz), y: this.S.y, z: this.S.z }; }
  _shot(c, p, kind = 'stage') {
    const B = this._base(kind), e = ease(p), cam = this.game.camera, f = c.from, t = c.to, lf = c.lf, lt = c.lt;
    cam.position.set(B.x + lerp(f[0], t[0], e), B.y + lerp(f[1], t[1], e), B.z + lerp(f[2], t[2], e));
    this.look.set(B.x + lerp(lf[0], lt[0], e), B.y + lerp(lf[1], lt[1], e), B.z + lerp(lf[2], lt[2], e)); cam.lookAt(this.look);
  }
  _orbit(c, a) {                                    // cámara delante de la mesa girando unos grados a cada lado (siempre mira a +Z)
    const B = this.C, cam = this.game.camera;
    cam.position.set(B.x + c.radius * Math.sin(a), B.y + c.h, B.z - c.radius * Math.cos(a));
    this.look.set(B.x + c.look[0], B.y + c.look[1], B.z + c.look[2]); cam.lookAt(this.look);
  }
  _type(text, p, from = 0, to = 0.6) {              // máquina de escribir (como la intro)
    const n = Math.ceil(text.length * clamp01((p - from) / (to - from)));
    if (n !== this._n || this._txt !== text) { this._n = n; this._txt = text; this.game.ui.caption(n ? text.slice(0, n) : null); }
  }

  // ---------- inicio / fin ----------
  start() {
    const g = this.game, L = g.level1, ui = g.ui, ch = g.chars;
    this.reset(true);
    this.S = L.spawn; this._buildCenterline();
    this.phase = 'seq'; this.t = 0; this.cakeReady = false; this.confOn = false; this.pop = 0; this._next = {};
    // Los cuatro amigos en el bosque (Berry vuelve a la escena: los niveles la habían retirado)
    for (const n of NAMES) { const c = ch[n]; L.scene.add(c.holder); c.holder.visible = true; c.fallAnim = false; c.spin = 0; c.dip = 0; c.hop = 0; }
    const fog = L.scene.fog; if (fog) { this._fog0 = { near: fog.near, far: fog.far }; fog.near = FIN.fog.near; fog.far = FIN.fog.far; }
    L.gateObj.visible = false; L.signObj.visible = false;          // la compuerta y el cartel del nivel 1 no pintan nada en el final
    g.showModel('fresas', this.basket); L.scene.add(this.basket); this.basket.scale.setScalar(1.0);
    this._buildProps(); this._buildConfetti();
    g.tpc.enabled = false; ui.show('hud', false); ui.closeComplete(); ui.closeDialog(); ui.prompt(null); ui.progress(null); ui.react(null); ui.closeEnding();
    this._pose0();
    this._shot(CAMS.back, 0);
    ui.captionTop(true);                                          // el texto se lee sobre el fundido a negro (#fade debe estar activo)
    const ca = CAMS, pr = (p0, p1, p) => lerp(p0, p1, p);
    const walk = (from, to, p, speed = 0.5) => TRIO.forEach(n => this._put(n, pr(from[n][1], to[n][1], p), pr(from[n][0], to[n][0], p), Math.PI, p < 1 ? speed : 0));
    const carry = (k = 1) => {                                      // Toffee lleva la canasta delante del pecho
      const b = ch.Toffee.body; this.basket.position.set(b.x + Math.sin(b.yaw) * 0.5 * k, b.y + 0.55, b.z + Math.cos(b.yaw) * 0.5 * k); this.basket.rotation.y = b.yaw;
    };
    const waiting = t => { const b = ch.Berry.body; b.yaw = Math.sin(t * 1.1) * 0.4; };        // Berry espera mirando el camino
    const steps = [
      { dur: DUR.back, enter: () => { this._n = -1; this._txt = null; ui.fade(true); },
        update: (p, t) => {
          this._shot(ca.back, p); this._type(T.r0, p, 0.05, 0.6); waiting(t); carry();
          if (p > 0.8 && !this._faded) { this._faded = true; ui.fade(false); ui.captionTop(false); }
        }, exit: () => { ui.captionTop(false); ui.fade(false); this._faded = false; } },
      { dur: DUR.arrive, enter: () => { this._n = -1; this._txt = null; ch.Cookie.hopNow(); },
        update: (p, t) => { this._shot(ca.arrive, p); this._type(T.r1, p); walk(FIN.trioStart, FIN.trioNear, p); waiting(t); carry(); if (p > 0.55 && p < 0.57) ch.Berry.hopNow(); } },
      { dur: DUR.meet, enter: () => { this._n = -1; this._txt = null; ch.Berry.hopNow(); },
        update: (p, t) => {
          this._shot(ca.meet, p); this._type(T.r2, p);
          const kb = ease(clamp01((p - 0.12) / 0.6)), bz = lerp(FIN.berryStart[1], FIN.hug.Berry[1], kb);
          this._put('Berry', bz, 0, 0, kb < 1 ? 0.9 : 0);
          walk(FIN.trioNear, FIN.hug, ease(clamp01(p / 0.8)));
          if (p > 0.5 && p < 0.52) ch.Cookie.hopNow(); if (p > 0.62 && p < 0.64) ch.Bobby.hopNow();
          carry();
        } },
      { dur: DUR.hug, enter: () => { this._n = -1; this._txt = null; this._h = 0; this._swap = false; },
        update: (p, t) => {
          this._shot(ca.hug, p);
          if (p < 0.5) this._type(T.r3, p, 0, 0.3); else { if (!this._swap) { this._swap = true; this._n = -1; this._txt = null; } this._type(T.r4, p, 0.5, 0.78); }
          // abrazo: todos juntos saltan y Berry da una vuelta de alegría (saltos por turnos para que se lea bien)
          const hopAt = [0.4, 0.9, 1.4, 1.9, 3.0, 3.5, 4.0, 4.5];
          while (this._h < hopAt.length && t >= hopAt[this._h]) { ch[['Berry', 'Toffee', 'Cookie', 'Bobby'][this._h % 4]].hopNow(); this._h++; }
          this._put('Berry', FIN.hug.Berry[1], FIN.hug.Berry[0], ease(clamp01(t / 1.4)) * Math.PI * 2, 0);
          TRIO.forEach(n => this._put(n, FIN.hug[n][1], FIN.hug[n][0], Math.PI + Math.sin(t * 3 + FIN.hug[n][0]) * 0.28, 0));
          carry();
          if (p > 0.45) {                                           // Toffee deja la canasta en el suelo a su lado
            const k = ease(clamp01((p - 0.45) / 0.3)), b = ch.Toffee.body, tx = b.x - 0.9, tz = b.z + 0.2, ty = this._ground(tx, tz);
            this.basket.position.set(lerp(b.x, tx, k), lerp(b.y + 0.55, ty, k), lerp(b.z - 0.5, tz, k));
          }
        } },
    ];
    // ---- cocina: pantalla en negro con una pequeña secuencia visual (icono + subtítulo) ----
    COOK.forEach((c, i) => steps.push({
      dur: DUR.cook[i],
      enter: () => {
        this._n = -1; this._txt = null; ui.cook(c.icon);
        if (i === 0) { ui.captionTop(true); ui.fade(true); }
        if (i === 1) this._setupCake();                              // el cambio de escenario ocurre con la pantalla en negro
      },
      update: (p, t) => {
        if (i === 0) { this._shot(ca.hug, 1); }
        this._type(c.text, clamp01((t - (i === 0 ? 0.55 : 0.1)) / (DUR.cook[i] - 0.1)), 0, 0.7);
      } }));
    // ---- revelación del pastel y celebración ----
    steps.push({ dur: DUR.reveal, enter: () => {
        this._n = -1; this._txt = null; ui.cook(null); this._setupCake(); ui.fade(false); ui.captionTop(false); this._cel0 = this.t; this.confOn = true; this._startConfetti();
      },
      update: (p, t) => {
        this._shot(CAMS.reveal, p, 'cake');
        this.pop = backOut(clamp01(t / 1.1)); this._applyCake();
        this._type(p < 0.5 ? T.k1 : T.k2, p < 0.5 ? p / 0.5 : (p - 0.5) / 0.5, 0, 0.6);
        this._celebrate(this.t - this._cel0, true);
      } });
    DUR.party.forEach((d, i) => steps.push({ dur: d,
      enter: () => { this._n = -1; this._txt = null; },
      update: (p) => {
        const c = CAMS.party; this._orbit(c, lerp(c.a0, c.a1, (i + p) / DUR.party.length));
        this._type([T.k3, T.k4, T.k5][i], p, 0, 0.6);
        this._celebrate(this.t - this._cel0);
      } }));
    this.seq = new Sequencer(steps, () => this._toEnding());
    this.seq.start(); ui.show('skip');
  }

  /** Estado inicial de la escena: Berry esperando, trío lejos, canasta en manos de Toffee. */
  _pose0() {
    const ch = this.game.chars;
    this._put('Berry', FIN.berryStart[1], FIN.berryStart[0], 0, 0);
    TRIO.forEach(n => this._put(n, FIN.trioStart[n][1], FIN.trioStart[n][0], Math.PI, 0));
    for (const n of NAMES) ch[n].sync();
    const b = ch.Toffee.body; this.basket.position.set(b.x, b.y + 0.55, b.z - 0.5);
  }

  // ---------- pastel, mesa y confeti ----------
  _buildProps() {
    const L = this.game.level1;
    const t = this.table = new THREE.Group(); t.name = 'mesa_final';
    const { r, h } = FIN.table;
    t.add(cyl(0.46, 0.5, 0.05, 0x6e4506, 0));                    // base
    t.add(cyl(0.13, 0.17, h - 0.1, 0x6e4506, 0.05));             // pie
    t.add(cyl(r, r, 0.05, 0x9B6108, h - 0.05));                   // tablero
    t.add(cyl(r * 0.88, r * 0.88, 0.02, 0xFFFFFE, h));            // mantel crema
    t.add(cyl(r, r, 0.012, 0x942221, h - 0.062));                 // ribete rojo bajo el tablero
    t.visible = false; L.scene.add(t);
    this.cakeG.visible = false; this.cakeG.scale.setScalar(0.001); L.scene.add(this.cakeG);
  }
  _setupCake() {
    if (this.cakeReady) return; this.cakeReady = true;
    const g = this.game, L = g.level1, S = this.S;
    const cz = S.z + FIN.cakeDz, cx = this._cx(cz);
    this.C = { x: cx, z: cz, y: this._ground(cx, cz) };
    this.table.position.set(cx, this.C.y, cz); this.table.visible = true;
    g.showModel('Pastel_de_fresas', this.cakeG); L.scene.add(this.cakeG); this.cakeG.visible = true;
    this.cakeG.position.set(cx, this.C.y + FIN.table.h + 0.02, cz);
    this.pop = 0; this._applyCake();
    for (const n of NAMES) { const q = this._ring(n), b = g.chars[n].body; b.x = q.x; b.z = q.z; b.y = this._ground(q.x, q.z); b.yaw = q.yaw; b.speed01 = 0; b.grounded = true; g.chars[n].sync(); g.chars[n].hop = 0; }
    const [bx, bz] = FIN.basket, px = cx + bx, pz = cz + bz;
    this.basket.position.set(px, this._ground(px, pz), pz); this.basket.rotation.y = 0.5; this.basket.scale.setScalar(1.0);
    this._shot(CAMS.reveal, 0, 'cake');
  }
  _applyCake() { this.cakeG.scale.setScalar(Math.max(0.001, FIN.cakeScale * this.pop)); }
  _buildConfetti() {
    const L = this.game.level1, grp = new THREE.Group(); grp.name = 'confeti'; grp.visible = false;
    const geo = new THREE.BoxGeometry(0.1, 0.012, 0.065), mats = CONFETTI.colors.map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    this.conf = { grp, pieces: [], rnd };
    for (let i = 0; i < CONFETTI.count; i++) {
      const m = new THREE.Mesh(geo, mats[i % mats.length]); grp.add(m);
      this.conf.pieces.push({ m, ox: (rnd() * 2 - 1) * CONFETTI.spread, oz: (rnd() * 2 - 1) * CONFETTI.spread * 0.8 + 0.5, y: rnd() * CONFETTI.top, v: lerp(CONFETTI.fall[0], CONFETTI.fall[1], rnd()), ph: rnd() * 6.28, rs: 1 + rnd() * 3 });
    }
    L.scene.add(grp);
  }
  _startConfetti() { if (this.conf) this.conf.grp.visible = true; }
  _updateConfetti(dt) {
    const c = this.conf; if (!c || !this.confOn || !this.C) return;
    for (const q of c.pieces) {
      q.y -= q.v * dt; if (q.y < 0.05) { q.y = CONFETTI.top; q.ox = (c.rnd() * 2 - 1) * CONFETTI.spread; q.oz = (c.rnd() * 2 - 1) * CONFETTI.spread * 0.8 + 0.5; }
      q.ph += dt * q.rs;
      q.m.position.set(this.C.x + q.ox + Math.sin(q.ph) * 0.18, this.C.y + q.y, this.C.z + q.oz + Math.cos(q.ph * 0.8) * 0.12);
      q.m.rotation.x = q.ph * 1.3; q.m.rotation.z = q.ph * 0.9;
    }
  }

  /** Celebración procedural: saltitos por turnos con giro de felicidad; todos mirando al pastel y a la cámara. */
  _celebrate(t, soft = false) {
    for (const n of NAMES) {
      const [per, off, amp] = HOP[n], q = this._ring(n), c = this.game.chars[n], u = ((t + off) % per) / per;
      const a = soft ? amp * clamp01((t - 0.4 - off) / 0.6) : amp;                    // al revelarse el pastel van estallando de alegría uno a uno
      c.body.x = q.x; c.body.z = q.z; c.body.y = this._ground(q.x, q.z) + (u < 0.55 ? Math.sin(Math.PI * u / 0.55) * a : 0);
      c.body.yaw = q.yaw + Math.sin(t * 2.4 + off * 3) * 0.22; c.body.speed01 = 0;
    }
  }

  // ---------- bucle ----------
  update(dt) {
    if (this.phase === 'idle') return;
    this.t += dt;
    if (this.phase === 'seq') this.seq?.update(dt);
    else if (this.phase === 'ending') {
      this._celebrate(this.t - this._cel0);
      const c = CAMS.final; this._orbit(c, Math.sin((this.t - this._cel0) * 0.22) * 0.1);
    }
    this.cakeG.rotation.y += this.cakeReady ? dt * 0.35 : 0;
    this._updateConfetti(dt);
    for (const n of NAMES) this.game.chars[n].update(dt);
  }
  skip() { if (this.phase === 'seq') this.seq?.skip(); }

  /** Fin de la cinemática (o salto con Espacio): deja la escena final completa y muestra la pantalla de victoria. */
  _toEnding() {
    const g = this.game, ui = g.ui;
    this.seq = null; this.phase = 'ending';
    ui.fade(false); ui.captionTop(false); ui.cook(null); ui.caption(null); ui.show('skip', false);
    this._setupCake(); this.pop = 1; this._applyCake(); this.confOn = true; this._startConfetti();
    this._cel0 ??= this.t; this._celebrate(this.t - this._cel0); this._orbit(CAMS.final, 0);
    ui.ending({
      title: END.title, phrase: END.phrase,
      buttons: [{ label: END.replay, big: true, onClick: () => g.replayAdventure() }, { label: END.menu, onClick: () => g.goTitle() }],
      credits: { title: END.creditsTitle, ...CREDITS },
    });
  }

  /** Apaga todo lo propio de la cinemática (al volver al menú o al reiniciar). */
  reset(keepUi = false) {
    const g = this.game, L = g.level1;
    this.seq = null; this.phase = 'idle'; this.confOn = false; this.cakeReady = false; this._faded = false; this._cel0 = undefined;
    g.hideModel('Pastel_de_fresas'); g.hideModel('fresas');
    for (const o of [this.basket, this.cakeG, this.table, this.conf && this.conf.grp]) o?.removeFromParent();
    this.table = null; this.conf = null; this.cakeG.rotation.y = 0;
    if (this._fog0 && L.scene.fog) { L.scene.fog.near = this._fog0.near; L.scene.fog.far = this._fog0.far; } this._fog0 = null;
    if (L.gateObj) L.gateObj.visible = true;
    if (L.signObj) L.signObj.visible = true;
    if (!keepUi) { const ui = g.ui; ui.closeEnding(); ui.cook(null); ui.captionTop(false); ui.caption(null); ui.show('skip', false); }
  }
}

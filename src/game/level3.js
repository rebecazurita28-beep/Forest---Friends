// Nivel 3 · La cueva del zorro (Cueva.glb + zorro.glb + fresas.glb). Estructura:
//   brief (título) → arrive (los amigos entran) → fox (aparece el zorro, quiere las fresas) → SHOWDOWN (reacción con la barra espaciadora)
//   → victory (el zorro se asusta y sale volando, celebración) → ventana de nivel completado (repetir / continuar al módulo final).
// La lógica del enfrentamiento es pura y está en flow3.js (con tests); aquí solo se dibuja y se anima (animación procedural: los GLB no traen).
import * as THREE from 'three';
import { Sequencer } from './sequencer.js';
import { WorldQueries } from './world.js';
import { Character } from './character.js';
import { PARTY, MOVE, ANIM } from './config.js';
import { Showdown, MSG } from './flow3.js';
import { LEVEL3, POS, FOX, T, DUR, DONE, CAMS } from './story3.js';

const ease = p => p * p * (3 - 2 * p);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = v => Math.min(1, Math.max(0, v));

export class Level3 {
  constructor(game) {
    this.game = game;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x201c18);
    scene.fog = new THREE.Fog(0x201c18, 16, 46);
    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x5a4a3a, 1.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(3, 12, 10); scene.add(sun);
    this.root = game.models.Cueva; scene.add(this.root); this.root.updateMatrixWorld(true);
    this.world = new WorldQueries(this.root, { walkable: /Suelo_cueva/, killY: -99 });
    this.fox = new Character('Fox', game.models.zorro, MOVE.Fox, ANIM.Fox);       // zorro.glb original (animación procedural)
    this.fox.holder.visible = false; scene.add(this.fox.holder);
    this.basket = new THREE.Group(); this.basket.name = 'canasta3';
    this.show = new Showdown(); this.look = new THREE.Vector3();
    this.phase = 'idle'; this.t = 0; this.seq = null; this.completed = false; this.modalOpen = false;
    this.surp = { Toffee: 0, Cookie: 0, Bobby: 0 }; this._n = -1; this._lastMode = '';
  }

  groundY(x, z) { const g = this.world.groundAt(x, z, 3); return g ? g.y : 0; }
  closeModal() { /* sin paneles que cerrar con ESC */ }
  get cinematic() { return this.phase === 'arrive' || this.phase === 'victory'; }

  // ---------- utilidades ----------
  _type(text, p) { const n = Math.ceil(text.length * Math.min(1, p / 0.6)); if (n !== this._n) { this._n = n; this.game.ui.caption(text.slice(0, n)); } }
  _shot(c, p) {
    const e = ease(p), cam = this.game.camera;
    cam.position.set(lerp(c.from[0], c.to[0], e), lerp(c.from[1], c.to[1], e), lerp(c.from[2], c.to[2], e));
    this.look.set(lerp(c.lf[0], c.lt[0], e), lerp(c.lf[1], c.lt[1], e), lerp(c.lf[2], c.lt[2], e)); cam.lookAt(this.look);
  }
  _put(n, x, z, yaw, moving = false) { const b = this.game.chars[n].body; b.x = x; b.z = z; b.y = this.groundY(x, z); b.yaw = yaw; b.speed01 = moving ? 0.6 : 0; b.grounded = true; }
  _party(fn) { PARTY.forEach((n, i) => fn(n, this.game.chars[n], i)); }
  _stand(pos, yaw = Math.PI) { this._party(n => this._put(n, pos[n][0], pos[n][1], yaw)); }
  _surprise(who = PARTY) { who.forEach(n => { this.surp[n] = 1; this.game.chars[n].hopNow(); }); }
  _carry(lift = 0, pull = 0) {                                  // Toffee lleva la canasta delante de él; el zorro puede tirar de ella
    const b = this.game.chars.Toffee.body, k = POS.carry;
    this.basket.position.set(b.x, b.y + k.y + lift, b.z + k.dz - FOX.tug * pull); this.basket.rotation.y = Math.sin(this.t * 14) * 0.25 * pull;
  }
  _foxAt(x, z, yaw = 0) { const f = this.fox, b = f.body; b.x = x; b.z = z; b.y = this.groundY(x, z); b.yaw = yaw; b.grounded = true; }
  _foxPose({ crouch = 0, lift = 0, scale = 1, tiltZ = 0, spin = 0 } = {}) {   // se aplica DESPUÉS de fox.update
    const f = this.fox, s = POS.foxScale * scale;
    f.holder.scale.set(s, s * (1 - 0.18 * crouch), s);
    f.holder.position.y += lift; f.anim.rotation.x += crouch * 0.32; f.anim.rotation.z += tiltZ; f.anim.rotation.y = spin;
  }

  // ---------- inicio ----------
  enter({ brief = true } = {}) {
    const g = this.game, ui = g.ui;
    g.chars.Berry.holder.removeFromParent();
    this._party((n, c) => { this.scene.add(c.holder); c.holder.visible = true; c.fallAnim = false; c.spin = 0; c.dip = 0; c.anim.rotation.y = 0; this._put(n, POS.start[n][0], POS.start[n][1], Math.PI); c.sync(); });
    g.showModel('fresas', this.basket); this.scene.add(this.basket); this.basket.scale.setScalar(1);
    this.fox.holder.visible = false; this.fox.anim.rotation.y = 0;
    this.show.reset(); this.surp = { Toffee: 0, Cookie: 0, Bobby: 0 };
    this.completed = false; this.t = 0; this.seq = null; this._lastMode = '';
    g.tpc.enabled = false; ui.closeComplete(); ui.closeDialog(); ui.prompt(null); ui.progress(null); ui.caption(null); ui.react(null); ui.party([], {}, -1, null);
    ui.show('hud', false); ui.show('skip', false); ui.fade(false);
    this._carry(); this._shot(CAMS.A1, 0);
    this.phase = 'brief';
    if (brief) ui.complete(LEVEL3.title, LEVEL3.brief, [{ label: LEVEL3.button, big: true, onClick: () => this.startArrive() }]);
    else this.startArrive();
  }
  restart() { this.enter({ brief: false }); }

  /** Apaga lo propio del nivel (al volver al menú). */
  reset() {
    this.seq = null; this.phase = 'idle'; const g = this.game;
    this.fox.holder.visible = false; this.basket.removeFromParent(); g.ui.react(null); g.ui.caption(null); g.ui.skipLabel(); g.ui.show('skip', false);
  }

  // ---------- llegada + aparición del zorro (cinemática) ----------
  startArrive() {
    if (this.phase !== 'brief') return;
    const g = this.game, ui = g.ui, ch = g.chars, fox = this.fox, S = POS;
    ui.closeComplete(); this.phase = 'arrive'; ui.show('skip'); ui.skipLabel('Saltar ▶ (Enter)');
    const A = DUR.arrive, F = DUR.fox, st = n => S.start[n], en = n => S.end[n];
    const walk = p => this._party((n) => { const k = ease(p); this._put(n, lerp(st(n)[0], en(n)[0], k), lerp(st(n)[1], en(n)[1], k), Math.PI, p < 0.97); });
    const foxPop = p => { const k = clamp01(p / 0.3), over = k < 1 ? ease(k) * 1.15 : 1; fox.holder.visible = true; this._foxAt(S.foxSpawn[0], S.foxSpawn[1], 0); this._fx = { scale: Math.max(0.01, over), lift: Math.sin(k * Math.PI) * 0.35 }; };
    const steps = [
      { dur: A[0], enter: () => { this._n = -1; ch.Toffee.hopNow(); }, update: p => { this._shot(CAMS.A1, p); this._type(T.a1, p); this._stand(S.start); } },
      { dur: A[1], enter: () => { this._n = -1; ch.Cookie.hopNow(); }, update: p => { this._shot(CAMS.A2, p); this._type(T.a2, p); walk(p); } },
      { dur: A[2], enter: () => { this._n = -1; this._hopB = false; }, update: (p, t) => {
        this._shot(CAMS.A3, p); this._type(T.a3, p); this._stand(S.end);
        ch.Bobby.body.yaw = Math.PI + Math.sin(t * 2.2) * 0.5;                       // Bobby olfatea a los lados
        if (p > 0.5 && !this._hopB) { this._hopB = true; ch.Bobby.hopNow(); } } },
      { dur: F[0], enter: () => { this._n = -1; this._popped = false; }, update: p => {
        this._shot(CAMS.F1, p); this._type(T.f1, p); this._stand(S.end); foxPop(p);
        if (p > 0.3 && !this._popped) { this._popped = true; this._surprise(); } } },
      { dur: F[1], enter: () => { this._n = -1; }, update: p => {
        this._shot(CAMS.F2, p); this._type(T.f2, p); this._stand(S.end);
        const k = ease(clamp01(p / 0.7)); this._foxAt(lerp(S.foxSpawn[0], S.foxRest[0], k), lerp(S.foxSpawn[1], S.foxRest[1], k), 0);
        fox.body.speed01 = k < 1 ? 0.8 : 0.1; this._fx = { scale: 1, lift: 0, crouch: k >= 1 ? 0.3 : 0 }; } },
      { dur: F[2], enter: () => { this._n = -1; this._surprise(); }, update: (p, t) => {
        this._shot(CAMS.F3, p); this._type(T.f3, p); this._stand(S.end); this._foxAt(S.foxRest[0], S.foxRest[1], 0);
        this._fx = { scale: 1, lift: 0, crouch: 0.3, tiltZ: Math.sin(t * 9) * 0.04 };
        if (p > 0.45 && p < 0.47) this._surprise(['Cookie', 'Bobby']); } },
    ];
    this.seq = new Sequencer(steps, () => this._startShowdown());
    this.seq.start();
  }

  // ---------- enfrentamiento (jugable) ----------
  _startShowdown() {
    const g = this.game, ui = g.ui, S = POS;
    this.seq = null; this.phase = 'showdown'; ui.caption(null); ui.show('skip', false); ui.skipLabel();
    this._stand(S.end); this.fox.holder.visible = true; this._foxAt(S.foxRest[0], S.foxRest[1], 0);
    ui.objective('Protege las fresas: ¡ahuyenta al zorro!'); ui.progress(''); ui.hint('Espacio: ¡ahuyentar al zorro! · ESC: pausa'); ui.show('hud');
    this.show.start(); this._lastMode = '';
  }

  _showdownFrame(dt) {
    const g = this.game, S = POS, sd = this.show, ch = g.chars;
    const evs = sd.update(dt, g.input.wasPressed('Space'));                 // solo la PULSACIÓN nueva cuenta (mantener no sirve)
    for (const e of evs) {
      if (e.type === 'go') this._surprise(['Toffee']);                     // pequeño salto de Toffee al aparecer la señal (refuerzo visual)
      if (e.type === 'early' || e.type === 'late') ch.Toffee.hopNow();
      if (e.type === 'restart') this._surprise();
    }
    this._stand(S.end); this._shot(CAMS.S, 1);
    const st = sd.state, rz = S.foxRest[1], rx = S.foxRest[0];
    let fz = rz, crouch = 0, lift = 0, pull = 0, tilt = 0, speed = 0.1;
    if (st === 'prep') { fz = rz + Math.sin(this.t * 3) * 0.04; speed = 0.2; }
    else if (st === 'wait') { crouch = ease(clamp01(sd.t / 0.5)); tilt = Math.sin(this.t * 45) * 0.06 * clamp01(sd.t / Math.max(0.5, sd.waitLen)); }
    else if (st === 'window') { const k = ease(clamp01(sd.t / 0.15)); fz = rz + FOX.lunge * k; lift = 0.15 * Math.sin(k * Math.PI); pull = k; }
    else if (st === 'miss') {
      if (sd.reason === 'late') { const back = ease(clamp01((sd.t / 1.5 - 0.5) / 0.5)); fz = rz + FOX.lunge * (1 - back); pull = 1 - back; tilt = Math.sin(this.t * 30) * 0.08 * pull; }
      else { lift = 0.14 * Math.abs(Math.sin(sd.t * 9)) * (sd.t < 0.9 ? 1 : 0); }     // «muy pronto»: el zorro se burla saltando
    }
    this._foxAt(rx, fz, 0); this.fox.body.speed01 = speed; this._fx = { scale: 1, lift, crouch, tiltZ: tilt };
    this._carry(0, pull);
    this._showdownUI();
    if (sd.state === 'won') this._startVictory();
  }

  _showdownUI() {
    const sd = this.show, ui = this.game.ui, left = sd.attemptsLeft;
    let r;
    if (sd.state === 'prep') r = { mode: 'prep', msg: MSG.prep, sub: 'El zorro se acerca… cuando veas la señal pulsa ESPACIO' };
    else if (sd.state === 'wait') r = { mode: 'wait', msg: MSG.wait, sub: '¡Espera la señal!' };
    else if (sd.state === 'window') r = { mode: 'go', msg: MSG.go, sub: '¡Pulsa ESPACIO!', progress: sd.windowProgress };
    else if (sd.state === 'miss') r = { mode: 'miss', msg: sd.reason === 'early' ? MSG.early : MSG.late, sub: left > 0 ? `Inténtalo otra vez · intentos restantes: ${left}` : 'Tomemos aire…' };
    else if (sd.state === 'restart') r = { mode: 'miss', msg: MSG.restart, sub: 'Los intentos se reinician y la señal será un poco más larga' };
    else r = { mode: 'won', msg: MSG.won };
    r.attempts = this.show.cfg.attempts; r.used = Math.min(sd.attempt, r.attempts);
    const key = JSON.stringify([r.mode, r.msg, r.used, Math.round((r.progress || 0) * 20)]);
    if (key !== this._lastMode) { this._lastMode = key; ui.react(r); }
  }

  // ---------- victoria ----------
  _startVictory() {
    const g = this.game, ui = g.ui, ch = g.chars, fox = this.fox, S = POS;
    this.phase = 'victory'; ui.react({ mode: 'won', msg: MSG.won, attempts: 0 }); ui.hint(''); ui.show('skip'); ui.skipLabel('Saltar ▶ (Enter)');
    const fz0 = S.foxRest[1] + FOX.lunge, x0 = S.foxRest[0]; let fx0 = x0, fzs = fz0;
    const steps = [
      { dur: DUR.scare, enter: () => { this._n = -1; this._party((n, c) => c.hopNow()); this._party((n, c, i) => { this['_b' + i] = false; }); },
        update: (p, t) => {
          this._shot(CAMS.V1, p); this._type(T.v1, p); this._stand(S.end);
          const k = ease(clamp01(p / 0.55)), z = lerp(fz0, S.foxRest[1] - FOX.scareDist, k);
          this._foxAt(x0, z, 0); fox.body.speed01 = 0; fx0 = x0; fzs = z;
          this._fx = { scale: 1 + 0.15 * Math.sin(clamp01(p / 0.3) * Math.PI), lift: 0.5 * Math.sin(k * Math.PI), crouch: -0.4 * (1 - k), tiltZ: Math.sin(t * 28) * 0.25 * (1 - p), spin: 0 };
          this._carry(0.15 * Math.abs(Math.sin(t * 10)), 0);
          this._party((n, c, i) => { if (t > 0.15 + i * 0.12 && !this['_b' + i]) { this['_b' + i] = true; c.hopNow(); } });
        } },
      { dur: DUR.flight, enter: () => { this._n = -1; this._party((n, c, i) => { this['_b' + i] = false; }); },
        update: (p, t) => {
          this._type(T.v2, p); this._stand(S.end);
          const u = ease(p), F2 = FOX.flight;
          this._foxAt(fx0 + F2.dx * u, fzs + F2.dz * u, 0); fox.body.y = 0.2 + F2.dy * Math.pow(u, 1.3); fox.body.speed01 = 0;
          const fade = p > 0.88 ? 1 - (p - 0.88) / 0.12 : 1;
          this._fx = { scale: Math.max(0.02, fade), lift: 0, crouch: 0, tiltZ: p * 14 * Math.PI, spin: 0 };
          const cam = this.game.camera, c2 = CAMS.V2, e = ease(p);
          cam.position.set(lerp(c2.from[0], c2.to[0], e), lerp(c2.from[1], c2.to[1], e), lerp(c2.from[2], c2.to[2], e));
          this.look.set(lerp(S.end.Cookie[0], fox.body.x, 0.75), lerp(1.0, Math.min(fox.body.y, 4.5), 0.7), lerp(S.end.Cookie[1], fox.body.z, 0.8)); cam.lookAt(this.look);
          this._carry(0.1, 0);
          this._party((n, c) => { const toward = Math.atan2(fox.body.x - c.body.x, fox.body.z - c.body.z); c.body.yaw = lerp(Math.PI, toward, ease(clamp01(p * 1.6))); });
        } },
      { dur: DUR.party, enter: () => { this._n = -1; fox.holder.visible = false; this._hops = 0; },
        update: (p, t) => {
          this._shot(CAMS.V3, p); this._type(T.v3, p);
          const turn = ease(clamp01(t / 0.8));
          this._party((n, c, i) => { this._put(n, S.end[n][0], S.end[n][1], lerp(Math.PI, 0, turn) + (p > 0.35 ? ease(clamp01((p - 0.35) / 0.5)) * Math.PI * 2 * (i % 2 ? 1 : -1) : 0)); if (t > 0.5 + this._hops * 0.45 && i === this._hops % 3) { c.hopNow(); this._hops++; } });
          this._carry(0.9 + 0.12 * Math.abs(Math.sin(t * 6)), 0);
        } },
    ];
    this.seq = new Sequencer(steps, () => this._complete());
    this.seq.start();
  }

  _complete() {
    const g = this.game, ui = g.ui;
    this.seq = null; this.phase = 'done'; this.completed = true; this.fox.holder.visible = false;
    ui.caption(null); ui.react(null); ui.show('skip', false); ui.skipLabel(); ui.hint('');
    this._party(n => this._put(n, POS.end[n][0], POS.end[n][1], 0));
    g.saveProgress({ level3: true });
    ui.complete(DONE.title, DONE.text, [
      { label: DONE.next, big: true, onClick: () => g.goNextLevel3() },
      { label: DONE.again, onClick: () => g.restartLevel() },
    ]);
  }

  skip() {
    if (this.phase === 'arrive') this.seq?.skip();          // → empieza el enfrentamiento
    else if (this.phase === 'victory') this.seq?.skip();    // → ventana de nivel completado
  }

  // ---------- bucle ----------
  update(dt) {
    const g = this.game, inp = g.input; this.t += dt; this._fx = null;
    if (this.phase === 'brief') {
      this._shot(CAMS.A1, Math.min(1, this.t / 8));
      if (inp.wasPressed('Enter') || inp.wasPressed('Space')) this.startArrive();
    } else if (this.cinematic) {
      if (inp.wasPressed('Enter')) this.skip();
      else if (this.seq) this.seq.update(dt);
    } else if (this.phase === 'showdown') this._showdownFrame(dt);
    else if (this.phase === 'done') {
      this._shot(CAMS.V3, 1); this._carry(0.9 + 0.12 * Math.abs(Math.sin(this.t * 6)), 0);
      this._party((n, c, i) => { if (Math.floor(this.t / 1.1 + i * 0.4) !== Math.floor((this.t - dt) / 1.1 + i * 0.4)) c.hopNow(); });
    }
    if (this.phase !== 'showdown') this._carryIfIdle();
    this._party((n, c) => {                                    // personajes: animación + reacción de sorpresa (retroceden e inclinan hacia atrás)
      c.update(dt); const k = this.surp[n]; this.surp[n] = Math.max(0, k - dt * 1.6);
      if (k > 0) { c.holder.position.z += 0.28 * ease(k); c.anim.rotation.x -= 0.45 * k; }
    });
    const f = this.fox; f.update(dt);
    if (this._fx) this._foxPose(this._fx);
  }
  _carryIfIdle() { if (this.phase === 'brief' || this.phase === 'arrive') this._carry(); }
}

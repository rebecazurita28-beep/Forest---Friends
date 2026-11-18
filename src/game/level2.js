// Nivel 2 · El puente colgante (GLB "Puente_colgante").
// Tres islas unidas por dos puentes colgantes (eje X). El jugador controla a los personajes de uno en uno; los demás esperan.
// Peligros reales: tablones que tiemblan y se desprenden (~1 s), tablones que se inclinan y resbalan, huecos (se saltan con Espacio)
// y balanceo que empuja un poco. Caer devuelve al personaje a su último punto de control.
import * as THREE from 'three';
import { WorldQueries } from './world.js';
import { stepBody, cameraRelativeWish, jump } from './physics.js';
import { PARTY, CHAR_INFO } from './config.js';
import { Level2Progress, PlankField, HAZ, buildPlanks, plankAt, swayAngle, KILL_Y, PADS, PAD_Z, LANE_Z } from './flow2.js';
import { makeCheckpoint, makeMarker } from './props.js';

const chain = o => { let s = ''; for (let p = o; p; p = p.parent) if (p.name) s += p.name + '|'; return s; };
const HINT = '↑ ↓ ← → mover · Espacio saltar · Tab o 1-2-3 cambiar de personaje · ESC pausa · arrastra el ratón: cámara';
const FACE_X = Math.PI / 2;            // yaw que mira hacia +X (de la isla 1 a la isla 3)

export class Level2 {
  constructor(game) {
    this.game = game;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfe6f5);
    scene.fog = new THREE.Fog(0xbfe6f5, 55, 150);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b09a, 1.55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-8, 22, 10); scene.add(sun);

    this.root = game.models.Puente_colgante;
    scene.add(this.root); this.root.updateMatrixWorld(true);

    // 1) Clasificar las piezas de los puentes (todas se llaman "…Bridge_Post…"): tablones = cajas planas y anchas
    const box = new THREE.Box3(), c3 = new THREE.Vector3(), s3 = new THREE.Vector3();
    const parts = [[], []], plankInfo = [[], []];
    this.root.traverse(o => {
      if (!o.isMesh || !/Bridge_Post/.test(chain(o))) return;
      box.setFromObject(o); box.getCenter(c3); box.getSize(s3);
      const k = c3.x < 0 ? 0 : 1;
      parts[k].push(o);
      if (s3.y < 0.25 && s3.z > 1.2) plankInfo[k].push({ mesh: o, cx: c3.x, cy: c3.y, hx: s3.x / 2, cz: c3.z, hz: s3.z / 2 });
    });

    // 2) Cada puente cuelga de un grupo que se balancea (solo visual); los tablones inestables, de un pivote propio
    this.sway = [0, 1].map(k => {
      const g = new THREE.Group(); g.name = 'sway' + k;
      const px = parts[k].length ? parts[k].reduce((a, o) => a + box.setFromObject(o).getCenter(c3).x, 0) / parts[k].length : 0;
      // El grupo cuelga de `root` (no de la escena) para que WorldQueries siga encontrando tablones y rocas al recorrer el escenario
      this.root.add(g); g.position.copy(this.root.worldToLocal(new THREE.Vector3(px, 0, LANE_Z))); g.updateMatrixWorld(true);
      parts[k].forEach(o => g.attach(o));
      return g;
    });
    this.planks = [0, 1].map(k => buildPlanks(plankInfo[k], k));
    if (this.planks.some(l => l.length < 4)) throw new Error('Puente_colgante.glb: no se encontraron los tablones de los puentes (¿cambió el modelo?)');
    this.allPlanks = [...this.planks[0], ...this.planks[1]];
    this.field = new PlankField(this.allPlanks);
    const red = new THREE.Color(0x942221), olive = new THREE.Color(0x8C8D4C);
    this.allPlanks.forEach(p => {
      const sw = this.sway[p.bridge];
      if (p.kind === 'gap') { p.mesh.visible = false; return; }                          // tablón que falta: hueco visible
      if (p.kind === 'normal') return;
      p.mesh.material = p.mesh.material.clone();
      p.mesh.material.color.lerp(p.kind === 'break' ? red : olive, p.kind === 'break' ? 0.5 : 0.4);   // rojizo = se rompe · verdoso = se inclina
      const pv = new THREE.Group(); sw.add(pv);
      pv.position.copy(sw.worldToLocal(new THREE.Vector3(p.cx, p.cy, p.cz)));
      sw.updateMatrixWorld(true); pv.attach(p.mesh); p.pivot = pv; p.baseY = pv.position.y;
    });
    const plankMeshes = new Set(this.allPlanks.map(p => p.mesh));
    const ends = this.planks.map(l => [l[0].cx - l[0].hx, l[l.length - 1].cx + l[l.length - 1].hx]).flat();

    // 3) Mundo: suelo = arena de las islas + tablones; las rocas decorativas son obstáculos, salvo las que están sobre un tablón
    //    o tapan la salida de un puente (así nadie se atora en un puente). No hay muros invisibles: el borde es vacío y se cae.
    const rockBox = new THREE.Box3();
    this.world = new WorldQueries(this.root, {
      walkable: (o, c) => /Sand_Top/.test(c) || (plankMeshes.has(o) && o.visible !== false),
      obstacles: [{
        re: /Rock_/,
        radius: (w, d) => (Math.min(w, d) > 1.5 ? 0.45 : 0.3) * Math.min(w, d),
        when: o => {
          rockBox.setFromObject(o); rockBox.getCenter(c3); rockBox.getSize(s3);
          if (Math.min(s3.x, s3.z) > 1.5) return true;
          if (plankAt(this.allPlanks, c3.x, c3.z)) return false;
          return !(ends.some(e => Math.abs(c3.x - e) < 0.7) && Math.abs(c3.z - LANE_Z) < 0.9);
        },
      }],
      killY: KILL_Y,
      bounds: { minX: -40, maxX: 40, minZ: -30, maxZ: 30 },
    });

    // 4) Banderas de punto de control y marcador del personaje seleccionado
    this.flags = PADS.map((p, k) => {
      const f = makeCheckpoint(['Salida', 'Control', 'Meta'][k]);
      f.position.set(p.x, this.groundY(p.x, -2.7), -2.7); f.userData.set(k === 0); scene.add(f);
      this.world.obstacles.push({ x: p.x, z: -2.7, r: 0.3 });
      return f;
    });
    this.marker = null;
    this.chars = PARTY.map(n => game.chars[n]);
    this.height = this.chars.map(ch => { box.setFromObject(ch.root); return Math.max(0.5, box.max.y - box.min.y); });
    this.marker = makeMarker(0xFFFFFE); scene.add(this.marker);

    this.t = 0; this.activeIdx = 0; this.briefing = false; this.completed = false;
    this.progress = new Level2Progress(3); this.recover = [0, 0, 0]; this.doneTimer = 0; this._hud = ''; this._warned = {};
    this.jumpCd = [0, 0, 0];
    this.allPlanks.forEach(p => { if (p.kind === 'gap') this.world.setWalkable(p.mesh, false); });
  }

  groundY(x, z) { const g = this.world.groundAt(x, z, 6); return g ? g.y : 0; }
  get active() { return this.chars[this.activeIdx]; }
  get modalOpen() { return this.briefing; }
  closeModal() { /* la presentación se cierra con su botón / Enter / Espacio */ }

  // ---------- inicio / reinicio ----------
  enter({ brief = true } = {}) {
    const g = this.game;
    g.chars.Berry.holder.removeFromParent();                  // Berry se queda en casa
    this.scene.updateMatrixWorld(true);
    this.progress = new Level2Progress(3);
    this.t = 0; this.completed = false; this.doneTimer = 0; this.recover = [0, 0, 0]; this._warned = {}; this._hud = ''; this.jumpCd = [0, 0, 0];
    this._resetPlanks();
    this.chars.forEach((c, i) => {
      this.scene.add(c.holder); c.holder.visible = true; c.fallAnim = true;
      c.place(PADS[0].x, this.groundY(PADS[0].x, PAD_Z[i]), PAD_Z[i], FACE_X);
    });
    this.flags.forEach((f, k) => f.userData.set(k === 0));
    this.activeIdx = 0;
    g.tpc.yaw = FACE_X; g.tpc.enabled = true; g.tpc.snapTo(this.active.body);
    g.ui.closeRiddle(); g.ui.closeComplete(); g.ui.prompt(null); g.ui.hint(HINT); g.ui.show('hud');
    this.refreshHud(true);
    this.briefing = brief;
    if (brief) g.ui.complete('Nivel 2: El puente colgante',
      'Toffee, Cookie y Bobby llegan a un acantilado sobre el mar. Para seguir su camino hacia la montaña más alta deben cruzar dos puentes colgantes que unen tres islas. ' +
      'El viento mece los puentes con fuerza: los tablones rojizos se rompen si te quedas encima, los verdosos se inclinan y te hacen resbalar, y algunos tablones faltan. ' +
      '¡Avancen con cuidado, uno por uno, y salten los huecos con la barra Espaciadora! Si alguien cae, volverá a su último punto de control.',
      [{ label: '¡Comenzar!', big: true, onClick: () => this.startPlay() }]);
  }
  restart() { this.enter({ brief: false }); }
  startPlay() {
    if (!this.briefing) return;
    this.briefing = false; this.game.ui.closeComplete();
    this.game.ui.toast('Cambia de personaje con Tab o con 1, 2 y 3', 3600);
  }

  switchTo(i) {
    if (i === this.activeIdx || i < 0 || i >= this.chars.length) return;
    this.activeIdx = i; this.active.hopNow(); this.refreshHud();
  }

  // ---------- interfaz ----------
  refreshHud(force = false) {
    const ui = this.game.ui, n = this.progress.arrivedCount;
    const st = PARTY.map((_, i) => this.progress.status(i));
    const key = JSON.stringify([this.activeIdx, st, n]);
    if (!force && key === this._hud) return;
    this._hud = key;
    ui.objective(this.completed ? '✔ Objetivo completado: ¡los tres llegaron a la última isla!' : 'Lleva a Toffee, Cookie y Bobby a la última isla.');
    ui.progress(`Han llegado: ${n} / 3 · Controlas a ${CHAR_INFO[PARTY[this.activeIdx]].name}`);
    ui.party(PARTY, CHAR_INFO, this.activeIdx, st);
  }

  // Todos los tablones rotos vuelven a su sitio y los inclinados se enderezan (al caer alguien o al reiniciar)
  _resetPlanks() {
    this.field.resetBroken();
    this.allPlanks.forEach(p => { if (p.kind === 'break') this.world.setWalkable(p.mesh, true); });
  }

  // ---------- caídas ----------
  _fell(i) {
    const g = this.game, c = this.chars[i];
    const k = this.progress.fall(i), pad = this.progress.spawnFor(i);
    this.jumpCd[i] = 0; this._resetPlanks();
    c.place(pad.x, this.groundY(pad.x, pad.z), pad.z, FACE_X);
    c.hopNow(); c.dip = 1; this.recover[i] = 1.3;
    if (i === this.activeIdx) g.tpc.snapTo(c.body);
    g.ui.toast(`¡${CHAR_INFO[PARTY[i]].name} cayó! Vuelve al punto de control (${PADS[k].name}).`, 2800);
    this.refreshHud();
  }

  update(dt) {
    const g = this.game, inp = g.input;
    this.t += dt;
    this._visuals(dt);

    if (this.briefing) {
      if (inp.wasPressed('Enter') || inp.wasPressed('Space') || inp.wasPressed('KeyE')) this.startPlay();
      this.chars.forEach(c => c.update(dt));
      g.tpc.update(this.active.body, dt);
      return;
    }

    const frozen = this.completed;
    if (!frozen) {
      if (inp.wasPressed('Tab')) this.switchTo((this.activeIdx + 1) % this.chars.length);
      ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (inp.wasPressed(k)) this.switchTo(i); });
    }

    // Movimiento del personaje seleccionado (los demás esperan en su sitio, sin empujes)
    const act = this.active, wish = frozen ? { x: 0, z: 0 } : cameraRelativeWish(inp.axis(), g.tpc.yaw);
    const ab = act.body, aIdx = this.activeIdx;
    // Peligros: el personaje controlado hace temblar/romper/inclinar los tablones que pisa
    for (const e of this.field.update(dt, frozen ? null : ab)) {
      if (e.type === 'shake' && !this._warned.shake) { this._warned.shake = true; g.ui.toast('¡El tablón tiembla! Sal de él rápido: se va a romper.', 3000); }
    }
    this.allPlanks.forEach(p => { if (p.kind === 'break') this.world.setWalkable(p.mesh, this.field.walkable(p)); });
    this.standing = this.field.standing;
    const moving = Math.hypot(wish.x, wish.z) > 0.05;
    if (this.standing && this.standing.kind === 'tilt' && !this._warned.tilt) { this._warned.tilt = true; g.ui.toast('¡El tablón verdoso se inclina! Corrige tu dirección hacia el centro.', 3000); }
    wish.z += this.field.push(this.t, moving);                                  // inclinación progresiva + balanceo del puente
    // Salto (Espacio): permite cruzar los huecos
    this.jumpCd = this.jumpCd.map(v => Math.max(0, v - dt));
    if (!frozen && inp.isDown('Space') && this.jumpCd[aIdx] <= 0) jump(ab, HAZ.jumpV);

    this.chars.forEach((c, i) => {
      const ev = stepBody(c.body, i === aIdx ? wish : { x: 0, z: 0 }, dt, this.world, { canFall: true, noGlide: true });
      if (ev.landed) this.jumpCd[i] = HAZ.jumpCd;
      if (ev.fell) { this._fell(i); return; }
      if (this.recover[i] > 0) { this.recover[i] = Math.max(0, this.recover[i] - dt); c.holder.visible = this.recover[i] === 0 || Math.floor(this.recover[i] * 12) % 2 === 0; }
      const e = this.progress.update(i, c.body.x, c.body.grounded, c.body.y);
      if (e.checkpoint) { this.flags[1].userData.set(true); c.hopNow(); g.ui.toast(`¡Punto de control! ${CHAR_INFO[PARTY[i]].name} llegó a la isla 2.`, 2600); this.refreshHud(); }
      if (e.arrived) {
        this.flags[2].userData.set(true); c.hopNow();
        g.ui.toast(`¡${CHAR_INFO[PARTY[i]].name} llegó a la última isla! (${this.progress.arrivedCount}/3)`, 2800); this.refreshHud();
      }
    });

    if (!this.completed && this.progress.done) this.doneTimer += dt; else this.doneTimer = 0;
    if (!this.completed && this.doneTimer > 1.4) this._complete();

    this.refreshHud();
    this.chars.forEach(c => c.update(dt));
    g.tpc.update(this.active.body, dt);
  }

  _complete() {
    const g = this.game;
    this.completed = true; this.refreshHud(true);
    g.saveProgress({ level2: true });
    g.ui.complete('¡Nivel completado!', 'Toffee, Cookie y Bobby cruzaron los dos puentes colgantes y llegaron juntos a la última isla. ¡La montaña más alta ya se ve en el horizonte!', [
      { label: 'Continuar: La montaña más alta ▶', big: true, onClick: () => g.goNextLevel2() },
      { label: 'Jugar de nuevo', onClick: () => g.restartLevel() },
    ]);
  }

  // ---------- movimiento visual (no afecta a las colisiones más que unos centímetros) ----------
  _visuals(dt) {
    const t = this.t;
    this.sway.forEach((s, k) => { s.rotation.x = swayAngle(k, t); s.position.y = 0.04 * (k + 1) * Math.sin(t * 1.3 + k * 2.1); });
    for (const p of this.allPlanks) {
      const pv = p.pivot; if (!pv) continue;
      pv.position.y = p.baseY; pv.rotation.x = pv.rotation.y = pv.rotation.z = 0; pv.visible = true;
      if (p.kind === 'tilt') pv.rotation.x = p.tilt * 0.3;                       // + z abajo: hacia donde resbala el personaje
      else if (p.kind === 'break') {
        if (p.st === 'shake') { const a = Math.min(1, 0.35 + p.t / HAZ.shake); pv.rotation.z = Math.sin(t * 55) * 0.05 * a; pv.position.y = p.baseY + Math.sin(t * 73) * 0.012 * a; pv.rotation.x = Math.sin(t * 41) * 0.03 * a; }
        else if (p.st === 'fall') { const u = p.t / HAZ.fall; pv.rotation.z = -0.9 * u * u * 1.4; pv.rotation.x = 0.5 * u; pv.position.y = p.baseY - 2.5 * u * u; }
        else if (p.st === 'broken') pv.visible = false;
        else if (p.st === 'restore') { const u = 1 - p.t / HAZ.restore; pv.position.y = p.baseY + 0.5 * u * u; }
      }
    }
    this.flags.forEach((f, k) => { f.userData.flag.rotation.x = 0.12 * Math.sin(t * 3 + k); });
    const b = this.active.body;
    this.marker.position.set(b.x, b.y + this.height[this.activeIdx] + 0.45 + 0.08 * Math.sin(t * 4), b.z);
    this.marker.rotation.y += dt * 2.2;
    this.marker.visible = !this.completed && !this.briefing;
    void dt;
  }
}

// Nivel 1 · El puente del acertijo (GLB "puente").
// Recorrido por el sendero → compuerta cerrada en la entrada del puente → acertijo (panel con 4 respuestas)
// → la compuerta se abre → los tres amigos cruzan → nivel completado.
import * as THREE from 'three';
import { WorldQueries } from './world.js';
import { stepBody, followStep, cameraRelativeWish } from './physics.js';
import { PARTY, CHAR_INFO, CONTROLS_HINT } from './config.js';
import { LevelFlow, RIDDLE, PHASE, objectiveText } from './flow.js';
import { makeGate, makeSign } from './props.js';

const RULES = {
  walkable: /Terrain_Base|Ground_Facet|Winding_Sandy_Path|Main_Bridge_Plank/,
  water: /Winding_Blue_River/,
  obstacles: [
    { re: /Tree_/, radius: (w, d) => 0.045 * (w + d) },          // solo el tronco
    { re: /Rock_/, radius: (w, d) => 0.2 * (w + d) },
    { re: /Blue_Crystal/, radius: (w, d) => 0.2 * (w + d) },
  ],
};
const GATE_NEAR = 4.4;     // m: distancia a la compuerta para poder interactuar
const GATE_NOTICE = 7.5;   // m: al acercarse así, aparece el aviso del puente bloqueado

export class Level1 {
  constructor(game) {
    this.game = game;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcfe8ef);
    scene.fog = new THREE.Fog(0xcfe8ef, 60, 170);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b09a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(10, 20, 8); scene.add(sun);

    this.root = game.models.puente;
    scene.add(this.root);
    this.world = new WorldQueries(this.root, RULES);
    this.fullMaxZ = this.world.bounds ? this.world.bounds.maxZ : 1e3;

    // Medidas reales del tablero del puente (en el GLB normalizado) para colocar la compuerta y la meta
    const deck = new THREE.Box3(); this.root.updateMatrixWorld(true);
    this.root.traverse(o => { if (o.isMesh && /Main_Bridge_Plank/.test(nameChain(o))) deck.expandByObject(o); });
    this.gate = { x: (deck.min.x + deck.max.x) / 2, z: deck.min.z - 0.35, width: deck.max.x - deck.min.x + 0.4 };
    this.zEnd = deck.max.z + 0.6;

    const re = /Winding_Sandy_Path/;
    const [z0] = this.world.zRange(re);
    const sz = z0 + 5;
    const sx = this.world.centerlineX(re, sz) ?? 0;
    this.spawn = { x: sx, z: sz, y: this.groundY(sx, sz) };

    // Compuerta y cartel de pista (formas low poly propias; ver props.js)
    this.gateObj = makeGate(this.gate.width);
    this.gateObj.position.set(this.gate.x, this.groundY(this.gate.x, this.gate.z - 0.3), this.gate.z);
    scene.add(this.gateObj);
    const csz = this.spawn.z + 7, csx = (this.world.centerlineX(re, csz) ?? sx) + 1.9;
    this.signObj = makeSign(['PUENTE', 'a la vista']);
    this.signObj.position.set(csx, this.groundY(csx, csz), csz);
    scene.add(this.signObj);
    this.signPos = { x: csx, z: csz };
    this.world.obstacles.push({ x: csx, z: csz, r: 0.35 });    // el poste del cartel es sólido

    this.party = PARTY.map(n => game.chars[n]);
    this.activeIdx = 0;
    this.flow = new LevelFlow(); this.riddleOpen = false; this.completed = false; this.sel = 0; this.gateP = 0; this.closeTimer = 0;
  }

  get active() { return this.party[this.activeIdx]; }
  groundY(x, z) { const g = this.world.groundAt(x, z, 8); return g ? g.y : 0; }
  placeOnGround(ch, x, z, yaw = 0) { ch.place(x, this.groundY(x, z), z, yaw); }
  get frozen() { return !!this.game.dlg || this.riddleOpen || this.completed; }

  /** Coloca al grupo al inicio del nivel y reinicia el estado (también se usa al reiniciar). */
  enter() {
    const g = this.game, S = this.spawn;
    this.game.chars.Berry.holder.removeFromParent();        // Berry se queda en casa: el nivel es solo del trío viajero
    this.party.forEach(c => this.scene.add(c.holder));
    this.placeOnGround(this.party[0], S.x, S.z);
    this.placeOnGround(this.party[1], S.x - 1.2, S.z - 1.1);
    this.placeOnGround(this.party[2], S.x + 1.2, S.z - 1.1);
    this.activeIdx = 0;
    g.tpc.yaw = 0; g.tpc.enabled = true; g.tpc.snapTo(this.active.body);

    this.flow = new LevelFlow(); this.riddleOpen = false; this.completed = false; this.gateP = 0; this.closeTimer = 0;
    this.gateObj.userData.open(0); this.gateObj.visible = true;
    if (this.world.bounds) this.world.bounds.maxZ = this.gate.z;      // mientras esté cerrada, el puente es inalcanzable
    g.ui.closeRiddle(); g.ui.closeComplete();
    this.refreshObjective();
    g.ui.hint(CONTROLS_HINT);
    g.ui.party(PARTY, CHAR_INFO, this.activeIdx);
    g.ui.show('hud');
  }

  refreshObjective() {
    let t = objectiveText(this.flow.phase, this.flow.reachedGate);
    if (this.flow.phase === PHASE.UNLOCKED) t += `  (cruzaron ${this.party.filter(c => c.body.z > this.zEnd).length}/3)`;
    if (t !== this._obj) { this._obj = t; this.game.ui.objective(t); }
  }

  switchTo(i) {
    if (i === this.activeIdx || i < 0 || i >= this.party.length) return;
    this.activeIdx = i; this.active.hopNow();
    this.game.ui.party(PARTY, CHAR_INFO, i);
  }

  // ---------- acertijo ----------
  openRiddle() {
    if (!this.flow.openRiddle()) return;
    this.riddleOpen = true; this.sel = 0; this._busy = false;
    const ui = this.game.ui;
    ui.openRiddle(RIDDLE, i => this.pick(i), () => this.closeRiddle());
    ui.riddleSelect(0);
    this.refreshObjective();
  }
  closeRiddle() {
    if (!this.riddleOpen || this._busy) return;
    this.flow.closeRiddle(); this.riddleOpen = false; this.game.ui.closeRiddle(); this.refreshObjective();
  }
  /** Lo usa Game para que ESC cierre el panel en vez de pausar. */
  get modalOpen() { return this.riddleOpen; }
  pick(i) {
    if (this._busy) return;
    const ui = this.game.ui, res = this.flow.answer(i);
    if (!res) return;
    this.sel = i; ui.riddleSelect(i);
    if (res.correct) {
      this._busy = true; ui.riddleLock(true); ui.riddleMark(i, 'good'); ui.riddleHint(null);
      ui.riddleFeedback('¡Correcto! Eres muy listo: el puente se está abriendo…', 'good');
      this.closeTimer = 1.8;
      if (this.world.bounds) this.world.bounds.maxZ = this.fullMaxZ;
      this.active.hopNow(); this.party.forEach(c => c.hopNow());
    } else {
      ui.riddleMark(i, 'bad');
      ui.riddleFeedback('¡Ups! Esa no es la respuesta. ¡Vuelve a intentarlo!', 'bad');
      ui.riddleHint(res.showHint ? RIDDLE.hint : null);
    }
  }
  _riddleKeys() {
    const inp = this.game.input, n = RIDDLE.options.length, ui = this.game.ui;
    if (this._busy) return;
    for (let k = 0; k < n; k++) if (inp.wasPressed('Digit' + (k + 1))) { this.pick(k); return; }
    if (inp.wasPressed('ArrowDown') || inp.wasPressed('ArrowRight')) { this.sel = (this.sel + 1) % n; ui.riddleSelect(this.sel); }
    if (inp.wasPressed('ArrowUp') || inp.wasPressed('ArrowLeft')) { this.sel = (this.sel + n - 1) % n; ui.riddleSelect(this.sel); }
    if (inp.wasPressed('Enter') || inp.wasPressed('KeyE')) this.pick(this.sel);
  }

  // ---------- final de nivel ----------
  _complete() {
    this.completed = true;
    const g = this.game;
    g.saveProgress({ level1: true });
    g.ui.prompt(null);
    g.ui.complete('¡Felicidades!', 'Resolvieron el acertijo y Toffee, Cookie y Bobby cruzaron el puente juntos. ¡La montaña más alta está cada vez más cerca!', [
      { label: 'Continuar: El puente colgante ▶', big: true, onClick: () => g.goNextLevel() },
      { label: 'Jugar de nuevo', onClick: () => g.restartLevel() },
    ]);
  }

  update(dt) {
    const g = this.game, inp = g.input, act = this.active, frozen = this.frozen;
    const dGate = Math.hypot(act.body.x - this.gate.x, act.body.z - this.gate.z);

    if (this.riddleOpen) this._riddleKeys();
    if (this.closeTimer > 0) {                       // éxito: se cierra el panel y se abre la compuerta
      this.closeTimer -= dt;
      if (this.closeTimer <= 0) { this.riddleOpen = false; this._busy = false; g.ui.closeRiddle(); g.ui.toast('¡El puente está desbloqueado!', 2600); this.refreshObjective(); }
    }
    if (this.flow.gateOpen && this.gateP < 1) { this.gateP = Math.min(1, this.gateP + dt / 1.4); this.gateObj.userData.open(this.gateP); }

    if (!frozen) {
      if (inp.wasPressed('Tab')) this.switchTo((this.activeIdx + 1) % this.party.length);
      ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (inp.wasPressed(k)) this.switchTo(i); });
    }

    const wish = frozen ? { x: 0, z: 0 } : cameraRelativeWish(inp.axis(), g.tpc.yaw);
    stepBody(act.body, wish, dt, this.world);

    // Los compañeros siguen al personaje activo (también cuando no se mueven por sí solos)
    let slot = 0;
    this.party.forEach((c, i) => {
      if (i === this.activeIdx) return;
      const r = followStep(c.body, act.body, ++slot, dt, this.world);
      if (r) this.placeOnGround(c, r.teleport.x, r.teleport.z, r.teleport.yaw);
    });

    // Aviso automático la primera vez que se acercan a la compuerta
    if (this.flow.phase === PHASE.EXPLORE && !this.flow.reachedGate && dGate < GATE_NOTICE && !frozen) {
      this.flow.reachedGate = true; this.refreshObjective();
      g.say([
        { who: 'Toffee', text: '¡El puente está cerrado! Hay un cartel que dice que solo se abre si resolvemos un acertijo.' },
        { who: 'Cookie', text: 'Acércate a la compuerta y pulsa E para escuchar el acertijo.' },
      ]);
    }

    // Elementos interactivos cercanos
    let prompt = null, action = null;
    if (!frozen) {
      if (this.flow.phase === PHASE.EXPLORE && dGate < GATE_NEAR) { prompt = '[E] Resolver el acertijo del puente'; action = () => this.openRiddle(); }
      else if (Math.hypot(act.body.x - this.signPos.x, act.body.z - this.signPos.z) < 2.6) {
        prompt = '[E] Leer el cartel';
        action = () => g.say([
          { who: 'Cartel', text: 'Más adelante hay un puente… pero un candado mágico lo mantiene cerrado.' },
          { who: 'Cartel', text: 'Solo se abre a quien resuelva su acertijo. Pista: presta atención al agua que corre bajo el puente.' },
        ]);
      }
    }
    g.ui.prompt(prompt);
    if (action && inp.wasPressed('KeyE')) action();

    // ¿Cruzaron los tres?
    if (!this.completed && this.flow.update(this.party.map(c => ({ z: c.body.z })), this.zEnd) === PHASE.DONE) this._complete();
    this.refreshObjective();

    this.party.forEach(c => c.update(dt));
    g.tpc.update(act.body, dt);
  }
}

function nameChain(o) { let s = ''; for (let p = o; p; p = p.parent) if (p.name) s += p.name + '/'; return s; }

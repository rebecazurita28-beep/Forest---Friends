// Pantalla de inicio: los cuatro amigos, con tarjeta de presentación individual.
import * as THREE from 'three';
import { ORDER, CHAR_INFO } from './config.js';
import { angleLerp } from './physics.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(0xD9CFC3);
    s.fog = new THREE.Fog(0xD9CFC3, 18, 45);
    s.add(new THREE.HemisphereLight(0xffffff, 0xb9ad98, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(-5, 10, 8); s.add(sun);

    // Plataforma y arbolitos low poly (formas simples, flatShading)
    const flat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8, 0.6, 9), flat(0x8C8D4C)); base.position.y = -0.3; s.add(base);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.3, 0.5, 9), flat(0x9B6108)); rim.position.y = -0.85; s.add(rim);
    const tree = (x, z, h, c) => {
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, h * 0.35, 6), flat(0x7a4a1a)); trunk.position.y = h * 0.17; t.add(trunk);
      const top = new THREE.Mesh(new THREE.ConeGeometry(h * 0.32, h * 0.8, 6), flat(c)); top.position.y = h * 0.6; t.add(top);
      t.position.set(x, 0, z); s.add(t);
    };
    [[-6, -3, 3.4, 0x6e7a3a], [-3.5, -5, 4.2, 0x8C8D4C], [0, -6, 3.8, 0x6e7a3a], [3.6, -5, 4.4, 0x8C8D4C], [6, -2.5, 3.4, 0x6e7a3a], [1.8, -4.2, 2.6, 0x9aa05a]].forEach(a => tree(...a));

    this.slots = [-3.0, -1.4, 0.2, 1.8];
    this.sel = 0; this.timer = 0; this.auto = true; this.hopT = 0;

    this.bind();
  }

  bind() {
    const ui = this.game.ui;
    document.getElementById('prevBtn').onclick = () => this.select(this.sel - 1, true);
    document.getElementById('nextBtn').onclick = () => this.select(this.sel + 1, true);
    document.getElementById('startBtn').onclick = () => this.game.startIntro();
    this.ui = ui;
  }

  enter() {
    const g = this.game;
    ORDER.forEach((n, i) => {
      const c = g.chars[n]; this.scene.add(c.holder);
      c.place(this.slots[i], 0, 0, 0);
    });
    g.camera.position.set(-0.5, 1.7, 8.8); g.camera.lookAt(-0.5, 0.85, 0);
    g.tpc.enabled = false;
    g.ui.show('menu'); this.select(0, false);
  }
  exit() { this.game.ui.show('menu', false); }

  select(i, manual) {
    const n = ORDER.length; this.sel = (i + n) % n;
    if (manual) { this.auto = false; }
    this.timer = 0;
    const name = ORDER[this.sel];
    this.ui.card(CHAR_INFO[name], this.sel, n);
    this.ui.roster(ORDER, CHAR_INFO, this.sel, k => this.select(k, true));
    this.game.chars[name].hopNow();
  }

  update(dt) {
    const g = this.game, inp = g.input;
    if (inp.wasPressed('ArrowRight')) this.select(this.sel + 1, true);
    if (inp.wasPressed('ArrowLeft')) this.select(this.sel - 1, true);
    if (inp.wasPressed('Space') || inp.wasPressed('Enter')) { g.startIntro(); return; }
    this.timer += dt; this.hopT += dt;
    if (this.auto && this.timer > 7) this.select(this.sel + 1, false);
    if (this.hopT > 2.6) { this.hopT = 0; g.chars[ORDER[this.sel]].hopNow(); }
    ORDER.forEach((n, i) => {
      const c = g.chars[n], b = c.body, selected = i === this.sel;
      const tz = selected ? 1.0 : 0, tx = this.slots[i];
      b.x += (tx - b.x) * (1 - Math.exp(-6 * dt)); b.z += (tz - b.z) * (1 - Math.exp(-6 * dt));
      const faceCenter = Math.atan2(-0.5 - tx, 8) * 0.8;                // miran levemente hacia el centro
      b.yaw = angleLerp(b.yaw, selected ? 0 : faceCenter, 1 - Math.exp(-6 * dt));
      b.speed01 = 0; c.update(dt);
    });
  }
}

// Cinemática de introducción en el escenario del bosque/puente (sin vídeo: guion + cámara + animación procedural).
import * as THREE from 'three';
import { Sequencer } from './sequencer.js';
import { PARTY } from './config.js';

const ease = p => p * p * (3 - 2 * p);

export class Intro {
  constructor(game) { this.game = game; this.seq = null; this.look = new THREE.Vector3(); this.prop = null; }

  start() {
    const g = this.game, L = g.level1, S = L.spawn, cam = g.camera, ui = g.ui;
    const V = (x, y, z) => new THREE.Vector3(S.x + x, S.y + y, S.z + z);
    const ch = g.chars;
    // Pastel flotando sobre Berry (su idea): solo existe en esta cinemática; se retira de la escena al terminar
    const prop = this.prop = new THREE.Group();
    g.showModel('Pastel_de_fresas', prop); prop.scale.setScalar(0.001); prop.visible = false;
    L.scene.add(prop);

    // Grupo compacto sobre el camino (centrado en la línea del sendero), escalonado en Z para que no se tapen ni se atraviesen.
    // Separación entre vecinos ≈ 0.9 m; cada carril X es distinto, así al partir los tres viajeros no cruzan a Berry.
    const row = { Toffee: [-1.2, 0.1], Berry: [-0.4, -0.3], Cookie: [0.4, 0.1], Bobby: [1.2, -0.3] };
    for (const n of Object.keys(row)) {
      const [dx, dz] = row[n]; L.scene.add(ch[n].holder);
      L.placeOnGround(ch[n], S.x + dx, S.z + dz, Math.atan2(-dx, 7)); // miran un poco hacia el centro
    }
    g.tpc.enabled = false;
    ui.show('hud', false);

    const type = (text, p) => { // máquina de escribir durante el 60 % del paso
      const n = Math.ceil(text.length * Math.min(1, p / 0.6));
      if (n !== this._n) { this._n = n; ui.caption(text.slice(0, n)); }
    };
    const shot = (from, to, lf, lt) => p => {
      const e = ease(p); cam.position.lerpVectors(from, to, e); this.look.lerpVectors(lf, lt, e); cam.lookAt(this.look);
    };
    const T = { a: 'En lo más profundo del bosque viven cuatro grandes amigos: Toffee, Berry, Cookie y Bobby.',
      b: 'Berry sueña con un pastel de fresas… pero en el bosque ya no quedan fresas.',
      c: 'Las fresas más dulces crecen en la montaña más alta. ¡Toffee, Cookie y Bobby emprenderán un viaje para conseguirlas y preparar un pastel para Berry!',
      d: '¡Buen viaje, amigos! ¡Yo cuidaré el bosque hasta que vuelvan!' };
    const s1 = shot(V(-1.2, 2.2, 9.0), V(0.3, 1.6, 6.2), V(0, 0.9, 0), V(-0.3, 0.9, 0));
    const s2 = shot(V(2.0, 1.4, 4.6), V(0.5, 1.35, 3.0), V(-0.4, 1.0, 0), V(-0.4, 1.1, 0));
    const s3 = shot(V(-0.5, 1.7, -5.5), V(0.2, 2.0, -3.4), V(0, 1.0, 6), V(0, 1.2, 8));
    let hops = 0;
    const steps = [
      { dur: 5.5, enter: () => { this._n = -1; hops = 0; },
        update: (p, t) => { s1(p); type(T.a, p); if (t > hops * 0.9 + 0.5 && hops < 4) { ch[['Toffee', 'Berry', 'Cookie', 'Bobby'][hops]].hopNow(); hops++; } } },
      { dur: 5.5, enter: () => { this._n = -1; prop.visible = true; },
        update: (p) => { s2(p); type(T.b, p); const k = Math.min(1, p * 4); prop.scale.setScalar(Math.max(0.001, ease(k))); prop.position.set(ch.Berry.body.x, S.y + 1.9 + Math.sin(p * 8) * 0.06, ch.Berry.body.z + 0.2); prop.rotation.y += 0.03; } },
      { dur: 6.5, enter: () => { this._n = -1; },
        update: (p, t) => { s3(p); type(T.c, p); prop.position.y = S.y + 1.9 + Math.sin(t * 3) * 0.06; prop.rotation.y += 0.03; if (p > 0.5 && p < 0.52) ch.Berry.hopNow(); } },
      { dur: 6, enter: () => { this._n = -1; prop.visible = false; this._z0 = {}; PARTY.forEach(n => { this._z0[n] = ch[n].body.z; ch[n].body.yaw = 0; }); this._bh = 0; },
        update: (p, t) => {
          type(T.d, p);
          PARTY.forEach(n => {
            const c = ch[n], z = this._z0[n] + ease(p) * 13;
            c.body.z = z; c.body.y = L.groundY(c.body.x, z); c.body.speed01 = p < 0.97 ? 0.85 : 0;
          });
          cam.position.copy(V(0, 2.3, -4.8 + ease(p) * 6)); this.look.copy(V(0, 1.0, 4 + ease(p) * 13)); cam.lookAt(this.look);
          if (t > this._bh * 0.8) { ch.Berry.hopNow(); this._bh++; }
        } },
    ];
    this.update = dt => { this.seq.update(dt); for (const n of Object.keys(row)) ch[n].update(dt); };
    this.seq = new Sequencer(steps, () => this.finish());
    this.seq.start();
    ui.show('skip');
  }
  skip() { this.seq?.skip(); }
  finish() {
    const g = this.game;
    g.ui.caption(null); g.ui.show('skip', false);
    if (this.prop) { g.hideModel('Pastel_de_fresas'); this.prop.removeFromParent(); this.prop = null; }
    g.beginLevel1();
  }
}

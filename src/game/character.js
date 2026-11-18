// Personaje jugable/NPC: contenedor + animación procedural (los GLB no traen animaciones).
// Jerarquía:  holder (posición, yaw)  ->  anim (balanceo/rebote)  ->  root (modelo normalizado, NO se toca)
import * as THREE from 'three';
import { createBody } from './physics.js';

export class Character {
  constructor(name, root, move, anim) {
    this.name = name; this.root = root; this.cfg = anim;
    this.holder = new THREE.Group(); this.holder.name = 'holder_' + name;
    this.anim = new THREE.Group();
    this.anim.add(root); this.holder.add(this.anim);
    this.body = createBody(0, 0, 0, { speed: move.speed });
    this.phase = Math.random() * 6; this.t = Math.random() * 10;
    this.hop = 0; this.dip = 0; this.wasGrounded = true;
    this.fallAnim = false; this.spin = 0;   // fallAnim: giro al caer (solo lo activa el Nivel 2)
  }
  place(x, y, z, yaw = 0) {
    const b = this.body; b.x = x; b.y = y; b.z = z; b.yaw = yaw; b.vx = b.vz = b.vy = 0; b.grounded = true; b.speed01 = 0;
    this.sync();
  }
  hopNow() { this.hop = 1; }
  sync() {
    const b = this.body;
    this.holder.position.set(b.x, b.y, b.z);
    this.holder.rotation.y = b.yaw;
  }
  update(dt) {
    const b = this.body, A = this.cfg, s = b.speed01;
    this.t += dt;
    this.phase += dt * A.rate * s;
    if (!this.wasGrounded && b.grounded) this.dip = 1;          // aterrizaje
    this.wasGrounded = b.grounded;
    this.dip = Math.max(0, this.dip - dt * 5);
    this.hop = Math.max(0, this.hop - dt * 2.2);
    const hopY = this.hop > 0 ? Math.sin((1 - this.hop) * Math.PI) * 0.3 : 0;
    const idle = Math.sin(this.t * 2.2) * 0.012 * (1 - s);
    this.anim.position.y = Math.abs(Math.sin(this.phase)) * A.bob * s + hopY + idle - this.dip * 0.05;
    this.anim.rotation.z = Math.sin(this.phase) * A.sway * s;
    this.anim.rotation.x = A.lean * s + Math.sin(this.phase * 2) * A.pitch * s + (b.grounded ? 0 : -0.15);
    if (this.fallAnim && !b.grounded && b.vy < -1.5) {            // reacción al caer: da vueltas
      this.spin += dt * 9; this.anim.rotation.x = this.spin; this.anim.rotation.z = Math.sin(this.spin * 0.6) * 0.7;
    } else this.spin = 0;
    this.sync();
  }
}

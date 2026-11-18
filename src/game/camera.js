// Cámara en tercera persona con órbita por ratón (arrastrar) y zoom (rueda).
import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.yaw = 0;          // hacia dónde mira la cámara (0 = +Z)
    this.pitch = 0.42; this.dist = 6.0; this.minDist = 3; this.maxDist = 11;
    this.height = 0.85;    // punto al que apunta (sobre los pies)
    this.enabled = true;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this._init = false;
    let drag = false, lx = 0, ly = 0;
    dom.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture?.(e.pointerId); });
    addEventListener('pointerup', () => { drag = false; });
    addEventListener('pointermove', e => {
      if (!drag || !this.enabled) return;
      this.yaw -= (e.clientX - lx) * 0.005;
      this.pitch = Math.min(1.1, Math.max(0.12, this.pitch + (e.clientY - ly) * 0.004));
      lx = e.clientX; ly = e.clientY;
    });
    dom.addEventListener('wheel', e => { if (!this.enabled) return; this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist + Math.sign(e.deltaY) * 0.5)); e.preventDefault(); }, { passive: false });
    dom.addEventListener('contextmenu', e => e.preventDefault());
  }
  snapTo(target) { this._init = false; this.update(target, 1); }
  update(target, dt) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const want = new THREE.Vector3(
      target.x - Math.sin(this.yaw) * cp * this.dist,
      target.y + this.height + sp * this.dist,
      target.z - Math.cos(this.yaw) * cp * this.dist);
    const look = new THREE.Vector3(target.x, target.y + this.height, target.z);
    if (!this._init) { this.pos.copy(want); this.look.copy(look); this._init = true; }
    const k = 1 - Math.exp(-9 * dt);
    this.pos.lerp(want, k); this.look.lerp(look, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}

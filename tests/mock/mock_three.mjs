// Mínimo "Three.js falso" SOLO para la prueba de humo de tests/smoke_level2.mjs (grafo de escena con traslaciones, Box3 y rayos
// contra triángulos exactos). No es Three.js: no dibuja nada.
export const SRGBColorSpace = 'srgb';
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); } clone() { return new Vector3(this.x, this.y, this.z); }
  lerp(v, k) { this.x += (v.x - this.x) * k; this.y += (v.y - this.y) * k; this.z += (v.z - this.z) * k; return this; }
  lerpVectors(a, b, k) { return this.copy(a).lerp(b, k); }
  setScalar(s) { return this.set(s, s, s); }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
}
export class Color { constructor(h = 0xffffff) { this.h = h; } setHex(h) { this.h = h; return this; } lerp() { return this; } copy(c) { this.h = c.h; return this; } }
export class Object3D {
  constructor() { this.name = ''; this.parent = null; this.children = []; this.position = new Vector3(); this.rotation = { x: 0, y: 0, z: 0 }; this.scale = new Vector3(1, 1, 1); this.visible = true; this.userData = {}; }
  add(...os) { for (const o of os) { o.removeFromParent(); o.parent = this; this.children.push(o); } return this; }
  removeFromParent() { if (this.parent) { this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; } return this; }
  worldPos() { const p = this.position.clone(); for (let a = this.parent; a; a = a.parent) { p.x += a.position.x; p.y += a.position.y; p.z += a.position.z; } return p; }
  worldToLocal(v) { const w = this.worldPos(); return v.set(v.x - w.x, v.y - w.y, v.z - w.z); }
  attach(o) { const w = o.worldPos(); o.removeFromParent(); this.add(o); const me = this.worldPos(); o.position.set(w.x - me.x, w.y - me.y, w.z - me.z); return this; }
  traverse(fn) { fn(this); for (const c of [...this.children]) c.traverse(fn); }
  updateMatrixWorld() {} updateWorldMatrix() {} lookAt() {}
}
export class Scene extends Object3D { }
export class Group extends Object3D { }
export class Mesh extends Object3D {
  constructor(geometry, material) { super(); this.isMesh = true; this.geometry = geometry || {}; this.material = material || { color: new Color(), clone() { return { color: new Color(), clone: this.clone }; } }; }
}
export class Box3 {
  constructor() { this.min = new Vector3(Infinity, Infinity, Infinity); this.max = new Vector3(-Infinity, -Infinity, -Infinity); }
  setFromObject(o) { this.min.set(Infinity, Infinity, Infinity); this.max.set(-Infinity, -Infinity, -Infinity); return this.expandByObject(o); }
  expandByObject(o) {
    o.traverse(m => { if (!m.isMesh || !m.bbox0) return; const w = m.worldPos(), b = m.bbox0;
      this.min.set(Math.min(this.min.x, b.min[0] + w.x), Math.min(this.min.y, b.min[1] + w.y), Math.min(this.min.z, b.min[2] + w.z));
      this.max.set(Math.max(this.max.x, b.max[0] + w.x), Math.max(this.max.y, b.max[1] + w.y), Math.max(this.max.z, b.max[2] + w.z)); });
    return this;
  }
  getCenter(v) { return v.set((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2, (this.min.z + this.max.z) / 2); }
  getSize(v) { return v.set(this.max.x - this.min.x, this.max.y - this.min.y, this.max.z - this.min.z); }
}
export class Raycaster {
  constructor() { this.o = null; this.far = 100; }
  set(o) { this.o = o; }
  intersectObjects(list) {
    let best = -Infinity; const { x, y, z } = this.o;
    for (const m of list) {
      const off = m.worldPos();
      for (const [a, b, c] of m.tris) {
        const ax = a[0] + off.x, az = a[2] + off.z, v0x = b[0] + off.x - ax, v0z = b[2] + off.z - az, v1x = c[0] + off.x - ax, v1z = c[2] + off.z - az, d = v0x * v1z - v1x * v0z;
        if (Math.abs(d) < 1e-9) continue;
        const px = x - ax, pz = z - az, u = (px * v1z - v1x * pz) / d, w = (v0x * pz - px * v0z) / d;
        if (u < -1e-6 || w < -1e-6 || u + w > 1 + 1e-6) continue;
        const yy = a[1] + off.y + u * (b[1] - a[1]) + w * (c[1] - a[1]);
        if (yy <= y && yy > best) best = yy;
      }
    }
    return best > -Infinity ? [{ point: { y: best } }] : [];
  }
}
const noop = class { constructor() { this.color = new Color(); this.position = new Vector3(); } };
export const Fog = noop, HemisphereLight = class extends Object3D { }, DirectionalLight = class extends Object3D { };
export const BoxGeometry = noop, ConeGeometry = noop, CylinderGeometry = noop, MeshLambertMaterial = noop, MeshBasicMaterial = noop, CanvasTexture = noop;

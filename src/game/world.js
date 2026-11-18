// Consultas de suelo/colisión sobre un escenario GLB ya normalizado (Three.js).
// Implementa la interfaz `world` que usa physics.js.
import * as THREE from 'three';
import { resolveGround } from './physics.js';

const DOWN = new THREE.Vector3(0, -1, 0);

function chainName(o, root) {
  let s = '';
  for (let p = o; p && p !== root.parent; p = p.parent) s += p.name + '|';
  return s;
}

export class WorldQueries {
  /**
   * @param root   Object3D del escenario (ya normalizado con loadAsset)
   * @param rules  { walkable: RegExp, water?: RegExp, obstacles?: [{re, radius:(w,d)=>number}], killY?: number }
   */
  constructor(root, rules) {
    this.root = root;
    this.walk = []; this.wat = []; this.obstacles = [];
    this.killY = rules.killY ?? -30;
    this.reach = 0.85;                       // el rayo parte a esta altura sobre los pies
    this.ray = new THREE.Raycaster();
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    // `walkable` puede ser una RegExp (nombre) o una función (malla, nombre) → boolean (p. ej. para elegir solo los tablones)
    const isWalk = typeof rules.walkable === 'function' ? rules.walkable : (o, c) => rules.walkable.test(c);
    root.traverse(o => {
      if (!o.isMesh) return;
      const c = chainName(o, root);
      if (rules.water && rules.water.test(c)) { this.wat.push(o); return; }
      if (isWalk(o, c)) { this.walk.push(o); box.expandByObject(o); return; }
      for (const r of rules.obstacles || []) {
        if (r.re.test(c) && (!r.when || r.when(o))) {
          const b = new THREE.Box3().setFromObject(o);
          this.obstacles.push({ x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, r: r.radius(b.max.x - b.min.x, b.max.z - b.min.z) });
          break;
        }
      }
    });
    this.bounds = rules.bounds ?? (this.walk.length ? { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z } : null);
  }

  /** Activa/desactiva una malla como suelo (p. ej. un tablón roto deja de ser transitable). */
  setWalkable(mesh, on) {
    const i = this.walk.indexOf(mesh);
    if (on && i < 0) this.walk.push(mesh); else if (!on && i >= 0) this.walk.splice(i, 1);
  }

  _hit(list, x, z, refY) {
    if (!list.length) return null;
    this.ray.set(new THREE.Vector3(x, refY + this.reach, z), DOWN);
    this.ray.far = 400;
    const h = this.ray.intersectObjects(list, false);
    return h.length ? h[0].point.y : null;
  }

  /** Suelo bajo (x,z): un rayo + relleno de rendijas estrechas entre tablones (ver resolveGround). */
  groundAt(x, z, refY) { return resolveGround((px, pz, py) => this._rawGround(px, pz, py), x, z, refY); }

  _rawGround(x, z, refY) {
    const gy = this._hit(this.walk, x, z, refY);
    const wy = this._hit(this.wat, x, z, refY);
    if (wy !== null && (gy === null || wy >= gy - 0.02)) return { y: wy, kind: 'water' };
    if (gy === null) return null;
    return { y: gy, kind: 'ground' };
  }

  /** Centro (x) de los vértices de las mallas que cumplen `re` en una franja de z. */
  centerlineX(re, z, half = 0.75) {
    let sum = 0, n = 0;
    const v = new THREE.Vector3();
    this.root.traverse(o => {
      if (!o.isMesh || !re.test(chainName(o, this.root))) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (Math.abs(v.z - z) < half) { sum += v.x; n++; }
      }
    });
    return n ? sum / n : null;
  }
  zRange(re) {
    let mn = Infinity, mx = -Infinity; const v = new THREE.Vector3();
    this.root.traverse(o => {
      if (!o.isMesh || !re.test(chainName(o, this.root))) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); mn = Math.min(mn, v.z); mx = Math.max(mx, v.z); }
    });
    return [mn, mx];
  }
}

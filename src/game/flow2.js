// Lógica del Nivel 2 · El puente colgante, SIN Three.js (se prueba en Node).
// Distribución real de Puente_colgante.glb (eje X): isla izquierda → puente 1 → isla central → puente 2 → isla derecha.

export const ISLANDS = {
  left:   { x0: -16.75, x1: -7.9 },
  center: { x0: -1.99,  x1: 4.35 },
  right:  { x0: 9.65,   x1: 18.0 },
};
export const LANE_Z = -0.14;                 // eje central de ambos puentes
export const SAFE_CENTER_X = -1.2;           // dentro de la isla central (punto de control)
export const SAFE_RIGHT_X = 10.4;            // dentro de la última isla (llegada)
export const KILL_Y = -5.0;                  // el mar queda en y≈-6.2: se detecta la caída antes de llegar a él

// Puntos de control (x) y carril (z) de cada personaje al aparecer. Orden: Toffee, Cookie, Bobby.
export const PADS = [
  { x: -13.0, name: 'Isla 1' },
  { x: 0.8,   name: 'Isla 2' },
  { x: 13.5,  name: 'Isla 3' },
];
export const PAD_Z = [-1.0, -0.14, 0.75];

export const STAGES = ['Isla 1', 'Puente 1', 'Isla 2', 'Puente 2', '¡Meta!'];
export function stageOf(x) {
  if (x <= ISLANDS.left.x1) return 0;
  if (x < ISLANDS.center.x0) return 1;
  if (x <= ISLANDS.center.x1) return 2;
  if (x < ISLANDS.right.x0) return 3;
  return 4;
}

/** Progreso individual de cada personaje, puntos de control y llegada. */
export class Level2Progress {
  constructor(n = 3) { this.n = n; this.c = Array.from({ length: n }, () => ({ stage: 0, best: 0, cp: 0, arrived: false, falls: 0 })); }
  /** Llamar cada cuadro con la posición del personaje. Solo cuenta si está apoyado en suelo (no en el aire). */
  update(i, x, grounded, y) {
    const c = this.c[i], ev = {};
    if (!grounded || y < -2) return ev;
    c.stage = stageOf(x); c.best = Math.max(c.best, c.stage);
    if (c.cp < 1 && x >= SAFE_CENTER_X) { c.cp = 1; ev.checkpoint = 1; }
    if (!c.arrived && x >= SAFE_RIGHT_X) { c.arrived = true; c.cp = 2; ev.arrived = true; }
    return ev;
  }
  /** El personaje cayó: devuelve el índice del punto de control donde reaparece. No toca el progreso de los demás. */
  fall(i) { this.c[i].falls++; this.c[i].stage = this.c[i].cp * 2; return this.c[i].cp; }
  get arrivedCount() { return this.c.filter(k => k.arrived).length; }
  get done() { return this.arrivedCount === this.n; }
  /** Para la interfaz: etiqueta y porcentaje (0..1) de cada personaje. */
  status(i) {
    const c = this.c[i];
    return { label: c.arrived ? '¡En la meta! ✔' : STAGES[c.stage], pct: c.arrived ? 1 : c.stage / 4, arrived: c.arrived };
  }
  spawnFor(i) { const k = this.c[i].cp; return { x: PADS[k].x, z: PAD_Z[i], cp: k }; }
}

// ---------- peligros de los puentes ----------
// Tipos de tablón por puente (índice 0..12 de izquierda a derecha; nunca los de las orillas 0 y 12):
//   break: se rompe tras ~1 s de pisarlo · tilt: se inclina hacia donde cae el peso · gap: falta (hueco permanente; se salta)
// Puente 1: introduce los que se rompen y los que se inclinan. Puente 2: los combina con huecos y más balanceo.
export const LAYOUT = [
  { break: [4, 9], tilt: { 2: -1, 6: 1, 7: 1 }, gap: [] },
  { break: [3, 8], tilt: { 2: -1, 6: 1, 7: 1, 11: -1 }, gap: [5, 10] },
];
export const HAZ = {
  shake: 1.0,          // s temblando antes de desprenderse (tiempo de reacción)
  fall: 0.5,           // s inclinándose y cayendo (ya no es transitable)
  reset: 8,            // s hasta que un tablón roto vuelve a su sitio
  restore: 0.3,        // s de la animación de regreso
  tiltRate: 2.2, tiltBack: 1.5,   // velocidad (1/s) con que se inclina con peso / se endereza sin él
  tiltBias: 0.35,      // inclinación inicial hacia su lado por defecto
  tiltGain: 2.0,       // cuánto se inclina hacia el lado donde está el personaje (por metro de desvío del eje)
  tiltDrift: 0.8,      // empuje lateral (fracción de la velocidad) con la inclinación máxima
  sway: [{ amp: 0.06, push: 0.15 }, { amp: 0.085, push: 0.26 }],   // balanceo (rad) y empuje de cada puente
  swayOmega: 1.8,
  jumpV: 5.4, jumpCd: 0.12,   // salto: velocidad inicial y espera tras aterrizar
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const swayAngle = (bridge, t) => HAZ.sway[bridge].amp * Math.sin(HAZ.swayOmega * t + bridge * 1.7);
export const swayPush = (bridge, t) => HAZ.sway[bridge].push * Math.sin(HAZ.swayOmega * t + bridge * 1.7);

/** boxes: [{cx, hx, cz, hz, …}] de UN puente. Devuelve los tablones ordenados con su tipo y estado. */
export function buildPlanks(boxes, bridge) {
  const L = LAYOUT[bridge];
  return [...boxes].sort((a, b) => a.cx - b.cx).map((b, i) => {
    const kind = L.gap.includes(i) ? 'gap' : L.break.includes(i) ? 'break' : (i in L.tilt) ? 'tilt' : 'normal';
    return { ...b, bridge, i, kind, dir: L.tilt[i] || (i % 2 ? 1 : -1), st: 'idle', t: 0, tilt: 0 };
  });
}
export function plankAt(planks, x, z) {
  for (const p of planks) if (Math.abs(x - p.cx) <= p.hx + 0.04 && Math.abs(z - p.cz) <= p.hz) return p;
  return null;
}

/** Dinámica de todos los tablones de un nivel. Solo el personaje controlado dispara/inclina los tablones. */
export class PlankField {
  constructor(planks) { this.planks = planks; this.standing = null; }
  walkable(p) { return p.kind === 'gap' ? false : p.kind === 'break' ? (p.st !== 'fall' && p.st !== 'broken') : true; }
  /** body: {x, z, grounded} del personaje controlado. Devuelve eventos [{type:'shake'|'break'|'restore', plank}]. */
  update(dt, body) {
    const ev = [];
    this.standing = body && body.grounded ? plankAt(this.planks, body.x, body.z) : null;
    for (const p of this.planks) {
      if (p.kind === 'break') {
        if (p.st === 'idle') { if (p === this.standing) { p.st = 'shake'; p.t = 0; ev.push({ type: 'shake', plank: p }); } }
        else {
          p.t += dt;
          if (p.st === 'shake' && p.t >= HAZ.shake) { p.st = 'fall'; p.t = 0; ev.push({ type: 'break', plank: p }); }
          else if (p.st === 'fall' && p.t >= HAZ.fall) { p.st = 'broken'; p.t = 0; }
          else if (p.st === 'broken' && p.t >= HAZ.reset) { p.st = 'restore'; p.t = 0; ev.push({ type: 'restore', plank: p }); }
          else if (p.st === 'restore' && p.t >= HAZ.restore) { p.st = 'idle'; p.t = 0; }
        }
      } else if (p.kind === 'tilt') {
        const occ = p === this.standing;
        const target = occ ? clamp(HAZ.tiltBias * p.dir + HAZ.tiltGain * (body.z - p.cz), -1, 1) : 0;
        const r = (occ ? HAZ.tiltRate : HAZ.tiltBack) * dt;
        p.tilt += clamp(target - p.tilt, -r, r);
      }
    }
    return ev;
  }
  /** Empuje lateral (en z) sobre el personaje controlado: inclinación del tablón (siempre) + balanceo del puente (si camina). */
  push(t, moving) {
    const p = this.standing; if (!p) return 0;
    return (p.kind === 'tilt' ? HAZ.tiltDrift * p.tilt : 0) + (moving ? swayPush(p.bridge, t) : 0);
  }
  /** Los tablones rotos vuelven a su sitio (tras una caída o al reiniciar el nivel). */
  resetBroken() { for (const p of this.planks) { if (p.kind === 'break') { p.st = 'idle'; p.t = 0; } if (p.kind === 'tilt') p.tilt = 0; } }
}

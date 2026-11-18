// Análisis de encuadre SIN navegador: lanza una rejilla de rayos desde la cámara (fov vertical 50°) y mide qué parte de lo que
// apunta hacia abajo cae en el vacío (fuera del rectángulo real de paramo.glb y sin montaña delante). También proyecta personajes.
import { TERRAIN, MOUNTAINS, FOG } from '../src/game/story.js';
const norm = v => { const m = Math.hypot(...v); return v.map(a => a / m); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function basis(pos, look) {
  const f = norm([look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]]), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  return { f, r, u };
}
function hitBox(o, d, [mn, mx]) {
  let t0 = 0, t1 = 1e9;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) return false; continue; }
    let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
  }
  return true;
}
/** Fracción de rayos hacia abajo que no encuentran ni terreno ni montaña (vacío visible). */
export function voidFraction(pos, look, aspect = 16 / 9, fov = 50, nx = 28, ny = 16) {
  const { f, r, u } = basis(pos, look), th = Math.tan(fov * Math.PI / 360); let down = 0, empty = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const sx = ((i + 0.5) / nx * 2 - 1) * th * aspect, sy = ((j + 0.5) / ny * 2 - 1) * th;
    const d = norm([f[0] + r[0] * sx + u[0] * sy, f[1] + r[1] * sx + u[1] * sy, f[2] + r[2] * sx + u[2] * sy]);
    if (d[1] >= 0) continue;
    down++;
    const t = -pos[1] / d[1], x = pos[0] + d[0] * t, z = pos[2] + d[2] * t;
    const onGround = x >= TERRAIN.minX && x <= TERRAIN.maxX && z >= TERRAIN.minZ && z <= TERRAIN.maxZ;
    // vacío VISIBLE = no hay terreno ni montaña y el punto del suelo queda a menos de FOG.visibleUntil (más lejos ya lo tapa la neblina)
    if (!onGround && Math.hypot(x - pos[0], z - pos[2]) < FOG.visibleUntil && !MOUNTAINS.some(b => hitBox(pos, d, b))) empty++;
  }
  return down ? empty / down : 0;
}
/** Coordenadas normalizadas de pantalla (-1..1) de un punto, o null si queda detrás de la cámara. */
export function project(pos, look, p, aspect = 16 / 9, fov = 50) {
  const { f, r, u } = basis(pos, look), v = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
  const z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2]; if (z <= 0.05) return null;
  const th = Math.tan(fov * Math.PI / 360);
  return [(v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / z / (th * aspect), (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / z / th];
}

/** Como voidFraction pero con un rectángulo de terreno arbitrario {minX,maxX,minZ,maxZ} (p. ej. el bosque de puente.glb). Sin montañas. */
export function voidFractionRect(pos, look, rect, aspect = 16 / 9, fogUntil = 90, fov = 50, nx = 28, ny = 16) {
  const { f, r, u } = basis(pos, look), th = Math.tan(fov * Math.PI / 360); let down = 0, empty = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const sx = ((i + 0.5) / nx * 2 - 1) * th * aspect, sy = ((j + 0.5) / ny * 2 - 1) * th;
    const d = norm([f[0] + r[0] * sx + u[0] * sy, f[1] + r[1] * sx + u[1] * sy, f[2] + r[2] * sx + u[2] * sy]);
    if (d[1] >= 0) continue;
    down++;
    const t = -pos[1] / d[1], x = pos[0] + d[0] * t, z = pos[2] + d[2] * t;
    if (!(x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ) && Math.hypot(x - pos[0], z - pos[2]) < fogUntil) empty++;
  }
  return down ? empty / down : 0;
}

// Simulación sin navegador del cruce del puente: tablero EXACTO (triángulos de puente.glb normalizado, con sus rendijas),
// terreno/río rasterizados a 0.25 m, obstáculos (árboles/rocas/cristales) con la regla del juego y la física REAL de src/game/physics.js.
// Uso: node tools/sim_bridge/sim.mjs old   (física sin relleno de rendijas: reproduce el atasco)
//      node tools/sim_bridge/sim.mjs new   (física actual)
import fs from 'fs';
import { createBody, stepBody, followStep, resolveGround } from '../../src/game/physics.js';
const G = JSON.parse(fs.readFileSync(new URL('./puente_grid.json', import.meta.url)));
const cellv = (a, x, z) => { const ix = Math.floor((x - G.X0) / G.RES), iz = Math.floor((z - G.Z0) / G.RES); return (ix < 0 || iz < 0 || ix >= G.nx || iz >= G.nz) ? -9 : a[iz][ix]; };
function deckTop(x, z, lim) {            // altura exacta del tablero bajo (x,z) con y<=lim
  let best = -9;
  for (const [a, b, c] of G.deck) {
    const v0x = b[0] - a[0], v0z = b[2] - a[2], v1x = c[0] - a[0], v1z = c[2] - a[2], d = v0x * v1z - v1x * v0z;
    if (Math.abs(d) < 1e-9) continue;
    const px = x - a[0], pz = z - a[2], u = (px * v1z - v1x * pz) / d, w = (v0x * pz - px * v0z) / d;
    if (u < -1e-6 || w < -1e-6 || u + w > 1 + 1e-6) continue;
    const y = a[1] + u * (b[1] - a[1]) + w * (c[1] - a[1]);
    if (y <= lim && y > best) best = y;
  }
  return best;
}
const raw = (x, z, refY) => {                 // misma lógica que WorldQueries._rawGround (un rayo)
  const lim = refY + 0.85;
  let g = cellv(G.walk, x, z); if (g > lim) g = -9;
  const dk = deckTop(x, z, lim); if (dk > g) g = dk;
  let w = cellv(G.wat, x, z); if (w > lim) w = -9;
  const gg = g > -8 ? g : null, ww = w > -8 ? w : null;
  if (ww !== null && (gg === null || ww >= gg - 0.02)) return { y: ww, kind: 'water' };
  return gg === null ? null : { y: gg, kind: 'ground' };
};
const MODE = process.argv[2] || 'new';
const GATE_Z = -3.97, FULL = 27.5;
const world = { obstacles: G.obs, bounds: { minX: -18, maxX: 18, minZ: -27.5, maxZ: FULL }, killY: -30,
  groundAt: (x, z, y) => (MODE === 'old' ? raw(x, z, y) : resolveGround(raw, x, z, y)) };
const mk = (x, z, speed) => { const b = createBody(x, 0, z, { speed }); b.y = world.groundAt(x, z, 8).y; return b; };
const SP = { Toffee: 3.0, Cookie: 3.4, Bobby: 3.9 }, zEnd = 5.51;

// Controlador simple: ir hacia un waypoint
function drive(b, wps, maxT = 40) {
  let t = 0, i = 0, stuckAt = null;
  while (i < wps.length && t < maxT) {
    const [tx, tz] = wps[i]; const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { i++; continue; }
    stepBody(b, { x: dx / d, z: dz / d }, 1 / 60, world); t += 1 / 60;
    if (b.y < -1) return { ok: false, why: 'cayó', at: [b.x, b.z, b.y].map(v => +v.toFixed(2)) };
  }
  return i >= wps.length ? { ok: true, t: +t.toFixed(1) } : { ok: false, why: 'atascado', at: [b.x, b.z, b.y].map(v => +v.toFixed(2)) };
}
let fails = 0;
const report = (n, r) => { console.log(`  ${n}: ${r.ok ? 'CRUZA ✔ (' + r.t + ' s)' : 'FALLA ✘ ' + r.why + ' en x,z,y=' + r.at}`); if (!r.ok) fails++; };

console.log(`\n=== MODO ${MODE.toUpperCase()} ===`);
console.log('A) Cada personaje controlado, por tres carriles (x=0.7 / 1.8 / 3.0), desde la entrada hasta z=9');
for (const n of Object.keys(SP)) for (const lane of [0.7, 1.8, 3.0]) {
  const b = mk(lane, -4.3, SP[n]); report(`${n} carril ${lane}`, drive(b, [[lane, -2], [lane, 1], [lane, 4], [lane, 7], [lane, 9]]));
}
console.log('B) Como seguidores: el líder cruza y los otros dos lo siguen (sin teleport); cada personaje de líder');
for (const lead of Object.keys(SP)) {
  const names = Object.keys(SP), bs = {}; names.forEach((n, i) => { bs[n] = mk(1.8 + (i - 1) * 0.9, -4.6 - i * 0.5, SP[n]); });
  const others = names.filter(n => n !== lead); let t = 0, tele = 0, ok = false;
  const wps = [[1.8, -2], [1.8, 1], [2.3, 4], [3.2, 7], [3.4, 10]]; let wi = 0;
  while (t < 60) {
    const L = bs[lead], [tx, tz] = wps[Math.min(wi, wps.length - 1)], dx = tx - L.x, dz = tz - L.z, d = Math.hypot(dx, dz);
    if (d < 0.3 && wi < wps.length - 1) wi++;
    // el líder espera si los seguidores se rezagan (como haría el jugador)
    const gap = Math.max(...others.map(o => Math.hypot(bs[o].x - L.x, bs[o].z - L.z)));
    stepBody(L, gap > 4 && t < 59 ? { x: 0, z: 0 } : { x: dx / d, z: dz / d }, 1 / 60, world);
    others.forEach((o, k) => { const r = followStep(bs[o], L, k + 1, 1 / 60, world); if (r) tele++; });
    t += 1 / 60;
    if (names.every(n => bs[n].z > zEnd)) { ok = true; break; }
  }
  const z = names.map(n => `${n} z=${bs[n].z.toFixed(1)}`).join(', ');
  console.log(`  líder ${lead}: ${ok ? 'LOS TRES CRUZAN ✔ (' + t.toFixed(1) + ' s)' : 'FALLA ✘ (' + z + ')'}${tele ? '  teleports=' + tele : ''}`); if (!ok) fails++;
}
console.log('C) Compuerta cerrada (maxZ = compuerta): nadie pasa');
world.bounds.maxZ = GATE_Z; const g = mk(1.8, -4.3, 3.0); drive(g, [[1.8, 3]], 6);
console.log(`  z máxima con compuerta cerrada = ${g.z.toFixed(2)} ${g.z <= GATE_Z ? '✔ bloqueado' : '✘ pasó'}`); if (g.z > GATE_Z) fails++;
console.log('D) Barrido de 32 carriles (x=0.3…3.4) con los tres personajes');
world.bounds.maxZ = FULL; let dBad = 0;
for (const n of Object.keys(SP)) for (let x = 0.3; x <= 3.41; x += 0.1) { const b = mk(x, -4.3, SP[n]); const r = drive(b, [[x, 9]], 25); if (!r.ok) { dBad++; console.log('  falla', n, x.toFixed(1), JSON.stringify(r)); } }
console.log(dBad ? `  ${dBad} carriles fallan (cerca del borde/roca; ver arriba)` : '  todos los carriles cruzan ✔');
console.log('E) Los bordes siguen sólidos: desde el centro del tablero caminar hacia los lados');
for (const z of [-1.5, 0.5, 2.5]) for (const dir of [-1, 1]) {
  const b = mk(1.8, z, 3.0); for (let i = 0; i < 400; i++) stepBody(b, { x: dir, z: 0 }, 1 / 60, world);
  const ok = b.y > 0.5 && b.grounded; console.log(`  z=${z} hacia ${dir < 0 ? '-X' : '+X'}: x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} ${ok ? 'queda sobre el tablero ✔' : 'SALIÓ ✘'}`); if (!ok) fails++;
}
console.log(fails ? `\n${fails} fallo(s)` : '\nTODO OK');

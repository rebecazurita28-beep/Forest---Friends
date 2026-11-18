// Simulación sin navegador del Nivel 2 con la geometría EXACTA de Puente_colgante.glb (islas + 26 tablones con sus rendijas),
// la física REAL (src/game/physics.js) y la lógica REAL (src/game/flow2.js: PlankField, HAZ, Level2Progress).
// No incluye dibujo, cámara ni las animaciones visuales (inclinaciones/temblor/balanceo).
// Uso: node tools/sim_colgante/sim.mjs
import fs from 'fs';
import { createBody, stepBody, resolveGround, cameraRelativeWish, jump } from '../../src/game/physics.js';
import { Level2Progress, PlankField, buildPlanks, plankAt, HAZ, KILL_Y, PAD_Z, PADS, LANE_Z } from '../../src/game/flow2.js';
const G = JSON.parse(fs.readFileSync(new URL('./colgante_geom.json', import.meta.url)));
const bridges = [buildPlanks(G.planks.filter(p => p.cx < 0), 0), buildPlanks(G.planks.filter(p => p.cx > 0), 1)];
const all = [...bridges[0], ...bridges[1]];
const sandTris = [], plankTris = new Map();
for (let i = 0; i < G.walk.length; i += 12) {
  const tris = G.walk.slice(i, i + 12); let cx = 0; for (const t of tris) for (const v of t) cx += v[0]; cx /= 36;
  const p = all.find(q => Math.abs(q.cx - cx) < 0.05 && tris.every(t => t.every(v => Math.abs(v[0] - q.cx) <= q.hx + 1e-3)));
  if (p) plankTris.set(p, tris); else sandTris.push(...tris);
}
const fresh = () => { all.forEach(p => { p.st = 'idle'; p.t = 0; p.tilt = 0; }); return new PlankField(all); };
let field = fresh();
function topIn(tris, x, z, lim, best) {
  for (const [a, b, c] of tris) {
    const v0x = b[0] - a[0], v0z = b[2] - a[2], v1x = c[0] - a[0], v1z = c[2] - a[2], d = v0x * v1z - v1x * v0z;
    if (Math.abs(d) < 1e-9) continue;
    const px = x - a[0], pz = z - a[2], u = (px * v1z - v1x * pz) / d, w = (v0x * pz - px * v0z) / d;
    if (u < -1e-6 || w < -1e-6 || u + w > 1 + 1e-6) continue;
    const y = a[1] + u * (b[1] - a[1]) + w * (c[1] - a[1]);
    if (y <= lim && y > best) best = y;
  }
  return best;
}
function topAt(x, z, lim) {
  let best = topIn(sandTris, x, z, lim, -99);
  for (const [p, tris] of plankTris) if (Math.abs(x - p.cx) < p.hx + 0.02 && field.walkable(p)) best = topIn(tris, x, z, lim, best);
  return best;
}
const raw = (x, z, refY) => { const y = topAt(x, z, refY + 0.85); return y > -90 ? { y, kind: 'ground' } : null; };
// rocas: mismas reglas que level2.js
const ends = [[-8.2, -1.7], [3.9, 10.05]];
const obstacles = G.obs.filter(o => o.r > 0.5 || !(plankAt(all, o.x, o.z) || ends.some(([a, b]) => (Math.abs(o.x - a) < 0.7 || Math.abs(o.x - b) < 0.7) && Math.abs(o.z - LANE_Z) < 0.9)))
  .map(o => ({ x: o.x, z: o.z, r: o.r > 0.5 ? o.r : 0.3 * 2 * o.r / 0.9 }));
const world = { obstacles, bounds: { minX: -40, maxX: 40, minZ: -30, maxZ: 30 }, killY: KILL_Y, groundAt: (x, z, y) => resolveGround(raw, x, z, y) };
const SP = [3.0, 3.4, 3.9], NAMES = ['Toffee', 'Cookie', 'Bobby'];
const mk = (i, x, z) => { const b = createBody(x, 0, z, { speed: SP[i] }); b.y = raw(x, z, 5).y; b.yaw = Math.PI / 2; return b; };
const gaps = () => all.filter(p => p.kind === 'gap' || (p.kind === 'break' && !field.walkable(p)));

// Un cuadro de juego (misma mecánica que level2.js). keys: {fwd,right,jump}; st: {cd}
function tick(b, keys, t, dt, st) {
  field.update(dt, b);
  const wish = cameraRelativeWish({ fwd: keys.fwd, right: keys.right }, Math.PI / 2);
  const moving = Math.hypot(wish.x, wish.z) > 0.05;
  wish.z += field.push(t, moving);
  st.cd = Math.max(0, st.cd - dt);
  if (keys.jump && st.cd <= 0) jump(b, HAZ.jumpV);
  const ev = stepBody(b, wish, dt, world, { canFall: true, noGlide: true });
  if (ev.landed) st.cd = HAZ.jumpCd;
  return ev;
}
// "Jugador" cuidadoso: avanza, corrige hacia el eje del puente y salta justo antes de cada hueco
function careful(b, takeoff) {
  const dz = LANE_Z - b.z, g = gaps().filter(p => p.cx - p.hx > b.x - 0.2).sort((a, c) => a.cx - c.cx)[0];
  const jumpNow = b.grounded && g && (g.cx - g.hx - b.x) < takeoff && (g.cx - g.hx - b.x) > -0.1 && b.x > -9 && Math.abs(g.cx - b.x) < 3;
  return { fwd: 1, right: Math.abs(dz) > 0.2 ? Math.sign(dz) : 0, jump: !!jumpNow };
}
function run(i, { policy = 'careful', t0 = 0, zStart = LANE_Z, limit = 60, takeoff = 0.3, preBroken = false } = {}) {
  field = fresh(); if (preBroken) all.forEach(p => { if (p.kind === 'break') p.st = 'broken'; });
  const b = mk(i, PADS[0].x, zStart), prog = new Level2Progress(3), st = { cd: 0 }; let t = t0, falls = 0; const dt = 1 / 60; let fallX = null;
  while (t - t0 < limit) {
    let keys;
    if (policy === 'careful') keys = careful(b, takeoff);
    else if (policy === 'steer') keys = { fwd: 1, right: Math.abs(LANE_Z - b.z) > 0.2 ? Math.sign(LANE_Z - b.z) : 0, jump: false };
    else keys = { fwd: 1, right: 0, jump: false };
    const ev = tick(b, keys, t, dt, st); t += dt;
    if (ev.fell) { falls++; fallX ??= +b.x.toFixed(1); prog.fall(i); field.resetBroken(); if (preBroken) all.forEach(p => { if (p.kind === 'break') p.st = 'broken'; }); const sp = prog.spawnFor(i); b.x = sp.x; b.z = sp.z; b.y = raw(b.x, b.z, 5).y; b.vx = b.vz = b.vy = 0; b.grounded = true; if (policy !== 'careful') break; }
    if (prog.update(i, b.x, b.grounded, b.y).arrived) return { ok: true, t: +(t - t0).toFixed(1), falls, fallX };
  }
  return { ok: false, falls, fallX, x: +b.x.toFixed(1) };
}
let fails = 0; const need = (ok, msg) => { console.log(`  ${ok ? '✔' : '✘'} ${msg}`); if (!ok) fails++; };
const planksOf = (br, kind) => bridges[br].filter(p => p.kind === kind);

console.log('1) Tablón que se rompe: pisarlo y quedarse → tiembla ~1 s, se desprende y el personaje cae');
for (let i = 0; i < 3; i++) {
  field = fresh(); const p = planksOf(0, 'break')[0], b = mk(i, p.cx - 0.475, LANE_Z), st = { cd: 0 }; let t = 0, tShake = null, tFall = null, tBreak = null;
  for (let f = 0; f < 60 * 8 && tFall === null; f++) {
    const toward = b.x < p.cx - 0.05; const ev = tick(b, { fwd: toward ? 1 : 0, right: 0, jump: false }, t, 1 / 60, st); t += 1 / 60;
    if (p.st === 'shake' && tShake === null) tShake = t; if (p.st === 'fall' && tBreak === null) tBreak = t; if (ev.fell) tFall = t;
  }
  need(tShake !== null && tBreak !== null && tFall !== null, `${NAMES[i]}: tiembla en t=${tShake?.toFixed(2)} s, se desprende ${(tBreak - tShake).toFixed(2)} s después (≈1 s de reacción) y cae al vacío (${tFall?.toFixed(2)} s)`);
  need(Math.abs((tBreak - tShake) - HAZ.shake) < 0.05, `${NAMES[i]}: tiempo de reacción = ${(tBreak - tShake).toFixed(2)} s`);
}
console.log('2) Si se sale a tiempo del tablón que se rompe, NO cae; el tablón se rompe igualmente y luego se repone');
for (let i = 0; i < 3; i++) {
  field = fresh(); const p = planksOf(0, 'break')[0], b = mk(i, p.cx - 0.475, LANE_Z), st = { cd: 0 }; let t = 0, fell = false, wasBroken = false, restored = false;
  for (let f = 0; f < 60 * 14; f++) { const ev = tick(b, { fwd: b.x < p.cx + 0.5 ? 1 : 0, right: 0, jump: false }, t, 1 / 60, st); t += 1 / 60; if (ev.fell) fell = true; if (p.st === 'broken') wasBroken = true; if (wasBroken && p.st === 'idle') { restored = true; break; } }
  need(!fell && wasBroken && restored, `${NAMES[i]}: pasa sin caer; el tablón se rompió (${wasBroken}) y volvió a su sitio (${restored})`);
}
console.log('3) Tablón que se inclina: sin corregir se resbala hacia el borde y cae; corrigiendo hacia el eje se recupera');
for (let i = 0; i < 3; i++) {
  const tp = planksOf(0, 'tilt')[0];
  field = fresh(); let b = mk(i, tp.cx, LANE_Z + 0.3), st = { cd: 0 }, t = 0, fallT = null;
  for (let f = 0; f < 60 * 8 && fallT === null; f++) { const ev = tick(b, { fwd: 0, right: 0, jump: false }, t, 1 / 60, st); t += 1 / 60; if (ev.fell) fallT = t; }
  field = fresh(); b = mk(i, tp.cx, LANE_Z + 0.3); st = { cd: 0 }; t = 0; let fell2 = false, minAbs = 9;
  for (let f = 0; f < 60 * 8; f++) { const dz = LANE_Z - b.z; const ev = tick(b, { fwd: 0, right: Math.abs(dz) > 0.12 ? Math.sign(dz) : 0, jump: false }, t, 1 / 60, st); t += 1 / 60; if (ev.fell) fell2 = true; minAbs = Math.min(minAbs, Math.abs(dz)); }
  need(fallT !== null && !fell2, `${NAMES[i]}: sin corregir cae a los ${fallT?.toFixed(1)} s (desliza progresivamente); corrigiendo se mantiene (desvío mín. ${minAbs.toFixed(2)} m)`);
}
console.log('4) El balanceo del puente desvía algo al caminar en línea recta (sin corregir), pero no tira al jugador por sí solo');
for (const br of [0, 1]) {
  field = fresh(); const dev = [];
  for (let k = 0; k < 20; k++) {
    const t0 = k * 0.4; const x0 = br ? 3.5 : -9; const b = mk(1, x0, LANE_Z), st = { cd: 0 }; let t = t0, mx = 0, f = false;
    // solo balanceo: se anula el tipo de tablón para aislar el efecto
    for (let s = 0; s < 60 * 3.2 && b.x < (br ? 10.4 : -1.2); s++) { field.update(1 / 60, b); const w = cameraRelativeWish({ fwd: 1, right: 0 }, Math.PI / 2); w.z += (field.standing ? swayOnly(field.standing.bridge, t) : 0); const ev = stepBody(b, w, 1 / 60, world, { canFall: true }); t += 1 / 60; mx = Math.max(mx, Math.abs(b.z - LANE_Z)); if (ev.fell) f = true; }
    dev.push([mx, f]);
  }
  const m = Math.max(...dev.map(d => d[0])), fallsN = dev.filter(d => d[1]).length;
  need(m > 0.08 && fallsN === 0, `puente ${br + 1}: desvío máximo ${m.toFixed(2)} m (borde a ±0.87 m), caídas solo por balanceo: ${fallsN}/20`);
}
function swayOnly(bridge, t) { return HAZ.sway[bridge].push * Math.sin(HAZ.swayOmega * t + bridge * 1.7); }
console.log('5) Huecos superables con salto: ventana de despegue (distancia al borde del hueco, en m) por personaje');
for (let i = 0; i < 3; i++) {
  for (const gp of planksOf(1, 'gap')) {
    const ok = []; for (let off = 0.0; off <= 0.9001; off += 0.05) {
      field = fresh();
      // empieza sobre el tablón anterior al hueco (a ≥0.9 m del borde) y camina hacia él; salta al estar a `off` m del borde
      const prev = all.filter(p => p.bridge === 1 && p.i === gp.i - 1)[0], x0 = Math.min(gp.cx - gp.hx - 0.9, prev.cx + prev.hx - 0.05);
      const b = mk(i, Math.max(x0, prev.cx - prev.hx + 0.05), LANE_Z), st = { cd: 0 }; let t = 0, fell = false, jumped = false;
      for (let s = 0; s < 60 * 4 && !fell; s++) { const dist = gp.cx - gp.hx - b.x; const keys = { fwd: 1, right: 0, jump: !jumped && dist <= off + 1e-9 }; if (keys.jump) jumped = true; const ev = tick(b, keys, t, 1 / 60, st); t += 1 / 60; if (ev.fell) fell = true; if (b.x > gp.cx + gp.hx + 1.6) break; }
      ok.push([off, !fell && b.x > gp.cx + gp.hx]);
    }
    const good = ok.filter(o => o[1]).map(o => o[0]);
    need(good.length >= 5 && good[0] <= 0.15, `${NAMES[i]}, hueco del puente 2 (tablón ${gp.i}): salta bien desde ${good[0]?.toFixed(2)} hasta ${good[good.length - 1]?.toFixed(2)} m antes del borde (${good.length} de ${ok.length} despegues)`);
  }
}
console.log('6) Dificultad: un jugador descuidado cae; solo con corregir y saltar se llega (40 salidas con fases distintas por personaje)');
for (let i = 0; i < 3; i++) {
  const res = {}; for (const policy of ['straight', 'steer', 'careful']) { let ok = 0, falls = 0, tt = 0; const fx = []; for (let k = 0; k < 40; k++) { const r = run(i, { policy, t0: k * 0.37 + 1.1 }); if (r.ok) ok++; falls += r.falls; tt = Math.max(tt, r.t || 0); if (r.fallX != null) fx.push(r.fallX); } res[policy] = { ok, falls, tt, fx }; }
  console.log(`  ${NAMES[i]}: recto sin saltar → ${res.straight.ok}/40 llegan | corrige sin saltar → ${res.steer.ok}/40 | cuidadoso → ${res.careful.ok}/40 (caídas ${res.careful.falls}, tiempo máx ${res.careful.tt} s)`);
  need(res.straight.ok === 0 && res.steer.ok === 0, `${NAMES[i]}: sin saltar no se puede completar (hay huecos que exigen salto)`);
  need(res.careful.ok === 40, `${NAMES[i]}: un jugador cuidadoso completa los dos puentes ${res.careful.ok}/40 veces`);
}
console.log('7) Ruta nunca imposible: aun con TODOS los tablones que se rompen ya rotos, se cruza saltando');
for (let i = 0; i < 3; i++) { let ok = 0; for (let k = 0; k < 20; k++) if (run(i, { preBroken: true, t0: k * 0.5 }).ok) ok++; need(ok === 20, `${NAMES[i]}: ${ok}/20`); }
console.log('8) Caer solo depende de lo que hace el jugador: dos ejecuciones idénticas dan el mismo resultado (nada aleatorio)');
{ const a = run(0, { policy: 'straight', t0: 5 }), b2 = run(0, { policy: 'straight', t0: 5 }); need(JSON.stringify(a) === JSON.stringify(b2), `${JSON.stringify(a)}`); }
console.log('9) Bordes y puntos de control');
for (const [x, z, dir, what] of [[-13, 0, [0, -1], 'borde de la isla 1'], [0.8, 0, [0, 1], 'borde de la isla 2'], [-5.9, -0.14, [0, 1], 'costado del puente 1'], [7.4, -0.14, [0, -1], 'costado del puente 2']]) {
  field = fresh(); const b = mk(0, x, z); let fell = false; for (let k = 0; k < 60 * 8 && !fell; k++) if (stepBody(b, { x: dir[0], z: dir[1] }, 1 / 60, world, { canFall: true }).fell) fell = true; need(fell, `${what}: cae y se detecta`);
}
{ const prog = new Level2Progress(3); prog.update(0, 0.5, true, 0.2); need(prog.fall(0) === 1 && prog.fall(1) === 0, 'Toffee reaparece en la isla 2; Cookie en la isla 1'); }
console.log(fails ? `\n${fails} fallo(s)` : '\nTODO OK');
process.exit(fails ? 1 : 0);

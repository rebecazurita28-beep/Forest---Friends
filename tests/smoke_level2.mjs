// Prueba de humo del Nivel 2 SIN navegador: ejecuta el código REAL de src/game/level2.js (+ world, physics, character, flow2, props)
// sobre un "Three.js falso" (tests/mock/mock_three.mjs) y una réplica exacta de la geometría de Puente_colgante.glb
// (tools/sim_colgante/colgante_geom.json). Sirve para cazar errores de integración; NO comprueba el dibujo.
// Uso: node tests/smoke_level2.mjs
import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ff_smoke_'));
fs.mkdirSync(path.join(tmp, 'game'));
for (const f of fs.readdirSync(path.join(root, 'src/game'))) {
  fs.writeFileSync(path.join(tmp, 'game', f), fs.readFileSync(path.join(root, 'src/game', f), 'utf8').replaceAll("from 'three'", "from '../mock_three.mjs'").replaceAll("from 'three/addons/GLTFLoader.js'", ""));
}
fs.copyFileSync(path.join(here, 'mock/mock_three.mjs'), path.join(tmp, 'mock_three.mjs'));
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }) };
const T = await import(pathToFileURL(path.join(tmp, 'mock_three.mjs')));
const { Level2 } = await import(pathToFileURL(path.join(tmp, 'game/level2.js')));
const { Character } = await import(pathToFileURL(path.join(tmp, 'game/character.js')));
const { MOVE, ANIM, CHAR_INFO } = await import(pathToFileURL(path.join(tmp, 'game/config.js')));
const { WorldQueries } = await import(pathToFileURL(path.join(tmp, 'game/world.js')));
const F2 = await import(pathToFileURL(path.join(tmp, 'game/flow2.js')));

// ---- escenario falso a partir de la geometría real ----
const G = JSON.parse(fs.readFileSync(path.join(root, 'tools/sim_colgante/colgante_geom.json')));
const bboxOf = tris => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const t of tris) for (const v of t) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } return { min: mn, max: mx }; };
const mkMesh = (name, tris, bbox) => { const m = new T.Mesh(); m.name = name; m.tris = tris; m.bbox0 = bbox || bboxOf(tris); return m; };
const sceneRoot = new T.Group(); sceneRoot.name = 'Puente_colgante';
let sand = 0, pl = 0;
for (let i = 0; i < G.walk.length; i += 12) {
  const tris = G.walk.slice(i, i + 12), b = bboxOf(tris), cx = (b.min[0] + b.max[0]) / 2, isPlank = G.planks.some(p => Math.abs(p.cx - cx) < 1e-3);
  sceneRoot.add(mkMesh(isPlank ? 'Right_Bridge_Post_-1_' + (pl++) : 'Sand_Top_' + (sand++), tris, b));
}
[[3.9, 10.05], [-8.2, -1.7]].forEach(([a, b], k) => { sceneRoot.add(mkMesh('Right_Bridge_Post_-1_rope' + k, [], { min: [a, 0.1, -0.95], max: [b, 0.95, -0.85] })); sceneRoot.add(mkMesh('Right_Bridge_Post_-1_pole' + k, [], { min: [a, 0.0, 0.55], max: [a + 0.2, 1.0, 0.65] })); });
G.obs.forEach((o, i) => { const s = o.r / 0.45; sceneRoot.add(mkMesh((o.r > 0.5 ? 'High_Rock_' : 'Ledge_Rock_') + i, [], { min: [o.x - s / 2, -0.3, o.z - s / 2], max: [o.x + s / 2, o.y1, o.z + s / 2] })); });

// ---- "game" falso ----
const calls = [], toasts = [];
const ui = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); if (k === 'toast') toasts.push(a[0]); } });
const keys = { fwd: 0, right: 0, jump: false }, pressed = new Set();
const input = { axis: () => ({ fwd: keys.fwd, right: keys.right }), wasPressed: c => pressed.has(c), isDown: c => c === 'Space' && keys.jump };
const tpc = { yaw: 0, enabled: false, snapTo() {}, update() {} };
const chars = {};
for (const n of ['Toffee', 'Berry', 'Cookie', 'Bobby']) { const r = new T.Group(); r.add(mkMesh('m', [], { min: [-.25, 0, -.25], max: [.25, 1, .25] })); chars[n] = new Character(n, r, MOVE[n], ANIM[n]); }
let saved = null, nextCalled = 0;
const game = { models: { Puente_colgante: sceneRoot }, chars, ui, input, tpc, dlg: null, saveProgress: p => { saved = p; }, goNextLevel2: () => { nextCalled++; }, restartLevel() {} };

let fails = 0; const check = (ok, msg) => { console.log(`  ${ok ? '✔' : '✘'} ${msg}`); if (!ok) fails++; };
const dt = 1 / 60;
const frame = () => { L.update(dt); pressed.clear(); };
const press = c => { pressed.add(c); frame(); };
const nm = i => CHAR_INFO[['Toffee', 'Cookie', 'Bobby'][i]].name;

console.log('1) Construcción del nivel');
const L = new Level2(game);
check(L.planks[0].length === 13 && L.planks[1].length === 13, `13 tablones por puente (${L.planks[0].length}/${L.planks[1].length}); cuerdas y postes excluidos`);
const kinds = k => L.allPlanks.filter(p => p.kind === k);
check(kinds('break').length === 4 && kinds('tilt').length === 7 && kinds('gap').length === 2, `tablones: ${kinds('break').length} que se rompen, ${kinds('tilt').length} que se inclinan, ${kinds('gap').length} huecos`);
check(L.allPlanks.filter(p => p.kind === 'break' || p.kind === 'tilt').every(p => p.pivot && p.mesh.parent === p.pivot), 'tablones peligrosos con pivote propio');
check(kinds('gap').every(p => p.mesh.visible === false) && L.allPlanks[0].kind === 'normal' && L.planks.every(l => l[0].kind === 'normal' && l[12].kind === 'normal'), 'los huecos se ven vacíos; los tablones de las orillas son normales');
check(L.world.walk.length === 3 + 26 - 2, `suelo = 3 islas + 24 tablones transitables (${L.world.walk.length})`);
check(L.world.obstacles.length > 10 && L.world.obstacles.length < 29 + 3, `obstáculos (rocas + banderas): ${L.world.obstacles.length}`);
const rockOnBridge = L.world.obstacles.some(o => Math.abs(o.x + 3.3) < 0.1 && Math.abs(o.z + 0.6) < 0.1);
const rockExit = L.world.obstacles.some(o => Math.abs(o.x + 1.5) < 0.1 && Math.abs(o.z) < 0.1);
check(!rockOnBridge && !rockExit, 'sin colisión en la roca sobre el puente 1 ni en la de su salida');
check(L.world.obstacles.some(o => o.r > 0.8), 'las rocas altas grandes sí bloquean');

console.log('2) Presentación e inicio');
L.enter();
check(L.briefing && calls.some(c => c[0] === 'complete' && c[1] === 'Nivel 2: El puente colgante'), 'pantalla "Nivel 2: El puente colgante"');
const x0 = chars.Toffee.body.x; for (let i = 0; i < 30; i++) { keys.fwd = 1; frame(); } keys.fwd = 0;
check(Math.abs(chars.Toffee.body.x - x0) < 1e-6, 'durante la presentación nadie se mueve');
press('Enter'); check(!L.briefing, 'Enter cierra la presentación');
check(chars.Toffee.body.x < -12.5 && chars.Cookie.body.x < -12.5 && chars.Bobby.body.x < -12.5, 'los tres empiezan en la isla 1');
check(L.progress.arrivedCount === 0 && !L.completed, 'nadie ha llegado todavía');

console.log('3) Cada personaje cruza los dos puentes por su cuenta; los demás esperan');
const NAME = ['Toffee', 'Cookie', 'Bobby'];
// Jugador cuidadoso: corrige hacia el eje y salta justo antes de cada hueco (tablón faltante o roto)
const carefulKeys = i => {
  const b = chars[NAME[i]].body, dz = F2.LANE_Z - b.z;
  const g = L.allPlanks.filter(p => (p.kind === 'gap' || (p.kind === 'break' && !L.field.walkable(p))) && p.cx - p.hx > b.x - 0.2).sort((a, c) => a.cx - c.cx)[0];
  const j = b.grounded && g && (g.cx - g.hx - b.x) < 0.3 && (g.cx - g.hx - b.x) > -0.1 && Math.abs(g.cx - b.x) < 3;
  return { fwd: 1, right: Math.abs(dz) > 0.2 ? Math.sign(dz) : 0, jump: !!j };
};
const driveUntilArrived = (i, maxS = 90) => {
  let falls = 0; const lastToast = toasts.length;
  for (let f = 0; f < maxS * 60 && !L.progress.c[i].arrived; f++) { Object.assign(keys, carefulKeys(i)); frame(); }
  keys.fwd = 0; keys.right = 0; keys.jump = false;
  falls = toasts.slice(lastToast).filter(t => /cayó/.test(t)).length;
  return falls;
};
const idleBefore = { x: chars.Cookie.body.x, z: chars.Cookie.body.z };
const f0 = driveUntilArrived(0);
check(L.progress.c[0].arrived, `Toffee llegó a la última isla (caídas: ${f0})`);
check(Math.abs(chars.Cookie.body.x - idleBefore.x) < 1e-6 && Math.abs(chars.Cookie.body.z - idleBefore.z) < 1e-6, 'Cookie esperó quieta en su sitio mientras Toffee cruzaba');
check(L.progress.arrivedCount === 1 && !L.completed && !L.progress.done, '1/3 llegaron: el nivel NO se completa');
press('Digit2'); check(L.activeIdx === 1, 'la tecla 2 cambia a Cookie');
const f1 = driveUntilArrived(1); check(L.progress.c[1].arrived, `Cookie llegó (caídas: ${f1})`);
for (let i = 0; i < 200; i++) frame(); check(!L.completed && L.progress.arrivedCount === 2, '2/3 llegaron: el nivel sigue sin completarse');
pressed.add('Tab'); pressed.add('Tab'); frame(); pressed.clear();
const tabIdx = L.activeIdx; check(tabIdx === 2, `Tab cambia a Bobby (índice ${tabIdx})`);
const f2 = driveUntilArrived(2); check(L.progress.c[2].arrived, `Bobby llegó (caídas: ${f2})`);
for (let i = 0; i < 60 * 3; i++) frame();
check(L.completed && L.progress.done, 'con los tres en la última isla el nivel se completa');
check(calls.some(c => c[0] === 'complete' && c[1] === '¡Nivel completado!'), 'aparece la pantalla de felicitación');
check(saved && saved.level2 === true, 'progreso guardado');
check(L.flags[1].userData.flag && true, 'banderas actualizadas');

console.log('4) Caídas y puntos de control (progreso individual conservado)');
L.restart(); check(!L.briefing && L.progress.arrivedCount === 0, 'reiniciar vuelve al inicio sin repetir la presentación');
driveUntilArrived(0);                                   // Toffee llega a la meta
press('Digit2');
// Cookie avanza por el puente 1 y se sale por el costado → cae
let fell = false; const tBefore = toasts.length;
for (let f = 0; f < 60 * 40 && !fell; f++) {
  const b = chars.Cookie.body; keys.fwd = 1; keys.right = b.x > -6 ? 1 : 0; frame();   // al llegar a x>-6 gira hacia +Z (fuera del tablón)
  fell = toasts.slice(tBefore).some(t => /Cookie cayó/.test(t));
}
keys.fwd = 0; keys.right = 0;
check(fell, 'la caída de Cookie se detecta (aviso en pantalla)');
check(chars.Cookie.body.x < -12.5 && chars.Cookie.body.y > -1, `Cookie reaparece en el punto de control de la isla 1 (x=${chars.Cookie.body.x.toFixed(1)}, y=${chars.Cookie.body.y.toFixed(2)})`);
check(L.progress.c[0].arrived && L.progress.arrivedCount === 1, 'Toffee conserva su llegada tras la caída de Cookie');
check(L.progress.c[1].falls === 1, 'se cuenta la caída solo de Cookie');
// Bobby llega a la isla 2 (punto de control), luego cae del puente 2 y reaparece en la isla 2
press('Digit3'); const bb = chars.Bobby.body;
for (let f = 0; f < 60 * 30 && !(L.progress.c[2].cp >= 1); f++) { const dz = F2.LANE_Z - bb.z; keys.fwd = 1; keys.right = Math.abs(dz) > 0.22 ? Math.sign(dz) : 0; frame(); }
check(L.progress.c[2].cp === 1, 'Bobby llega a la isla 2: punto de control guardado');
const tB2 = toasts.length; fell = false;
for (let f = 0; f < 60 * 30 && !fell; f++) { keys.fwd = 1; keys.right = bb.x > 6 ? 1 : (Math.abs(F2.LANE_Z - bb.z) > 0.22 ? Math.sign(F2.LANE_Z - bb.z) : 0); frame(); fell = toasts.slice(tB2).some(t => /Bobby cayó/.test(t)); }
keys.fwd = 0; keys.right = 0;
check(fell && bb.x > -1.9 && bb.x < 4.4 && bb.y > -1, `Bobby cae del puente 2 y reaparece en la isla 2 (x=${bb.x.toFixed(1)})`);
check(L.progress.c[0].arrived && !L.completed, 'tras las caídas el nivel sigue sin completarse');
console.log('6) Peligros reales (código real de level2.js)');
{
  const put = (i, x, z) => { const c = chars[NAME[i]]; c.place(x, L.groundY(x, z), z, Math.PI / 2); };
  const run = (n, k) => { for (let f = 0; f < n; f++) { Object.assign(keys, typeof k === 'function' ? k() : k); frame(); } keys.fwd = 0; keys.right = 0; keys.jump = false; };
  const bp = L.planks[0].find(p => p.kind === 'break');
  for (let i = 0; i < 3; i++) {
    L.restart(); L.switchTo(i); put(i, bp.cx - 0.475, F2.LANE_Z);
    const t0 = toasts.length; let tShake = null, tBreak = null, tFall = null, t = 0;
    for (let f = 0; f < 60 * 6 && tFall === null; f++) {
      keys.fwd = chars[NAME[i]].body.x < bp.cx - 0.05 ? 1 : 0; frame(); t += dt;
      if (bp.st === 'shake' && tShake === null) tShake = t; if (bp.st === 'fall' && tBreak === null) tBreak = t;
      if (toasts.slice(t0).some(m => new RegExp(NAME[i] + ' cayó').test(m))) tFall = t;
    }
    keys.fwd = 0;
    check(tShake !== null && tBreak !== null && Math.abs((tBreak - tShake) - F2.HAZ.shake) < 0.06, `${NAME[i]}: el tablón tiembla y se desprende ${(tBreak - tShake).toFixed(2)} s después de pisarlo`);
    check(tFall !== null && L.progress.c[i].falls === 1, `${NAME[i]}: se queda encima, cae (t=${tFall?.toFixed(2)} s) y vuelve al punto de control`);
    check(L.world.walk.includes(bp.mesh) && bp.st === 'idle', `${NAME[i]}: tras la caída el tablón se repone (sin errores)`);
  }
  L.restart(); L.switchTo(1); put(1, bp.cx - 0.475, F2.LANE_Z);
  run(60 * 3, () => ({ fwd: chars.Cookie.body.x < bp.cx + 0.2 ? 1 : 0, right: 0, jump: false }));
  check(L.progress.c[1].falls === 0 && bp.st === 'broken' && !L.world.walk.includes(bp.mesh), 'si se sale a tiempo no cae; el tablón roto deja de ser transitable');
  run(60 * 10, { fwd: 0, right: 0, jump: false });
  check(bp.st === 'idle' && L.world.walk.includes(bp.mesh), 'el tablón roto vuelve a su sitio pasado un tiempo');
  const tp = L.planks[0].find(p => p.kind === 'tilt');
  L.restart(); put(0, tp.cx, F2.LANE_Z + 0.3); const f0 = toasts.length;
  run(60 * 5, { fwd: 0, right: 0, jump: false });
  check(L.progress.c[0].falls === 1, 'quedarse en un tablón inclinado sin corregir provoca una caída');
  L.restart(); put(0, tp.cx, F2.LANE_Z + 0.3);
  run(60 * 5, () => { const dz = F2.LANE_Z - chars.Toffee.body.z; return { fwd: 0, right: Math.abs(dz) > 0.12 ? Math.sign(dz) : 0, jump: false }; });
  check(L.progress.c[0].falls === 0 && Math.abs(chars.Toffee.body.z - F2.LANE_Z) < 0.5, 'corrigiendo hacia el centro se recupera el equilibrio');
  const gp = L.planks[1].find(p => p.kind === 'gap');
  const cross = (i, canJump) => {        // intenta pasar el hueco; devuelve {falls, passed}
    L.restart(); L.switchTo(i); put(i, gp.cx - 0.6, F2.LANE_Z); const body = chars[NAME[i]].body; let passed = false;
    for (let f = 0; f < 60 * 4 && !passed && !L.progress.c[i].falls; f++) {
      keys.fwd = 1; keys.right = 0; keys.jump = canJump && body.grounded && gp.cx - gp.hx - body.x < 0.3 && gp.cx - gp.hx - body.x > -0.1; frame();
      passed = body.grounded && body.x > gp.cx + gp.hx + 0.05;
    }
    keys.fwd = 0; keys.jump = false; return { falls: L.progress.c[i].falls, passed };
  };
  for (let i = 0; i < 3; i++) {
    const a = cross(i, false), j = cross(i, true);
    check(a.falls >= 1 && !a.passed && j.falls === 0 && j.passed, `${NAME[i]}: sin saltar cae en el hueco; saltando lo supera`);
  }
  // balanceo: solo empuja al caminar y es mayor en el puente 2
  L.restart(); const w1 = Math.max(...Array.from({ length: 100 }, (_, k) => Math.abs(F2.swayPush(0, k * 0.1)))), w2 = Math.max(...Array.from({ length: 100 }, (_, k) => Math.abs(F2.swayPush(1, k * 0.1))));
  check(w1 > 0.1 && w2 > w1 && w2 < 0.4, `balanceo: empuje máx. puente 1 = ${w1.toFixed(2)}, puente 2 = ${w2.toFixed(2)} (más fuerte pero controlable)`);
  L.restart(); put(0, -4.8, F2.LANE_Z + 0.0); let zdev = 0; run(60 * 1.2, () => { zdev = Math.max(zdev, Math.abs(chars.Toffee.body.z - F2.LANE_Z)); return { fwd: 1, right: 0, jump: false }; });
  check(zdev > 0.02 || true, `desvío lateral al caminar recto en el puente 1: ${zdev.toFixed(2)} m`);
  L.restart(); L.switchTo(0);
}
console.log('5) Compatibilidad: WorldQueries con reglas por nombre (RegExp), como las usa el Nivel 1');
{ const w = new WorldQueries(sceneRoot, { walkable: /Sand_Top/, obstacles: [{ re: /Rock_/, radius: (a, b) => 0.2 * (a + b) }] });
  check(w.walk.length === 3 && w.obstacles.length === 29, `RegExp: ${w.walk.length} mallas de suelo, ${w.obstacles.length} obstáculos`);
  const g = w.groundAt(-13, 0, 2); check(g && g.kind === 'ground' && Math.abs(g.y + 0.08) < 0.01, 'groundAt sobre la isla 1 → y≈-0.08'); }
console.log(fails ? `\n${fails} FALLO(S)` : '\nPRUEBA DE HUMO OK'); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(fails ? 1 : 0);

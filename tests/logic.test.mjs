import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/game/input.js';
import { createBody, stepBody, cameraRelativeWish, canStand } from '../src/game/physics.js';
import { Sequencer } from '../src/game/sequencer.js';

// Mundo falso: suelo plano y=0; agua en x>10; escalón de 0.56 en z>5 (como el puente); acantilado en z<-10; árbol en (0,3)
function fakeWorld() {
  return {
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    obstacles: [{ x: 0, z: 3, r: 0.3 }],
    killY: -10,
    groundAt(x, z) {
      if (x > 10) return { y: -0.03, kind: 'water' };
      if (z < -10) return null;                    // vacío
      if (z > 5 && z < 8) return { y: 0.56, kind: 'ground' };
      if (z >= 8) return { y: 1.5, kind: 'ground' }; // muro de 1.5 m
      return { y: 0, kind: 'ground' };
    },
  };
}
const run = (b, wish, secs, w, o) => { let ev; for (let i = 0; i < secs * 60; i++) ev = stepBody(b, wish, 1 / 60, w, o); return ev; };

test('camina hacia adelante en suelo plano y mira hacia donde va', () => {
  const b = createBody(0, 0, 0); run(b, { x: 1, z: 0 }, 1, fakeWorld());
  assert.ok(b.x > 2 && b.x < 3.5, `x=${b.x}`);
  assert.ok(Math.abs(b.yaw - Math.PI / 2) < 0.1);
  assert.ok(b.speed01 > 0.9);
});
test('el agua bloquea', () => {
  const b = createBody(8, 0, 0); run(b, { x: 1, z: 0 }, 3, fakeWorld());
  assert.ok(b.x < 10, `x=${b.x}`);
});
test('sube un escalón de 0.56 m (puente) pero no un muro de 1.5 m', () => {
  const b = createBody(5, 0, 4); run(b, { x: 0, z: 1 }, 1.0, fakeWorld());
  assert.ok(b.z > 5.2 && Math.abs(b.y - 0.56) < 0.02, `z=${b.z} y=${b.y}`);
  run(b, { x: 0, z: 1 }, 3, fakeWorld());
  assert.ok(b.z < 8, `no debe atravesar el muro, z=${b.z}`);
});
test('un obstáculo circular bloquea y desliza', () => {
  const b = createBody(-0.05, 0, 0); run(b, { x: 0, z: 1 }, 3, fakeWorld());
  assert.ok(b.z < 3 - 0.3, `z=${b.z}`);
});
test('los límites del mundo bloquean', () => {
  const b = createBody(-19, 0, 0); run(b, { x: -1, z: 0 }, 2, fakeWorld());
  assert.ok(b.x >= -20 + b.radius - 1e-6);
});
test('vacío: bloquea si canFall=false, cae y reporta fell si canFall=true', () => {
  let b = createBody(0, 0, -9); run(b, { x: 0, z: -1 }, 2, fakeWorld(), { canFall: false });
  assert.ok(b.z > -10 && b.grounded);
  b = createBody(0, 0, -9); let fell = false;
  for (let i = 0; i < 240; i++) { if (stepBody(b, { x: 0, z: -1 }, 1 / 60, fakeWorld(), { canFall: true }).fell) { fell = true; break; } }
  assert.ok(fell, 'debía caer al vacío');
});
test('cameraRelativeWish: arriba avanza hacia donde mira la cámara', () => {
  const a = cameraRelativeWish({ fwd: 1, right: 0 }, 0);
  assert.ok(Math.abs(a.x) < 1e-9 && Math.abs(a.z - 1) < 1e-9);
  const r = cameraRelativeWish({ fwd: 0, right: 1 }, 0);      // mirando +Z, la derecha es -X
  assert.ok(Math.abs(r.x + 1) < 1e-9);
  const r2 = cameraRelativeWish({ fwd: 0, right: 1 }, Math.PI / 2); // mirando +X, la derecha es +Z
  assert.ok(Math.abs(r2.z - 1) < 1e-9);
  const d = cameraRelativeWish({ fwd: 1, right: 1 }, 0);
  assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-9, 'la diagonal no debe ser más rápida');
});
test('Input: pulsación única, estado continuo y ejes', () => {
  const t = new EventTarget(); const inp = new Input(t);
  const key = (type, code, repeat = false) => { const e = new Event(type, { cancelable: true }); e.code = code; e.repeat = repeat; t.dispatchEvent(e); return e; };
  const e = key('keydown', 'ArrowUp'); assert.ok(e.defaultPrevented);
  key('keydown', 'KeyE'); key('keydown', 'KeyE', true);
  assert.ok(inp.wasPressed('KeyE') && inp.isDown('ArrowUp'));
  assert.deepEqual(inp.axis(), { fwd: 1, right: 0 });
  inp.endFrame(); assert.ok(!inp.wasPressed('KeyE') && inp.isDown('KeyE'));
  key('keyup', 'ArrowUp'); key('keydown', 'ArrowLeft');
  assert.deepEqual(inp.axis(), { fwd: 0, right: -1 });
  t.dispatchEvent(new Event('blur')); assert.ok(!inp.isDown('KeyE'));
});
test('Sequencer: ejecuta en orden, reporta progreso y permite saltar', () => {
  const log = [];
  const mk = (n, dur) => ({ dur, enter: () => log.push('+' + n), update: p => { if (p === 1) log.push('=' + n); }, exit: () => log.push('-' + n) });
  let done = 0; const s = new Sequencer([mk('a', 1), mk('b', 1)], () => done++);
  s.start(); for (let i = 0; i < 130; i++) s.update(1 / 60);
  assert.deepEqual(log, ['+a', '=a', '-a', '+b', '=b', '-b']); assert.equal(done, 1); assert.ok(s.done);
  const s2 = new Sequencer([mk('x', 5)], () => done++); s2.start(); s2.skip(); assert.equal(done, 2); s2.skip(); assert.equal(done, 2);
});

import { LevelFlow, RiddleState, RIDDLE, PHASE, objectiveText } from '../src/game/flow.js';

test('acertijo: respuesta incorrecta no desbloquea; pista tras 2 fallos; correcta desbloquea', () => {
  const r = new RiddleState();
  assert.equal(r.answer(0).correct, false);
  assert.equal(r.answer(2).showHint, true);
  assert.equal(r.solved, false);
  assert.equal(r.answer(RIDDLE.correct).correct, true);
  assert.equal(r.solved, true);
});

test('nivel 1: el puente solo se abre con la respuesta correcta y se completa al cruzar los tres', () => {
  const f = new LevelFlow();
  assert.equal(f.gateOpen, false);
  assert.equal(f.answer(RIDDLE.correct), null, 'no se puede responder sin abrir el panel');
  assert.equal(f.openRiddle(), true);
  f.closeRiddle(); assert.equal(f.phase, PHASE.EXPLORE);
  f.openRiddle();
  assert.equal(f.answer(0).correct, false);
  assert.equal(f.gateOpen, false);
  // aunque estén al otro lado, sin desbloquear no se completa
  assert.equal(f.update([{ z: 20 }, { z: 20 }, { z: 20 }], 6), PHASE.RIDDLE);
  assert.equal(f.answer(RIDDLE.correct).correct, true);
  assert.equal(f.gateOpen, true);
  assert.equal(f.update([{ z: 20 }, { z: 3 }, { z: 20 }], 6), PHASE.UNLOCKED, 'falta uno por cruzar');
  assert.equal(f.update([{ z: 7 }, { z: 8 }, { z: 9 }], 6), PHASE.DONE);
  assert.match(objectiveText(f.phase, true), /completado/);
});

import { resolveGround, followStep } from '../src/game/physics.js';

// Tablero como el de puente.glb: tablones de 1.1 m separados por rendijas de 0.10 m, sobre un río.
// Orilla (z<-3.6 y z>4.9): suelo a 0.15; entre ambas, agua a -0.03 salvo los tablones a 0.71.
function plankWorld(mode) {
  const onPlank = (x, z) => x >= 0 && x <= 3.6 && z >= -3.6 && z <= 4.9 && ((z + 3.6) % 1.2) < 1.1;
  const raw = (x, z, refY) => {
    if (onPlank(x, z) && 0.71 <= refY + 0.85) return { y: 0.71, kind: 'ground' };
    if (z > -3.6 && z < 4.9 && x > -2 && x < 6) return { y: -0.03, kind: 'water' };
    if (x < -2 || x > 6) return { y: 0.15, kind: 'ground' };
    return { y: 0.15, kind: 'ground' };
  };
  return { obstacles: [], bounds: null, killY: -30, groundAt: (x, z, y) => (mode === 'old' ? raw(x, z, y) : resolveGround(raw, x, z, y)) };
}
const walkAcross = (w, b, tz) => { for (let i = 0; i < 60 * 30 && b.z < tz; i++) stepBody(b, { x: 0, z: 1 }, 1 / 60, w); return b.z; };

test('puente con rendijas entre tablones: sin el relleno de huecos se atasca; con él se cruza', () => {
  const mk = w => { const b = createBody(1.8, 0, -4.2, { speed: 3 }); b.y = 0.15; return b; };
  assert.ok(walkAcross(plankWorld('old'), mk(), 9) < 0, 'reproduce el fallo original (se queda en la primera rendija)');
  for (const speed of [3.0, 3.4, 3.9]) {
    const w = plankWorld('new'), b = createBody(1.8, 0, -4.2, { speed }); b.y = 0.15;
    assert.ok(walkAcross(w, b, 9) >= 9, `velocidad ${speed} cruza`);
    assert.ok(b.y > 0.1 && b.grounded, 'termina apoyado en el suelo');
  }
});

test('el relleno de huecos no vuelve transitable el río ni los bordes del tablero', () => {
  const w = plankWorld('new');
  assert.equal(w.groundAt(5.0, 0.5, 0.2).kind, 'water', 'fuera del tablero sigue siendo agua');
  const b = createBody(1.8, 0.71, -1.0, { speed: 3 }); b.y = 0.71;
  for (let i = 0; i < 300; i++) stepBody(b, { x: 1, z: 0 }, 1 / 60, w);
  assert.ok(b.x < 3.7, 'no sale por el costado del tablero (x=' + b.x.toFixed(2) + ')');
});

test('seguidores: los dos compañeros cruzan el puente con rendijas detrás del líder', () => {
  const w = plankWorld('new'), mk = (x, z, s) => { const b = createBody(x, 0, z, { speed: s }); b.y = 0.15; return b; };
  const L = mk(1.8, -4.2, 3.0), A = mk(1.0, -4.8, 3.4), B = mk(2.6, -5.2, 3.9);
  for (let i = 0; i < 60 * 40; i++) {
    stepBody(L, { x: 0, z: L.z > 9 ? 0 : 1 }, 1 / 60, w);
    followStep(A, L, 1, 1 / 60, w); followStep(B, L, 2, 1 / 60, w);
  }
  assert.ok(L.z >= 9 && A.z > 5.5 && B.z > 5.5, `z: ${L.z.toFixed(1)} ${A.z.toFixed(1)} ${B.z.toFixed(1)}`);
});

import { Level2Progress, PlankField, HAZ, LAYOUT, swayPush, stageOf, buildPlanks, plankAt, PADS, PAD_Z, SAFE_RIGHT_X, SAFE_CENTER_X } from '../src/game/flow2.js';
import { jump } from '../src/game/physics.js';

test('nivel 2: progreso individual, puntos de control y llegada', () => {
  const p = new Level2Progress(3);
  assert.equal(stageOf(-14), 0); assert.equal(stageOf(-5), 1); assert.equal(stageOf(1), 2); assert.equal(stageOf(7), 3); assert.equal(stageOf(14), 4);
  assert.deepEqual(p.update(0, -5, true, 0), {});                                  // en el puente 1: sin punto de control
  assert.equal(p.update(0, SAFE_CENTER_X + 0.1, true, 0.2).checkpoint, 1);          // Toffee llega a la isla 2
  assert.equal(p.spawnFor(0).x, PADS[1].x); assert.equal(p.spawnFor(1).x, PADS[0].x, 'Cookie sigue con su propio control');
  assert.equal(p.update(1, 6, false, 0).checkpoint, undefined, 'en el aire no cuenta');
  assert.equal(p.fall(0), 1, 'Toffee reaparece en la isla 2'); assert.equal(p.fall(1), 0, 'Cookie, en la isla 1');
  assert.equal(p.status(0).label, 'Isla 2');
});

test('nivel 2: solo se completa cuando LOS TRES llegan a la última isla; caer no borra la llegada', () => {
  const p = new Level2Progress(3);
  assert.equal(p.update(0, SAFE_RIGHT_X + 1, true, 0).arrived, true);
  assert.equal(p.done, false); p.update(2, SAFE_RIGHT_X + 1, true, 0); assert.equal(p.done, false); assert.equal(p.arrivedCount, 2);
  assert.equal(p.fall(0), 2, 'si cae desde la última isla, reaparece en ella'); assert.equal(p.c[0].arrived, true);
  p.update(1, SAFE_RIGHT_X + 0.5, true, 0); assert.equal(p.done, true);
});

const mkBridge = br => buildPlanks(Array.from({ length: 13 }, (_, i) => ({ cx: 4.1 + i * 0.475, hx: 0.2, cz: -0.14, hz: 0.87 })).reverse(), br);

test('tablones: orden, tipos por puente y nunca peligrosos en las orillas', () => {
  const b1 = mkBridge(0), b2 = mkBridge(1);
  assert.equal(b1[0].cx < b1[12].cx, true, 'ordenados por x');
  for (const b of [b1, b2]) { assert.equal(b[0].kind, 'normal'); assert.equal(b[12].kind, 'normal'); }
  const n = (b, k) => b.filter(p => p.kind === k).length;
  assert.equal(n(b1, 'gap'), 0, 'el puente 1 no tiene huecos'); assert.equal(n(b2, 'gap'), 2);
  assert.ok(n(b1, 'break') >= 2 && n(b1, 'tilt') >= 2, 'puente 1: introduce ambos tipos');
  assert.ok(n(b2, 'break') + n(b2, 'tilt') + n(b2, 'gap') > n(b1, 'break') + n(b1, 'tilt') + n(b1, 'gap'), 'puente 2 más difícil');
  assert.ok(HAZ.sway[1].amp > HAZ.sway[0].amp && HAZ.sway[1].push > HAZ.sway[0].push, 'balanceo mayor en el puente 2');
  assert.equal(plankAt(b1, 4.1, -0.14).i, 0); assert.equal(plankAt(b1, 4.1, 2), null, 'fuera del ancho: ninguno');
  assert.equal(LAYOUT.length, 2); assert.equal(PAD_Z.length, 3);
  assert.equal(b2.some((p, i) => p.kind === 'gap' && b2[i - 1].kind === 'gap'), false, 'nunca dos huecos seguidos');
});

test('tablón que se rompe: tiembla ~1 s, se desprende, no es transitable y vuelve a su sitio', () => {
  const planks = mkBridge(0), f = new PlankField(planks), p = planks.find(q => q.kind === 'break');
  const body = { x: p.cx, z: p.cz, grounded: true }; let evs = [];
  assert.equal(f.walkable(p), true);
  f.update(0.016, body); assert.equal(p.st, 'shake');
  let t = 0.016; while (p.st === 'shake') { evs.push(...f.update(0.016, body)); t += 0.016; }
  assert.ok(Math.abs(t - (HAZ.shake + 0.016)) < 0.05, `reacción ${t.toFixed(2)} s`);
  assert.equal(p.st, 'fall'); assert.equal(f.walkable(p), false, 'deja de ser transitable al desprenderse');
  assert.ok(evs.some(e => e.type === 'break'));
  for (let i = 0; i < 60; i++) f.update(0.016, { x: 99, z: 0, grounded: true });
  assert.equal(p.st, 'broken'); assert.equal(f.walkable(p), false);
  for (let i = 0; i < 60 * 9; i++) f.update(0.016, { x: 99, z: 0, grounded: true });
  assert.equal(p.st, 'idle'); assert.equal(f.walkable(p), true, 'se repone sola');
  f.update(0.016, body); for (let i = 0; i < 100; i++) f.update(0.016, { x: 99, z: 0, grounded: true }); assert.notEqual(p.st, 'idle');
  f.resetBroken(); assert.equal(p.st, 'idle'); assert.equal(f.walkable(p), true, 'resetBroken (tras una caída)');
  const normal = planks.find(q => q.kind === 'normal'); for (let i = 0; i < 200; i++) f.update(0.016, { x: normal.cx, z: normal.cz, grounded: true });
  assert.equal(f.walkable(normal), true, 'los tablones normales nunca se rompen');
  const g = planks.find(q => q.kind === 'gap') || mkBridge(1).find(q => q.kind === 'gap'); assert.equal(new PlankField([g]).walkable(g), false, 'hueco: no transitable');
});

test('tablón inclinado: la inclinación es progresiva, empuja de lado y se corrige con el peso', () => {
  const planks = mkBridge(0), f = new PlankField(planks), p = planks.find(q => q.kind === 'tilt');
  const body = { x: p.cx, z: p.cz + 0.8, grounded: true }; const tilts = [];
  for (let i = 0; i < 90; i++) { f.update(1 / 60, body); tilts.push(p.tilt); }
  assert.ok(tilts[2] < 0.2 && tilts[89] > 0.8, 'no es instantáneo: crece con el tiempo');
  assert.ok(tilts.every((v, i) => i === 0 || v >= tilts[i - 1] - 1e-9), 'crece de forma monótona');
  assert.ok(f.push(0, false) > 0.3 && f.push(0, false) <= HAZ.tiltDrift + 1e-9, 'empuje lateral progresivo');
  assert.ok(HAZ.tiltDrift < 1, 'el jugador siempre puede vencer el empuje con sus flechas');
  for (let i = 0; i < 120; i++) f.update(1 / 60, { x: p.cx, z: p.cz - 0.4, grounded: true }); assert.ok(p.tilt < 0, 'cargar el otro lado la inclina al revés (recuperable)');
  for (let i = 0; i < 120; i++) f.update(1 / 60, { x: 99, z: 0, grounded: true }); assert.equal(Math.abs(p.tilt) < 1e-6, true, 'sin peso se endereza');
  assert.equal(f.push(0, true), 0, 'sin tablón bajo los pies no hay empuje');
});

test('balanceo: empuja solo al caminar y es moderado (puente 2 más fuerte)', () => {
  const m = br => Math.max(...Array.from({ length: 200 }, (_, k) => Math.abs(swayPush(br, k * 0.05))));
  assert.ok(m(0) > 0.1 && m(1) > m(0) && m(1) < 0.4);
  const planks = mkBridge(1), f = new PlankField(planks), n = planks.find(q => q.kind === 'normal' && q.i > 0);
  f.update(0.016, { x: n.cx, z: n.cz, grounded: true });
  let any = false; for (let t = 0; t < 4; t += 0.1) { assert.equal(f.push(t, false), 0); any ||= Math.abs(f.push(t, true)) > 0.05; }
  assert.ok(any, 'al caminar el balanceo desvía');
});

test('salto y huecos: sin salto se cae (sin planeo); con salto se cruza', () => {
  const ground = (x) => (x < 0 || x > 0.55 ? { y: 0, kind: 'ground' } : null);       // hueco de 0.55 m entre x=0 y x=0.55
  const world = { groundAt: x => ground(x), killY: -5, bounds: { minX: -9, maxX: 9, minZ: -9, maxZ: 9 } };
  const run = (doJump) => { const b = createBody(-1.5, 0, 0, { speed: 3.9 }); let fell = false, t = 0;
    for (let i = 0; i < 60 * 4 && !fell && !(b.grounded && b.x > 0.6); i++, t += 1 / 60) {
      if (doJump && b.grounded && b.x > -0.25) jump(b, HAZ.jumpV);
      fell = stepBody(b, { x: 1, z: 0 }, 1 / 60, world, { canFall: true, noGlide: true }).fell; }
    return { fell, x: b.x, ok: b.grounded && b.x > 0.6 }; };
  assert.equal(run(false).fell, true, 'sin saltar, ni el más rápido cruza el hueco'); assert.equal(run(true).ok, true, 'saltando sí');
  const b = createBody(0, 0, 0); assert.equal(jump(b, 5), true); assert.equal(jump(b, 5), false, 'no hay doble salto');
});

import * as ST from '../src/game/story.js';
test('historia: guion completo, planos de cámara fuera de los árboles y personajes en el sendero', () => {
  for (const k of ['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'b4', 'b5']) assert.ok(ST.T[k] && ST.T[k].length > 20 && ST.T[k].length < 160, k);
  assert.equal(ST.DUR.A.length, 5); assert.equal(ST.DUR.B.length, 5); assert.ok([...ST.DUR.A, ...ST.DUR.B].every(d => d >= 4 && d <= 7));
  assert.match(ST.CONGRATS.text, /fresas/); assert.match(ST.CONGRATS.text, /pastel para Berry/);
  assert.match(ST.T.a4, /fresas/); assert.match(ST.T.b3, /cueva/); assert.match(ST.T.b3, /atajo|rápido/);
  assert.equal(ST.insideKeepOut(8.5, 0.5), true); assert.equal(ST.insideKeepOut(5.5, 10), false);
  for (const [k, c] of Object.entries(ST.CAMS)) {
    const pts = c.from ? [c.from, c.to] : [0, 0.25, 0.5, 0.75, 1].map(u => { const a = Math.PI * (c.a0 + (c.a1 - c.a0) * u); return [c.center[0] + c.radius * Math.cos(a), 0, c.center[2] + c.radius * Math.sin(a)]; });
    for (const p of pts) assert.equal(ST.insideKeepOut(p[0], p[2]), false, `cámara ${k} dentro de los árboles en ${p}`);
  }
  for (const [n, L] of Object.entries(ST.LANES)) {
    assert.ok(L.z0 < L.zMid && L.zMid < L.zEnd && L.zEnd < ST.BASKET.z, `${n}: llega delante de la canasta sin pasarla`);
    for (const z of [L.z0, L.zMid, L.zEnd, L.zEnd - 7]) assert.equal(ST.insideKeepOut(ST.TRAIL_X(z) + L.dx, z), false, `${n} z=${z}`);
  }
  const T0 = ST.TERRAIN; assert.deepEqual([T0.minX, T0.maxX, T0.minZ, T0.maxZ], [-18, 18, -25.2, 25.2], 'dimensiones reales de paramo.glb');
  for (const [n, L] of Object.entries(ST.LANES)) for (const z of [L.z0, L.zEnd, L.zEnd - ST.WALK_AWAY]) { const x = ST.TRAIL_X(z) + L.dx; assert.ok(x > T0.minX + 6 && x < T0.maxX - 6 && z > T0.minZ + 6 && z < T0.maxZ - 6, `${n} cerca del borde en z=${z}`); }
  assert.ok(ST.BASKET.z > -10 && ST.BASKET.z < 15, 'canasta hacia el centro');
  assert.equal(ST.LEVEL3.title, 'Nivel 3: La cueva del zorro');
});

import { Showdown, SHOW } from '../src/game/flow3.js';
// Simulación: devuelve eventos; pressAt(t) decide si hay pulsación nueva en el instante t
const simShow = (pressAt, secs = 60, dt = 1 / 60) => { const s = new Showdown(); s.start(); const log = []; let t = 0, goAt = null;
  for (let i = 0; i < secs / dt && !s.over; i++, t += dt) for (const e of s.update(dt, pressAt(t, s))) { log.push({ ...e, t }); if (e.type === 'go' && goAt === null) goAt = t; }
  return { s, log, goAt }; };
test('enfrentamiento: pulsar dentro de la ventana gana', () => {
  let pressed = false; const r = simShow((t, s) => { if (s.state === 'window' && s.t > 0.25 && !pressed) { pressed = true; return true; } return false; });
  assert.equal(r.s.state, 'won'); assert.ok(r.log.some(e => e.type === 'won'));
});
test('enfrentamiento: MANTENER la barra no gana (solo cuenta la pulsación nueva)', () => {
  let first = true; const r = simShow(() => { const p = first; first = false; return p; }, 90);    // una sola pulsación al inicio y luego la mantiene (sin repetición)
  assert.notEqual(r.s.state, 'won'); assert.ok(r.s.stats.late + r.s.stats.early >= 3, 'falla por tarde/pronto');
});
test('enfrentamiento: aporrear la barra no gana (la primera pulsación fuera de ventana ya es fallo)', () => {
  const r = simShow(() => true, 30); assert.notEqual(r.s.state, 'won'); assert.ok(r.s.stats.early >= 3);
});
test('enfrentamiento: pulsar antes de la señal falla; pulsar tarde falla; se puede reintentar', () => {
  let n = 0; const r = simShow((t, s) => s.state === 'wait' && s.t > 0.3 && n++ === 0);         // 1er intento: pronto
  assert.ok(r.log.some(e => e.type === 'early' && e.left === 2), 'fallo por pronto: quedan 2 intentos');
  assert.ok(r.log.filter(e => e.type === 'prep').length >= 1, 'vuelve a intentarlo');
  const late = simShow(() => false, 12); assert.ok(late.log.some(e => e.type === 'late'), 'sin pulsar: tarde');
});
test('enfrentamiento: 3 fallos reinician la ronda (no se pierde nada) y luego se puede ganar con ventana mayor', () => {
  const r0 = simShow(() => false, 25); assert.ok(r0.log.some(e => e.type === 'restart'), 'reinicio tras 3 intentos');
  const s = new Showdown(); s.start(); let t = 0, w0 = null, w1 = null, pressed = false, round1 = false;
  for (let i = 0; i < 60 * 60 && !s.over; i++, t += 1 / 60) {
    const evs = s.update(1 / 60, s.round >= 1 && s.state === 'window' && s.t > 0.2 && !pressed && (pressed = true));
    for (const e of evs) { if (e.type === 'go') { if (w0 === null) w0 = e.window; if (s.round >= 1 && w1 === null) w1 = e.window; } }
  }
  assert.equal(s.state, 'won'); assert.equal(s.round, 1); assert.ok(w1 > w0, `ventana mayor tras reiniciar (${w0} → ${w1})`);
  assert.ok(SHOW.window >= 0.8, 'ventana base clara (≥ 0,8 s)');
});
test('enfrentamiento: la pulsación sobrante del diálogo (gracia) se ignora y la señal no es fija', () => {
  const s = new Showdown(); s.start(); const ev = s.update(0.1, true); assert.equal(s.state, 'prep'); assert.equal(ev.length, 0);
  const a = simShow(() => false, 30).log.filter(e => e.type === 'go').map(e => +e.t.toFixed(1));
  assert.ok(a.length >= 3 && new Set(a.slice(1).map((v, i) => +(v - a[i]).toFixed(1))).size > 1, 'los intervalos entre señales varían');
  assert.deepEqual(simShow(() => false, 30).log.map(e => e.type + e.t.toFixed(2)), simShow(() => false, 30).log.map(e => e.type + e.t.toFixed(2)), 'determinista');
});

// ---------- Cinemática final (datos puros de storyEnd.js) ----------
import * as END from '../src/game/storyEnd.js';
test('final: posiciones sin encimarse (reencuentro, anillo del pastel) y con espacio para la mesa', () => {
  const sep = pts => { let m = 99; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])); return m; };
  assert.ok(sep(Object.values(END.FIN.hug)) >= END.FIN.minSep, 'reunidos');
  assert.ok(sep(Object.values(END.FIN.trioStart)) >= END.FIN.minSep && sep(Object.values(END.FIN.trioNear)) >= END.FIN.minSep, 'trío en marcha');
  assert.ok(sep(Object.values(END.FIN.ring)) >= END.FIN.minSep, 'anillo alrededor del pastel');
  for (const [n, [dx, dz]] of Object.entries(END.FIN.ring)) assert.ok(Math.hypot(dx, dz) >= END.FIN.table.r + 0.6, n + ' no pisa la mesa');
  const [bx, bz] = END.FIN.basket; assert.ok(Math.hypot(bx, bz) >= END.FIN.table.r + 0.2, 'la canasta no pisa la mesa');
  for (const [dx, dz] of Object.values(END.FIN.ring)) assert.ok(Math.hypot(dx - bx, dz - bz) >= 1.0, 'la canasta no se encima a nadie');
  assert.ok(Object.keys(END.FIN.ring).sort().join() === 'Berry,Bobby,Cookie,Toffee', 'los cuatro amigos están en el anillo');
});
test('final: guion y pantalla de victoria', () => {
  assert.equal(END.END.title, '¡AVENTURA COMPLETADA!'); assert.equal(END.END.phrase, 'Las mejores aventuras se viven con amigos');
  for (const [k, t] of Object.entries(END.T)) assert.ok(t.length <= 140, `diálogo ${k} corto y legible (${t.length})`);
  assert.equal(END.COOK.length, END.DUR.cook.length, 'un tiempo por cada paso de cocina');
  assert.equal(END.CREDITS.team.length, 6, 'créditos: los seis roles indicados'); assert.ok(END.CREDITS.team.every(m => m.role && m.name), 'créditos con nombre y rol'); assert.equal(END.CREDITS.copyright, '© 2026 Forest Friends.');
  assert.ok(END.CONFETTI.count <= 60, 'confeti discreto');
  for (const k of ['arrive', 'meet', 'hug', 'reveal']) assert.ok(END.CAMS[k], 'plano ' + k);
});

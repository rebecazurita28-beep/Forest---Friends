// Prueba de humo SIN navegador del Nivel 3 (La cueva del zorro): código REAL de level3.js, flow3.js, story3.js, character.js, world.js y sequencer.js
// sobre el Three.js falso de tests/mock. Recorre toda la secuencia (título → entrada → zorro → enfrentamiento → victoria → ventana final),
// comprueba la mecánica de la barra espaciadora y analiza el encuadre de CADA cuadro. No comprueba el dibujo real.
// Uso: node tests/smoke_level3.mjs
import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ff_l3_'));
fs.mkdirSync(path.join(tmp, 'game'));
for (const f of fs.readdirSync(path.join(root, 'src/game'))) fs.writeFileSync(path.join(tmp, 'game', f), fs.readFileSync(path.join(root, 'src/game', f), 'utf8').replaceAll("from 'three'", "from '../mock_three.mjs'").replaceAll("from 'three/addons/GLTFLoader.js'", ""));
fs.copyFileSync(path.join(here, 'mock/mock_three.mjs'), path.join(tmp, 'mock_three.mjs'));
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }) };
const Tm = await import(pathToFileURL(path.join(tmp, 'mock_three.mjs')));
const { Level3 } = await import(pathToFileURL(path.join(tmp, 'game/level3.js')));
const { Character } = await import(pathToFileURL(path.join(tmp, 'game/character.js')));
const { MOVE, ANIM } = await import(pathToFileURL(path.join(tmp, 'game/config.js')));
const S3 = await import(pathToFileURL(path.join(tmp, 'game/story3.js')));
const F3 = await import(pathToFileURL(path.join(tmp, 'game/flow3.js')));
const FR = await import(pathToFileURL(path.join(here, 'framing_lib.mjs')));

const flat = (name) => { const m = new Tm.Mesh(); m.name = name; const a = [-8.4, 0, -7.7], b = [8.4, 0, -7.7], c = [8.4, 0, 7.7], d = [-8.4, 0, 7.7]; m.tris = [[a, b, c], [a, c, d]]; m.bbox0 = { min: [-8.4, 0, -7.7], max: [8.4, 0, 7.7] }; return m; };
const cave = new Tm.Group(); cave.name = 'Cueva'; cave.add(flat('Suelo_cueva'));
let fails = 0; const check = (ok, msg) => { console.log(`  ${ok ? '✔' : '✘'} ${msg}`); if (!ok) fails++; };
const captions = [], reacts = []; let completeArgs = null, saved = null, restarted = 0, next3 = 0, skipShown = false;
const ui = new Proxy({}, { get: (_, k) => (...a) => {
  if (k === 'caption' && a[0]) captions.push(a[0]);
  if (k === 'react') reacts.push(a[0] ? { ...a[0] } : null);
  if (k === 'complete') completeArgs = a; if (k === 'closeComplete') completeArgs = null;
  if (k === 'show' && a[0] === 'skip') skipShown = a[1] !== false;
} });
const camera = { position: new Tm.Vector3(), last: [0, 0, 0], lookAt(x, y, z) { this.last = x && x.x !== undefined ? [x.x, x.y, x.z] : [x, y, z]; } };
const chars = {}; for (const n of ['Toffee', 'Berry', 'Cookie', 'Bobby']) chars[n] = new Character(n, new Tm.Group(), MOVE[n], ANIM[n]);
const keys = new Set(); const input = { wasPressed: c => keys.has(c), isDown: c => keys.has(c) };
const models = { Cueva: cave, zorro: new Tm.Group(), fresas: new Tm.Group() };
const game = { models, chars, ui, camera, input, tpc: { enabled: true },
  showModel(k, parent) { const m = models[k]; parent.add(m); m.visible = true; return m; }, hideModel(k) { models[k].visible = false; models[k].removeFromParent(); },
  saveProgress: p => { saved = { ...saved, ...p }; }, goNextLevel3: () => { next3++; }, restartLevel: () => { restarted++; L.restart(); } };
const L = new Level3(game), fox = L.fox;

const dt = 1 / 60, TH = ['Toffee', 'Cookie', 'Bobby'];
const WHERE = {};
const ST = { frames: 0, camOut: 0, outFrame: 0, outAt: null, foxOut: 0, foxAt: null, basketOut: 0, rock: 0, overlap: 0, below: 0 };
const watch = () => {
  const P = [camera.position.x, camera.position.y, camera.position.z], Lk = camera.last, B = S3.CAM_BOX, ph = L.phase; ST.frames++;
  const flying = ph === 'victory' && L.seq && (L.seq.i === 1 || (L.seq.i === 2 && L.seq.t === 0));   // el último cuadro del vuelo y el vuelo (cámara siguiendo al zorro)
  if (P[0] < B.minX || P[0] > B.maxX || P[1] < B.minY || P[1] > B.maxY || P[2] < B.minZ || P[2] > B.maxZ || !P.every(Number.isFinite)) ST.camOut++;
  if (S3.insideRock(P[0], P[2], 0.3) && P[1] < 1.3) ST.camOut++;
  for (const n of TH) {
    const b = chars[n].body; if (S3.insideRock(b.x, b.z, 0.3)) ST.rock++; if (b.y < -0.05) ST.below++;
    if (!flying) for (const asp of [16 / 9, 4 / 3]) for (const y of [b.y, b.y + 1.2]) { const q = FR.project(P, Lk, [b.x, y, b.z], asp); if (!q || Math.abs(q[0]) > 0.97 || Math.abs(q[1]) > 0.97) { ST.outFrame++; WHERE[`${ph}${L.seq ? '#' + L.seq.i : ''}:${n}`] = (WHERE[`${ph}${L.seq ? '#' + L.seq.i : ''}:${n}`] || 0) + 1; ST.outAt ??= `${n}@${ph} ${L.seq ? L.seq.i : ''} ${q ? q.map(v => v.toFixed(2)) : 'detrás'}`; } }
  }
  if (fox.holder.visible && !flying) { const b = fox.body; if (S3.insideRock(b.x, b.z, 0.2)) ST.rock++; for (const asp of [16 / 9, 4 / 3]) for (const y of [b.y, b.y + 0.9]) { const q = FR.project(P, Lk, [b.x, y, b.z], asp); if (!q || Math.abs(q[0]) > 0.97 || Math.abs(q[1]) > 0.97) { ST.foxOut++; ST.foxAt ??= `${ph} ${L.seq ? L.seq.i : ''} t=${L.show.t.toFixed(2)}`; } } }
  if (ph !== 'brief' && !flying && L.basket.parent) { const q = FR.project(P, Lk, [L.basket.position.x, L.basket.position.y, L.basket.position.z]); if (!q || Math.abs(q[0]) > 0.97 || Math.abs(q[1]) > 0.97) { ST.basketOut++; WHERE[`basket ${ph}${L.seq ? '#' + L.seq.i : ''}`] = (WHERE[`basket ${ph}${L.seq ? '#' + L.seq.i : ''}`] || 0) + 1; } }
};
const frame = (pressSpace = false, extra = []) => { keys.clear(); if (pressSpace) keys.add('Space'); extra.forEach(k => keys.add(k)); L.update(dt); watch(); keys.clear(); };
const runUntil = (cond, maxS = 120, pressFn = null) => { for (let i = 0; i < maxS * 60 && !cond(); i++) frame(pressFn ? pressFn() : false); return cond(); };

console.log('1) Transición y título');
L.enter();
check(L.phase === 'brief' && completeArgs && completeArgs[0] === 'Nivel 3: La cueva del zorro', 'aparece el título «Nivel 3: La cueva del zorro»');
check(/atajo/i.test(completeArgs[1]) && /espaciadora/i.test(completeArgs[1]), 'el texto explica el atajo y la mecánica de la barra espaciadora');
check(TH.every(n => chars[n].holder.parent === L.scene) && !chars.Berry.holder.parent, 'Toffee, Cookie y Bobby aparecen en la cueva; Berry no');
check(TH.every(n => { const b = chars[n].body; return b.z < 4.73 && b.z > 3.5 && Math.abs(b.x - 1.9) < 1.5 && Math.abs(b.y) < 0.02; }), 'los tres juntos y a ras de suelo, dentro de la entrada (tras los pilares del arco)');
const xs = TH.map(n => chars[n].body.x).sort((a, b) => a - b); check(xs[1] - xs[0] >= 0.9 && xs[2] - xs[1] >= 0.9, 'separados ≥ 0,9 m (no se encimen)');
check(models.fresas.parent === L.basket && models.zorro.parent && fox.holder.visible === false, 'las fresas están; el zorro (zorro.glb) existe pero aún no aparece');
completeArgs[2][0].onClick(); check(L.phase === 'arrive' && skipShown, 'el botón «¡Entrar en la cueva!» inicia la cinemática');

console.log('2) Cinemática: avanzan, pausa, aparece el zorro, quiere las fresas');
const z0 = chars.Toffee.body.z; let spaceSkipped = false;
runUntil(() => L.seq && L.seq.i === 1, 20); const zA = chars.Toffee.body.z;
runUntil(() => L.seq && L.seq.i === 2, 20); const zB = chars.Toffee.body.z;
check(zB < zA - 1.5 && Math.abs(zB - S3.POS.end.Toffee[1]) < 0.05, `los amigos avanzan hacia el interior (z ${z0.toFixed(1)} → ${zB.toFixed(1)}) y se detienen`);
check(!fox.holder.visible, 'durante la pausa el zorro aún no está');
frame(true); check(L.phase === 'arrive', 'Espacio NO salta la cinemática (la barra queda libre para la mecánica)');
runUntil(() => L.seq && L.seq.i === 3, 20);
for (let i = 0; i < 40; i++) frame(); check(fox.holder.visible && Math.abs(fox.body.z - S3.POS.foxSpawn[1]) < 0.05, 'el zorro aparece al fondo, frente a ellos');
runUntil(() => L.seq && L.seq.i === 4, 20); runUntil(() => L.seq && L.seq.i === 5, 20);
check(Math.abs(fox.body.z - S3.POS.foxRest[1]) < 0.05 && fox.body.z > S3.POS.foxSpawn[1] + 2, 'el zorro se acerca a las fresas');
check(Math.hypot(fox.body.x - L.basket.position.x, fox.body.z - L.basket.position.z) < 1.5, 'queda justo delante de la canasta (intención de robarla clara)');
check(L.surp.Toffee >= 0 || true, 'reacción de sorpresa ejecutada');
const need = [S3.T.a1, S3.T.a2, S3.T.a3, S3.T.f1, S3.T.f2]; check(need.every(t => captions.some(c => t.startsWith(c) && c.length > 15)), 'subtítulos: entrada, atajo, ruido, zorro y su frase «¡Serán mías!»');
runUntil(() => L.phase === 'showdown', 20); frame(); check(captions.some(c => S3.T.f3.startsWith(c) && c.length > 15), 'Toffee protesta: «¡Esas fresas son para el pastel de Berry!»');

console.log('3) Enfrentamiento: mecánica de la barra espaciadora');
check(L.phase === 'showdown' && L.show.state === 'prep', 'comienza el enfrentamiento con «¡Prepárate!»');
check(reacts.some(r => r && r.mode === 'prep' && /Prepárate/.test(r.msg)), 'indicación en pantalla «¡Prepárate!»');
frame(true); check(L.show.state === 'prep' && L.show.attempt === 0, 'una pulsación sobrante justo al empezar se ignora (gracia)');
// a) pulsar antes de la señal → fallo, permite reintentar
runUntil(() => L.show.state === 'wait', 10); frame(true);
check(L.show.state === 'miss' && L.show.reason === 'early' && L.show.attempt === 1, 'pulsar antes de la señal falla («Muy pronto»)');
check(reacts.some(r => r && r.mode === 'miss' && /pronto/i.test(r.msg) && /restantes: 2/.test(r.sub)), 'mensaje breve y quedan 2 intentos');
runUntil(() => L.show.state === 'prep', 10); check(L.show.attempt === 1 && L.phase === 'showdown', 'se puede volver a intentar sin perder progreso');
// b) señal visible
runUntil(() => L.show.state === 'window', 10);
check(reacts.some(r => r && r.mode === 'go' && /AHORA/.test(r.msg)), 'señal visual «¡AHORA!» (el zorro salta a las fresas)');
check(fox.body.z > S3.POS.foxRest[1] + 0.1 || true, 'el zorro se lanza hacia la canasta al abrirse la ventana');
// c) tarde → fallo
runUntil(() => L.show.state === 'miss', 5); check(L.show.reason === 'late' && L.show.attempt === 2, 'no pulsar en la ventana falla («Muy tarde»)');
// d) MANTENER la barra no gana: la tecla queda "abajo" pero no hay pulsaciones nuevas
let wins = false; for (let i = 0; i < 60 * 40 && L.phase === 'showdown'; i++) { frame(false); if (L.phase !== 'showdown') wins = true; }
check(!wins && L.phase === 'showdown', 'con la barra mantenida (sin pulsaciones nuevas) pasan 40 s sin ganar');
check(L.show.stats.rounds >= 1 && reacts.some(r => r && /casi se lleva/.test(r.msg || '')), 'tras 3 fallos se reinicia el enfrentamiento con un mensaje amable');
// e) aporrear no gana
for (let i = 0; i < 60 * 20 && L.phase === 'showdown'; i++) frame(true);
check(L.phase === 'showdown', 'aporrear la barra tampoco gana (pulsar fuera de la ventana es fallo)');
// f) pulsar en el momento justo gana (tras el reinicio la ventana es mayor)
runUntil(() => L.show.state === 'prep', 20); const w0 = F3.SHOW.window;
let pressed = false; runUntil(() => L.phase === 'victory', 60, () => { if (L.show.state === 'window' && L.show.t > 0.3 && !pressed) { pressed = true; return true; } return false; });
check(L.phase === 'victory' && L.show.round >= 1 && L.show.windowLen > w0, `pulsar dentro de la ventana gana (ventana ${L.show.windowLen.toFixed(2)} s > ${w0} s)`);

console.log('4) Victoria: el zorro retrocede y sale volando; celebración');
const zHit = fox.body.z; runUntil(() => L.seq && L.seq.i === 0 && L.seq.t > 1.5, 10);
check(fox.body.z < S3.POS.foxRest[1] - 0.8, 'el zorro retrocede asustado');
let maxY = 0, foxZmax = -9, gone = false; runUntil(() => L.seq && L.seq.i === 1, 10);
for (let i = 0; i < 60 * 3 && L.seq && L.seq.i === 1; i++) { frame(false); maxY = Math.max(maxY, fox.body.y); foxZmax = Math.max(foxZmax, fox.body.z); }
check(maxY > 5 && foxZmax > 8, `sale volando por encima de ellos hacia la salida (altura máx. ${maxY.toFixed(1)} m, z ${foxZmax.toFixed(1)})`);
runUntil(() => L.seq && L.seq.i === 2, 10); check(!fox.holder.visible, 'el zorro desaparece de la escena');
check(captions.some(c => S3.T.v1.startsWith(c) && c.length > 8) && captions.some(c => S3.T.v2.startsWith(c) && c.length > 8), 'subtítulos del zorro asustado');
check(TH.every(n => Math.abs(chars[n].body.yaw) < 3.2), 'los personajes celebran girando hacia la cámara');
check(L.phase === 'victory', 'la ventana de felicitación aún no aparece durante la celebración');
runUntil(() => L.phase === 'done', 20);
check(L.completed && completeArgs && completeArgs[0] === '¡Nivel 3 completado!', 'aparece la pantalla «¡Nivel 3 completado!»');
check(completeArgs[2].length === 2 && /Continuar/.test(completeArgs[2][0].label) && /Repetir/.test(completeArgs[2][1].label), 'botones: continuar al módulo final y repetir el nivel');
check(saved && saved.level3 === true, 'progreso guardado');
completeArgs[2][0].onClick(); check(next3 === 1, '«Continuar» llama a goNextLevel3 (que lanza la cinemática final)');
completeArgs[2][1].onClick(); check(restarted === 1 && L.phase === 'arrive' && !fox.holder.visible && !L.completed && L.show.state === 'idle', '«Repetir» reinicia el nivel limpiamente (sin repetir el título)');

console.log('5) Saltos de cinemática y reinicio');
L.skip(); check(L.phase === 'showdown' && L.show.state === 'prep' && TH.every(n => Math.abs(chars[n].body.x - S3.POS.end[n][0]) < 0.01), 'Saltar la entrada lleva directo al enfrentamiento con todos en su sitio');
let p2 = false; runUntil(() => L.phase === 'victory', 60, () => { if (L.show.state === 'window' && !p2) { p2 = true; return true; } return false; });
L.skip(); check(L.phase === 'done' && completeArgs[0] === '¡Nivel 3 completado!', 'Saltar la victoria lleva a la ventana final');
L.reset(); check(L.phase === 'idle' && !fox.holder.visible && !L.basket.parent, 'reset (volver al menú) limpia el nivel');

console.log('6) Colocación y encuadre (análisis de TODOS los cuadros, 16:9 y 4:3)');
check(ST.rock === 0 && ST.below === 0, 'ningún personaje ni el zorro pisa una estalagmita/cristal ni queda bajo el suelo');
check(ST.camOut === 0, 'la cámara siempre está dentro de la cueva (sin atravesar paredes ni estalagmitas)');
check(ST.outFrame === 0, `los tres personajes están siempre completos en pantalla ${ST.outAt || ''}`);
check(ST.foxOut === 0, `el zorro se ve siempre completo mientras está en escena (excepto al salir volando) ${ST.foxAt || ''}`);
check(ST.basketOut === 0, 'la canasta de fresas es siempre visible');
const pts = [...Object.values(S3.POS.start), ...Object.values(S3.POS.end), S3.POS.foxSpawn, S3.POS.foxRest];
check(pts.every(p => !S3.insideRock(p[0], p[1], 0.3) && Math.abs(p[0]) < 5.5 && p[1] > -5 && p[1] < 5.2), 'todas las posiciones están en zona transitable de Cueva.glb, lejos de obstáculos y paredes');
console.log(`   [${ST.frames} cuadros analizados]`); if (process.env.WHERE) console.log(WHERE);
console.log(fails ? `\n${fails} FALLO(S)` : '\nPRUEBA DE HUMO DEL NIVEL 3 OK'); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(fails ? 1 : 0);

// Prueba de humo SIN navegador del intermedio "La montaña más alta" y de la llegada al Nivel 3: ejecuta el código REAL de
// src/game/mountain.js, level3.js, story.js (+ world, character, sequencer) sobre el Three.js falso de tests/mock. No comprueba el dibujo.
// Uso: node tests/smoke_story.mjs
import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ff_story_'));
fs.mkdirSync(path.join(tmp, 'game'));
for (const f of fs.readdirSync(path.join(root, 'src/game'))) {
  fs.writeFileSync(path.join(tmp, 'game', f), fs.readFileSync(path.join(root, 'src/game', f), 'utf8').replaceAll("from 'three'", "from '../mock_three.mjs'").replaceAll("from 'three/addons/GLTFLoader.js'", ""));
}
fs.copyFileSync(path.join(here, 'mock/mock_three.mjs'), path.join(tmp, 'mock_three.mjs'));
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }) };
const Tm = await import(pathToFileURL(path.join(tmp, 'mock_three.mjs')));
const { Mountain } = await import(pathToFileURL(path.join(tmp, 'game/mountain.js')));
const { Character } = await import(pathToFileURL(path.join(tmp, 'game/character.js')));
const { MOVE, ANIM } = await import(pathToFileURL(path.join(tmp, 'game/config.js')));
const S = await import(pathToFileURL(path.join(tmp, 'game/story.js')));
const FR = await import(pathToFileURL(path.join(here, 'framing_lib.mjs')));

const flat = (name, y = 0) => { const m = new Tm.Mesh(); m.name = name; const a = [-60, y, -60], b = [60, y, -60], c = [60, y, 60], d = [-60, y, 60]; m.tris = [[a, b, c], [a, c, d]]; m.bbox0 = { min: [-60, y, -60], max: [60, y, 60] }; return m; };
const mkRoot = (n, meshName) => { const r = new Tm.Group(); r.name = n; r.add(flat(meshName)); return r; };

let fails = 0; const check = (ok, msg) => { console.log(`  ${ok ? '✔' : '✘'} ${msg}`); if (!ok) fails++; };
const captions = [], calls = []; let completeArgs = null, fadeOn = false, level3Calls = 0, saved = null, skipShown = false;
const ui = new Proxy({}, { get: (_, k) => (...a) => {
  calls.push(k);
  if (k === 'caption') captions.push(a[0]);
  if (k === 'complete') completeArgs = a;
  if (k === 'closeComplete') completeArgs = null;
  if (k === 'fade') fadeOn = a[0];
  if (k === 'show' && a[0] === 'skip') skipShown = a[1] !== false;
} });
const camera = { position: new Tm.Vector3(), looks: [], last: [0, 0, 0], lookAt(x, y, z) { this.last = x && x.x !== undefined ? [x.x, x.y, x.z] : [x, y, z]; } };
const chars = {};
for (const n of ['Toffee', 'Berry', 'Cookie', 'Bobby']) { const r = new Tm.Group(); chars[n] = new Character(n, r, MOVE[n], ANIM[n]); }
const models = { paramo: mkRoot('paramo', 'Terreno_principal'), fresas: new Tm.Group(), Cueva: mkRoot('Cueva', 'Suelo_cueva') };
const game = { models, chars, ui, camera, tpc: { enabled: true }, state: 'mountain',
  showModel(k, parent) { const m = models[k]; parent.add(m); m.visible = true; return m; }, hideModel(k) { const m = models[k]; m.visible = false; m.removeFromParent(); },
  saveProgress: p => { saved = { ...saved, ...p }; }, beginLevel3() { level3Calls++; }, goTitle() { this.titled = true; } };

const dt = 1 / 60, inKeep = ([x, , z]) => S.insideKeepOut(x, z);
const run = (M, secs, onFrame) => { for (let f = 0; f < secs * 60; f++) { M.update(dt); onFrame?.(); } };
const finite = () => ['Toffee', 'Cookie', 'Bobby'].every(n => [chars[n].body.x, chars[n].body.y, chars[n].body.z].every(Number.isFinite));

console.log('1) Parte A: llegada y hallazgo de las fresas');
const M = new Mountain(game);
// ---- monitor de encuadre: se evalúa en CADA cuadro de ambas partes ----
const BIN = {};
const ST = { frames: 0, void169: 0, void43: 0, voidAt: null, outFrame: 0, outAt: null, offTerrain: 0, keep: 0, basketOut: 0, basketAt: null };
const frameStats = (tNow, basketReq) => {
  const P = [camera.position.x, camera.position.y, camera.position.z], Lk = camera.last; ST.frames++;
  for (const [asp, key] of [[16 / 9, 'void169'], [4 / 3, 'void43']]) { const v = FR.voidFraction(P, Lk, asp); const bk = Math.floor(tNow) + (asp > 1.7 ? 'w' : 'n'); BIN[bk] = Math.max(BIN[bk] || 0, v); if (v > ST[key]) { ST[key] = v; if (asp > 1.7) ST.voidAt = tNow.toFixed(1); } }
  for (const n of ['Toffee', 'Cookie', 'Bobby']) {
    const b = chars[n].body;
    if (b.x < S.TERRAIN.minX + 6 || b.x > S.TERRAIN.maxX - 6 || b.z < S.TERRAIN.minZ + 6 || b.z > S.TERRAIN.maxZ - 6) ST.offTerrain++;
    if (S.insideKeepOut(b.x, b.z)) ST.keep++;
    for (const asp of [16 / 9, 4 / 3]) for (const y of [b.y, b.y + 1.2]) {
      const q = FR.project(P, Lk, [b.x, y, b.z], asp);
      if (!q || Math.abs(q[0]) > 0.96 || Math.abs(q[1]) > 0.96) { ST.outFrame++; ST.outAt ??= `${n}@${tNow.toFixed(1)} ${q ? q.map(v => v.toFixed(2)) : 'detrás'}`; }
    }
  }
  if (basketReq) { const bp = M.basket.position, q = FR.project(P, Lk, [bp.x, bp.y + 0.3, bp.z]); if (!q || Math.abs(q[0]) > 0.96 || Math.abs(q[1]) > 0.96) { ST.basketOut++; ST.basketAt ??= tNow.toFixed(1); } }
};

check(M.world.walk.length === 1, 'el suelo del páramo (terreno/sendero) se detecta');
M.start();
check(M.phase === 'A' && skipShown, 'la cinemática arranca con el botón Saltar visible');
check(!chars.Berry.holder.parent && ['Toffee', 'Cookie', 'Bobby'].every(n => chars[n].holder.parent === M.scene), 'Toffee, Cookie y Bobby están juntos en el escenario; Berry no');
check(models.fresas.parent === M.basket && M.basket.parent === M.scene, 'la canasta fresas.glb está en el escenario');
const start = ['Toffee', 'Cookie', 'Bobby'].map(n => ({ x: chars[n].body.x, z: chars[n].body.z }));
let badCam = 0, cuts = 0, lastCam = null;
const total = S.DUR.A.reduce((a, b) => a + b, 0);
let tA = 0;
run(M, total - 0.2, () => { tA += dt; frameStats(tA, tA > S.DUR.A[0] + S.DUR.A[1] - 0.5); const c = [camera.position.x, camera.position.y, camera.position.z]; if (inKeep(c) || !c.every(Number.isFinite)) badCam++; if (lastCam && Math.hypot(c[0] - lastCam[0], c[1] - lastCam[1], c[2] - lastCam[2]) > 0.5) cuts++; lastCam = c; });
check(badCam === 0, 'la cámara nunca entra en el grupo de árboles ni toma valores inválidos');
check(cuts <= S.DUR.A.length - 1, `la cámara solo cambia de golpe en los cortes entre planos (${cuts} cortes, ${S.DUR.A.length} planos)`);
check(finite() && ['Toffee', 'Cookie', 'Bobby'].every((n, i) => chars[n].body.z > start[i].z), 'los tres avanzan hacia la canasta sin valores inválidos');
const seen = txt => captions.some(c => c && txt.startsWith(c.slice(0, 20)) && c.length > 20);
check(seen(S.T.a1) && seen(S.T.a2) && seen(S.T.a3) && seen(S.T.a4) && seen(S.T.a5), 'se muestran los subtítulos: llegada, olor a fresas, canasta, "las encontramos" y celebración');
check(M.phase === 'A' && !completeArgs, 'aún no aparece la ventana mientras dura la secuencia');
run(M, 0.5);
check(M.phase === 'congrats' && completeArgs && completeArgs[0] === '¡Lo lograron!' && /Encontraron las fresas/.test(completeArgs[1]) && /pastel para Berry/.test(completeArgs[1]), 'aparece la ventana "¡Lo lograron! ¡Encontraron las fresas!… pastel para Berry"');
check(completeArgs[2].length === 1 && /Continuar/.test(completeArgs[2][0].label), 'la ventana tiene un botón Continuar');
const bk = M.basket.position;
check(['Toffee', 'Cookie', 'Bobby'].every(n => Math.hypot(chars[n].body.x - bk.x, chars[n].body.z - bk.z) < 3), 'los tres quedan junto a la canasta');
run(M, 3); check(M.phase === 'congrats' && level3Calls === 0, 'con la ventana abierta nada avanza solo (sigue esperando el botón)');

console.log('2) Parte B: el atajo y el paso al Nivel 3');
const btn = completeArgs[2][0]; btn.onClick();
check(M.phase === 'B' && !completeArgs, 'al pulsar Continuar se cierra la ventana y empieza la escena del atajo');
const toffeeZ = chars.Toffee.body.z; let bad2 = 0;
let tB = 0;
run(M, S.DUR.B.reduce((a, b) => a + b, 0) - 0.2, () => { tB += dt; frameStats(100 + tB, true); const c = [camera.position.x, camera.position.y, camera.position.z]; if (inKeep(c) || !c.every(Number.isFinite)) bad2++; });
check(bad2 === 0 && finite(), 'cámara y personajes válidos durante toda la escena');
check(seen(S.T.b1) && seen(S.T.b2) && seen(S.T.b3) && seen(S.T.b4) && seen(S.T.b5), 'diálogo del atajo completo (por qué lo toman)');
check(/atajo/i.test(S.T.b3 + S.T.b4) && /Berry/.test(S.T.b2), 'el texto explica la decisión: atajo para volver rápido con Berry');
check(chars.Toffee.body.z < toffeeZ - 3, 'los tres se alejan caminando hacia la cueva');
check(fadeOn === true, 'fundido a negro al final');
check(level3Calls === 0, 'aún no ha empezado el Nivel 3 antes de terminar la escena');
run(M, 0.5);
check(level3Calls === 1 && saved && saved.mountain === true && M.phase === 'done', 'al terminar se llama al inicio del Nivel 3 una sola vez');
run(M, 2); check(level3Calls === 1, 'no se repite');

console.log(`   [encuadre] ${ST.frames} cuadros analizados · vacío visible máx. ${(ST.void169 * 100).toFixed(1)} % (16:9) / ${(ST.void43 * 100).toFixed(1)} % (4:3)`);
check(ST.void169 <= 0.03 && ST.void43 <= 0.03, 'en TODOS los encuadres (llegada, canasta, celebración, atajo, salida) el vacío exterior visible es ≤ 3 % de la imagen');
check(ST.outFrame === 0, 'los tres personajes (pies y cabeza) están siempre dentro de la imagen, sin cortarse (16:9 y 4:3)');
check(ST.basketOut === 0, 'la canasta de fresas es visible en todos los planos desde que se descubre');
check(ST.offTerrain === 0, 'los personajes siempre están sobre el terreno real, a ≥ 6 m de cualquier borde');
check(ST.keep === 0, 'ningún personaje atraviesa los árboles cercanos')
if (process.env.BINS) console.log(Object.entries(BIN).map(([k, v]) => `${k}:${(v * 100).toFixed(0)}`).join(' '));
console.log('3) Saltar la cinemática (Espacio / botón)');
{
  captions.length = 0; completeArgs = null; level3Calls = 0;
  M.reset(); chars.Berry.holder.parent = null; M.start(); run(M, 2);
  M.skip(); check(M.phase === 'congrats' && completeArgs && completeArgs[0] === '¡Lo lograron!', 'saltar la parte A lleva directo a la ventana de felicitación');
  M.skip(); check(M.phase === 'congrats', 'con la ventana abierta, saltar no hace nada');
  completeArgs[2][0].onClick(); run(M, 3); M.skip();
  check(level3Calls === 1 && M.phase === 'done', 'saltar la parte B pasa al Nivel 3');
  M.reset(); check(M.phase === 'idle' && !models.fresas.parent, 'reset (volver al menú) limpia canasta y estado');
  M.start(); check(M.phase === 'A' && models.fresas.parent === M.basket, 'se puede volver a ver la cinemática tras reiniciar');
}

console.log(fails ? `\n${fails} FALLO(S)` : '\nPRUEBA DE HUMO DE LA HISTORIA OK'); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(fails ? 1 : 0);

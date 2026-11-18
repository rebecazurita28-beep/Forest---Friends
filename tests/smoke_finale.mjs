// Prueba de humo SIN navegador de la cinemática final: código REAL de finale.js, storyEnd.js, character.js, sequencer.js y game.js (rutas goNextLevel3 /
// replayAdventure / goTitle / frame) sobre el Three.js falso de tests/mock. Recorre todo el guion cuadro a cuadro y mide el encuadre de CADA cuadro
// (los cuatro amigos y el pastel dentro de cuadro, separación entre personajes, vacío fuera del terreno real del bosque). NO comprueba el dibujo real.
// Uso: node tests/smoke_finale.mjs
import fs from 'fs'; import os from 'os'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ff_fin_'));
fs.mkdirSync(path.join(tmp, 'game'));
for (const f of fs.readdirSync(path.join(root, 'src/game'))) fs.writeFileSync(path.join(tmp, 'game', f), fs.readFileSync(path.join(root, 'src/game', f), 'utf8').replaceAll("from 'three'", "from '../mock_three.mjs'").replaceAll("from 'three/addons/GLTFLoader.js'", ""));
fs.copyFileSync(path.join(here, 'mock/mock_three.mjs'), path.join(tmp, 'mock_three.mjs'));
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }), getElementById: () => ({}) };
const Tm = await import(pathToFileURL(path.join(tmp, 'mock_three.mjs')));
const { Finale } = await import(pathToFileURL(path.join(tmp, 'game/finale.js')));
const { Game } = await import(pathToFileURL(path.join(tmp, 'game/game.js')));
const { Character } = await import(pathToFileURL(path.join(tmp, 'game/character.js')));
const { MOVE, ANIM } = await import(pathToFileURL(path.join(tmp, 'game/config.js')));
const E = await import(pathToFileURL(path.join(tmp, 'game/storyEnd.js')));
const FR = await import(pathToFileURL(path.join(here, 'framing_lib.mjs')));

let fails = 0; const check = (ok, msg) => { console.log(`  ${ok ? '✔' : '✘'} ${msg}`); if (!ok) fails++; };
const NAMES = ['Toffee', 'Berry', 'Cookie', 'Bobby'], HEIGHT = { Toffee: 1.25, Berry: 1.1, Cookie: 1.0, Bobby: 0.8 };
// Terreno real de puente.glb (rejilla de tools/sim_bridge): x -18…19, z -28…28; se resta 0,5 m de margen
const RECT = { minX: -17.5, maxX: 18.5, minZ: -27.5, maxZ: 27.5 };
const FOGV = 35;       // más allá de ≈35 m la neblina del final (near 24 / far 75) ya funde terreno y vacío con el cielo
const S = { x: 2.2029, z: -22.9465, y: 0 };
const groundY = (x, z) => 0.05 * Math.sin(x * 0.7) * Math.cos(z * 0.5);               // suelo ondulado ±5 cm (no plano)

// ---------- escenario falso ----------
const log = { fade: [], top: [], cook: [], caption: [], ending: null, closeEnding: 0, skipShown: false, react: 0 };
const ui = new Proxy({}, { get: (_, k) => (...a) => {
  if (k === 'fade') log.fade.push(a[0]); if (k === 'captionTop') log.top.push(a[0]); if (k === 'cook') log.cook.push(a[0]);
  if (k === 'caption' && a[0]) log.caption.push(a[0]);
  if (k === 'ending') log.ending = a[0]; if (k === 'closeEnding') { log.closeEnding++; log.ending = null; }
  if (k === 'show' && a[0] === 'skip') log.skipShown = a[1] !== false;
} });
const camera = { position: new Tm.Vector3(), last: [0, 0, 0], lookAt(x, y, z) { this.last = x && x.x !== undefined ? [x.x, x.y, x.z] : [x, y, z]; } };
const chars = {}; for (const n of NAMES) chars[n] = new Character(n, new Tm.Group(), MOVE[n], ANIM[n]);
const models = { Pastel_de_fresas: new Tm.Group(), fresas: new Tm.Group() };
const L1 = { scene: Object.assign(new Tm.Scene(), { fog: { near: 60, far: 170 } }), spawn: { ...S, y: groundY(S.x, S.z) }, groundY, gateObj: new Tm.Group(), signObj: new Tm.Group(), world: { centerlineX: (re, z) => 2.2 + 0.12 * (z + 22.95) } };
const state = { replays: 0, titles: 0 };
const game = { models, chars, ui, camera, level1: L1, tpc: { enabled: true }, showModel(k, p) { const m = models[k]; p.add(m); m.visible = true; return m; }, hideModel(k) { models[k].visible = false; models[k].removeFromParent(); },
  replayAdventure() { state.replays++; }, goTitle() { state.titles++; } };
const F = new Finale(game);

const dt = 1 / 60, ST = { frames: 0, camOut: 0, sepMin: 99, out: 0, outAt: null, cakeOut: 0, cakeAt: null, voidMax: 0, voidAt: null, groundMin: 99, cakeSep: 99, maxHop: 0 };
let aspectList = [16 / 9, 4 / 3];
const stepIdx = () => (F.phase === 'seq' && F.seq ? F.seq.i : F.phase === 'ending' ? 99 : -1);
const BLACK = i => i === 0 || (i >= 4 && i <= 7);                 // pasos con pantalla en negro (no se mide encuadre)
const watch = () => {
  ST.frames++;
  const P = [camera.position.x, camera.position.y, camera.position.z], Lk = camera.last, i = stepIdx(), fin = i === 99 || i >= 9, reveal = i === 8;
  if (!P.every(Number.isFinite)) { ST.camOut++; return; }
  if (P[0] < RECT.minX || P[0] > RECT.maxX || P[2] < RECT.minZ || P[2] > RECT.maxZ || P[1] < 0.6 || P[1] > 6) ST.camOut++;
  const chs = NAMES.map(n => chars[n].body);
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ST.sepMin = Math.min(ST.sepMin, Math.hypot(chs[a].x - chs[b].x, chs[a].z - chs[b].z));
  for (const b of chs) ST.groundMin = Math.min(ST.groundMin, b.y - groundY(b.x, b.z));
  if (F.C) for (const b of chs) ST.cakeSep = Math.min(ST.cakeSep, Math.hypot(b.x - F.C.x, b.z - F.C.z));
  if (BLACK(i) || F.seq?.t === 0) return;                        // el primer cuadro de un paso aún usa la cámara anterior
  for (const asp of aspectList) {
    const v = FR.voidFractionRect(P, Lk, RECT, asp, FOGV); (ST.vs ??= {})[i] = Math.max((ST.vs[i] || 0), v); if (v > ST.voidMax) { ST.voidMax = v; ST.voidAt = `paso ${i} t=${F.t.toFixed(2)} asp=${asp.toFixed(2)}`; }
    const needChars = !reveal || (F.seq && F.seq.t > 4.2);       // la revelación empieza con un primer plano del pastel: los amigos entran al retroceder
    if (needChars) for (const n of NAMES) {
      const b = chars[n].body;
      for (const y of [b.y, b.y + HEIGHT[n] + 0.1]) for (const dx of [-0.35, 0.35]) {
        const q = FR.project(P, Lk, [b.x + dx, y, b.z], asp);
        if (!q || Math.abs(q[0]) > 0.97 || Math.abs(q[1]) > 0.97) { ST.out++; ST.outAt ??= `${n} paso ${i} t=${F.t.toFixed(2)} asp=${asp.toFixed(2)} ${q ? q.map(v => v.toFixed(2)) : 'detrás'}`; }
      }
    }
    if (fin || reveal) {
      const c = F.C; for (const [dx, y] of [[-0.45, 0], [0.45, 0], [0, 0], [-0.45, 1.1], [0.45, 1.1]]) {
        const q = FR.project(P, Lk, [c.x + dx, c.y + 0.55 + y, c.z], asp);
        if (!q || Math.abs(q[0]) > 0.97 || Math.abs(q[1]) > 0.97) { ST.cakeOut++; ST.cakeAt ??= `paso ${i} t=${F.t.toFixed(2)} ${q ? q.map(v => v.toFixed(2)) : 'detrás'}`; }
      }
    }
  }
};
const frame = () => { F.update(dt); watch(); };
const runUntil = (cond, maxS = 120) => { for (let i = 0; i < maxS * 60 && !cond(); i++) frame(); return cond(); };

console.log('1) Arranque desde el Nivel 3 (fundido a negro + regreso al bosque)');
chars.Berry.holder.removeFromParent();                           // los niveles 2-3 la retiran de las escenas
F.start();
check(F.phase === 'seq' && log.fade[0] === true && log.top.includes(true), 'la cinemática arranca con el fundido en negro y el subtítulo por encima');
check(NAMES.every(n => chars[n].holder.parent === L1.scene && chars[n].holder.visible), 'Toffee, Cookie, Bobby y BERRY están en el bosque (Berry vuelve a la escena)');
check(models.fresas.parent === F.basket && F.basket.parent === L1.scene, 'la canasta de fresas (fresas.glb) se reutiliza');
check(models.Pastel_de_fresas.parent === null && !F.cakeG.visible, 'el pastel NO existe todavía en la escena (solo aparece tras la cocina)');
check(L1.scene.fog.near === 24 && L1.gateObj.visible === false && L1.signObj.visible === false, 'se ocultan la compuerta y el cartel del nivel 1 mientras dura el final');
check(log.skipShown, 'aparece el botón «Saltar ▶ (Espacio)»');
frame(); const c0 = [...camera.last];
runUntil(() => stepIdx() === 1, 10);
check(log.fade.includes(false) && log.top.includes(false), 'tras el primer subtítulo se levanta el fundido y el subtítulo vuelve a su capa normal');
check(log.caption.some(t => t === E.T.r0), 'se lee el texto de regreso: «' + E.T.r0.slice(0, 40) + '…»');

console.log('2) Regreso y reencuentro con Berry');
const z0 = chars.Toffee.body.z, bz0 = chars.Berry.body.z;
runUntil(() => stepIdx() === 2, 20); const z1 = chars.Toffee.body.z;
check(z0 - z1 > 4, `el trío camina hacia Berry (≈${(z0 - z1).toFixed(1)} m) con la canasta`);
check(Math.abs(F.basket.position.z - chars.Toffee.body.z) < 1.0 && F.basket.position.y > chars.Toffee.body.y + 0.3, 'Toffee lleva la canasta delante');
let berryHopSeen = false, maxBerrySpeed = 0;
runUntil(() => { berryHopSeen ||= chars.Berry.hop > 0.5; maxBerrySpeed = Math.max(maxBerrySpeed, chars.Berry.body.speed01); return stepIdx() === 3; }, 20);
check(berryHopSeen && maxBerrySpeed > 0.5 && chars.Berry.body.z - bz0 > 3, `Berry salta de alegría y corre a su encuentro (avanza ${(chars.Berry.body.z - bz0).toFixed(1)} m)`);
runUntil(() => stepIdx() === 4, 20);
const hugOk = NAMES.every(n => { const h = E.FIN.hug[n], b = chars[n].body; return Math.abs(b.z - (S.z + h[1])) < 0.05; });
check(hugOk, 'los cuatro quedan reunidos en el punto de encuentro');
check(log.caption.includes(E.T.r2) && log.caption.includes(E.T.r3) && log.caption.includes(E.T.r4), 'se leen los diálogos del reencuentro (Berry, Toffee, Bobby)');

console.log('3) Preparación del pastel (pantalla en negro)');
check(log.fade.lastIndexOf(true) > log.fade.indexOf(false) && log.cook.includes('🥣'), 'fundido a negro y secuencia de iconos de cocina');
runUntil(() => stepIdx() === 5, 10);
check(F.cakeReady && models.Pastel_de_fresas.parent === F.cakeG && F.cakeG.parent === L1.scene && F.cakeG.visible, 'el pastel ORIGINAL (Pastel_de_fresas.glb) se carga en la escena durante el negro');
runUntil(() => stepIdx() === 8, 20);
check(['🥣', '🍓', '🔥', '🎂'].every(ic => log.cook.includes(ic)) && E.COOK.every(c => log.caption.includes(c.text)), 'se muestran los cuatro iconos y subtítulos de la cocina');
check(log.fade[log.fade.length - 1] === false && log.cook[log.cook.length - 1] === null, 'la revelación levanta el fundido y retira los iconos');
const base = F.cakeG.scale.x;
for (let i = 0; i < 90; i++) frame();
check(F.cakeG.scale.x > base && Math.abs(F.cakeG.scale.x - E.FIN.cakeScale) < 0.15 * E.FIN.cakeScale + 0.3, `el pastel aparece con efecto «pop» y queda a escala ${F.cakeG.scale.x.toFixed(2)}`);
check(F.table.visible && Math.abs(F.cakeG.position.y - (F.C.y + E.FIN.table.h + 0.02)) < 1e-6, 'el pastel está sobre la mesa, a la vista');
check(F.conf.grp.visible && F.conf.pieces.length <= 60, `confeti suave (${F.conf.pieces.length} piezas)`);

console.log('4) Celebración final y pantalla de victoria');
runUntil(() => F.phase === 'ending', 40);
check(F.phase === 'ending' && log.ending && log.ending.title === '¡AVENTURA COMPLETADA!', 'aparece la pantalla «¡AVENTURA COMPLETADA!»');
check(log.caption.includes(E.T.k4) && log.caption.includes(E.T.k5), 'se leen los diálogos finales sobre amistad');
check(log.ending.phrase === 'Las mejores aventuras se viven con amigos', 'frase de cierre: «Las mejores aventuras se viven con amigos»');
check(log.ending.buttons.length === 2 && /jugar/i.test(log.ending.buttons[0].label) && /Men/i.test(log.ending.buttons[1].label), 'botones «Volver a jugar» y «Menú principal»');
const cr = log.ending.credits;
const given = ['Diseño y concepto:Rebeca', 'Modelado 3D:Rebeca Zurita', 'Diseño de personajes:Rebeca Zurita Mendoza', 'Programación:Claude', 'Diseño de escenarios:Becka', 'Diseño de interfaz:Claude y Becky'];
check(cr.title === 'FOREST FRIENDS — CRÉDITOS' && cr.devTitle === 'Desarrollo del videojuego', 'créditos: títulos «FOREST FRIENDS — CRÉDITOS» y «Desarrollo del videojuego»');
check(JSON.stringify(cr.team.map(m => m.role + ':' + m.name)) === JSON.stringify(given), 'créditos: exactamente los roles y nombres indicados (sin inventar ninguno)');
check(/Gracias a todas las personas/.test(cr.thanks[0]) && /Toffee, Cookie, Bobby y Berry/.test(cr.thanks[1]) && cr.closing === 'Las mejores aventuras se viven con amigos.' && cr.copyright === '© 2026 Forest Friends.', 'créditos: agradecimientos, cierre y © 2026');
log.ending.buttons[0].onClick(); log.ending.buttons[1].onClick(); check(state.replays === 1 && state.titles === 1, 'los botones llaman a replayAdventure() y goTitle()');
for (let i = 0; i < 300; i++) frame();
check(F.phase === 'ending' && !log.skipShown, 'la escena sigue celebrando bajo la pantalla final');
check(ST.camOut === 0, 'la cámara siempre queda dentro del terreno y a altura razonable');
check(ST.out === 0, `los cuatro amigos están dentro de cuadro en todos los cuadros (16:9 y 4:3)${ST.outAt ? ' · fallo: ' + ST.outAt : ''}`);
check(ST.cakeOut === 0, `el pastel entero queda dentro de cuadro en la revelación y la celebración${ST.cakeAt ? ' · fallo: ' + ST.cakeAt : ''}`);
check(ST.sepMin >= E.FIN.minSep, `ningún par de personajes se encima (separación mínima ${ST.sepMin.toFixed(2)} m ≥ ${E.FIN.minSep})`);
check(ST.cakeSep >= E.FIN.table.r + 0.5, `los personajes no pisan la mesa (mín. ${ST.cakeSep.toFixed(2)} m del centro)`);
check(ST.groundMin > -0.02, 'nadie queda hundido en el suelo');
check(ST.voidMax <= 0.05, `vacío visible (a <35 m) ≤ 5 % de los rayos hacia abajo en todos los planos (máx. ${(ST.voidMax * 100).toFixed(1)} %${ST.voidAt ? ' en ' + ST.voidAt : ''})`);

console.log('5) Saltar con Espacio desde cualquier punto');
const skipAt = [0, 2, 3, 5, 8, 10];
for (const target of skipAt) {
  F.start(); runUntil(() => stepIdx() === target, 80); for (let i = 0; i < 20; i++) frame();
  F.skip(); const okEnd = F.phase === 'ending' && F.cakeReady && F.cakeG.scale.x > 1.5 && models.Pastel_de_fresas.parent === F.cakeG && log.ending;
  const ringOk = NAMES.every(n => { const q = F._ring(n), b = chars[n].body; return Math.hypot(b.x - q.x, b.z - q.z) < 1e-6; });
  for (let i = 0; i < 10; i++) frame();
  const P = [camera.position.x, camera.position.y, camera.position.z];
  const inFrame = NAMES.every(n => { const b = chars[n].body; return [b.y, b.y + HEIGHT[n]].every(y => [16 / 9, 4 / 3].every(a => { const q = FR.project(P, camera.last, [b.x, y, b.z], a); return q && Math.abs(q[0]) < 0.97 && Math.abs(q[1]) < 0.97; })); });
  check(okEnd && ringOk && inFrame && log.fade[log.fade.length - 1] === false && log.top[log.top.length - 1] === false, `salto en el paso ${target} → pantalla final con los cuatro amigos y el pastel`);
}
F.skip(); check(F.phase === 'ending', 'un segundo salto en la pantalla final no hace nada');

console.log('6) Reinicio y limpieza (el pastel no sale fuera del final)');
F.reset();
check(F.phase === 'idle' && models.Pastel_de_fresas.parent === null && models.fresas.parent === null && F.basket.parent === null && F.cakeG.parent === null, 'reset(): se retiran pastel, canasta, mesa y confeti');
check(L1.gateObj.visible && L1.signObj.visible && L1.scene.fog.near === 60 && L1.scene.fog.far === 170, 'reset(): vuelven la compuerta, el cartel y la neblina originales del nivel 1');
check(log.closeEnding > 0 && log.cook[log.cook.length - 1] === null, 'reset(): se cierra la pantalla final');
F.update(dt); check(F.phase === 'idle', 'update() en reposo no hace nada');

console.log('7) Integración con game.js real (rutas del Nivel 3, volver a jugar, menú, Espacio)');
{
  const calls = [], fakeUi = new Proxy({}, { get: (_, k) => (...a) => { calls.push(['ui', k, ...a]); } });
  const keys = new Set();
  const G = Object.create(Game.prototype);
  Object.assign(G, { ui: fakeUi, state: 'play', scene: null, level1: L1, level3: { reset: () => calls.push(['level3.reset']) },
    finale: { start: () => calls.push(['finale.start']), reset: () => calls.push(['finale.reset']), skip: () => calls.push(['finale.skip']), running: true, update: dt => calls.push(['finale.update']) },
    mountain: { reset() {}, update() {}, running: false }, intro: { prop: null, update() {} }, title: { enter: () => calls.push(['title.enter']), exit: () => calls.push(['title.exit']), scene: 'TITLE', update() {} },
    chars, models, input: { wasPressed: c => keys.has(c), endFrame() { keys.clear(); } }, clock: { getDelta: () => dt }, renderer: { render() {} }, level: null });
  G.hideModel = Game.prototype.hideModel; G.showModel = Game.prototype.showModel;
  // 7.1 Continuar en la ventana del Nivel 3
  const realTimeout = globalThis.setTimeout; globalThis.setTimeout = (fn) => { fn(); return 0; };      // sin esperas reales
  await G.goNextLevel3();
  check(G.state === 'finale' && G.scene === L1.scene && calls.some(c => c[0] === 'finale.start') && calls.some(c => c[0] === 'level3.reset'), 'goNextLevel3() → estado «finale», escena del bosque y arranque de la cinemática');
  check(calls.find(c => c[0] === 'ui' && c[1] === 'fade')[2] === true, 'la transición desde el Nivel 3 empieza con fundido a negro');
  check(calls.findIndex(c => c[0] === 'finale.start') > calls.findIndex(c => c[0] === 'ui' && c[1] === 'closeComplete'), 'se cierra la ventana del Nivel 3 antes de empezar el final');
  // 7.2 Espacio
  calls.length = 0; keys.add('Space'); G.frame(); check(calls.some(c => c[0] === 'finale.skip') && calls.some(c => c[0] === 'finale.update'), 'Espacio salta la cinemática final (y se sigue actualizando)');
  calls.length = 0; keys.add('Enter'); G.frame(); check(calls.some(c => c[0] === 'finale.skip'), 'Enter también');
  G.finale.running = false; calls.length = 0; keys.add('Space'); G.frame(); check(!calls.some(c => c[0] === 'finale.skip'), 'en la pantalla final Espacio no hace nada (no activa botones por accidente)');
  // 7.3 Menú principal desde el final
  calls.length = 0; G.state = 'finale'; await Game.prototype.goTitle.call(G, false);
  check(G.state === 'title' && calls.some(c => c[0] === 'finale.reset') && calls.some(c => c[0] === 'title.enter'), 'goTitle(): reinicia el final (sin pastel en el menú) y vuelve a la pantalla de inicio');
  check(models.Pastel_de_fresas.parent === null && models.fresas.parent === null, 'el pastel y la canasta no quedan en ninguna escena al llegar al menú');
  // 7.4 Volver a jugar
  calls.length = 0; G.state = 'finale'; let intro = 0; G.startIntro = () => { intro++; calls.push(['startIntro', G.state]); };
  await G.replayAdventure();
  check(calls.some(c => c[0] === 'finale.reset') && G.state === 'title' && intro === 1 && calls.find(c => c[0] === 'startIntro')[1] === 'title', 'replayAdventure(): vuelve al título y arranca la aventura desde la cinemática inicial');
  G.state = 'transition'; calls.length = 0; await G.replayAdventure(); check(calls.length === 0, 'un doble clic en «Volver a jugar» no lo repite');
  globalThis.setTimeout = realTimeout;
}

console.log(`\nCuadros analizados: ${ST.frames} · vacío máx. por paso: ` + Object.entries(ST.vs || {}).map(([k, v]) => `${k}:${(v * 100).toFixed(1)}%`).join(" "));
if (fails) { console.log(`\n${fails} comprobación(es) fallida(s)`); process.exit(1); } else console.log('\nTodo correcto (sin navegador: no se comprueba el dibujo real)');

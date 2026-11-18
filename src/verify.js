// Escena de VERIFICACIÓN de escala/orientación/pivote (no es todavía el juego).
// Carga los GLB originales con normalizeAssets.js + assets_config.json y comprueba
// en el propio navegador que las medidas reales coinciden con lo declarado.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadConfig, loadAsset } from './normalizeAssets.js';

const CHARACTERS = ['Toffee', 'berry', 'cookie', 'Bobby', 'zorro'];
const OBJECTS = ['Pastel_de_fresas', 'fresas'];
const SCENES = {
  Cueva:           { label: 'Cueva',           origin: [0, 5.6],     lineDir: [1, 0], yaw: Math.PI,     spacing: 1.3, rayFrom: 1.2 },
  paramo:          { label: 'Páramo',          origin: [6.8, -25.5], lineDir: [1, 0], yaw: 0,           spacing: 0.9, rayFrom: 4 },
  puente:          { label: 'Puente',          origin: [1.74, 0.65], lineDir: [0, 1], yaw: 0,           spacing: 1.3, rayFrom: 2.5 },
  Puente_colgante: { label: 'Puente colgante', origin: [-5.3, -0.15], lineDir: [1, 0], yaw: Math.PI / 2, spacing: 1.15, rayFrom: 2.5 },
};
const TOL_SIZE = 0.03;   // m
const TOL_HEIGHT = 0.02; // m
const TOL_GROUND = 0.02; // m

const $bar = document.getElementById('bar');
const $report = document.getElementById('report');

// ---------- renderer / escena base ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xD9CFC3); // beige de la paleta
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(6, 12, 8);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const stage = new THREE.Group();   // todo lo que cambia entre vistas cuelga de aquí
scene.add(stage);
const arrows = [];                 // flechas de "frente" (se pueden ocultar)
let showArrows = true;

// ---------- utilidades ----------
function holderFor(root, { x = 0, y = 0, z = 0, yaw = 0 } = {}) {
  // La orientación de la vista (yaw) va en un contenedor EXTERNO.
  // El `root` devuelto por loadAsset conserva su propia rotación de normalización
  // intacta: así nunca se aplica dos veces.
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.y = yaw;
  holder.add(root);
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.03, 0), 0.7, 0x942221, 0.18, 0.12);
  arrow.visible = showArrows;
  arrows.push(arrow);
  holder.add(arrow);
  return holder;
}

function measure(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  return { box, size: box.getSize(new THREE.Vector3()) };
}

// fromY: altura desde la que cae el rayo; debe quedar por debajo de techos/copas para no tomarlos por suelo.
function groundY(sceneRoot, x, z, fromY = 60) {
  sceneRoot.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0), 0, fromY + 50);
  const hits = rc.intersectObject(sceneRoot, true).filter(h => {
    for (let o = h.object; o; o = o.parent) if (o.name && o.name.startsWith('Deep_Ocean')) return false; // el océano no es suelo
    return true;
  });
  return hits.length ? hits[0].point.y : null;
}

// ---------- comprobaciones automáticas ----------
function checkModel(key, root, entry) {
  const notes = [];
  const { box, size } = measure(root);
  const decl = entry.tamano_normalizado_XYZ_m;
  const dSize = Math.max(Math.abs(size.x - decl[0]), Math.abs(size.y - decl[1]), Math.abs(size.z - decl[2]));
  // tolerancia relativa para escenarios grandes
  const tol = entry.role === 'scene' ? Math.max(TOL_SIZE, 0.002 * Math.max(...decl)) : TOL_SIZE;
  if (dSize > tol) notes.push(`tamaño ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)} ≠ declarado ${decl.join('×')}`);
  if (entry.targetHeight_m !== undefined && Math.abs(size.y - entry.targetHeight_m) > TOL_HEIGHT)
    notes.push(`altura ${size.y.toFixed(3)} ≠ objetivo ${entry.targetHeight_m}`);
  if (entry.role !== 'scene' && Math.abs(box.min.y) > TOL_GROUND) notes.push(`no apoya en el suelo (y mín=${box.min.y.toFixed(3)})`);
  // transformación aplicada UNA sola vez
  const scaler = root.children[0];
  if (Math.abs(root.scale.x - 1) > 1e-9 || Math.abs(scaler.scale.x - entry.scale) > 1e-9) notes.push('escala duplicada o alterada');
  if (Math.abs(root.rotation.y - THREE.MathUtils.degToRad(entry.rotationY_deg)) > 1e-9) notes.push('rotación duplicada o alterada');
  return { key, ok: notes.length === 0, notes, size, minY: box.min.y, entry };
}

function renderReport(results, extra = '') {
  const lines = [];
  lines.push(`<b>Comprobación en Three.js r${THREE.REVISION}</b>`);
  for (const r of results) {
    const s = r.size;
    lines.push(`<span class="${r.ok ? 'ok' : 'bad'}">${r.ok ? 'OK   ' : 'FALLO'}</span> ${r.key.padEnd(17)} ${s.x.toFixed(2)}×${s.y.toFixed(2)}×${s.z.toFixed(2)} m  y mín ${r.minY.toFixed(3)}`);
    for (const n of r.notes) lines.push(`      <span class="bad">!! ${n}</span>`);
  }
  const bad = results.filter(r => !r.ok).length;
  lines.push(bad ? `<span class="bad">${bad} modelo(s) con problemas</span>` : '<span class="ok">Todos los modelos coinciden con la configuración.</span>');
  if (extra) lines.push(extra);
  $report.innerHTML = lines.join('\n');
  window.__REPORT = results.map(r => ({ key: r.key, ok: r.ok, notes: r.notes, size: r.size.toArray(), minY: r.minY }));
  console.table(window.__REPORT);
}

// ---------- vistas ----------
function clearStage() {
  stage.clear();
  arrows.length = 0;
}

function viewLineup(models) {
  clearStage();
  const grid = new THREE.GridHelper(14, 14, 0x9B6108, 0xb9ae9d);
  stage.add(grid);
  // Reglas horizontales a 0.5 / 1.0 / 1.5 m detrás de la fila
  [[0.5, 0x8C8D4C], [1.0, 0x9B6108], [1.5, 0x942221]].forEach(([h, c]) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-7, h, -0.9), new THREE.Vector3(7, h, -0.9)]);
    stage.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: c })));
  });
  const order = [...CHARACTERS, ...OBJECTS];
  const step = 1.7;
  const x0 = -step * (order.length - 1) / 2;
  order.forEach((k, i) => stage.add(holderFor(models[k], { x: x0 + i * step })));
  camera.position.set(0, 1.0, 7.5);
  controls.target.set(0, 0.55, 0);
  controls.update();
  return order.map(k => checkModel(k, models[k], models[k].userData.config));
}

function viewScene(key, models) {
  clearStage();
  const def = SCENES[key];
  const sc = models[key];
  stage.add(sc);
  const [ox, oz] = def.origin;
  const fwd = new THREE.Vector3(Math.sin(def.yaw), 0, Math.cos(def.yaw));
  const lat = new THREE.Vector3(Math.cos(def.yaw), 0, -Math.sin(def.yaw));
  const [dx, dz] = def.lineDir;
  const x0 = -def.spacing * (CHARACTERS.length - 1) / 2;
  const missing = [];

  const place = (k, px, pz) => {
    const gy = groundY(sc, px, pz, def.rayFrom);
    if (gy === null) missing.push(k);
    stage.add(holderFor(models[k], { x: px, y: gy ?? 0, z: pz, yaw: def.yaw }));
  };
  CHARACTERS.forEach((k, i) => place(k, ox + dx * (x0 + i * def.spacing), oz + dz * (x0 + i * def.spacing)));
  place('Pastel_de_fresas', ox + fwd.x * 2.2 - lat.x * 0.7, oz + fwd.z * 2.2 - lat.z * 0.7);
  place('fresas',           ox + fwd.x * 2.2 + lat.x * 0.7, oz + fwd.z * 2.2 + lat.z * 0.7);

  const gy = groundY(sc, ox, oz, def.rayFrom) ?? 0;
  const target = new THREE.Vector3(ox, gy + 0.8, oz);
  const cam = target.clone().addScaledVector(fwd, 5.5).addScaledVector(lat, 4).add(new THREE.Vector3(0, 3, 0));
  camera.position.copy(cam);
  controls.target.copy(target);
  controls.update();

  const res = [checkModel(key, sc, sc.userData.config)];
  const info = missing.length ? `<span class="bad">Sin suelo bajo: ${missing.join(', ')} (ajustar anclas en SCENES)</span>` : 'Personajes apoyados con raycast sobre la malla del escenario.';
  return { res, info };
}

// ---------- arranque ----------
async function main() {
  const config = await loadConfig('./assets_config.json');
  const keys = Object.keys(config.models);
  const loaded = await Promise.all(keys.map(k => loadAsset(k, config, './assets/')));
  const models = Object.fromEntries(keys.map((k, i) => [k, loaded[i]]));

  // Botones
  const buttons = {};
  const mk = (id, label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { Object.values(buttons).forEach(x => x.classList.remove('on')); b.classList.add('on'); fn(); };
    buttons[id] = b; $bar.appendChild(b);
  };
  mk('lineup', 'Alineación', () => renderReport(viewLineup(models)));
  Object.entries(SCENES).forEach(([k, d]) => mk(k, d.label, () => { const { res, info } = viewScene(k, models); renderReport(res, info); }));
  const lab = document.createElement('label');
  lab.innerHTML = '<input type="checkbox" checked> flechas de frente (rojo = +Z del personaje)';
  lab.querySelector('input').onchange = e => { showArrows = e.target.checked; arrows.forEach(a => (a.visible = showArrows)); };
  $bar.appendChild(lab);

  buttons.lineup.click();

  // Resumen global de TODOS los modelos (independiente de la vista actual)
  window.__ALL = keys.map(k => checkModel(k, models[k], config.models[k]));
  console.log('Resumen global:', window.__ALL.map(r => `${r.ok ? 'OK' : 'FALLO'} ${r.key}`).join(' | '));

  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}

main().catch(err => {
  $report.innerHTML = `<span class="bad">Error: ${err.message}</span>\nAbre la página desde un servidor (npm start), no con file://.`;
  console.error(err);
});

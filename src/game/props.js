// Elementos de nivel construidos con formas low poly sencillas y la paleta del juego
// (el GLB `puente` no incluye compuerta ni carteles). Los personajes y escenarios siguen siendo los GLB originales.
import * as THREE from 'three';

const flat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const WOOD = 0x9B6108, DARK = 0x6e4506, RED = 0x942221, OLIVE = 0x8C8D4C, CREAM = 0xFFFFFE;

function labelTexture(lines, { w = 512, h = 256, bg = '#FFFFFE', fg = '#3a2a14', border = '#9B6108' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lh = h / (lines.length + 1);
  lines.forEach((t, i) => {
    g.font = `700 ${i === 0 ? 58 : 44}px "Fredoka","Trebuchet MS",sans-serif`;
    g.fillText(t, w / 2, lh * (i + 1));
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
function board(w, h, lines, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [flat(DARK), flat(DARK), flat(DARK), flat(DARK),
    new THREE.MeshBasicMaterial({ map: labelTexture(lines, opts) }), flat(DARK)]);
  return m;
}
const box = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(c)); m.position.set(x, y, z); return m; };

/** Cartel con pista. Su cara con texto mira hacia -Z (hacia quien viene del inicio del sendero). */
export function makeSign(lines) {
  const g = new THREE.Group(); g.name = 'sign';
  g.add(box(0.14, 1.5, 0.14, WOOD, 0, 0.75, 0));
  const b = board(1.3, 0.8, lines, { bg: '#D9CFC3' }); b.position.set(0, 1.45, -0.1); b.rotation.y = Math.PI; g.add(b);
  g.add(box(1.4, 0.1, 0.18, DARK, 0, 1.9, -0.1));
  return g;
}

/**
 * Compuerta que cierra la entrada del puente. Ocupa el ancho `width` en X (centro en 0) y mira a -Z.
 * open(p): p 0..1 (0 = cerrada, 1 = abierta). Las barras giran hacia arriba y el cartel se retira.
 */
export function makeGate(width = 4.2) {
  const g = new THREE.Group(); g.name = 'gate';
  const half = width / 2;
  g.add(box(0.3, 1.9, 0.3, DARK, -half, 0.95, 0)); g.add(box(0.3, 1.9, 0.3, DARK, half, 0.95, 0));
  const capL = box(0.4, 0.18, 0.4, RED, -half, 1.95, 0), capR = box(0.4, 0.18, 0.4, RED, half, 1.95, 0); g.add(capL, capR);
  const mkArm = (dir) => {
    const pivot = new THREE.Group(); pivot.position.set(dir * half, 0, 0);
    [0.55, 1.1, 1.5].forEach((y, i) => { const bar = box(half - 0.2, 0.16, 0.14, i === 1 ? WOOD : DARK, -dir * (half - 0.2) / 2 - dir * 0.15, y, 0); pivot.add(bar); });
    pivot.add(box(0.14, 1.0, 0.14, DARK, -dir * (half - 0.15), 1.05, 0));
    g.add(pivot); return pivot;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  const sign = board(1.9, 0.95, ['PUENTE CERRADO', 'Resuelve el acertijo'], { bg: '#FFFFFE', border: '#942221', fg: '#942221' });
  sign.position.set(0, 1.0, -0.12); sign.rotation.y = Math.PI; g.add(sign);
  const post = box(0.2, 1.3, 0.2, DARK, 0, 0.65, -0.05); g.add(post);
  g.userData.open = p => {
    const e = p * p * (3 - 2 * p);
    armL.rotation.z = -e * 1.35; armR.rotation.z = e * 1.35;            // se levantan como una barrera
    sign.position.y = 1.0 - e * 1.4; post.scale.y = Math.max(0.001, 1 - e); post.position.y = 0.65 * (1 - e);
    sign.visible = e < 0.98;
    capL.material.color.setHex(e > 0.5 ? OLIVE : RED); capR.material.color.setHex(e > 0.5 ? OLIVE : RED);
  };
  g.userData.open(0);
  return g;
}

/** Bandera de punto de control. set(active): verde/olivo cuando ya fue alcanzada, roja mientras no. */
export function makeCheckpoint(label) {
  const g = new THREE.Group(); g.name = 'checkpoint';
  g.add(box(0.12, 2.2, 0.12, DARK, 0, 1.1, 0));
  const flagMat = flat(RED);
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 3), flagMat); flag.rotation.z = -Math.PI / 2; flag.position.set(0.5, 1.85, 0); g.add(flag);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.12, 8), flat(OLIVE)); base.position.y = 0.06; g.add(base);
  if (label) { const b = board(1.2, 0.5, [label], { bg: '#FFFFFE', border: '#8C8D4C' }); b.position.set(0, 2.5, 0); g.add(b); g.userData.label = b; }
  g.userData.set = on => flagMat.color.setHex(on ? OLIVE : RED);
  g.userData.flag = flag;
  return g;
}

/** Flecha flotante sobre el personaje seleccionado. */
export function makeMarker(color) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), flat(color)); m.rotation.x = Math.PI; m.name = 'marker';
  return m;
}
export { CREAM };

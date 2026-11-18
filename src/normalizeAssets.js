// normalizeAssets.js — aplica assets_config.json a los GLB originales (sin modificarlos).
// world = position + RotY(rotationY_deg) * ( scale * (modelo - pivot) )
// NOTA: no pude ejecutarlo aquí (sin Three.js en el entorno); la misma fórmula y el mismo JSON
// se usaron en los renders de verificación.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadConfig(url = './assets_config.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  return res.json();
}

export function normalizeModel(key, gltfScene, entry) {
  const [px, py, pz] = entry.pivot;
  gltfScene.position.set(-px, -py, -pz);          // pivote -> origen (en unidades originales)
  const scaler = new THREE.Group();
  scaler.scale.setScalar(entry.scale);            // escala uniforme: no deforma
  scaler.add(gltfScene);
  const root = new THREE.Group();
  root.name = key;
  root.rotation.y = THREE.MathUtils.degToRad(entry.rotationY_deg);
  root.add(scaler);
  root.position.set(...entry.position);
  return root;
}

export async function loadAsset(key, config, basePath = './assets/', loader = new GLTFLoader()) {
  const entry = config.models[key];
  if (!entry) throw new Error(`Modelo no definido en la configuración: ${key}`);
  const gltf = await loader.loadAsync(basePath + entry.file);
  const root = normalizeModel(key, gltf.scene, entry);
  root.userData.config = entry;
  return root;
}

// Comprobación en desarrollo: altura real en metros vs. altura objetivo
export function checkHeight(root) {
  const box = new THREE.Box3().setFromObject(root);
  const h = box.max.y - box.min.y;
  const t = root.userData.config?.targetHeight_m;
  console.log(`[${root.name}] alto=${h.toFixed(2)} m` + (t ? ` (objetivo ${t})` : '') + ` | y mín=${box.min.y.toFixed(3)}`);
  return { height: h, minY: box.min.y };
}

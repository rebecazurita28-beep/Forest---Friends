// Carga de todos los GLB originales con normalizeAssets.js (una sola vez).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadConfig, loadAsset } from '../normalizeAssets.js';

export async function loadAll(onProgress = () => {}) {
  const config = await loadConfig('./assets_config.json');
  const keys = Object.keys(config.models);
  const loader = new GLTFLoader();
  let done = 0;
  const roots = await Promise.all(keys.map(async k => {
    const r = await loadAsset(k, config, './assets/', loader);
    onProgress(++done / keys.length, k);
    return r;
  }));
  return { config, models: Object.fromEntries(keys.map((k, i) => [k, roots[i]])) };
}

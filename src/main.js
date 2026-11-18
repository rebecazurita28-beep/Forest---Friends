// Punto de entrada de Forest Friends. (La escena de verificación anterior sigue en verify.html / src/verify.js)
import { UI } from './game/ui.js';
import { loadAll } from './game/loader.js';
import { Game } from './game/game.js';

const ui = new UI();
const fail = err => {
  console.error(err);
  ui.error('Error: ' + (err?.message || err) + '\nAbre la página desde un servidor (npm start → http://localhost:8080), no con file://. Se necesita internet para cargar Three.js.');
};
addEventListener('error', e => fail(e.error || e.message));
addEventListener('unhandledrejection', e => fail(e.reason));

try {
  const loaded = await loadAll((p, k) => ui.setLoading(p, `Cargando ${k}…`));
  const game = new Game(loaded, ui);
  window.__game = game;           // depuración desde la consola
  game.start();
  ui.show('loading', false);
} catch (e) { fail(e); }

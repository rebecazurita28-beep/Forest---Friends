# Forest Friends

Juego 3D (HTML + CSS + JavaScript + Three.js r170, estilo low poly).

## Ejecutar
```
cd forest-friends
npm start            # = npx http-server . -p 8080 -c-1
```
Abre http://localhost:8080 (no funciona con file://). Necesita internet para cargar Three.js desde jsDelivr.
Sin internet: `npm i three@0.170.0` y cambia el importmap de `index.html` a
`"three": "./node_modules/three/build/three.module.js"` y `"three/addons/": "./node_modules/three/examples/jsm/"`.

## Controles
Nivel 3: Espacio = ahuyentar al zorro cuando aparezca la señal (Enter salta la cinemática) · ESC pausa.
Controles del Nivel 2: flechas mover · Espacio saltar (huecos) · Tab/1-2-3 cambiar personaje.
Niveles: 1 · El puente del acertijo → 2 · El puente colgante → cinemática «La montaña más alta» (fresas) → 3 · La cueva del zorro (enfrentamiento con el zorro con la barra espaciadora) → cinemática final «De vuelta en el bosque» (reencuentro con Berry, pastel, celebración) → pantalla «¡AVENTURA COMPLETADA!» con créditos.
Cinemática final: Espacio / Enter (o el botón «Saltar») la saltan y llevan a la pantalla final.
Créditos: edita los nombres del equipo en `src/game/storyEnd.js` (constante `CREDITS`).
Flechas: mover · E: interactuar / avanzar diálogo · en el acertijo: 1-4 o clic para responder, ESC cierra · Tab o 1-2-3: cambiar de personaje · Espacio: acción especial (niveles posteriores) · ESC: pausa · arrastrar ratón: cámara · rueda: zoom.

## Estructura
- `index.html`, `css/style.css`, `src/main.js` (entrada) y `src/game/*` (config, input, physics, sequencer, world, character, camera, loader, ui, menu, intro, level1, game, finale, storyEnd).
- `src/normalizeAssets.js` + `assets_config.json` + `assets/*.glb`: ORIGINALES, no se modifican.
- `verify.html` + `src/verify.js`: escena de verificación de escalas (la anterior).
- `npm test`: tests de lógica + prueba de humo del Nivel 2 (`tests/smoke_level2.mjs`) + de la cinemática (`tests/smoke_story.mjs`) + del Nivel 3 (`tests/smoke_level3.mjs`) + de la cinemática final (`tests/smoke_finale.mjs`), todas con un Three.js simulado + `tools/sim_colgante/sim.mjs`.
- `tests/logic.test.mjs` (`node --test tests/logic.test.mjs`): física, entrada y secuenciador.
- `tools/sim_bridge/sim.mjs`: simulación del cruce del puente (`node tools/sim_bridge/sim.mjs old|new`).
- `tools/verify_config.py` (`python3 -I tools/verify_config.py`): comprueba la configuración contra los GLB sin Three.js.
- `PROGRESS.md`: estado por etapas.

## Reglas para no duplicar transformaciones
`loadAsset()` devuelve un `root` que YA lleva escala, rotación y pivote. No volver a escalarlo ni girarlo: se orienta/mueve con un `Group` externo (ver `Character`).

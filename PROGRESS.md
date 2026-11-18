# Progreso

| Etapa | Contenido | Estado |
|---|---|---|
| 0 | Análisis, normalización, verificación visual de modelos | Hecha y aceptada |
| 1 | Estructura, cámara 3ª persona, movimiento, colisiones, pausa, cambio de personaje | Escrita; pendiente de prueba en navegador |
| 2 | Pantalla de inicio (presentación de los 4 personajes) + cinemática de introducción | Escrita; pendiente de prueba en navegador |
| 3 | Pulido de animación procedural | Pendiente |
| 4 | Nivel 1: El puente del acertijo | Escrito; simulado con la geometría real, pendiente de prueba en navegador |
| 5 | Nivel 2: El puente colgante | Pendiente |
| 6 | Intermedio: La montaña más alta | Pendiente |
| 7 | Nivel 3: La cueva del zorro | Pendiente |
| 8 | Final (cinemática), victoria, rejugar, créditos | Escrito; probado con Three.js simulado, pendiente de prueba en navegador |

## Ajustes visuales (tras la primera prueba)
- Pantalla de inicio: botones de personajes, «Comenzar» y pista en un contenedor `#dock` con separación propia.
- Pastel y fresas ya no se muestran en inicio ni en la cinemática; los modelos siguen cargados en `game.models` y se añadirán en sus escenas (recogida de fresas / pastel final).
- Cinemática: los cuatro amigos en grupo compacto sobre el camino (separación ≈ 0.9 m, escalonados).
- Pastel: vuelve a aparecer en la cinemática (escenas 2 y 3, sobre Berry). Helpers `Game.showModel/hideModel` controlan su visibilidad: se oculta al volver al título y al terminar la cinemática. La escena final (Etapa 8) usará `showModel('Pastel_de_fresas', …)`.

## Nivel 1 · El puente del acertijo
- `src/game/flow.js` (lógica pura, con tests): acertijo, intentos, pista y fases del nivel (explorar → acertijo → desbloqueado → completado).
- `src/game/props.js`: compuerta y cartel low poly en paleta del juego (el GLB no trae compuerta ni carteles).
- `src/game/level1.js`: reescrito sobre la base anterior (seguimiento, cambio de personaje, colisiones intactos).
- UI: panel del acertijo y tarjeta de fin de nivel (`index.html`, `css/style.css`, `src/game/ui.js`); `game.js`: ESC cierra el acertijo, progreso en localStorage, transición al Nivel 2 (aviso, aún sin construir).
- Berry ya no aparece en el nivel (se queda en casa); antes era solo un NPC de pruebas.

## Corrección: los personajes se atascaban en el puente
- Causa: el tablero de `puente.glb` está hecho de tablones de ≈1.1 m con rendijas de ≈0.10 m. El rayo de suelo (uno solo, en el centro del personaje) caía por la rendija, veía agua/terreno bajo el puente y lo tomaba por vacío: el personaje se frenaba o se hundía.
- Arreglo (sin quitar colisiones ni tocar el GLB): `resolveGround` en `src/game/physics.js` mira también a ambos lados del punto; solo si los dos lados son suelo (rendija entre tablones) lo trata como tablero. Los bordes reales (río, costados) siguen sólidos.
- El seguimiento de compañeros se extrajo a `followStep` (misma lógica) para poder probarlo.
- Pruebas: 14 tests Node (3 nuevos) y `node tools/sim_bridge/sim.mjs old|new` (simulación con el tablero exacto del GLB).

## Nivel 2 · El puente colgante
- `src/game/level2.js` (Three.js): islas y puentes de `Puente_colgante.glb`; control de un personaje a la vez (los demás esperan); peligros reales en los puentes (tablones rojizos que tiemblan ~1 s y se desprenden, tablones verdosos que se inclinan y hacen resbalar, huecos que se saltan con Espacio, balanceo que empuja un poco; puente 2 más difícil); salto (`jump` en physics.js); caídas (`y < -5`) → último punto de control propio; banderas de control; marcador del personaje activo; presentación y pantalla de fin.
- `src/game/flow2.js` (lógica pura, con tests): progreso individual, puntos de control, llegada de los tres, `PlankField` (rotura/inclinación/reposición), `LAYOUT` y `HAZ` (parámetros de dificultad).
- `Game` ahora maneja dos niveles (`this.level`); `goNextLevel()` lleva del Nivel 1 al 2; `goNextLevel2()` muestra el aviso «La montaña más alta» (Nivel 3 sin construir).
- `WorldQueries` acepta una función como regla `walkable` y `when` en los obstáculos (compatible con las reglas por RegExp del Nivel 1).
- Decisiones: las rocas decorativas pequeñas que están SOBRE un tablón o tapan la salida de un puente no tienen colisión (así nadie se atora); el borde de islas y puentes es vacío (se cae), sin muros invisibles.
- Pruebas: `npm test` = 21 tests de lógica + prueba de humo (`tests/smoke_level2.mjs`, con Three.js simulado) + simulación con la geometría exacta (`tools/sim_colgante/sim.mjs`).

### Ajuste de dificultad del Nivel 2
- Parámetros en `flow2.js` (`LAYOUT`, `HAZ`). Calibración con `tools/sim_colgante/sim.mjs`: un jugador que corrige y salta completa el 100 %; recto o sin saltar cae; con todos los tablones rotos aún se cruza saltando.
- Sin probar en navegador real: sensación del salto, visuales de temblor/caída/inclinación, intensidad del balanceo y cámara.

## Intermedio · La montaña más alta (cinemática, NO es un nivel) → Nivel 3
- `src/game/story.js` (datos puros): guion, duraciones, carriles de los personajes, planos de cámara y zona de árboles que la cámara evita.
- `src/game/mountain.js`: escenario `paramo.glb` + canasta `fresas.glb`. Parte A (llegada → olor a fresas → hallazgo → celebración → ventana «¡Lo lograron!» con botón Continuar) y parte B (deciden el atajo → caminan hacia la cueva → fundido a negro → Nivel 3). Botón/Espacio saltan cada parte.
- (Superado por el Nivel 3 completo, ver abajo.)
- `game.js`: `goNextLevel2()` ahora lanza la cinemática; `beginLevel3()`; estados `mountain` y `level3`.
- Pruebas: `tests/smoke_story.mjs` (código real sobre Three.js simulado) + test de guion en `tests/logic.test.mjs`.

### Ajuste visual de «La montaña más alta»
- Escena movida al centro del terreno real de `paramo.glb` (rectángulo x ±18, z ±25,2): personajes en z≈2…10 sobre el sendero, canasta en z=11, siempre a ≥ 6 m de cualquier borde. Antes salían de z=-26 (fuera del terreno).
- Cámaras rehechas (`CAMS` en `story.js`): más cercanas, algo hacia abajo y mirando hacia el oeste/norte (cordillera y terreno al fondo). Neblina más corta (`FOG`) para que el borde lejano del terreno se funda con el fondo.
- `tests/framing_lib.mjs` + `tests/smoke_story.mjs`: analizan CADA cuadro de la cinemática (vacío visible ≤ 3 %, personajes y canasta dentro de la imagen en 16:9 y 4:3, sobre el terreno, fuera de los árboles).

## Nivel 3 · La cueva del zorro
- `src/game/flow3.js` (lógica pura, con tests): `Showdown`, la prueba de reacción con la barra espaciadora. Ronda de 3 intentos; cada intento = «¡Prepárate!» → espera irregular (ciclo fijo, sin azar) → ventana («¡AHORA!», 0,9 s + 0,15 s por fallo + 0,2 s por ronda fallada). Solo cuenta la PULSACIÓN nueva (mantener no sirve) y pulsar antes de la señal es fallo (aporrear tampoco gana). Tras 3 fallos la ronda se reinicia con más margen; nunca se pierde el progreso.
- `src/game/story3.js` (datos): guion, posiciones (medidas reales de `Cueva.glb`), obstáculos (estalagmitas/cristales), planos de cámara, tiempos.
- `src/game/level3.js`: título → entrada (avanzan) → pausa → aparece el zorro (`zorro.glb`) → se acerca a las fresas → sorpresa → ENFRENTAMIENTO → el zorro retrocede y sale volando → celebración → ventana «¡Nivel 3 completado!» (Repetir / Continuar). Animación procedural (los GLB no traen). Enter/botón saltan la cinemática (Espacio NO, para no interferir con la mecánica).
- UI: panel de reacción `#react` (index.html, style.css, `ui.react`).
- `game.js`: Nivel 3 corre en el estado `play` (ESC pausa/reinicia como los otros niveles); `goNextLevel3()` lanza la cinemática final.
- Pruebas: 6 tests de lógica del enfrentamiento + `tests/smoke_level3.mjs` (recorrido completo y encuadre de cada cuadro).

## Final · De vuelta en el bosque (cinemática, NO es un nivel) + pantalla de victoria
- `src/game/storyEnd.js` (datos): guion, posiciones (relativas al inicio del sendero del Nivel 1), planos de cámara, tiempos, confeti, textos de la pantalla final y `CREDITS` (créditos editables).
- `src/game/finale.js`: reutiliza el bosque de `puente.glb` (escena del Nivel 1, tramo llano cerca del inicio). Pasos: fundido a negro con el texto del regreso → llegada del trío con la canasta (`fresas.glb`) → Berry los ve, salta y corre → abrazo y diálogos → cocina (pantalla en negro con iconos 🥣🍓🔥🎂 y subtítulos; el cambio de escenario ocurre en el negro) → revelación de `Pastel_de_fresas.glb` sobre una mesa baja con los cuatro en anillo → celebración (saltitos por turnos, giros, confeti suave) → pantalla final sobre la escena que sigue celebrando. Espacio/Enter/botón saltan directamente a la escena final.
- Ajustes temporales solo durante el final (se restauran en `reset()`): neblina más cercana (24/75 m) para fundir el horizonte con el cielo; se ocultan la compuerta y el cartel del Nivel 1.
- `ui.js` / `index.html` / `style.css`: `captionTop` (subtítulo sobre el negro), `cook` (icono de cocina), `ending` (logo original, «¡AVENTURA COMPLETADA!», frase, botones y créditos).
- `game.js`: estado `finale`; `goNextLevel3()` (fundido → cinemática), `replayAdventure()` (título → cinemática inicial → Nivel 1), `goTitle()` reinicia el final y retira el pastel.
- Pruebas: 2 tests de lógica de datos + `tests/smoke_finale.mjs` (recorrido completo cuadro a cuadro, encuadre de los 4 amigos y el pastel en 16:9 y 4:3, separación, vacío, saltos con Espacio desde 6 puntos distintos, rutas reales de `game.js`).

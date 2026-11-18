// Nivel 3 · La cueva del zorro: datos puros (guion, posiciones, planos de cámara, tiempos). Medidas reales de Cueva.glb ya normalizado
// (escala 0,7): suelo x ±8,4 · z ±7,7 · y=0; entrada = arco en z 4,73…6,48 con hueco x ±2,84; paredes |x| ≥ 6,44; pared del fondo z ≤ -5,25.
// La cueva se recorre hacia -Z (la entrada está en +Z). Los personajes miran a -Z (yaw π); el zorro mira a +Z (yaw 0).
export const LEVEL3 = {
  title: 'Nivel 3: La cueva del zorro',
  brief: 'Los amigos toman un atajo por el interior de la montaña para volver más rápido al bosque. Pero la cueva está oscura… y alguien los vigila entre las sombras. ' +
    '¡Protejan las fresas! Cuando el zorro ataque, pulsa la barra espaciadora justo cuando aparezca la señal.',
  button: '¡Entrar en la cueva!',
};
// Obstáculos reales del suelo (estalagmitas y cristales): [minX, minZ, maxX, maxZ]
export const ROCKS = [
  [2.55, -4.72, 3.11, -4.24], [-0.23, 1.6, 0.33, 2.08], [3.42, 0.39, 3.98, 0.87], [-1.18, 1.31, -0.62, 1.8], [-1.04, -0.25, -0.48, 0.23],
  [-3.24, 2.46, -2.68, 2.94], [0.12, -1.02, 0.68, -0.54], [4.84, -1.0, 5.4, -0.52], [-4.2, 1.21, -3.64, 1.69], [-2.47, 1.02, -1.91, 1.5],
  [-1.05, -3.75, -0.49, -3.27], [-4.83, -0.07, -4.27, 0.41], [2.0, -4.93, 2.56, -4.45], [3.45, 1.54, 4.01, 2.02],
  [-5.82, -2.29, -5.38, -1.91], [-5.12, -2.99, -4.68, -2.61], [5.38, -3.69, 5.82, -3.31], [5.59, -2.38, 6.04, -1.99], [-6.52, 2.61, -6.08, 2.99], [6.08, 1.21, 6.52, 1.59],
];
// Dónde puede estar la cámara (dentro de la cueva, por encima de las estalagmitas y bajo la bóveda)
export const CAM_BOX = { minX: -5.6, maxX: 5.6, minZ: -4.6, maxZ: 4.9, minY: 1.2, maxY: 2.9 };

export const POS = {
  start: { Toffee: [1.0, 4.4], Cookie: [2.05, 4.2], Bobby: [2.95, 4.5] },    // dentro de la entrada (z < 4,73), en el hueco del arco
  end:   { Toffee: [1.0, 1.35], Cookie: [2.05, 1.0], Bobby: [3.0, 1.4] },    // tras avanzar un poco por el interior
  foxSpawn: [1.7, -3.4], foxRest: [1.15, -0.55], foxScale: 1.3,
  carry: { y: 0.5, dz: -0.5 },                                               // la canasta, delante de Toffee (que mira a -Z)
};
export const FOX = { lunge: 0.45, tug: 0.3, scareDist: 2.2, flight: { dz: 17, dy: 7.5, dx: 1.6 } };

export const T = {
  a1: 'Los amigos toman el atajo y se adentran en la cueva de la montaña… dentro todo es silencio y sombras.',
  a2: 'Cookie: «¡Qué oscuro! Pero con este atajo llegaremos al bosque mucho antes.»',
  a3: 'Bobby: «Shhh… ¿Oyen eso? Hay algo moviéndose al fondo de la cueva…»',
  f1: '¡Unos ojos brillan entre las sombras! ¡Es un zorro!',
  f2: 'Zorro: «Jejeje… ¡Qué fresas tan jugosas! ¡Serán mías!»',
  f3: 'Toffee: «¡Oye! ¡Esas fresas son para el pastel de Berry! ¡No dejaremos que te las lleves!»',
  v1: 'Zorro: «¡AAAY! ¡Qué susto!»',
  v2: 'Zorro: «¡Me voy volaaaando…!»',
  v3: 'Bobby: «¡Lo logramos! ¡Las fresas están a salvo!»',
};
export const DUR = { arrive: [5.5, 6, 5], fox: [4.5, 5.5, 5], scare: 2.4, flight: 2.4, party: 5.5 };
export const DONE = {
  title: '¡Nivel 3 completado!',
  text: 'Toffee, Cookie y Bobby ahuyentaron al zorro y protegieron las fresas. ¡Ya solo falta volver al bosque y preparar el pastel para Berry!',
  next: 'Continuar ▶', again: 'Repetir el nivel',
};

// Planos de cámara: { from, to, lf, lt } (posición y punto de mira, inicial/final). Metros.
export const CAMS = {
  A1: { from: [-3.4, 2.3, 0.6], to: [-2.5, 2.0, 1.4], lf: [1.7, 1.1, 4.5], lt: [1.9, 1.1, 3.9] },
  A2: { from: [-2.0, 1.7, 4.2], to: [-1.4, 1.6, 3.0], lf: [2.0, 1.0, 3.6], lt: [2.0, 0.9, 1.8] },
  A3: { from: [2.0, 2.3, 4.8], to: [2.0, 2.1, 4.5], lf: [2.0, 0.9, 0.0], lt: [2.0, 0.9, -0.6] },
  F1: { from: [2.0, 2.7, 4.8], to: [2.0, 2.6, 4.5], lf: [1.8, 0.4, -1.0], lt: [1.7, 0.5, -1.8] },
  F2: { from: [4.6, 2.5, 4.8], to: [4.2, 2.4, 4.4], lf: [1.9, 0.5, 0.4], lt: [1.8, 0.6, 0.2] },
  F3: { from: [2.0, 2.6, 4.8], to: [2.0, 2.5, 4.5], lf: [1.8, 0.5, 0.2], lt: [1.8, 0.5, 0.2] },
  S:  { from: [2.0, 2.4, 4.6], to: [2.0, 2.4, 4.6], lf: [1.9, 0.8, 0.3], lt: [1.9, 0.8, 0.3] },          // enfrentamiento (fijo y claro)
  V1: { from: [2.0, 2.4, 4.6], to: [2.0, 2.3, 4.2], lf: [1.9, 0.8, 0.3], lt: [1.8, 0.8, -0.8] },
  V2: { from: [-2.4, 1.7, 0.4], to: [-1.8, 1.9, 0.6], follow: true },                                       // sigue al zorro
  V3: { from: [1.9, 1.7, -3.3], to: [1.9, 1.9, -2.9], lf: [2.0, 1.0, 1.2], lt: [2.0, 1.1, 1.2] },
};
export const insideRock = (x, z, m = 0.0) => ROCKS.some(([a, b, c, d]) => x > a - m && x < c + m && z > b - m && z < d + m);

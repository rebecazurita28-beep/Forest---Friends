// Guion y planos del intermedio "La montaña más alta" (cinemática, NO es un nivel jugable) y del arranque del Nivel 3.
// Datos puros (sin Three.js) para poder comprobarlos en Node. Coordenadas ya normalizadas de paramo.glb (escala 0.6).
// Neblina de la escena: lo que queda más allá se funde con el fondo (el borde del terreno no se distingue del horizonte).
export const FOG = { near: 12, far: 40, visibleUntil: 30 };
// Escena situada hacia el centro del terreno, con la cordillera al oeste (-X) como fondo; los árboles sueltos se evitan (KEEP_OUT).
// Límites REALES de paramo.glb (ya normalizado): el terreno es un rectángulo; fuera de él solo hay vacío.
// (El sendero asoma unos metros por z<-25,2 y z>25,2: ahí NO se coloca a nadie.)
export const TERRAIN = { minX: -18, maxX: 18, minZ: -25.2, maxZ: 25.2 };
// Cajas aproximadas de las montañas (borde oeste, x<-7), ya reducidas para no sobrestimar lo que tapan: {min:[x,y,z], max:[x,y,z]}
export const MOUNTAINS = [
  [[-20.4, 0, 14.6], [-13.3, 7.3, 21.4]], [[-23.5, 0, 6.5], [-17.4, 9.2, 12.7]], [[-25.2, 0, -6.6], [-18.1, 9.9, 4.2]],
  [[-22.3, 0, -17.4], [-16.2, 8, -9]], [[-15.1, 0, -25.9], [-10.2, 6.6, -18.5]], [[-14.1, 0, 22.4], [-9.5, 6, 28.9]], [[-7.5, 0, -30.6], [-1.8, 5.4, -24.8]],
];
// Escena ubicada hacia el CENTRO del terreno (x≈5, z≈2..11), con la cordillera al oeste como fondo. El sendero baja de x≈6,8 (z=-26) a x≈4,8 (z=26).
export const TRAIL_X = z => 6.8 - 2 * (z + 26.3) / 52;
export const BASKET = { x: TRAIL_X(11), z: 11, scale: 1.6 };
// Carriles de los tres (dx respecto al sendero) y su recorrido en z: salida → punto medio → junto a la canasta
export const LANES = {
  Toffee: { dx: -0.9, z0: 1.9, zMid: 8.1, zEnd: 9.6 },
  Cookie: { dx: 0.0, z0: 2.7, zMid: 8.5, zEnd: 9.9 },
  Bobby:  { dx: 0.9, z0: 2.3, zMid: 8.8, zEnd: 9.6 },
};
export const WALK_AWAY = 7;      // metros que caminan hacia la cueva (hacia -z) en el último plano
// Zonas con árboles cerca del sendero que la cámara y los personajes NO deben pisar
export const KEEP_OUT = [
  { minX: -1.5, maxX: 3.0, minZ: -4.5, maxZ: 1.5 }, { minX: -1.5, maxX: 3.0, minZ: 2.5, maxZ: 8.0 },
  { minX: 7.5, maxX: 10.5, minZ: -6.5, maxZ: -4.5 }, { minX: 7.5, maxX: 10.5, minZ: -0.5, maxZ: 2.0 },
  { minX: -0.5, maxX: 3.0, minZ: 8.5, maxZ: 12.5 }, { minX: -0.5, maxX: 3.0, minZ: 13.5, maxZ: 16.5 },
];
// Planos de cámara: { from, to, lf, lt } = posición inicial/final y punto al que mira (inicial/final). Metros.
// Criterio: cámara a ≤ 9 m del grupo, mirando hacia el OESTE/NORTE (cordillera y terreno al fondo, nunca hacia el borde este/sur-lejano) y algo hacia abajo.
export const CAMS = {
  A1: { from: [11.8, 3.4, 0.2], to: [10.4, 2.8, 3.0], lf: [3.8, 1.8, 5.8], lt: [5.6, 1.1, 6.0] },
  A2: { from: [10.2, 2.7, 2.7], to: [8.8, 2.4, 6.4], lf: [5.8, 0.8, 5.0], lt: [5.7, 0.8, 8.8] },
  A3: { from: [9.0, 1.8, 14.2], to: [7.8, 1.6, 13.6], lf: [5.5, 0.9, 9.6], lt: [5.5, 0.8, 10.2] },
  A4: { from: [4.0, 1.7, 14.0], to: [5.0, 1.6, 13.2], lf: [5.6, 0.9, 10.3], lt: [5.6, 0.9, 10.0] },
  A5: { center: [5.6, 1.0, 10.0], radius: 3.8, h: 1.9, a0: 0.38, a1: 0.06 },   // órbita (π·a) del lado norte al este: el grupo de frente y la cordillera al fondo
  B1: { from: [4.0, 1.8, 14.0], to: [4.6, 1.8, 13.4], lf: [5.6, 1.0, 9.9], lt: [5.6, 1.0, 9.9] },
  B2: { from: [7.0, 1.8, 14.0], to: [6.4, 1.8, 13.4], lf: [5.6, 1.0, 9.9], lt: [5.6, 1.0, 9.9] },
  B3: { from: [7.2, 1.8, 13.6], to: [6.6, 1.8, 12.8], lf: [5.8, 1.0, 9.8], lt: [5.8, 1.0, 9.8] },
  B4: { from: [5.6, 1.6, 13.0], to: [5.6, 1.9, 13.4], lf: [5.6, 1.2, 9.8], lt: [5.6, 1.2, 9.8] },
  B5: { from: [5.5, 2.6, 14.0], to: [5.6, 3.4, 12.6], lf: [5.6, 1.0, 8.4], lt: [5.7, 1.0, 3.6] },
};

export const T = {
  a1: 'Tras cruzar el puente colgante, Toffee, Cookie y Bobby llegan por fin a la montaña más alta.',
  a2: 'Bobby: «¡Esperen! ¡Huelo algo dulce… muy cerca de aquí!»',
  a3: 'Cookie: «¡Miren! ¡Allí, junto al sendero! ¡Es una canasta de fresas!»',
  a4: 'Toffee: «¡Son las fresas de la montaña más alta! ¡Por fin las encontramos!»',
  a5: '¡Hurra! ¡Toffee, Cookie y Bobby celebran haber conseguido su objetivo!',
  b1: 'Toffee: «Ya tenemos las fresas… pero volver por el puente y el camino largo nos llevará muchísimo tiempo.»',
  b2: 'Cookie: «Berry nos espera para el pastel. ¡Tenemos que regresar al bosque cuanto antes!»',
  b3: 'Bobby: «Huelo una cueva al otro lado de la montaña. Si la cruzamos, ¡llegaremos mucho más rápido!»',
  b4: 'Toffee: «Es un atajo un poco misterioso… pero por Berry, ¡vamos!»',
  b5: 'Y así, con la canasta a salvo, los tres amigos se internan en el camino hacia la cueva…',
};
export const CONGRATS = { title: '¡Lo lograron!', text: '¡Encontraron las fresas! Ahora podrán preparar el pastel para Berry.', button: 'Continuar ▶' };

// Duración (s) de cada paso: parte A (llegada y hallazgo) y parte B (decisión del atajo)
export const DUR = { A: [6, 5.5, 5, 5.5, 5.5], B: [5, 4.5, 5, 4, 6.5] };

export const LEVEL3 = {
  title: 'Nivel 3: La cueva del zorro',
  text: 'Para volver al bosque antes de que se haga de noche, Toffee, Cookie y Bobby entran en la cueva de la montaña. Dentro, unos ojos brillantes los observan en la oscuridad… ' +
    '(El juego de esta cueva se construirá en la siguiente etapa del desarrollo.)',
  party: { z: 7.0, yaw: Math.PI, dx: [-1.3, 0, 1.3] },     // delante de la entrada (+Z), mirando hacia -Z
};

export const insideKeepOut = (x, z) => KEEP_OUT.some(k => x >= k.minX && x <= k.maxX && z >= k.minZ && z <= k.maxZ);

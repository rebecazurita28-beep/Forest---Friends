// Cinemática final "De vuelta en el bosque": datos puros (guion, posiciones, planos de cámara, tiempos, créditos).
// Escenario: el bosque del nivel 1 (puente.glb) en el tramo de sendero cercano al punto de inicio S (level1.spawn).
// Todas las coordenadas son RELATIVAS a S: `dz` = metros hacia +Z desde S (hacia el puente), `dx` = desplazamiento lateral respecto a la
// línea central del sendero a esa profundidad. Medidas reales de puente.glb (ya normalizado): terreno x -18…19, z -28…28 (S ≈ x 2,2 · z -22,9);
// el tramo S+0…S+20 es llano (±0,15 m), sin árboles ni agua en ±6 m del sendero.
// Convención: los personajes miran a +Z con yaw 0. Berry espera mirando a +Z; los tres viajeros llegan caminando hacia -Z (yaw π).

export const FIN = {
  // Fase 1 · Reencuentro
  berryStart: [0, 4.5],
  trioStart: { Toffee: [0, 17.0], Cookie: [-1.3, 18.4], Bobby: [1.3, 18.1] },
  trioNear:  { Toffee: [0, 11.5], Cookie: [-1.3, 12.4], Bobby: [1.3, 12.1] },     // fin del tramo de llegada
  hug: { Berry: [0, 8.0], Toffee: [0, 9.5], Cookie: [-1.3, 9.2], Bobby: [1.3, 9.2] },   // reunidos
  // Fase 2 · Pastel: centro de la mesa y anillo de amigos (relativo al centro del pastel)
  cakeDz: 9.0,
  ring: { Cookie: [-2.2, 0.5], Toffee: [-1.0, 1.5], Berry: [1.0, 1.5], Bobby: [2.2, 0.5] },
  faceAt: [0, -1.5],                    // todos miran a un punto delante del pastel (hacia la cámara): se ven de 3/4 y no le dan la espalda
  basket: [-1.0, -0.95],                // la canasta junto a la mesa
  table: { r: 0.78, h: 0.55 },          // mesa redonda baja (formas low poly propias) donde se apoya el pastel
  cakeScale: 2.0,                       // el contenedor del pastel (el GLB original 0,39×0,5 m queda ≈0,8×1,0 m): protagonista de la escena
  fog: { near: 24, far: 75 },           // neblina suave solo durante el final: el horizonte y el borde lejano del terreno se funden con el cielo
  minSep: 0.9,                          // separación mínima entre personajes (m)
};

export const T = {
  r0: 'Con las fresas a salvo, Toffee, Cookie y Bobby salieron de la montaña y emprendieron el regreso al bosque…',
  r1: 'Cookie: «¡Ya casi llegamos! ¡Berry se va a poner tan contenta!»',
  r2: 'Berry: «¡Volvieron! ¡Sabía que lo lograrían!»',
  r3: 'Toffee: «¡Y traemos las fresas más dulces de la montaña más alta!»',
  r4: 'Bobby: «¡Guau! ¡Ahora sí, a preparar ese pastel!»',
  c1: 'Toffee amasó, Cookie batió, Bobby probó… ¡solo un poquito!',
  c2: 'Berry puso las fresas más bonitas, una por una…',
  c3: 'Y entre risas, el horno hizo su magia.',
  c4: '¡El pastel de fresas estaba listo!',
  k1: 'Berry: «¡Es el pastel más hermoso del mundo!»',
  k2: 'Cookie: «¡Lo hicimos todos juntos!»',
  k3: 'Toffee: «Gracias por soñar con este pastel, Berry.»',
  k4: 'Berry: «Lo mejor no son las fresas… ¡es compartirlas con ustedes!»',
  k5: 'Bobby: «¡Guau! ¡Amigos para siempre!»',
};

// Pasos de la cocina (pantalla en negro): icono + texto
export const COOK = [
  { icon: '🥣', text: T.c1 }, { icon: '🍓', text: T.c2 }, { icon: '🔥', text: T.c3 }, { icon: '🎂', text: T.c4 },
];

// Duraciones (s)
export const DUR = { back: 4.2, arrive: 7, meet: 6.5, hug: 6.5, cook: [2.4, 2.4, 2.4, 2.4], reveal: 5.5, party: [6, 6, 5] };

// Planos de cámara. Las posiciones son [dx, altura sobre el suelo, dz] relativas a (línea central en dz=cakeDz, S.z).
// Se miran siempre hacia +Z o de lado (nunca hacia -Z) para no enseñar el borde del terreno.
export const CAMS = {
  back:   { from: [-1.2, 1.7, 0.0], to: [-1.2, 1.7, 0.0], lf: [0.0, 1.0, 10.0], lt: [0.0, 1.0, 10.0] },                    // mismo plano que abrirá "arrive"
  arrive: { from: [-1.2, 1.7, 0.0], to: [-0.9, 1.9, 0.4], lf: [0.0, 1.0, 10.0], lt: [0.0, 0.8, 9.6] },
  meet:   { from: [4.0, 1.5, 1.0], to: [3.6, 1.45, 2.4], lf: [0.0, 0.95, 8.0], lt: [0.0, 0.95, 8.8] },
  hug:    { from: [3.2, 1.5, 4.2], to: [2.6, 1.4, 5.0], lf: [0.0, 1.0, 8.7], lt: [0.0, 1.0, 8.7] },
  // Pastel (relativas al centro del pastel: dz ya es respecto al pastel)
  reveal: { from: [0.7, 1.6, -2.9], to: [0.0, 2.8, -4.6], lf: [0.0, 0.75, 0.0], lt: [0.0, 0.85, 0.5] },
  party:  { radius: 4.5, h: 2.8, look: [0.0, 0.85, 0.5], a0: -0.16, a1: 0.16 },
  final:  { radius: 4.4, h: 2.7, look: [0.0, 0.85, 0.5] },
};

// Material del confeti (paleta del juego + dos toques cálidos)
export const CONFETTI = { count: 46, colors: [0x942221, 0xFFFFFE, 0x9B6108, 0x8C8D4C, 0xE8A33D, 0xF2B8B5], top: 3.6, spread: 3.2, fall: [0.55, 0.9] };

// Pantalla final
export const END = {
  title: '¡AVENTURA COMPLETADA!',
  phrase: 'Las mejores aventuras se viven con amigos',
  replay: 'Volver a jugar', menu: 'Menú principal',
  creditsTitle: 'FOREST FRIENDS — CRÉDITOS',
};
// ✏️ CRÉDITOS EDITABLES: cambia aquí cualquier texto (nombres, roles, agradecimientos). Se muestran tal cual en la pantalla final.
// Los nombres están exactamente como los escribiste (Rebeca / Rebeca Zurita / Becka / Becky…): unifícalos cuando quieras.
export const CREDITS = {
  devTitle: 'Desarrollo del videojuego',
  team: [
    { role: 'Diseño y concepto', name: 'Rebeca' },
    { role: 'Modelado 3D', name: 'Rebeca Zurita' },
    { role: 'Diseño de personajes', name: 'Rebeca Zurita Mendoza' },
    { role: 'Programación', name: 'Claude' },
    { role: 'Diseño de escenarios', name: 'Becka' },
    { role: 'Diseño de interfaz', name: 'Claude y Becky' },
  ],
  thanksTitle: 'Agradecimientos',
  thanks: [
    'Gracias a todas las personas que hicieron posible este proyecto (yo), por su apoyo, creatividad y dedicación durante el desarrollo. Tambien a Claude y a mi compu por no morir en el intento de desarrollar este juego /(:D)/',
    'Y, sobre todo, gracias a quienes acompañaron a Toffee, Cookie, Bobby y Berry en esta aventura.',
  ],
  closeTitle: 'Cierre',
  closing: 'Las mejores aventuras se viven con amigos.',
  copyright: '© 2026 Forest Friends.',
};

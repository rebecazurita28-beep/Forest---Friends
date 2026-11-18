// Configuración central de Forest Friends (datos, sin lógica de Three.js).
export const PALETTE = { crema: '#FFFFFE', ocre: '#9B6108', rojo: '#942221', oliva: '#8C8D4C', arena: '#D9CFC3' };

// Nombre en el juego -> clave en assets_config.json
export const ASSET_KEY = { Toffee: 'Toffee', Berry: 'berry', Cookie: 'cookie', Bobby: 'Bobby', Fox: 'zorro' };

export const ORDER = ['Toffee', 'Berry', 'Cookie', 'Bobby'];   // orden de presentación
export const PARTY = ['Toffee', 'Cookie', 'Bobby'];            // quienes viajan a la montaña

export const CHAR_INFO = {
  Toffee: { name: 'Toffee', color: '#9B6108', ink: '#FFFFFE', tagline: 'El grandote tierno',
    bio: 'Fuerte, calmado y con un corazón enorme. Toffee nunca deja a nadie atrás, y su abrazo es famoso en todo el bosque. Su punto débil: los postres.' },
  Berry:  { name: 'Berry',  color: '#942221', ink: '#FFFFFE', tagline: 'La amiga curiosa',
    bio: 'Dulce, soñadora y siempre con una sonrisa. Berry cuida el bosque y ama las sorpresas. Hoy sueña con un pastel de fresas.' },
  Cookie: { name: 'Cookie', color: '#8C8D4C', ink: '#FFFFFE', tagline: 'El pequeño veloz',
    bio: 'Pequeño, ágil y un poquito travieso. Cookie siempre encuentra el camino más corto y no hay pregunta que lo detenga.' },
  Bobby:  { name: 'Bobby',  color: '#6f6a64', ink: '#FFFFFE', tagline: 'El explorador leal',
    bio: 'Leal, atento y de buen olfato. Bobby siempre va adelante olfateando el camino… y protege a sus amigos pase lo que pase.' },
};

// Velocidad (m/s) y parámetros de animación procedural por personaje
export const MOVE = {
  Toffee: { speed: 3.0 }, Cookie: { speed: 3.4 }, Bobby: { speed: 3.9 }, Berry: { speed: 3.0 }, Fox: { speed: 5.0 },
};
export const ANIM = {
  //          bob    sway   lean   pitch  rate
  Toffee: { bob: 0.06, sway: 0.07, lean: 0.03, pitch: 0.01, rate: 7 },
  Berry:  { bob: 0.05, sway: 0.06, lean: 0.03, pitch: 0.01, rate: 7 },
  Cookie: { bob: 0.05, sway: 0.08, lean: 0.04, pitch: 0.01, rate: 9 },
  Bobby:  { bob: 0.04, sway: 0.03, lean: 0.00, pitch: 0.06, rate: 11 },
  Fox:    { bob: 0.04, sway: 0.03, lean: 0.00, pitch: 0.06, rate: 12 },
};

export const CONTROLS_HINT = '↑ ↓ ← → mover · E interactuar · Tab cambiar de personaje · Espacio acción · ESC pausa · arrastra el ratón: cámara';

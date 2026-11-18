// Nivel 3 · lógica pura (sin Three.js, con tests) del enfrentamiento con el zorro: prueba de reacción con la barra espaciadora.
// Ronda = hasta 3 intentos. Cada intento: «¡Prepárate!» → espera (el zorro se agazapa) → VENTANA («¡AHORA!», el zorro salta) → fin.
// Reglas anti-trampa: solo cuenta la PULSACIÓN (flanco de subida, no tener la tecla mantenida) y pulsar antes de tiempo es un fallo,
// así que mantener o aporrear la barra nunca gana. Fallar nunca pierde progreso: tras 3 fallos la ronda se reinicia con más margen.
export const SHOW = {
  prep: 1.0,                              // s de «¡Prepárate!» (el zorro olfatea)
  waits: [1.4, 2.1, 1.1, 1.8, 1.25, 2.3], // s de espera antes de la señal (ciclo fijo e irregular: no hay azar, pero no se puede adivinar el pulso)
  window: 0.9,                            // s de ventana base
  windowBonus: 0.15,                      // s extra por cada fallo ya cometido en la ronda
  roundBonus: 0.2,                        // s extra por cada ronda completa fallada (ayuda progresiva, sin frustrar)
  attempts: 3,                            // intentos por ronda
  grace: 0.3,                             // s al empezar cada intento en que una pulsación sobrante (p. ej. la del diálogo) se ignora
  missPause: 1.5,                         // s de mensaje tras un fallo
  restartPause: 2.4,                      // s de mensaje al reiniciar la ronda
};

export const MSG = {
  prep: '¡Prepárate!', wait: '…', go: '¡AHORA!',
  early: '¡Muy pronto! Espera la señal.', late: '¡Muy tarde! El zorro fue más rápido.', won: '¡Lo asustaron!',
  restart: '¡El zorro casi se lleva las fresas! Vamos otra vez, con calma.',
};

export class Showdown {
  constructor(cfg = SHOW) { this.cfg = cfg; this.reset(); }
  reset() {
    this.state = 'idle'; this.t = 0; this.attempt = 0; this.round = 0; this.n = 0;   // n: contador global de intentos (elige la espera)
    this.reason = null; this.win = 0; this.waitLen = 0; this.stats = { early: 0, late: 0, rounds: 0 };
  }
  start() { this.reset(); this._begin(); }
  _begin() { this.state = 'prep'; this.t = 0; this.reason = null; }
  /** Duración de la ventana del intento en curso. */
  get windowLen() { return this.cfg.window + this.cfg.windowBonus * this.attempt + this.cfg.roundBonus * this.round; }
  get attemptsLeft() { return this.cfg.attempts - this.attempt; }
  /** 0..1 de la ventana ya consumida (para la barra en pantalla). */
  get windowProgress() { return this.state === 'window' ? Math.min(1, this.t / this.win) : 0; }
  get over() { return this.state === 'won'; }

  /** dt en s; pressed = ¿hubo una PULSACIÓN NUEVA (flanco) de la barra en este cuadro? Devuelve lista de eventos. */
  update(dt, pressed) {
    const ev = [], c = this.cfg;
    switch (this.state) {
      case 'prep':
        this.t += dt;
        if (pressed && this.t > c.grace) this._miss('early', ev);
        else if (this.t >= c.prep) { this.state = 'wait'; this.t = 0; this.waitLen = c.waits[this.n % c.waits.length]; ev.push({ type: 'wait' }); }
        break;
      case 'wait':
        this.t += dt;
        if (pressed) this._miss('early', ev);
        else if (this.t >= this.waitLen) { this.state = 'window'; this.t = 0; this.win = this.windowLen; ev.push({ type: 'go', window: this.win }); }
        break;
      case 'window':
        if (pressed) { this.state = 'won'; ev.push({ type: 'won', reaction: this.t }); break; }   // pulsó dentro de la ventana
        this.t += dt;
        if (this.t >= this.win) this._miss('late', ev);
        break;
      case 'miss':
        this.t += dt;
        if (this.t >= c.missPause) {
          if (this.attempt >= c.attempts) { this.state = 'restart'; this.t = 0; this.stats.rounds++; ev.push({ type: 'restart' }); }
          else { this._begin(); ev.push({ type: 'prep' }); }
        }
        break;
      case 'restart':
        this.t += dt;
        if (this.t >= c.restartPause) { this.round++; this.attempt = 0; this._begin(); ev.push({ type: 'prep' }); }
        break;
      default: break;                       // idle / won: nada
    }
    return ev;
  }
  _miss(reason, ev) {
    this.state = 'miss'; this.t = 0; this.reason = reason; this.attempt++; this.n++; this.stats[reason]++;
    ev.push({ type: reason, attempt: this.attempt, left: this.cfg.attempts - this.attempt });
  }
}

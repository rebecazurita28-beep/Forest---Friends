// Lógica del Nivel 1 SIN Three.js (se prueba en Node): acertijo + fases del nivel.

export const RIDDLE = {
  title: 'El acertijo del puente',
  text: 'Corro sin tener pies, murmuro sin tener boca y todos los puentes me cruzan por encima. ¿Qué soy?',
  options: ['El viento', 'El río', 'El camino', 'La sombra'],
  correct: 1,
  hint: 'Mira a tu alrededor: ¿qué es lo que corre y suena justo debajo del puente?',
  hintAfter: 2,            // intentos fallidos antes de ofrecer la pista
};

/** Estado del acertijo: cuenta intentos y decide si ya se desbloqueó. */
export class RiddleState {
  constructor(riddle = RIDDLE) { this.r = riddle; this.attempts = 0; this.solved = false; }
  answer(i) {
    if (this.solved) return { correct: true, already: true, showHint: false };
    const ok = i === this.r.correct;
    if (ok) this.solved = true; else this.attempts++;
    return { correct: ok, already: false, showHint: !ok && this.attempts >= this.r.hintAfter };
  }
}

/** Fases del nivel. Solo se puede avanzar en orden; cruzar antes de resolver es imposible. */
export const PHASE = { EXPLORE: 'explore', RIDDLE: 'riddle', UNLOCKED: 'unlocked', DONE: 'done' };

export class LevelFlow {
  constructor() { this.phase = PHASE.EXPLORE; this.riddle = new RiddleState(); this.reachedGate = false; }
  get gateOpen() { return this.phase === PHASE.UNLOCKED || this.phase === PHASE.DONE; }
  openRiddle() { if (this.phase === PHASE.EXPLORE) this.phase = PHASE.RIDDLE; return this.phase === PHASE.RIDDLE; }
  closeRiddle() { if (this.phase === PHASE.RIDDLE) this.phase = PHASE.EXPLORE; }
  answer(i) {
    if (this.phase !== PHASE.RIDDLE) return null;
    const res = this.riddle.answer(i);
    if (res.correct) this.phase = PHASE.UNLOCKED;
    return res;
  }
  /** positions: [{z}] de los tres personajes; cruzaron cuando todos superan zEnd. */
  update(positions, zEnd) {
    if (this.phase === PHASE.UNLOCKED && positions.length && positions.every(p => p.z > zEnd)) this.phase = PHASE.DONE;
    return this.phase;
  }
}

export function objectiveText(phase, reachedGate) {
  switch (phase) {
    case PHASE.EXPLORE: return reachedGate ? 'Resuelve el acertijo del puente (E).' : 'Sigue el sendero hasta el puente.';
    case PHASE.RIDDLE: return 'Elige la respuesta correcta al acertijo.';
    case PHASE.UNLOCKED: return '¡Puente desbloqueado! Crúzalo con los tres amigos.';
    default: return '✔ Objetivo completado: ¡el puente quedó atrás!';
  }
}

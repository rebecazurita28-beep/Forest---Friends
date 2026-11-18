// Secuenciador de pasos con duración (para cinemáticas). Sin dependencias.
export class Sequencer {
  constructor(steps, onDone) { this.steps = steps; this.onDone = onDone; this.i = -1; this.t = 0; this.done = false; }
  start() { this.i = 0; this.t = 0; this.done = false; this.steps[0].enter?.(); }
  get current() { return this.i >= 0 && this.i < this.steps.length ? this.steps[this.i] : null; }
  update(dt) {
    if (this.done || this.i < 0) return;
    const s = this.steps[this.i];
    this.t += dt;
    s.update?.(Math.min(1, this.t / s.dur), this.t);
    if (this.t >= s.dur) {
      s.exit?.();
      this.i++; this.t = 0;
      if (this.i >= this.steps.length) { this.done = true; this.onDone?.(); }
      else this.steps[this.i].enter?.();
    }
  }
  skip() {
    if (this.done) return;
    const s = this.current; s?.exit?.();
    this.done = true; this.onDone?.();
  }
}

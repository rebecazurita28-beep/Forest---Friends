// Teclado: estado continuo (isDown) y pulsaciones de un solo cuadro (wasPressed).
const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

export class Input {
  constructor(target = window) {
    this.target = target;
    this.down = new Set();
    this.pressed = new Set();
    this._kd = e => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!e.repeat && !this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this._ku = e => { this.down.delete(e.code); };
    this._blur = () => { this.down.clear(); };
    target.addEventListener('keydown', this._kd);
    target.addEventListener('keyup', this._ku);
    target.addEventListener('blur', this._blur);
  }
  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  /** Flechas -> { fwd, right } en {-1,0,1}. */
  axis() {
    return {
      fwd: (this.isDown('ArrowUp') ? 1 : 0) - (this.isDown('ArrowDown') ? 1 : 0),
      right: (this.isDown('ArrowRight') ? 1 : 0) - (this.isDown('ArrowLeft') ? 1 : 0),
    };
  }
  endFrame() { this.pressed.clear(); }
  dispose() {
    this.target.removeEventListener('keydown', this._kd);
    this.target.removeEventListener('keyup', this._ku);
    this.target.removeEventListener('blur', this._blur);
  }
}

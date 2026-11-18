// Orquestador: renderer, bucle, estados (title → intro → play ⇄ pause), diálogos y pausa.
import * as THREE from 'three';
import { Input } from './input.js';
import { ThirdPersonCamera } from './camera.js';
import { Character } from './character.js';
import { TitleScene } from './menu.js';
import { Level1 } from './level1.js';
import { Level2 } from './level2.js';
import { Intro } from './intro.js';
import { Mountain } from './mountain.js';
import { Level3 } from './level3.js';
import { Finale } from './finale.js';
import { ASSET_KEY, MOVE, ANIM, CHAR_INFO } from './config.js';

export class Game {
  constructor(loaded, ui) {
    this.ui = ui; this.models = loaded.models; this.config = loaded.config;
    const canvas = document.getElementById('c');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
    this.input = new Input(window);
    this.tpc = new ThirdPersonCamera(this.camera, canvas);

    this.chars = {};
    for (const n of ['Toffee', 'Berry', 'Cookie', 'Bobby']) this.chars[n] = new Character(n, this.models[ASSET_KEY[n]], MOVE[n], ANIM[n]);

    this.title = new TitleScene(this);
    this.level1 = new Level1(this);
    this.level2 = new Level2(this);
    this.level = this.level1;                 // nivel en juego (Level1 / Level2)
    this.intro = new Intro(this);
    this.mountain = new Mountain(this);       // intermedio narrativo (no es un nivel)
    this.level3 = new Level3(this);
    this.finale = new Finale(this);           // cinemática final (no es un nivel)
    this.state = 'none'; this.scene = null; this.dlg = null;
    this.clock = new THREE.Clock();

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight, false);
    });
    document.getElementById('skip').onclick = () => (this.state === 'finale' ? this.finale.skip() : this.state === 'mountain' ? this.mountain.skip() : this.state === 'play' && this.level === this.level3 ? this.level3.skip() : this.intro.skip());
    document.getElementById('resumeBtn').onclick = () => this.setPaused(false);
    document.getElementById('restartBtn').onclick = () => { this.setPaused(false); this.restartLevel(); };
    document.getElementById('menuBtn').onclick = () => { this.setPaused(false, true); this.goTitle(); };
  }

  start() {
    this.goTitle(false);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Visibilidad de objetos de historia (pastel, fresas): solo existen en la escena que los pide. */
  showModel(key, parent) { const m = this.models[key]; parent.add(m); m.visible = true; return m; }
  hideModel(key) { const m = this.models[key]; m.visible = false; m.removeFromParent(); }

  async transition(fn) {
    this.ui.fade(true); await new Promise(r => setTimeout(r, 450));
    fn(); this.ui.fade(false);
  }

  goTitle(withFade = true) {
    const go = () => {
      this.hideModel('Pastel_de_fresas'); this.hideModel('fresas'); this.intro.prop = null; this.mountain.reset(); this.level3.reset(); this.finale.reset();
      this.ui.closeComplete(); this.ui.closeRiddle(); this.ui.progress(null);
      for (const c of Object.values(this.chars)) c.holder.visible = true;
      this.level = this.level1;
      this.dlg = null; this.ui.closeDialog(); this.ui.show('hud', false); this.ui.show('skip', false); this.ui.caption(null); this.ui.prompt(null);
      this.state = 'title'; this.scene = this.title.scene; this.title.enter();
    };
    withFade ? this.transition(go) : go();
  }

  startIntro() {
    if (this.state !== 'title') return;
    this.state = 'transition';
    this.transition(() => {
      this.title.exit(); this.scene = this.level1.scene; this.state = 'intro'; this.intro.start();
    });
  }

  beginLevel1() {
    this.state = 'transition';
    this.transition(() => { this.level = this.level1; this.level1.enter(); this.scene = this.level1.scene; this.state = 'play'; });
  }

  /** Progreso guardado en el navegador (opcional: si el almacenamiento falla, el juego sigue igual). */
  saveProgress(patch) {
    try { const k = 'forestFriends.progress'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || '{}'), ...patch })); } catch { /* sin almacenamiento */ }
  }

  /** Nivel 1 → Nivel 2 (con su pantalla de presentación). */
  goNextLevel() {
    if (this.state === 'transition') return;
    this.state = 'transition';
    this.transition(() => {
      this.ui.closeComplete(); this.level = this.level2; this.scene = this.level2.scene;
      this.level2.enter(); this.state = 'play';
    });
  }

  /** Nivel 2 → intermedio narrativo "La montaña más alta" (cinemática con las fresas) → Nivel 3. */
  goNextLevel2() {
    if (this.state === 'transition') return;
    this.state = 'transition';
    this.transition(() => {
      this.ui.closeComplete(); this.scene = this.mountain.scene; this.mountain.start(); this.state = 'mountain';
    });
  }

  /** Fin de la cinemática de la montaña → Nivel 3: La cueva del zorro (título, llegada, zorro, enfrentamiento). */
  beginLevel3() {
    this.state = 'transition';
    this.transition(() => {
      this.mountain.reset(); this.level = this.level3; this.scene = this.level3.scene; this.level3.enter(); this.state = 'play';
    });
  }

  /** Nivel 3 completado → cinemática final: fundido a negro (los amigos regresan al bosque) → bosque, reencuentro, pastel y pantalla de victoria. */
  async goNextLevel3() {
    if (this.state === 'transition' || this.state === 'finale') return;
    this.state = 'transition';
    this.ui.fade(true); await new Promise(r => setTimeout(r, 450));
    this.ui.closeComplete(); this.level3.reset(); this.scene = this.level1.scene;
    this.finale.start(); this.state = 'finale';          // el fundido sigue en negro: la cinemática lo levanta tras el primer subtítulo
  }

  /** «Volver a jugar» (pantalla final): reinicia la aventura desde el principio (título → cinemática inicial → Nivel 1). */
  async replayAdventure() {
    if (this.state === 'transition') return;
    this.state = 'transition';
    this.ui.fade(true); await new Promise(r => setTimeout(r, 450));
    this.goTitle(false); this.startIntro();
  }

  restartLevel() {
    this.dlg = null; this.ui.closeDialog();
    if (this.level.restart) this.level.restart(); else this.level.enter();
    this.scene = this.level.scene; this.state = 'play';
  }

  setPaused(on, silent = false) {
    if (on && this.state === 'play') { this.state = 'pause'; this.ui.show('pause'); }
    else if (!on && this.state === 'pause') { this.state = 'play'; if (!silent) this.ui.show('pause', false); }
    if (silent) this.ui.show('pause', false);
  }

  /** Diálogo: líneas [{who, text}]; E / Espacio avanzan. */
  say(lines) { this.dlg = { lines, i: 0 }; this._showLine(); }
  _showLine() {
    const l = this.dlg.lines[this.dlg.i], info = CHAR_INFO[l.who];
    this.ui.dialog(info ? info.name : l.who, info ? info.color : '#9B6108', l.text);
  }
  _dialogInput() {
    if (!this.dlg) return;
    if (this.input.wasPressed('KeyE') || this.input.wasPressed('Space') || this.input.wasPressed('Enter')) {
      if (++this.dlg.i >= this.dlg.lines.length) { this.dlg = null; this.ui.closeDialog(); } else this._showLine();
    }
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()), inp = this.input;
    if (inp.wasPressed('Escape')) {
      if (this.state === 'play' && this.level.modalOpen) (this.level.closeModal || this.level.closeRiddle).call(this.level);   // ESC cierra el acertijo
      else if (this.state === 'pause' || (this.state === 'play' && !this.level.completed)) this.setPaused(this.state === 'play');
    }
    switch (this.state) {
      case 'title': this.title.update(dt); break;
      case 'intro':
        if (inp.wasPressed('Space') || inp.wasPressed('Enter')) this.intro.skip();
        this.intro.update?.(dt); break;
      case 'mountain':
        if (this.mountain.running && (inp.wasPressed('Space') || inp.wasPressed('Enter'))) this.mountain.skip();
        this.mountain.update(dt); break;
      case 'finale':
        if (this.finale.running && (inp.wasPressed('Space') || inp.wasPressed('Enter'))) this.finale.skip();
        this.finale.update(dt); break;
      case 'play': this._dialogInput(); this.level.update(dt); break;
      default: break; // pause / transition: congelado
    }
    inp.endFrame();
    if (this.scene) this.renderer.render(this.scene, this.camera);
  }
}

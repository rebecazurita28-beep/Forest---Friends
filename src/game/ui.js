// Capa de interfaz (DOM). Sin lógica de juego.
const $ = id => document.getElementById(id);

export class UI {
  constructor() {
    this.el = Object.fromEntries(['loading', 'loadbar', 'loadtext', 'menu', 'card', 'cardTag', 'cardName', 'cardBio', 'cardIdx', 'roster', 'hud', 'objective',
      'party', 'prompt', 'hint', 'dialog', 'dlgName', 'dlgText', 'caption', 'skip', 'pause', 'fade', 'toast', 'err',
      'progress', 'react', 'reactMsg', 'reactRing', 'reactFill', 'reactPips', 'reactSub', 'riddle', 'rTitle', 'rText', 'rOpts', 'rFeedback', 'rHint', 'rClose', 'complete', 'cTitle', 'cText', 'cBtns', 'cook', 'ending', 'endLogo', 'endTitle', 'endPhrase', 'endBtns', 'credits'].map(k => [k, $(k)]));
    this._toastT = 0;
  }
  setLoading(p, text) { this.el.loadbar.firstElementChild.style.width = Math.round(p * 100) + '%'; if (text) this.el.loadtext.textContent = text; }
  show(id, on = true) { this.el[id].classList.toggle('hidden', !on); }
  fade(on) { this.el.fade.classList.toggle('on', on); }
  error(msg) { this.el.err.textContent = msg; this.show('err'); }

  card(info, idx, total) {
    const c = this.el;
    c.cardTag.textContent = info.tagline; c.cardTag.style.background = info.color;
    c.cardName.textContent = info.name; c.cardBio.textContent = info.bio; c.cardIdx.textContent = `${idx + 1} / ${total}`;
  }
  roster(names, infoOf, activeIdx, onPick) {
    const r = this.el.roster; r.innerHTML = '';
    names.forEach((n, i) => { const b = document.createElement('button'); b.textContent = infoOf[n].name; if (i === activeIdx) b.classList.add('on'); b.onclick = () => onPick(i); r.appendChild(b); });
  }
  objective(t) { this.el.objective.textContent = t; }
  hint(t) { this.el.hint.textContent = t; }
  /** status (opcional): [{label, pct, arrived}] por personaje → barra de progreso individual (Nivel 2). */
  party(names, infoOf, activeIdx, status) {
    const p = this.el.party; p.innerHTML = '';
    names.forEach((n, i) => {
      const d = document.createElement('div'); d.className = 'chip' + (i === activeIdx ? ' on' : ''); d.style.background = infoOf[n].color;
      const st = status && status[i];
      d.innerHTML = `${infoOf[n].name}<small>${i + 1}</small>` + (st
        ? `<em>${st.label}</em><i class="bar"><b style="width:${Math.round(st.pct * 100)}%"></b></i>` : '');
      if (st && st.arrived) d.classList.add('done');
      p.appendChild(d);
    });
  }
  progress(t) { this.el.progress.textContent = t || ''; }
  prompt(t) { this.el.prompt.textContent = t || ''; this.show('prompt', !!t); }
  dialog(name, color, text) { this.el.dlgName.textContent = name; this.el.dlgName.style.color = color; this.el.dlgText.textContent = text; this.show('dialog'); }
  closeDialog() { this.show('dialog', false); }
  caption(t) { this.el.caption.textContent = t || ''; this.show('caption', !!t); }
  /** Panel del acertijo. onPick(i) al elegir una opción; onClose() al cerrar con ✕. */
  openRiddle(r, onPick, onClose) {
    const e = this.el; e.rTitle.textContent = r.title; e.rText.textContent = r.text; e.rOpts.innerHTML = '';
    r.options.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'opt'; b.dataset.i = i;
      b.innerHTML = `<span class="key">${i + 1}</span>${o}`; b.onclick = () => onPick(i); e.rOpts.appendChild(b);
    });
    e.rClose.onclick = onClose; this.riddleFeedback(null); this.riddleHint(null); this.show('riddle');
  }
  riddleSelect(i) { [...this.el.rOpts.children].forEach((b, k) => b.classList.toggle('sel', k === i)); }
  riddleLock(on) { [...this.el.rOpts.children].forEach(b => { b.disabled = on; }); }
  riddleMark(i, cls) { const b = this.el.rOpts.children[i]; if (!b) return; b.classList.remove('bad', 'good'); void b.offsetWidth; b.classList.add(cls); }
  riddleFeedback(t, kind) { const f = this.el.rFeedback; f.textContent = t || ''; f.className = t ? kind : 'hidden'; }
  riddleHint(t) { const h = this.el.rHint; h.textContent = t ? '💡 ' + t : ''; h.classList.toggle('hidden', !t); }
  closeRiddle() { this.show('riddle', false); }
  /** Tarjeta de fin de nivel. buttons: [{label, onClick, big}] */
  complete(title, text, buttons) {
    const e = this.el; e.cTitle.textContent = title; e.cText.textContent = text; e.cBtns.innerHTML = '';
    buttons.forEach(b => { const x = document.createElement('button'); x.textContent = b.label; if (b.big) x.className = 'big'; x.onclick = b.onClick; e.cBtns.appendChild(x); });
    this.show('complete');
  }
  closeComplete() { this.show('complete', false); }
  /** Subtítulo por encima del fundido a negro (cinemática final). */
  captionTop(on) { this.el.caption.classList.toggle('top', !!on); }
  /** Icono grande sobre el fundido a negro (secuencia de cocina). null = ocultar. */
  cook(icon) { const c = this.el.cook; if (!icon) { c.textContent = ''; this.show('cook', false); return; } c.innerHTML = ''; const s = document.createElement('span'); s.textContent = icon; c.appendChild(s); this.show('cook'); }
  /** Pantalla final «¡AVENTURA COMPLETADA!». cfg: {title, phrase, buttons:[{label,onClick,big}], credits:{title,charsTitle,chars:[{name,tagline,color}],teamTitle,team:[{role,name}],thanks}} */
  ending(cfg) {
    const e = this.el; e.endTitle.textContent = cfg.title; e.endPhrase.textContent = '«' + cfg.phrase + '»'; e.endBtns.innerHTML = '';
    cfg.buttons.forEach(b => { const x = document.createElement('button'); x.textContent = b.label; if (b.big) x.className = 'big'; x.onclick = b.onClick; e.endBtns.appendChild(x); });
    const c = cfg.credits, el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
    const cr = e.credits; cr.innerHTML = ''; cr.scrollTop = 0;
    cr.appendChild(el('h3', 'ctitle', c.title));
    cr.appendChild(el('h4', 'csec', c.devTitle));
    const list = el('div', 'clist');
    c.team.forEach(m => { const r = el('div', 'crow'); r.appendChild(el('span', 'crole', m.role)); r.appendChild(el('span', 'cdots')); r.appendChild(el('span', 'cname', m.name)); list.appendChild(r); });
    cr.appendChild(list);
    cr.appendChild(el('h4', 'csec', c.thanksTitle));
    c.thanks.forEach(t => cr.appendChild(el('p', 'cquote', '«' + t + '»')));
    cr.appendChild(el('h4', 'csec', c.closeTitle));
    cr.appendChild(el('p', 'cclose', '«' + c.closing + '»'));
    cr.appendChild(el('p', 'ccopy', c.copyright));
    e.ending.scrollTop = 0; this.show('ending');
  }
  closeEnding() { this.show('ending', false); }
  /** Panel de reacción del Nivel 3. r: null (ocultar) o { mode:'prep'|'wait'|'go'|'miss'|'won', msg, sub, progress(0..1 ventana consumida), attempts, used } */
  react(r) {
    const e = this.el; if (!r) { this.show('react', false); return; }
    e.react.dataset.mode = r.mode; e.reactMsg.textContent = r.msg; e.reactSub.textContent = r.sub || '';
    e.reactFill.style.height = Math.round((1 - (r.progress || 0)) * 100) + '%';
    e.reactPips.innerHTML = ''; for (let i = 0; i < (r.attempts || 0); i++) { const d = document.createElement('i'); if (i < (r.used || 0)) d.className = 'used'; e.reactPips.appendChild(d); }
    e.reactRing.style.display = r.mode === 'won' || r.mode === 'miss' ? 'none' : ''; this.show('react');
  }
  skipLabel(t) { this.el.skip.textContent = t || 'Saltar ▶ (Espacio)'; }
  toast(t, ms = 2200) { this.el.toast.textContent = t; this.show('toast'); clearTimeout(this._toastT); this._toastT = setTimeout(() => this.show('toast', false), ms); }
}

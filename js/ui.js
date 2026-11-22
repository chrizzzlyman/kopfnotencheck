// Wiederverwendbare Oberflächenbausteine: Icons, Dialoge (Sheets), Hinweise (Toasts), Strichliste.

import { h, svg, clear } from './util.js';

// ------------------------------------------------------------------ Icons

const ICONS = {
  back: ['M15 5l-7 7 7 7'],
  chart: ['M6 20v-6', 'M12 20V5', 'M18 20v-10'],
  more: { circles: [[5, 12], [12, 12], [19, 12]] },
  download: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'],
  upload: ['M12 16V5', 'M7 9l5-5 5 5', 'M5 20h14'],
  trash: ['M5 7h14', 'M10 7V4h4v3', 'M7 7l1 13h8l1-13'],
  edit: ['M4 20l1-4L16 5l3 3L8 19z', 'M14 7l3 3'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  chevron: ['M6 9l6 6 6-6'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  users: ['M9 11a3 3 0 100-6 3 3 0 000 6z', 'M3 20c0-3 3-5 6-5s6 2 6 5', 'M16 6a3 3 0 010 6', 'M18 15c2 .6 3 2.4 3 5'],
  warn: ['M12 3l10 18H2z', 'M12 10v5', 'M12 18v.01'],
  check: ['M5 12l5 5 9-10'],
  note: ['M4 5h16v11H9l-5 4z'],
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 010 12h-3'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
};

export function icon(name, size = 22) {
  const def = ICONS[name];
  const el = svg('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
  });
  if (Array.isArray(def)) for (const d of def) el.append(svg('path', { d }));
  else for (const [cx, cy] of def.circles) el.append(svg('circle', { cx, cy, r: 1.6, fill: 'currentColor' }));
  el.classList.add('icon');
  return el;
}

// ------------------------------------------------------------------ Strichliste

const GROUP_W = 26;
const STROKE_X = [3, 8, 13, 18];
const TALLY_MAX = 10;

/** Zeichnet n Beobachtungen als Strichliste (je 5 = vier Striche + Querstrich). Ab 11 steht eine Zahl. */
export function tally(n, kind, { fresh = false } = {}) {
  const wrap = h('span', { class: `tally ${kind}`, 'aria-hidden': 'true' });
  if (n <= 0) return wrap;
  if (n > TALLY_MAX) {
    wrap.append(h('span', { class: 'tally-num' }, String(n)));
    return wrap;
  }
  const groups = Math.ceil(n / 5);
  const el = svg('svg', { width: groups * GROUP_W - 5, height: 20, viewBox: `0 0 ${groups * GROUP_W - 5} 20` });
  let left = n;
  let strokeIndex = 0;
  for (let g = 0; g < groups; g++) {
    const k = Math.min(5, left);
    left -= k;
    const x0 = g * GROUP_W;
    for (let i = 0; i < Math.min(k, 4); i++) {
      strokeIndex++;
      const isNew = fresh && strokeIndex === n;
      el.append(svg('line', { x1: x0 + STROKE_X[i], y1: 2, x2: x0 + STROKE_X[i], y2: 18, class: isNew ? 'new' : '' }));
    }
    if (k === 5) {
      strokeIndex++;
      el.append(svg('line', { x1: x0, y1: 14, x2: x0 + 21, y2: 6, class: fresh && strokeIndex === n ? 'new' : '' }));
    }
  }
  wrap.append(el);
  return wrap;
}

// ------------------------------------------------------------------ Dialoge (Sheets)

const stack = [];
let sheetCounter = 0;

function layer() {
  return document.getElementById('overlays');
}

/**
 * Öffnet einen Dialog. Auf dem Handy erscheint er von unten, auf dem Tablet als Fenster.
 * Rückgabe: { el, body, footer, close, setTitle }
 */
export function openSheet({ title, subtitle = '', size = '', onClose = null } = {}) {
  const prevFocus = document.activeElement;
  const id = `sheet-title-${++sheetCounter}`;
  const titleEl = h('h2', { id, class: 'sheet-title' }, title);
  const subEl = h('p', { class: 'sheet-sub' }, subtitle);
  subEl.hidden = !subtitle;
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', onclick: () => api.close() }, icon('close'));
  const body = h('div', { class: 'sheet-body' });
  const footer = h('div', { class: 'sheet-footer' });
  footer.hidden = true;
  const sheet = h(
    'div',
    { class: `sheet ${size}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id, tabindex: '-1' },
    h('div', { class: 'sheet-head' }, h('div', { class: 'sheet-head-text' }, titleEl, subEl), closeBtn),
    body,
    footer,
  );
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) api.close(); } }, sheet);
  let closed = false;

  const api = {
    el: sheet,
    body,
    footer,
    setTitle(t) { titleEl.textContent = t; },
    setSubtitle(t) { subEl.textContent = t; subEl.hidden = !t; },
    /** Fußzeile mit Buttons füllen */
    setActions(...buttons) {
      clear(footer);
      footer.append(...buttons);
      footer.hidden = buttons.length === 0;
    },
    close(result) {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      overlay.classList.add('leaving');
      const finish = () => {
        overlay.remove();
        if (!stack.length) document.body.classList.remove('has-overlay');
        if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
        if (onClose) onClose(result);
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
      else setTimeout(finish, 140);
    },
  };

  layer().append(overlay);
  document.body.classList.add('has-overlay');
  stack.push(api);
  sheet.focus({ preventScroll: true });
  return api;
}

export function closeAllOverlays() {
  for (const s of [...stack]) s.close();
}

export function hasOverlay() {
  return stack.length > 0;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    stack[stack.length - 1].close();
  }
});

/** Bestätigungsdialog. Löst mit true/false auf. */
export function confirmDialog({ title, message, confirmLabel = 'OK', cancelLabel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const sh = openSheet({ title, size: 'small', onClose: () => resolve(answer) });
    sh.body.append(...(Array.isArray(message) ? message : [message]).map((m) => (m instanceof Node ? m : h('p', { class: 'dialog-text' }, m))));
    sh.setActions(
      h('button', { class: 'btn', type: 'button', onclick: () => sh.close() }, cancelLabel),
      h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => { answer = true; sh.close(); } }, confirmLabel),
    );
  });
}

export function infoDialog({ title, message, buttonLabel = 'OK' }) {
  return new Promise((resolve) => {
    const sh = openSheet({ title, size: 'small', onClose: () => resolve() });
    sh.body.append(...(Array.isArray(message) ? message : [message]).map((m) => (m instanceof Node ? m : h('p', { class: 'dialog-text' }, m))));
    sh.setActions(h('button', { class: 'btn primary', type: 'button', onclick: () => sh.close() }, buttonLabel));
  });
}

// ------------------------------------------------------------------ Toasts

let toastTimer = null;

export function toast(message, { action = '', onAction = null, kind = '', duration = 4500 } = {}) {
  const host = document.getElementById('toasts');
  clear(host);
  clearTimeout(toastTimer);
  const el = h('div', { class: `toast ${kind}`.trim() }, h('span', { class: 'toast-text' }, message));
  if (action) {
    el.append(
      h('button', {
        class: 'toast-action',
        type: 'button',
        onclick: () => {
          clear(host);
          clearTimeout(toastTimer);
          if (onAction) onAction();
        },
      }, action),
    );
  }
  host.append(el);
  toastTimer = setTimeout(() => clear(host), duration);
  return el;
}

export function clearToast() {
  clearTimeout(toastTimer);
  const host = document.getElementById('toasts');
  if (host) clear(host);
}

// ------------------------------------------------------------------ Formularbausteine

export function field(label, input, hint = '') {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);
}

export function errorText(msg) {
  return h('p', { class: 'form-error', role: 'alert' }, msg);
}

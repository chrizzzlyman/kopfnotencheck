// Unterrichtsansicht: Fokus-Modus. Oben der Schwerpunkt, bei jedem Kind ein + und ein −.
// Im Bereich "Hausaufgaben" hat jedes Kind zwei Buttons: ✓ nachgeholt (hakt die älteste offene ab) und Vergessen.
// Die Strichlisten zeigen links nachgeholte (grün) und rechts offene (rot) Hausaufgaben.

import { h, clear } from '../util.js';
import { CATEGORIES, ASPECT_BY_KEY, aspectsOf } from '../aspects.js';
import {
  S, getCount, getPeriod, getStudent, setFocus, addObservation, removeObservation, periodRangeText, isOutsidePeriod,
  homeworkStats, openHomeworkCount, completeOldestOpen, setHomeworkDone,
} from '../state.js';
import { icon, tally, toast, openSheet } from '../ui.js';
import { openChildSheet } from './child.js';
import { openPeriodPicker, openPeriodForm } from './periods.js';
import { openExportSheet } from './exporter.js';

export function renderLive(app) {
  const cls = S.cls;
  const cards = new Map(); // studentId -> { el, plus, minus, sr, btnPlus, btnMinus, plusText, minusText, name }

  // ------------------------------------------------------------ Kopf
  const pill = h('button', { class: 'period-pill', type: 'button', onclick: () => openPeriodPicker({ onChange: refreshAll }) });
  const header = h('header', { class: 'topbar' },
    h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Zur Klassenliste' }, icon('back')),
    h('div', { class: 'title-block' }, h('h1', { class: 'title' }, cls.name), pill),
    h('a', { class: 'icon-btn', href: `#/c/${cls.id}/auswertung`, 'aria-label': 'Auswertung' }, icon('chart')),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Weitere Aktionen', onclick: openMenu }, icon('more')),
  );

  // ------------------------------------------------------------ Fokus
  const tabs = h('div', { class: 'focus-tabs', role: 'group', 'aria-label': 'Bereich' });
  const chips = h('div', { class: 'focus-chips', role: 'group', 'aria-label': 'Schwerpunkt' });
  const hintPlus = h('p', { class: 'hint-box plus' });
  const hintMinus = h('p', { class: 'hint-box minus' });
  const hints = h('div', { class: 'hints' }, hintPlus, hintMinus);
  const panel = h('section', { class: 'focus', 'aria-label': 'Aktueller Schwerpunkt' }, tabs, chips, hints);

  function updateFocus() {
    const focus = ASPECT_BY_KEY[S.ui.focus];
    panel.dataset.cat = focus.cat;
    tabs.replaceChildren(
      ...CATEGORIES.map((c) =>
        h('button', {
          class: `tab ${c.key}`,
          type: 'button',
          'aria-pressed': String(c.key === focus.cat),
          onclick: () => chooseFocus(S.ui.lastFocus[c.key]),
        }, c.label, c.extra ? h('span', { class: 'tab-badge' }) : null)),
    );
    refreshBadge();
    const sl = chips.scrollLeft;
    const list = aspectsOf(focus.cat);
    chips.hidden = list.length < 2; // ein einziger Schwerpunkt braucht keine Auswahl
    chips.replaceChildren(
      ...list.map((a) =>
        h('button', {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(a.key === focus.key),
          onclick: () => chooseFocus(a.key),
        }, a.label)),
    );
    chips.scrollLeft = sl;
    const sel = chips.querySelector('[aria-pressed="true"]');
    if (sel && chips.scrollWidth > chips.clientWidth) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    hintPlus.replaceChildren(h('span', { class: 'sgn' }, focus.single ? '✓' : '+'), h('span', {}, focus.pos || ''));
    hintMinus.replaceChildren(h('span', { class: 'sgn' }, '−'), h('span', {}, focus.neg));
    grid.classList.toggle('single', !!focus.single);
  }

  /** Zahl der offenen Hausaufgaben (alle Zeiträume) am Tab, damit man sie auch in den anderen Bereichen sieht. */
  function refreshBadge() {
    const badge = tabs.querySelector('.tab-badge');
    if (!badge) return;
    const n = openHomeworkCount();
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
    const tab = badge.closest('.tab');
    tab.setAttribute('aria-label', n ? `Hausaufgaben, ${n} offen` : 'Hausaufgaben');
  }

  function chooseFocus(key) {
    if (key === S.ui.focus) return;
    setFocus(key).catch(() => {});
    updateFocus();
    refreshCards();
  }

  // ------------------------------------------------------------ Kinderkarten
  const grid = h('div', { class: 'kid-grid' });

  function buildCards() {
    cards.clear();
    grid.replaceChildren();
    for (const s of S.students) {
      const plus = h('span', { class: 'tally-slot plus' });
      const minus = h('span', { class: 'tally-slot minus' });
      const sr = h('span', { class: 'sr-only' });
      const plusText = h('span', { 'aria-hidden': 'true' }, '+');
      const btnPlus = h('button', { class: 'act plus', type: 'button', 'data-v': '1' }, plusText);
      const minusText = h('span', { 'aria-hidden': 'true' }, '−');
      const btnMinus = h('button', { class: 'act minus', type: 'button', 'data-v': '-1' }, minusText);
      const name = h('button', { class: 'kid-name', type: 'button', 'data-open': '1' }, s.name);
      const el = h('article', { class: 'kid', dataset: { id: s.id } },
        name,
        h('div', { class: 'kid-tallies' }, plus, minus, sr),
        h('div', { class: 'kid-actions' }, btnPlus, btnMinus),
      );
      cards.set(s.id, { el, plus, minus, sr, btnPlus, btnMinus, plusText, minusText, name });
      grid.append(el);
    }
  }

  function updateCard(studentId, fresh = 0) {
    const c = cards.get(studentId);
    const s = getStudent(studentId);
    if (!c || !s) return;
    const focus = ASPECT_BY_KEY[S.ui.focus];
    if (focus.single) {
      // Hausaufgaben: links nachgeholt (grün), rechts noch offen (rot)
      const { open, done } = S.ui.periodId ? homeworkStats(studentId, S.ui.periodId) : { open: 0, done: 0 };
      c.plus.replaceChildren(tally(done, 'plus', { fresh: fresh > 0 }));
      c.minus.replaceChildren(tally(open, 'minus', { fresh: fresh < 0 }));
      c.sr.textContent = `${focus.full}: ${open} offen, ${done} nachgeholt`;
      c.btnPlus.setAttribute('aria-label', `${s.name}: Hausaufgabe nachgeholt`);
      c.btnMinus.setAttribute('aria-label', `${s.name}: ${focus.full}`);
      c.btnPlus.disabled = open === 0;
      c.plusText.textContent = '✓';
      c.minusText.textContent = 'Vergessen';
    } else {
      const [p, m] = S.ui.periodId ? getCount(studentId, focus.key, S.ui.periodId) : [0, 0];
      c.plus.replaceChildren(tally(p, 'plus', { fresh: fresh > 0 }));
      c.minus.replaceChildren(tally(m, 'minus', { fresh: fresh < 0 }));
      c.sr.textContent = `${focus.label}: ${p} positiv, ${m} negativ`;
      c.btnPlus.setAttribute('aria-label', `${s.name}: ${focus.label} positiv`);
      c.btnMinus.setAttribute('aria-label', `${s.name}: ${focus.label} negativ`);
      c.btnPlus.disabled = false;
      c.plusText.textContent = '+';
      c.minusText.textContent = '−';
    }
    c.name.setAttribute('aria-label', `${s.name}: alle Schwerpunkte öffnen`);
  }

  function refreshCards() {
    for (const id of cards.keys()) updateCard(id);
  }

  function refreshPill() {
    const p = getPeriod(S.ui.periodId);
    const outside = isOutsidePeriod(p);
    pill.className = `period-pill${outside ? ' warn' : ''}`;
    pill.replaceChildren(
      outside ? icon('warn', 16) : icon('calendar', 16),
      h('span', { class: 'period-pill-text' }, p ? p.name : 'Zeitraum wählen'),
      icon('chevron', 16),
    );
    pill.title = p ? [periodRangeText(p), outside ? 'Heute liegt nicht in diesem Zeitraum.' : ''].filter(Boolean).join('. ') : '';
    pill.setAttribute('aria-label', p ? `Zeitraum: ${p.name}${outside ? ', heute außerhalb des Zeitraums' : ''}. Zeitraum wechseln` : 'Zeitraum wählen');
  }

  function refreshAll() {
    refreshPill();
    refreshCards();
  }

  // ------------------------------------------------------------ Erfassen
  function record(studentId, v) {
    const s = getStudent(studentId);
    if (!s) return;
    if (!S.ui.periodId) {
      toast('Lege zuerst einen Beobachtungszeitraum an.', { action: 'Zeitraum anlegen', onAction: () => openPeriodForm({ onSaved: refreshAll }), kind: 'error' });
      return;
    }
    const focus = ASPECT_BY_KEY[S.ui.focus];
    let res;
    try {
      res = addObservation({ studentId, aspect: focus.key, v });
    } catch (e) {
      toast(e.message, { kind: 'error' });
      return;
    }
    res.done.catch((e) => {
      updateCard(studentId);
      refreshBadge();
      toast(`Nicht gespeichert: ${e.message}`, { kind: 'error', duration: 8000 });
    });
    updateCard(studentId, v);
    refreshBadge();
    const c = cards.get(studentId);
    if (c) {
      const cls = v > 0 ? 'flash-plus' : 'flash-minus';
      c.el.classList.remove('flash-plus', 'flash-minus');
      void c.el.offsetWidth; // Animation neu starten
      c.el.classList.add(cls);
      (v > 0 ? c.btnPlus : c.btnMinus).classList.add('hit');
      setTimeout(() => (v > 0 ? c.btnPlus : c.btnMinus).classList.remove('hit'), 160);
    }
    if (navigator.vibrate) navigator.vibrate(10);
    const what = focus.single
      ? [`: ${focus.full}`]
      : [`: ${focus.label} `, h('span', { class: `sgn ${v > 0 ? 'plus' : 'minus'}` }, v > 0 ? '+' : '−')];
    toast(h('span', {}, h('strong', {}, s.name), ...what), {
      action: 'Rückgängig',
      onAction: () => {
        const saved = removeObservation(res.obs.id); // Zustand ändert sich sofort, Speichern läuft nach
        updateCard(studentId);
        refreshBadge();
        toast('Rückgängig gemacht.', { duration: 1800 });
        saved.catch((e) => {
          updateCard(studentId);
          refreshBadge();
          toast(`Fehler: ${e.message}`, { kind: 'error' });
        });
      },
    });
  }

  /** Hakt die älteste offene Hausaufgabe des Kindes ab. */
  function complete(studentId) {
    const s = getStudent(studentId);
    if (!s || !S.ui.periodId) return;
    const res = completeOldestOpen(studentId, S.ui.periodId);
    if (!res) return;
    res.done.catch((e) => {
      updateCard(studentId);
      refreshBadge();
      toast(`Nicht gespeichert: ${e.message}`, { kind: 'error', duration: 8000 });
    });
    updateCard(studentId, 1);
    refreshBadge();
    const c = cards.get(studentId);
    if (c) {
      c.el.classList.remove('flash-plus', 'flash-minus');
      void c.el.offsetWidth;
      c.el.classList.add('flash-plus');
      c.btnPlus.classList.add('hit');
      setTimeout(() => c.btnPlus.classList.remove('hit'), 160);
    }
    if (navigator.vibrate) navigator.vibrate(10);
    toast(h('span', {}, h('strong', {}, s.name), ': Hausaufgabe nachgeholt'), {
      action: 'Rückgängig',
      onAction: () => {
        const saved = setHomeworkDone(res.obs.id, false);
        updateCard(studentId);
        refreshBadge();
        toast('Rückgängig gemacht.', { duration: 1800 });
        saved.catch((e) => {
          updateCard(studentId);
          refreshBadge();
          toast(`Fehler: ${e.message}`, { kind: 'error' });
        });
      },
    });
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.kid');
    if (!card) return;
    const id = card.dataset.id;
    const act = e.target.closest('button.act');
    if (act) {
      const v = Number(act.dataset.v);
      if (v > 0 && ASPECT_BY_KEY[S.ui.focus].single) complete(id);
      else record(id, v);
      return;
    }
    if (e.target.closest('button.kid-name')) {
      openChildSheet(id, { onChange: () => { updateCard(id); refreshBadge(); } });
    }
  });

  // ------------------------------------------------------------ Menü
  function openMenu() {
    const sh = openSheet({ title: 'Weitere Aktionen', size: 'small' });
    const item = (iconName, label, sub, onclick) =>
      h('button', { class: 'menu-item', type: 'button', onclick }, icon(iconName, 22), h('span', { class: 'menu-text' }, h('span', { class: 'menu-label' }, label), h('span', { class: 'menu-sub' }, sub)));
    sh.body.append(
      h('div', { class: 'menu-list' },
        item('chart', 'Auswertung ansehen', 'Zähler je Kind und Schwerpunkt', () => { sh.close(); location.hash = `#/c/${cls.id}/auswertung`; }),
        item('download', 'Dokumentation als PDF', 'Klassenübersicht oder Bericht pro Kind', () => { sh.close(); openExportSheet(); }),
        item('users', 'Kinder und Zeiträume verwalten', 'Namen ändern, Zeiträume anlegen', () => { sh.close(); location.hash = `#/c/${cls.id}/verwalten`; }),
      ),
    );
  }

  // ------------------------------------------------------------ Aufbau
  const sticky = h('div', { class: 'sticky-head' }, header, panel);
  const main = h('main', { class: 'live-main' });
  clear(app);
  app.append(sticky, main);

  if (!S.students.length) {
    main.append(
      h('section', { class: 'empty' },
        h('h2', {}, 'Diese Klasse hat noch keine Kinder'),
        h('p', {}, 'Füge Namen hinzu, um mit dem Beobachten zu beginnen.'),
        h('a', { class: 'btn primary big', href: `#/c/${cls.id}/verwalten` }, 'Kinder hinzufügen')),
    );
  } else {
    main.append(grid);
    buildCards();
  }
  updateFocus();
  refreshAll();
}

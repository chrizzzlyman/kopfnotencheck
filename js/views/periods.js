// Beobachtungszeiträume: Auswahl und Formular.

import { h, deDate } from '../util.js';
import { S, savePeriod, setPeriod, periodRangeText, isOutsidePeriod } from '../state.js';
import { openSheet, icon, field, errorText, toast } from '../ui.js';

/** Formular zum Anlegen oder Bearbeiten eines Zeitraums. onSaved(period) wird nach dem Speichern aufgerufen. */
export function openPeriodForm({ period = null, suggestion = null, onSaved = null } = {}) {
  const sh = openSheet({ title: period ? 'Zeitraum bearbeiten' : 'Zeitraum hinzufügen', size: 'small' });
  const base = period || suggestion || { name: '', start: '', end: '' };
  const name = h('input', { type: 'text', value: base.name, placeholder: 'z. B. 2. Halbjahr 2026/27', autocomplete: 'off', maxLength: 60 });
  const start = h('input', { type: 'date', value: base.start || '' });
  const end = h('input', { type: 'date', value: base.end || '' });
  const err = h('div');
  sh.body.append(
    field('Name', name),
    h('div', { class: 'field-row' }, field('Von', start), field('Bis', end)),
    h('p', { class: 'hint' }, 'Die Daten sind optional. Sie helfen, den richtigen Zeitraum zu wählen, und erscheinen im PDF.'),
    err,
  );
  const save = async () => {
    err.replaceChildren();
    if (!name.value.trim()) {
      err.append(errorText('Gib dem Zeitraum einen Namen.'));
      name.focus();
      return;
    }
    if (start.value && end.value && end.value < start.value) {
      err.append(errorText('Das Ende liegt vor dem Beginn.'));
      return;
    }
    try {
      const saved = await savePeriod({ id: period?.id, name: name.value, start: start.value, end: end.value });
      sh.close();
      if (onSaved) onSaved(saved);
    } catch (e) {
      err.append(errorText(`Speichern fehlgeschlagen: ${e.message}`));
    }
  };
  sh.setActions(
    h('button', { class: 'btn', type: 'button', onclick: () => sh.close() }, 'Abbrechen'),
    h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Speichern'),
  );
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  name.focus({ preventScroll: true }); // sofort, damit später Eingetipptes nicht den Fokus verliert
  return sh;
}

/** Auswahl des Zeitraums, dem neue Beobachtungen zugeordnet werden. */
export function openPeriodPicker({ onChange }) {
  const sh = openSheet({ title: 'Beobachtungszeitraum', subtitle: 'Neue Beobachtungen werden diesem Zeitraum zugeordnet.', size: 'small' });
  const render = () => {
    sh.body.replaceChildren();
    const list = h('div', { class: 'choice-list', role: 'radiogroup', 'aria-label': 'Zeitraum' });
    for (const p of S.periods) {
      const selected = p.id === S.ui.periodId;
      const outside = isOutsidePeriod(p);
      list.append(
        h(
          'button',
          {
            class: `choice${selected ? ' selected' : ''}`,
            type: 'button',
            role: 'radio',
            'aria-checked': String(selected),
            onclick: async () => {
              await setPeriod(p.id);
              sh.close();
              onChange();
            },
          },
          h('span', { class: 'choice-main' }, h('span', { class: 'choice-title' }, p.name), h('span', { class: 'choice-sub' }, periodRangeText(p) || 'ohne Datum')),
          outside ? h('span', { class: 'choice-flag', title: 'Heute liegt nicht in diesem Zeitraum' }, icon('warn', 18), h('span', {}, 'heute außerhalb')) : null,
          selected ? h('span', { class: 'choice-check' }, icon('check')) : null,
        ),
      );
    }
    sh.body.append(list);
  };
  render();
  sh.setActions(
    h('a', { class: 'btn', href: `#/c/${S.cls.id}/verwalten` }, 'Zeiträume bearbeiten'),
    h(
      'button',
      {
        class: 'btn primary',
        type: 'button',
        onclick: () => openPeriodForm({
          onSaved: async (p) => {
            await setPeriod(p.id);
            sh.close();
            onChange();
            toast(`Zeitraum „${p.name}“ ist jetzt aktiv.`);
          },
        }),
      },
      icon('plus', 18),
      'Zeitraum hinzufügen',
    ),
  );
  return sh;
}

export { deDate };

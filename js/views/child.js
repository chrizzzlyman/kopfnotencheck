// Detailansicht eines Kindes: alle Schwerpunkte mit + und −, Zähler und Verlauf der Beobachtungen.

import { h, deShortDateTime, plural } from '../util.js';
import { CATEGORIES, ASPECT_BY_KEY, aspectsOf, aspectTitle } from '../aspects.js';
import {
  S, ALL, getStudent, getCount, sumCounts, observationsOf, addObservation, removeObservation,
  restoreObservation, setObservationNote, getPeriod,
} from '../state.js';
import { openSheet, icon, toast, errorText } from '../ui.js';

const HISTORY_STEP = 30;

/**
 * Öffnet die Detailansicht. onChange() wird aufgerufen, sobald sich Beobachtungen ändern,
 * damit die Ansicht dahinter ihre Zähler aktualisieren kann.
 */
export function openChildSheet(studentId, { onChange = () => {}, periodId = null } = {}) {
  const student = getStudent(studentId);
  if (!student) return null;
  let viewPeriod = periodId || S.ui.periodId || (S.periods[0] && S.periods[0].id) || ALL;
  if (viewPeriod === ALL && S.periods.length === 1) viewPeriod = S.periods[0].id;
  let historyLimit = HISTORY_STEP;

  const sh = openSheet({ title: student.name, size: 'wide' });

  const periodSelect = h(
    'select',
    {
      'aria-label': 'Zeitraum',
      onchange: () => {
        viewPeriod = periodSelect.value;
        historyLimit = HISTORY_STEP;
        render();
      },
    },
    S.periods.map((p) => h('option', { value: p.id, selected: p.id === viewPeriod }, p.name)),
    S.periods.length > 1 ? h('option', { value: ALL, selected: viewPeriod === ALL }, 'Alle Zeiträume') : null,
  );

  const content = h('div');
  sh.body.append(h('div', { class: 'child-period' }, h('span', {}, 'Zeitraum'), periodSelect), content);

  function record(aspectKey, v) {
    let res;
    try {
      res = addObservation({ studentId, aspect: aspectKey, v, periodId: viewPeriod });
    } catch (e) {
      toast(e.message, { kind: 'error' });
      return;
    }
    res.done.catch((e) => {
      render();
      onChange();
      toast(`Speichern fehlgeschlagen: ${e.message}`, { kind: 'error' });
    });
    if (navigator.vibrate) navigator.vibrate(10);
    render();
    onChange();
    const a = ASPECT_BY_KEY[aspectKey];
    toast(a.single ? h('span', {}, a.full) : h('span', {}, `${a.label} `, h('span', { class: `sgn ${v > 0 ? 'plus' : 'minus'}` }, v > 0 ? '+' : '−')), {
      action: 'Rückgängig',
      onAction: () => {
        const saved = removeObservation(res.obs.id);
        render();
        onChange();
        saved.catch(failed);
      },
    });
  }

  function failed(e) {
    render();
    onChange();
    toast(`Speichern fehlgeschlagen: ${e.message}`, { kind: 'error' });
  }

  /** Zähler nur anzeigen, wenn es etwas zu zählen gibt (ruhigeres Bild, keine „+0 −0“-Reihen). */
  const counts = (p, m, extraClass = '') =>
    h('span', { class: `aspect-counts ${extraClass}`.trim(), 'aria-label': `${p} positiv, ${m} negativ` },
      p ? h('span', { class: 'cnt plus' }, `+${p}`) : null,
      m ? h('span', { class: 'cnt minus' }, `−${m}`) : null);

  function aspectRow(a) {
    const [p, m] = getCount(studentId, a.key, viewPeriod);
    const canAdd = viewPeriod !== ALL;
    if (a.single) {
      // Zusatzzähler (Hausaufgaben): nur eine Zählung, kein + und −
      return h('div', { class: 'aspect-row' },
        h('div', { class: 'aspect-main' },
          h('span', { class: 'aspect-name' }, a.full),
          m ? h('span', { class: 'aspect-counts', 'aria-label': `${m} Mal` }, h('span', { class: 'cnt minus' }, `${m}×`)) : null),
        canAdd
          ? h('div', { class: 'mini-actions' },
              h('button', { class: 'mini minus wide', type: 'button', 'aria-label': `${a.full}: einmal zählen`, onclick: () => record(a.key, -1) }, 'Vergessen'))
          : null,
      );
    }
    return h('div', { class: 'aspect-row' },
      h('div', { class: 'aspect-main' }, h('span', { class: 'aspect-name' }, a.label), counts(p, m)),
      canAdd
        ? h('div', { class: 'mini-actions' },
            h('button', { class: 'mini plus', type: 'button', 'aria-label': `${a.label} positiv`, onclick: () => record(a.key, 1) }, '+'),
            h('button', { class: 'mini minus', type: 'button', 'aria-label': `${a.label} negativ`, onclick: () => record(a.key, -1) }, '−'))
        : null,
    );
  }

  function render() {
    const top = sh.body.scrollTop;
    content.replaceChildren();
    if (viewPeriod === ALL) content.append(h('p', { class: 'hint' }, 'In der Ansicht „Alle Zeiträume“ kannst du nichts hinzufügen. Wähle dafür einen einzelnen Zeitraum.'));

    for (const cat of CATEGORIES) {
      const list = aspectsOf(cat.key);
      const [p, m] = sumCounts(studentId, viewPeriod, list);
      content.append(
        h('section', { class: `aspect-group ${cat.key}` },
          h('div', { class: 'group-head' },
            h('h3', {}, cat.label),
            cat.extra ? null : counts(p, m, 'group-total')),
          list.map(aspectRow)),
      );
    }

    // Verlauf
    const all = observationsOf(studentId, viewPeriod);
    const shown = all.slice(0, historyLimit);
    const hist = h('section', { class: 'history' }, h('h3', {}, 'Verlauf'));
    if (!all.length) hist.append(h('p', { class: 'hint' }, 'Noch keine Beobachtungen in diesem Zeitraum.'));
    const ul = h('ul', { class: 'history-list' });
    for (const o of shown) {
      ul.append(
        h('li', { class: 'history-item' },
          h('span', { class: `sgn-badge ${o.v > 0 ? 'plus' : 'minus'}`, 'aria-label': o.v > 0 ? 'positiv' : 'negativ' }, o.v > 0 ? '+' : '−'),
          h('div', { class: 'history-main' },
            h('span', { class: 'history-title' }, aspectTitle(o.aspect)),
            h('span', { class: 'history-meta' }, deShortDateTime(o.ts), viewPeriod === ALL && getPeriod(o.periodId) ? `, ${getPeriod(o.periodId).name}` : ''),
            o.note ? h('span', { class: 'history-note' }, o.note) : null),
          h('div', { class: 'history-actions' },
            h('button', { class: 'icon-btn small', type: 'button', 'aria-label': o.note ? 'Notiz bearbeiten' : 'Notiz hinzufügen', onclick: () => editNote(o) }, icon('note', 18)),
            h('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'Beobachtung löschen', onclick: () => deleteObs(o) }, icon('trash', 18))),
        ),
      );
    }
    hist.append(ul);
    if (all.length > shown.length) {
      hist.append(h('button', { class: 'btn block', type: 'button', onclick: () => { historyLimit += HISTORY_STEP; render(); } }, `Weitere anzeigen (${plural(all.length - shown.length, 'Eintrag', 'Einträge')})`));
    }
    content.append(hist);
    sh.body.scrollTop = top;
  }

  function deleteObs(o) {
    const saved = removeObservation(o.id);
    render();
    onChange();
    saved.catch(failed);
    toast('Beobachtung gelöscht.', {
      action: 'Rückgängig',
      onAction: () => {
        const restored = restoreObservation(o);
        render();
        onChange();
        restored.catch(failed);
      },
    });
  }

  function editNote(o) {
    const nsh = openSheet({ title: 'Notiz zur Beobachtung', subtitle: `${aspectTitle(o.aspect)}, ${deShortDateTime(o.ts)}`, size: 'small' });
    const ta = h('textarea', { rows: 4, maxLength: 500, placeholder: 'z. B. Was genau ist passiert?', value: o.note || '' });
    const err = h('div');
    nsh.body.append(h('div', { class: 'field' }, h('label', { for: 'note-input' }, 'Notiz'), ta), err);
    ta.id = 'note-input';
    nsh.setActions(
      h('button', { class: 'btn', type: 'button', onclick: () => nsh.close() }, 'Abbrechen'),
      h('button', {
        class: 'btn primary',
        type: 'button',
        onclick: async () => {
          try {
            await setObservationNote(o.id, ta.value);
            nsh.close();
            render();
          } catch (e) {
            err.replaceChildren(errorText(`Speichern fehlgeschlagen: ${e.message}`));
          }
        },
      }, 'Speichern'),
    );
    ta.focus({ preventScroll: true }); // sofort, damit später Eingetipptes nicht den Fokus verliert
  }

  render();
  return sh;
}


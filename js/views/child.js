// Detailansicht eines Kindes: alle Schwerpunkte mit + und −, Zähler und Verlauf der Beobachtungen.

import { h, deShortDateTime, deLongDateTime, ageText, plural } from '../util.js';
import { CATEGORIES, ASPECT_BY_KEY, aspectsOf, aspectTitle } from '../aspects.js';
import {
  S, ALL, HW, getStudent, getCount, sumCounts, observationsOf, addObservation, removeObservation,
  restoreObservation, setObservationNote, getPeriod, homeworkEntries, setHomeworkDone,
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
    return h('div', { class: 'aspect-row' },
      h('div', { class: 'aspect-main' }, h('span', { class: 'aspect-name' }, a.label), counts(p, m)),
      canAdd
        ? h('div', { class: 'mini-actions' },
            h('button', { class: 'mini plus', type: 'button', 'aria-label': `${a.label} positiv`, onclick: () => record(a.key, 1) }, '+'),
            h('button', { class: 'mini minus', type: 'button', 'aria-label': `${a.label} negativ`, onclick: () => record(a.key, -1) }, '−'))
        : null,
    );
  }

  /** Hausaufgaben: jeder Eintrag mit genauem Datum, Status und Knopf "Nachgeholt" / "Wieder offen". */
  function homeworkSection(cat) {
    const a = aspectsOf(cat.key)[0];
    const entries = homeworkEntries(studentId, viewPeriod);
    const open = entries.filter((o) => !o.doneTs).sort((x, y) => x.ts - y.ts);
    const done = entries.filter((o) => o.doneTs).sort((x, y) => y.ts - x.ts);
    const canAdd = viewPeriod !== ALL;
    return h('section', { class: `aspect-group ${cat.key}` },
      h('div', { class: 'group-head' },
        h('h3', {}, cat.label),
        h('span', { class: 'aspect-counts group-total', 'aria-label': `${open.length} offen, ${done.length} nachgeholt` },
          open.length ? h('span', { class: 'cnt minus' }, `${open.length} offen`) : null,
          done.length ? h('span', { class: 'cnt plus' }, `${done.length} nachgeholt`) : null)),
      h('div', { class: 'aspect-row' },
        h('div', { class: 'aspect-main' }, h('span', { class: 'aspect-name' }, a.full)),
        canAdd
          ? h('div', { class: 'mini-actions' },
              h('button', { class: 'mini minus wide', type: 'button', 'aria-label': `${a.full}: einmal zählen`, onclick: () => record(a.key, -1) }, 'Vergessen'))
          : null),
      entries.length
        ? h('ul', { class: 'history-list hw-entries' }, [...open, ...done].map(hwItem))
        : h('p', { class: 'hint hw-none' }, 'Noch keine vergessenen Hausaufgaben in diesem Zeitraum.'));
  }

  function hwItem(o) {
    const isDone = !!o.doneTs;
    const per = viewPeriod === ALL && getPeriod(o.periodId) ? `, ${getPeriod(o.periodId).name}` : '';
    return h('li', { class: `history-item hw-item ${isDone ? 'done' : 'open'}` },
      h('span', { class: `sgn-badge ${isDone ? 'plus' : 'minus'}`, 'aria-label': isDone ? 'nachgeholt' : 'offen' }, isDone ? '✓' : '−'),
      h('div', { class: 'history-main' },
        h('span', { class: 'history-title' }, `Vergessen am ${deLongDateTime(o.ts)}`),
        h('span', { class: `hw-status ${isDone ? 'done' : 'open'}` },
          isDone ? `Nachgeholt am ${deLongDateTime(o.doneTs)}${per}` : `Noch offen, ${ageText(o.ts)}${per}`),
        o.note ? h('span', { class: 'history-note' }, o.note) : null,
        h('button', { class: 'btn small hw-toggle', type: 'button', onclick: () => toggleDone(o) }, isDone ? 'Wieder offen' : 'Nachgeholt')),
      h('div', { class: 'history-actions' },
        h('button', { class: 'icon-btn small', type: 'button', 'aria-label': o.note ? 'Notiz bearbeiten' : 'Notiz hinzufügen', onclick: () => editNote(o) }, icon('note', 18)),
        h('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'Beobachtung löschen', onclick: () => deleteObs(o) }, icon('trash', 18))),
    );
  }

  function toggleDone(o) {
    const wasDone = !!o.doneTs;
    const saved = setHomeworkDone(o.id, !wasDone);
    render();
    onChange();
    saved.catch(failed);
    toast(wasDone ? 'Wieder offen.' : 'Als nachgeholt markiert.', {
      action: 'Rückgängig',
      onAction: () => {
        const back = setHomeworkDone(o.id, wasDone);
        render();
        onChange();
        back.catch(failed);
      },
    });
  }

  function render() {
    const top = sh.body.scrollTop;
    content.replaceChildren();
    if (viewPeriod === ALL) content.append(h('p', { class: 'hint' }, 'In der Ansicht „Alle Zeiträume“ kannst du nichts hinzufügen. Wähle dafür einen einzelnen Zeitraum.'));

    for (const cat of CATEGORIES) {
      if (cat.extra) {
        content.append(homeworkSection(cat));
        continue;
      }
      const list = aspectsOf(cat.key);
      const [p, m] = sumCounts(studentId, viewPeriod, list);
      content.append(
        h('section', { class: `aspect-group ${cat.key}` },
          h('div', { class: 'group-head' },
            h('h3', {}, cat.label),
            counts(p, m, 'group-total')),
          list.map(aspectRow)),
      );
    }

    // Verlauf
    const all = observationsOf(studentId, viewPeriod).filter((o) => o.aspect !== HW); // Hausaufgaben stehen oben im eigenen Abschnitt
    const shown = all.slice(0, historyLimit);
    const hist = h('section', { class: 'history' }, h('h3', {}, 'Verlauf Mitarbeit und Verhalten'));
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


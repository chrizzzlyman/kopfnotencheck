// Dialog "Dokumentation als PDF".

import { h, saveFile, plural } from '../util.js';
import { S, ALL } from '../state.js';
import { openSheet, toast, errorText } from '../ui.js';

export function openExportSheet({ periodId = null } = {}) {
  const sh = openSheet({ title: 'Dokumentation als PDF', subtitle: S.cls.name });
  let kind = 'overview';

  const per = h(
    'select',
    { id: 'exp-period' },
    S.periods.map((p) => h('option', { value: p.id, selected: p.id === (periodId && periodId !== ALL ? periodId : S.ui.periodId) }, p.name)),
    S.periods.length > 1 ? h('option', { value: ALL, selected: periodId === ALL }, 'Alle Zeiträume') : null,
  );
  const child = h('select', { id: 'exp-child', 'aria-label': 'Kind wählen', disabled: true }, S.students.map((s) => h('option', { value: s.id }, s.name)));
  const list = h('input', { type: 'checkbox', id: 'exp-list', checked: true });
  const listRow = h('label', { class: 'check-row', for: 'exp-list' }, list, h('span', {}, 'Einzelne Beobachtungen mit Datum und Uhrzeit auflisten'));
  const err = h('div');

  const kinds = [
    { key: 'overview', title: 'Klassenübersicht', sub: 'Eine Tabelle: alle Kinder, alle Schwerpunkte und vergessene Hausaufgaben (Querformat).' },
    { key: 'child', title: 'Bericht für ein Kind', sub: 'Zähler je Schwerpunkt und Verlauf, zum Beispiel für ein Elterngespräch.' },
    { key: 'all', title: 'Berichte für alle Kinder', sub: `Ein Bericht je Kind, ${plural(S.students.length, 'Kind', 'Kinder')} in einer Datei.` },
  ];
  const radios = h('div', { class: 'choice-list', role: 'radiogroup', 'aria-label': 'Inhalt' });
  function renderKinds() {
    radios.replaceChildren(
      ...kinds.map((k) =>
        h('button', {
          class: `choice${kind === k.key ? ' selected' : ''}`,
          type: 'button',
          role: 'radio',
          'aria-checked': String(kind === k.key),
          onclick: () => { kind = k.key; resetReady(); renderKinds(); sync(); },
        }, h('span', { class: 'choice-main' }, h('span', { class: 'choice-title' }, k.title), h('span', { class: 'choice-sub' }, k.sub)))),
    );
  }
  function resetReady() {
    if (!ready) return;
    ready = null;
    go.textContent = 'PDF herunterladen';
    err.replaceChildren();
  }
  function sync() {
    child.disabled = kind !== 'child';
    listRow.classList.toggle('disabled', kind === 'overview');
    list.disabled = kind === 'overview';
  }

  const go = h('button', { class: 'btn primary', type: 'button' }, 'PDF herunterladen');
  let ready = null; // fertige Datei, die beim nächsten Tipp gespeichert wird (iPad: Teilen-Dialog braucht einen frischen Tipp)

  const finish = (status) => {
    if (status === 'cancelled') {
      go.disabled = false;
      go.textContent = 'PDF herunterladen';
      return;
    }
    if (status !== 'shared') toast('PDF heruntergeladen.');
    sh.close();
  };

  go.addEventListener('click', async () => {
    err.replaceChildren();
    if (ready) {
      finish(await saveFile(ready.blob, ready.filename, { forceDownload: ready.retried }));
      return;
    }
    if (!S.students.length) {
      err.append(errorText('Die Klasse hat noch keine Kinder.'));
      return;
    }
    go.disabled = true;
    go.textContent = 'PDF wird erstellt …';
    try {
      const { createPdf } = await import('../pdf.js');
      const made = await createPdf({ kind, studentId: child.value, periodId: per.value, includeList: list.checked });
      const status = await saveFile(made.blob, made.filename);
      if (status === 'needs-gesture') {
        ready = { ...made, retried: false };
        err.append(h('p', { class: 'hint', role: 'status' }, 'Das PDF ist fertig. Tippe auf „PDF speichern“, um es zu sichern.'));
        go.disabled = false;
        go.textContent = 'PDF speichern';
        return;
      }
      finish(status);
    } catch (e) {
      console.error(e);
      err.append(errorText(`Das PDF konnte nicht erstellt werden: ${e.message}`));
      go.disabled = false;
      go.textContent = 'PDF herunterladen';
    }
  });

  for (const el of [per, child, list]) el.addEventListener('change', () => resetReady());
  sh.body.append(
    h('div', { class: 'field' }, h('label', { for: 'exp-period' }, 'Zeitraum'), per),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Inhalt'), radios),
    h('div', { class: 'field' }, h('label', { for: 'exp-child' }, 'Kind (für „Bericht für ein Kind“)'), child),
    listRow,
    err,
  );
  sh.setActions(h('button', { class: 'btn', type: 'button', onclick: () => sh.close() }, 'Abbrechen'), go);
  renderKinds();
  sync();
  return sh;
}

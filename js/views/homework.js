// Übersicht offener Hausaufgaben über alle Klassen (Startseite). Ein Tipp auf ✓ markiert sie als nachgeholt.

import { h, deLongDateTime, ageText, dayDiff, plural } from '../util.js';
import { setHomeworkDone } from '../state.js';
import { icon, toast } from '../ui.js';

const SHOW_FIRST = 5;
const OLD_DAYS = 7;
let expanded = false; // bleibt erhalten, wenn die Startseite neu aufgebaut wird

/** rows: Ergebnis von listOpenHomework(). onChanged() baut die Startseite neu auf. */
export function homeworkOverview(rows, { onChanged = () => {} } = {}) {
  if (!rows.length) return null;
  const shown = expanded ? rows : rows.slice(0, SHOW_FIRST);

  const done = async (row) => {
    const name = row.student.name;
    try {
      await setHomeworkDone(row.obs.id, true);
    } catch (e) {
      toast(`Nicht gespeichert: ${e.message}`, { kind: 'error' });
      return;
    }
    onChanged();
    toast(h('span', {}, h('strong', {}, name), ': Hausaufgabe nachgeholt'), {
      action: 'Rückgängig',
      onAction: async () => {
        try {
          await setHomeworkDone(row.obs.id, false);
        } catch (e) {
          toast(`Fehler: ${e.message}`, { kind: 'error' });
        }
        onChanged();
      },
    });
  };

  const list = h('ul', { class: 'hw-list' },
    shown.map((row) => {
      const days = dayDiff(row.obs.ts);
      return h('li', { class: 'hw-row' },
        h('div', { class: 'hw-main' },
          h('div', { class: 'hw-who' },
            h('span', { class: 'hw-name' }, row.student.name),
            h('a', { class: 'hw-class', href: `#/c/${row.cls.id}` }, row.cls.name)),
          h('div', { class: 'hw-meta' },
            h('span', { class: 'hw-when' }, `Vergessen am ${deLongDateTime(row.obs.ts)}`),
            h('span', { class: `hw-age${days >= OLD_DAYS ? ' old' : ''}` }, days >= OLD_DAYS ? `seit ${days} Tagen offen` : `offen, ${ageText(row.obs.ts)}`)),
        ),
        h('button', {
          class: 'hw-done',
          type: 'button',
          'aria-label': `${row.student.name}, ${row.cls.name}: Hausaufgabe nachgeholt`,
          onclick: () => done(row),
        }, icon('check', 24), h('span', {}, 'Nachgeholt')),
      );
    }),
  );

  return h('section', { class: 'hw-overview', 'aria-labelledby': 'hw-title' },
    h('div', { class: 'hw-head' },
      h('h2', { id: 'hw-title' }, 'Offene Hausaufgaben'),
      h('span', { class: 'hw-count', 'aria-label': plural(rows.length, 'offene Hausaufgabe', 'offene Hausaufgaben') }, String(rows.length)),
    ),
    list,
    rows.length > SHOW_FIRST
      ? h('button', {
          class: 'link hw-more',
          type: 'button',
          onclick: () => { expanded = !expanded; onChanged(); },
        }, expanded ? 'Weniger anzeigen' : `Alle ${rows.length} anzeigen`)
      : null,
  );
}

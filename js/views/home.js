// Startseite: Klassenliste, neue Klasse anlegen.

import { h, clear, parseNames, suggestPeriod, plural } from '../util.js';
import { listClasses, createClass, lastBackupAt } from '../state.js';
import { requestPersistence } from '../db.js';
import { icon, openSheet, field, errorText, tally } from '../ui.js';
import { openBackupSheet, openPrivacySheet } from './backup.js';

const BACKUP_REMINDER_DAYS = 14;

export async function renderHome(app, isCurrent = () => true) {
  const [classes, last] = await Promise.all([listClasses(), lastBackupAt()]);
  if (!isCurrent()) return;
  const hasData = classes.some((c) => c.obsCount > 0);
  const stale = hasData && (!last || Date.now() - last > BACKUP_REMINDER_DAYS * 86400000);
  clear(app);

  const rerender = () => renderHome(app);

  app.append(
    h('header', { class: 'topbar' },
      h('h1', { class: 'title app-title' }, 'Kopfnoten-Beobachter'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sichern und wiederherstellen', onclick: () => openBackupSheet({ onChanged: rerender }) }, icon('download')),
    ),
    h('main', { class: 'page' },
      stale
        ? h('div', { class: 'banner' },
            h('p', {}, last ? 'Deine letzte Sicherung ist älter als zwei Wochen.' : 'Du hast noch keine Sicherung erstellt.'),
            h('button', { class: 'btn small', type: 'button', onclick: () => openBackupSheet({ onChanged: rerender }) }, 'Jetzt sichern'))
        : null,
      classes.length ? classList(classes) : emptyState(rerender),
      classes.length
        ? h('button', { class: 'btn primary big', type: 'button', onclick: () => openNewClassSheet() }, icon('plus', 20), 'Klasse anlegen')
        : null,
      h('footer', { class: 'home-foot' },
        h('button', { class: 'link', type: 'button', onclick: () => openBackupSheet({ onChanged: rerender }) }, 'Sichern und wiederherstellen'),
        h('button', { class: 'link', type: 'button', onclick: () => openPrivacySheet() }, 'Datenschutz'),
      ),
    ),
  );
}

function classList(classes) {
  return h('ul', { class: 'class-list' },
    classes.map((c) =>
      h('li', {},
        h('a', { class: 'class-card', href: `#/c/${c.id}` },
          h('span', { class: 'class-name' }, c.name),
          h('span', { class: 'class-meta' }, `${plural(c.studentCount, 'Kind', 'Kinder')}, ${plural(c.obsCount, 'Beobachtung', 'Beobachtungen')}`),
        ),
      ),
    ),
  );
}

function emptyState() {
  return h('section', { class: 'empty' },
    h('div', { class: 'empty-mark', 'aria-hidden': 'true' }, tally(5, 'plus'), tally(2, 'minus')),
    h('h2', {}, 'Noch keine Klasse'),
    h('p', {}, 'Lege eine Klasse an, trage die Namen der Kinder ein und halte im Unterricht mit einem Tipp fest, was du beobachtest.'),
    h('button', { class: 'btn primary big', type: 'button', onclick: () => openNewClassSheet() }, icon('plus', 20), 'Erste Klasse anlegen'),
  );
}

export function openNewClassSheet() {
  const sh = openSheet({ title: 'Klasse anlegen' });
  const sug = suggestPeriod();
  const name = h('input', { type: 'text', placeholder: 'z. B. 7b Deutsch', autocomplete: 'off', maxLength: 60 });
  const names = h('textarea', { rows: 8, placeholder: 'Anna Müller\nBen Schmidt\nCem Yilmaz', spellcheck: false, autocomplete: 'off' });
  const count = h('p', { class: 'hint', 'aria-live': 'polite' }, 'Noch keine Namen.');
  const pName = h('input', { type: 'text', value: sug.name, autocomplete: 'off', maxLength: 60 });
  const pStart = h('input', { type: 'date', value: sug.start });
  const pEnd = h('input', { type: 'date', value: sug.end });
  const err = h('div');

  names.addEventListener('input', () => {
    const list = parseNames(names.value);
    const seen = new Set();
    const dupes = new Set();
    for (const n of list) {
      const k = n.toLocaleLowerCase('de');
      if (seen.has(k)) dupes.add(n);
      seen.add(k);
    }
    count.textContent = list.length
      ? `${plural(list.length, 'Kind', 'Kinder')} erkannt.${dupes.size ? ` Doppelt: ${[...dupes].join(', ')}. Unterscheide gleiche Namen z. B. mit dem Anfangsbuchstaben des Nachnamens.` : ''}`
      : 'Noch keine Namen.';
  });

  sh.body.append(
    field('Name der Klasse', name),
    field('Namen der Kinder', names, 'Ein Name pro Zeile. Du kannst eine Liste aus einer Tabelle einfügen. Vornamen oder Kürzel genügen.'),
    count,
    h('div', { class: 'section-gap' }),
    field('Erster Beobachtungszeitraum', pName),
    h('div', { class: 'field-row' }, field('Von', pStart), field('Bis', pEnd)),
    h('p', { class: 'hint' }, 'Weitere Zeiträume legst du später an. Der Vorschlag ist ein Halbjahr und frei änderbar.'),
    err,
  );

  const save = async () => {
    err.replaceChildren();
    const list = parseNames(names.value);
    if (!name.value.trim()) return fail('Gib der Klasse einen Namen.', name);
    if (!list.length) return fail('Trage mindestens einen Namen ein.', names);
    if (!pName.value.trim()) return fail('Gib dem Zeitraum einen Namen.', pName);
    if (pStart.value && pEnd.value && pEnd.value < pStart.value) return fail('Das Ende des Zeitraums liegt vor dem Beginn.', pEnd);
    try {
      const id = await createClass({ name: name.value, names: list, period: { name: pName.value, start: pStart.value, end: pEnd.value } });
      requestPersistence();
      sh.close();
      location.hash = `#/c/${id}`;
    } catch (e) {
      err.append(errorText(`Speichern fehlgeschlagen: ${e.message}`));
    }
  };
  const fail = (msg, el) => {
    err.append(errorText(msg));
    el.focus();
  };

  sh.setActions(
    h('button', { class: 'btn', type: 'button', onclick: () => sh.close() }, 'Abbrechen'),
    h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Klasse anlegen'),
  );
  name.focus({ preventScroll: true }); // sofort, damit später Eingetipptes nicht den Fokus verliert
  return sh;
}

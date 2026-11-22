// Klasse verwalten: Name, Kinder, Beobachtungszeiträume, Klasse löschen.

import { h, clear, parseNames, plural } from '../util.js';
import {
  S, renameClass, addStudents, renameStudent, removeStudent, sortStudentsAZ, removePeriod, removeClass, periodRangeText,
} from '../state.js';
import { icon, toast, confirmDialog, infoDialog } from '../ui.js';
import { openPeriodForm } from './periods.js';

export function renderManage(app) {
  const cls = S.cls;
  const kidsBox = h('div');
  const periodsBox = h('div');
  const classTitle = h('h1', { class: 'title' }, cls.name);

  const obsCountOf = (studentId) => S.obs.filter((o) => o.studentId === studentId).length;

  // ----------------------------------------------------------- Klasse
  const nameInput = h('input', { type: 'text', value: cls.name, maxLength: 60, autocomplete: 'off', 'aria-label': 'Name der Klasse' });
  const saveName = async () => {
    const v = nameInput.value.trim();
    if (!v) {
      nameInput.value = S.cls.name;
      toast('Der Name der Klasse darf nicht leer sein.', { kind: 'error' });
      return;
    }
    if (v === S.cls.name) return;
    try {
      await renameClass(v);
      classTitle.textContent = S.cls.name;
      toast('Name gespeichert.', { duration: 1800 });
    } catch (e) {
      toast(`Speichern fehlgeschlagen: ${e.message}`, { kind: 'error' });
    }
  };
  nameInput.addEventListener('change', saveName);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

  // ----------------------------------------------------------- Kinder
  function renderKids() {
    clear(kidsBox);
    const list = h('ul', { class: 'edit-list' });
    for (const s of S.students) {
      const input = h('input', { type: 'text', value: s.name, maxLength: 80, autocomplete: 'off', 'aria-label': `Name: ${s.name}` });
      input.addEventListener('change', async () => {
        const v = input.value.replace(/\s+/g, ' ').trim();
        if (!v) {
          input.value = s.name;
          toast('Ein Name darf nicht leer sein. Zum Entfernen nutze den Papierkorb.', { kind: 'error' });
          return;
        }
        try {
          await renameStudent(s.id, v);
          input.value = v;
        } catch (e) {
          toast(`Speichern fehlgeschlagen: ${e.message}`, { kind: 'error' });
        }
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      list.append(
        h('li', { class: 'edit-row' },
          input,
          h('button', {
            class: 'icon-btn danger-ghost',
            type: 'button',
            'aria-label': `${s.name} entfernen`,
            onclick: async () => {
              const n = obsCountOf(s.id);
              const ok = await confirmDialog({
                title: `${s.name} entfernen?`,
                message: n ? `Alle ${plural(n, 'Beobachtung', 'Beobachtungen')} dieses Kindes werden ebenfalls gelöscht. Das kannst du nicht rückgängig machen.` : 'Das Kind wird aus der Klasse entfernt.',
                confirmLabel: 'Entfernen',
                danger: true,
              });
              if (!ok) return;
              try {
                await removeStudent(s.id);
                renderKids();
              } catch (e) {
                toast(`Löschen fehlgeschlagen: ${e.message}`, { kind: 'error' });
              }
            },
          }, icon('trash', 20)),
        ),
      );
    }
    const addArea = h('textarea', { rows: 3, placeholder: 'Weitere Namen, ein Name pro Zeile', spellcheck: false, autocomplete: 'off', 'aria-label': 'Weitere Namen hinzufügen' });
    const addBtn = h('button', {
      class: 'btn',
      type: 'button',
      onclick: async () => {
        const names = parseNames(addArea.value);
        if (!names.length) {
          addArea.focus();
          return;
        }
        try {
          await addStudents(names);
          toast(`${plural(names.length, 'Kind', 'Kinder')} hinzugefügt.`, { duration: 2200 });
          renderKids();
        } catch (e) {
          toast(`Speichern fehlgeschlagen: ${e.message}`, { kind: 'error' });
        }
      },
    }, icon('plus', 18), 'Hinzufügen');

    kidsBox.append(
      h('div', { class: 'panel-head' },
        h('h2', {}, `Kinder (${S.students.length})`),
        S.students.length > 1
          ? h('button', {
              class: 'link',
              type: 'button',
              onclick: async () => {
                try {
                  await sortStudentsAZ();
                  renderKids();
                  toast('Alphabetisch sortiert.', { duration: 1800 });
                } catch (e) {
                  toast(`Fehler: ${e.message}`, { kind: 'error' });
                }
              },
            }, 'A bis Z sortieren')
          : null),
      S.students.length ? list : h('p', { class: 'hint' }, 'Noch keine Kinder.'),
      h('div', { class: 'add-box' }, addArea, addBtn),
    );
  }

  // ----------------------------------------------------------- Zeiträume
  function renderPeriods() {
    clear(periodsBox);
    const list = h('ul', { class: 'edit-list' });
    for (const p of S.periods) {
      const n = S.obs.filter((o) => o.periodId === p.id).length;
      list.append(
        h('li', { class: 'edit-row period-row' },
          h('div', { class: 'period-info' },
            h('span', { class: 'period-name' }, p.name),
            h('span', { class: 'period-sub' }, [periodRangeText(p), plural(n, 'Beobachtung', 'Beobachtungen')].filter(Boolean).join(', '))),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${p.name} bearbeiten`, onclick: () => openPeriodForm({ period: p, onSaved: renderPeriods }) }, icon('edit', 20)),
          h('button', {
            class: 'icon-btn danger-ghost',
            type: 'button',
            'aria-label': `${p.name} löschen`,
            onclick: async () => {
              if (S.periods.length <= 1) {
                await infoDialog({ title: 'Zeitraum nicht löschbar', message: 'Eine Klasse braucht mindestens einen Beobachtungszeitraum. Lege zuerst einen neuen an.' });
                return;
              }
              const ok = await confirmDialog({
                title: `${p.name} löschen?`,
                message: n ? `Alle ${plural(n, 'Beobachtung', 'Beobachtungen')} in diesem Zeitraum werden ebenfalls gelöscht. Lade vorher eine Sicherung oder ein PDF herunter, wenn du sie noch brauchst.` : 'Der Zeitraum wird gelöscht.',
                confirmLabel: 'Löschen',
                danger: true,
              });
              if (!ok) return;
              try {
                await removePeriod(p.id);
                renderPeriods();
              } catch (e) {
                toast(`Löschen fehlgeschlagen: ${e.message}`, { kind: 'error' });
              }
            },
          }, icon('trash', 20)),
        ),
      );
    }
    periodsBox.append(
      h('div', { class: 'panel-head' }, h('h2', {}, 'Beobachtungszeiträume')),
      list,
      h('button', { class: 'btn', type: 'button', onclick: () => openPeriodForm({ onSaved: renderPeriods }) }, icon('plus', 18), 'Zeitraum hinzufügen'),
    );
  }

  // ----------------------------------------------------------- Löschen
  const deleteBtn = h('button', {
    class: 'btn danger',
    type: 'button',
    onclick: async () => {
      const ok = await confirmDialog({
        title: `Klasse „${S.cls.name}“ löschen?`,
        message: [
          `Die Klasse mit ${plural(S.students.length, 'Kind', 'Kindern')} und ${plural(S.obs.length, 'Beobachtung', 'Beobachtungen')} wird von diesem Gerät gelöscht. Das kannst du nicht rückgängig machen.`,
          'Tipp: Lade vorher eine Sicherung herunter.',
        ],
        confirmLabel: 'Klasse löschen',
        danger: true,
      });
      if (!ok) return;
      try {
        await removeClass(S.cls.id);
        location.hash = '#/';
      } catch (e) {
        toast(`Löschen fehlgeschlagen: ${e.message}`, { kind: 'error' });
      }
    },
  }, icon('trash', 18), 'Klasse löschen');

  clear(app);
  app.append(
    h('div', { class: 'sticky-head' },
      h('header', { class: 'topbar' },
        h('a', { class: 'icon-btn', href: `#/c/${cls.id}`, 'aria-label': 'Zurück zum Unterricht' }, icon('back')),
        h('div', { class: 'title-block' }, classTitle, h('span', { class: 'subtitle' }, 'Verwalten')),
      ),
    ),
    h('main', { class: 'page' },
      h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Name der Klasse')), nameInput),
      h('section', { class: 'panel' }, kidsBox),
      h('section', { class: 'panel' }, periodsBox),
      h('section', { class: 'panel danger-zone' }, h('div', { class: 'panel-head' }, h('h2', {}, 'Klasse löschen')), h('p', { class: 'hint' }, 'Entfernt die Klasse mit allen Kindern, Zeiträumen und Beobachtungen von diesem Gerät.'), deleteBtn),
    ),
  );
  renderKids();
  renderPeriods();
}

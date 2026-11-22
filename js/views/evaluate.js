// Auswertung: Tabelle aller Kinder × Schwerpunkte mit Zählern und Tendenz (ohne Notenvorschlag).

import { h, clear, plural } from '../util.js';
import { MATRIX_CATEGORIES, MATRIX_ASPECTS, EXTRA_ASPECT, CATEGORIES, aspectsOf } from '../aspects.js';
import { S, ALL, getCount, sumCounts, homeworkStats } from '../state.js';
import { icon } from '../ui.js';
import { openChildSheet } from './child.js';
import { openExportSheet } from './exporter.js';

export function renderEvaluate(app) {
  const cls = S.cls;
  let periodId = S.ui.periodId || (S.periods.length > 1 ? ALL : S.periods[0]?.id) || ALL;
  let sort = 'name';

  const wrap = h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Auswertungstabelle, horizontal und vertikal scrollbar' });
  const summary = h('p', { class: 'hint', 'aria-live': 'polite' });

  const periodSelect = h(
    'select',
    { 'aria-label': 'Zeitraum', onchange: () => { periodId = periodSelect.value; renderTable(); } },
    S.periods.map((p) => h('option', { value: p.id, selected: p.id === periodId }, p.name)),
    S.periods.length > 1 ? h('option', { value: ALL, selected: periodId === ALL }, 'Alle Zeiträume') : null,
  );

  const sortBtn = (key, label) =>
    h('button', { class: 'seg', type: 'button', 'aria-pressed': String(sort === key), onclick: () => { sort = key; renderControls(); renderTable(); } }, label);
  const sortBox = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Sortierung' });
  function renderControls() {
    sortBox.replaceChildren(sortBtn('name', 'Wie in der Liste'), sortBtn('least', 'Wenigste zuerst'));
  }

  const num = (n, cls) => h('span', { class: `${cls}${n ? '' : ' z'}` }, n ? String(n) : '–');

  function cell(studentId, aspectKey) {
    const [p, m] = getCount(studentId, aspectKey, periodId);
    const td = h('td', { class: `cell${p + m ? '' : ' zero'}` });
    if (p + m) {
      td.append(
        h('span', { class: 'nums', 'aria-label': `${p} positiv, ${m} negativ` }, num(p, 'p'), num(m, 'm')),
        h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${Math.round((p / (p + m)) * 100)}%` } })),
      );
    }
    return td;
  }

  /** Zusatzzähler (Hausaufgaben): nur eine Zahl, kein Balken. */
  function extraCell(studentId, a) {
    const [, m] = getCount(studentId, a.key, periodId);
    const { open } = homeworkStats(studentId, periodId);
    const td = h('td', { class: `cell extra${m ? '' : ' zero'}` });
    if (m) {
      td.append(h('span', { class: 'nums', 'aria-label': `${m} Mal ${a.full}${open ? `, davon ${open} noch offen` : ''}` }, num(m, 'm')));
      if (open) td.append(h('span', { class: 'sub-open', 'aria-hidden': 'true' }, `${open} offen`));
    }
    return td;
  }

  function renderTable() {
    const rows = S.students.map((s) => ({ s, tot: sumCounts(s.id, periodId) }));
    if (sort === 'least') rows.sort((a, b) => a.tot[0] + a.tot[1] - (b.tot[0] + b.tot[1]));

    const head1 = h('tr', { class: 'group-row' },
      h('th', { class: 'name-col corner', rowspan: 2, scope: 'col' }, 'Kind'),
      ...MATRIX_CATEGORIES.map((c) => h('th', { class: `group ${c.key}`, colspan: aspectsOf(c.key).length, scope: 'colgroup' }, c.label)),
      h('th', { class: 'total-col', rowspan: 2, scope: 'col' }, 'Gesamt'),
      ...CATEGORIES.filter((c) => c.extra).map((c) => h('th', { class: `group ${c.key} extra-col`, colspan: aspectsOf(c.key).length, scope: 'colgroup' }, c.label)),
    );
    const head2 = h('tr', { class: 'aspect-row-head' },
      ...MATRIX_ASPECTS.map((a) => h('th', { class: `rot ${a.cat}`, scope: 'col', title: a.full }, h('span', {}, a.label))),
      h('th', { class: `rot ${EXTRA_ASPECT.cat} extra-col`, scope: 'col', title: EXTRA_ASPECT.full }, h('span', {}, EXTRA_ASPECT.label)),
    );

    const body = h('tbody');
    for (const { s, tot } of rows) {
      const none = tot[0] + tot[1] === 0;
      body.append(
        h('tr', { class: none ? 'unobserved' : '' },
          h('th', { class: 'name-col', scope: 'row' }, h('button', { class: 'name-link', type: 'button', onclick: () => openChildSheet(s.id, { periodId, onChange: renderTable }) }, s.name)),
          MATRIX_ASPECTS.map((a) => cell(s.id, a.key)),
          h('td', { class: 'total-col' }, none ? h('span', { class: 'none' }, 'keine') : h('span', { class: 'nums', 'aria-label': `${tot[0]} positiv, ${tot[1]} negativ` }, num(tot[0], 'p'), num(tot[1], 'm'))),
          extraCell(s.id, EXTRA_ASPECT),
        ),
      );
    }

    clear(wrap);
    wrap.append(h('table', { class: 'eval' }, h('thead', {}, head1, head2), body));

    const observed = rows.filter((r) => r.tot[0] + r.tot[1] > 0).length;
    const openTotal = S.students.reduce((n, st) => n + homeworkStats(st.id, periodId).open, 0);
    summary.textContent = `${observed} von ${plural(rows.length, 'Kind', 'Kindern')} mit Beobachtungen.${openTotal ? ` ${plural(openTotal, 'Hausaufgabe', 'Hausaufgaben')} noch offen.` : ''}`;
  }

  clear(app);
  app.append(
    h('div', { class: 'sticky-head' },
      h('header', { class: 'topbar' },
        h('a', { class: 'icon-btn', href: `#/c/${cls.id}`, 'aria-label': 'Zurück zum Unterricht' }, icon('back')),
        h('div', { class: 'title-block' }, h('h1', { class: 'title' }, 'Auswertung'), h('span', { class: 'subtitle' }, cls.name)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Als PDF herunterladen', onclick: () => openExportSheet({ periodId }) }, icon('download')),
      ),
    ),
    h('main', { class: 'page wide-page' },
      h('div', { class: 'eval-controls' }, h('label', { class: 'select-label' }, h('span', {}, 'Zeitraum'), periodSelect), sortBox),
      summary,
      wrap,
      h('p', { class: 'hint legend' },
        h('span', { class: 'sgn plus' }, 'Grün'), ' zählt positive, ', h('span', { class: 'sgn minus' }, 'Rot'), ' negative Beobachtungen. Der Balken zeigt den Anteil der positiven. Die Spalte Hausaufgaben zählt vergessene Hausaufgaben, darunter steht, wie viele davon noch offen sind. Sie fließt nicht in „Gesamt“ ein. Die Zahlen dokumentieren Beobachtungen und ersetzen nicht die Bewertung nach den Bewertungsmatrizen.'),
    ),
  );
  renderControls();
  renderTable();
}

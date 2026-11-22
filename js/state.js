// Zustand der aktuell geöffneten Klasse (im Arbeitsspeicher) und alle Änderungen daran.
// Jede Änderung wird sofort in IndexedDB gespeichert.

import * as db from './db.js';
import { MATRIX_ASPECTS, DEFAULT_FOCUS, ASPECT_BY_KEY, EXTRA_ASPECT } from './aspects.js';
import { uid, todayIso, collator } from './util.js';

export const ALL = 'all'; // Pseudo-Zeitraum "Alle Zeiträume" (nur für Ansicht und Export)

export const S = {
  cls: null,
  students: [],
  periods: [],
  obs: [],
  counts: new Map(), // `${studentId}|${aspect}|${periodId}` -> [positiv, negativ]
  ui: { periodId: null, focus: DEFAULT_FOCUS.mitarbeit, lastFocus: { ...DEFAULT_FOCUS } },
};

const key = (sid, aspect, pid) => `${sid}|${aspect}|${pid}`;

/** Schlüssel des Hausaufgaben-Zählers. */
export const HW = EXTRA_ASPECT.key;

/** Meldet Änderungen an Hausaufgaben (für die Zahl am App-Symbol). */
export const events = new EventTarget();
const touchHomework = () => events.dispatchEvent(new Event('homework'));

function bump(o, delta) {
  const k = key(o.studentId, o.aspect, o.periodId);
  const c = S.counts.get(k) || [0, 0];
  if (o.v > 0) c[0] += delta;
  else c[1] += delta;
  if (c[0] <= 0 && c[1] <= 0) S.counts.delete(k);
  else S.counts.set(k, c);
}

function rebuildCounts() {
  S.counts = new Map();
  for (const o of S.obs) bump(o, 1);
}

export const sortStudents = (list) =>
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || collator.compare(a.name, b.name));

/** Zeiträume mit Datum nach Beginn, Zeiträume ohne Datum danach in Reihenfolge des Anlegens. */
export const sortPeriods = (list) =>
  list.sort((a, b) => {
    if (!!a.start !== !!b.start) return a.start ? -1 : 1;
    return (a.start || '').localeCompare(b.start || '') || (a.createdAt || 0) - (b.createdAt || 0);
  });

/** Zeitraum wählen, in dem "heute" liegt; sonst den neuesten. */
export function pickDefaultPeriod(periods) {
  if (!periods.length) return null;
  const today = todayIso();
  const hits = periods.filter((p) => (!p.start || p.start <= today) && (!p.end || p.end >= today));
  const pool = hits.length ? hits : periods;
  return [...pool].sort((a, b) => (b.start || '').localeCompare(a.start || '') || (b.createdAt || 0) - (a.createdAt || 0))[0];
}

// ---------------------------------------------------------------- Klassenliste

export async function listClasses() {
  const [classes, students] = await Promise.all([db.getAll('classes'), db.getAll('students')]);
  const kids = new Map();
  for (const s of students) kids.set(s.classId, (kids.get(s.classId) || 0) + 1);
  const rows = [];
  for (const c of classes) {
    rows.push({ ...c, studentCount: kids.get(c.id) || 0, obsCount: await db.countBy('observations', 'classId', c.id) });
  }
  return rows.sort((a, b) => collator.compare(a.name, b.name));
}

export async function createClass({ name, names, period }) {
  const cls = { id: uid(), name: name.trim(), createdAt: Date.now() };
  const students = names.map((n, i) => ({ id: uid(), classId: cls.id, name: n, order: i }));
  const per = { id: uid(), classId: cls.id, name: period.name.trim(), start: period.start || '', end: period.end || '', createdAt: Date.now() };
  await db.batch([
    { store: 'classes', put: cls },
    ...students.map((s) => ({ store: 'students', put: s })),
    { store: 'periods', put: per },
  ]);
  return cls.id;
}

export async function removeClass(id) {
  await db.deleteClass(id);
  if (S.cls && S.cls.id === id) unloadClass();
  touchHomework();
}

// ---------------------------------------------------------------- Klasse laden

export function unloadClass() {
  S.cls = null;
  S.students = [];
  S.periods = [];
  S.obs = [];
  S.counts = new Map();
}

export async function loadClass(id) {
  const cls = await db.get('classes', id);
  if (!cls) return false;
  const [students, periods, obs, saved] = await Promise.all([
    db.getAllBy('students', 'classId', id),
    db.getAllBy('periods', 'classId', id),
    db.getAllBy('observations', 'classId', id),
    db.metaGet(`ui:${id}`, {}),
  ]);
  S.cls = cls;
  S.students = sortStudents(students);
  S.periods = sortPeriods(periods);
  S.obs = obs;
  rebuildCounts();
  const periodOk = S.periods.some((p) => p.id === saved.periodId);
  const lastFocus = { ...DEFAULT_FOCUS, ...(saved.lastFocus || {}) };
  const focus = ASPECT_BY_KEY[saved.focus] ? saved.focus : DEFAULT_FOCUS.mitarbeit;
  S.ui = {
    periodId: periodOk ? saved.periodId : pickDefaultPeriod(S.periods)?.id ?? null,
    focus,
    lastFocus,
  };
  S.ui.lastFocus[ASPECT_BY_KEY[focus].cat] = focus;
  return true;
}

export function saveUi() {
  if (!S.cls) return Promise.resolve();
  return db.metaSet(`ui:${S.cls.id}`, { periodId: S.ui.periodId, focus: S.ui.focus, lastFocus: S.ui.lastFocus });
}

export function setFocus(aspectKey) {
  S.ui.focus = aspectKey;
  S.ui.lastFocus[ASPECT_BY_KEY[aspectKey].cat] = aspectKey;
  return saveUi();
}

export function setPeriod(periodId) {
  S.ui.periodId = periodId;
  return saveUi();
}

export const getPeriod = (id) => S.periods.find((p) => p.id === id) || null;
export const getStudent = (id) => S.students.find((s) => s.id === id) || null;

// ---------------------------------------------------------------- Beobachtungen

/** Zählt [positiv, negativ] für ein Kind und einen Schwerpunkt. periodId kann ALL sein. */
export function getCount(studentId, aspect, periodId) {
  if (periodId === ALL) {
    let p = 0;
    let m = 0;
    for (const per of S.periods) {
      const c = S.counts.get(key(studentId, aspect, per.id));
      if (c) {
        p += c[0];
        m += c[1];
      }
    }
    return [p, m];
  }
  return S.counts.get(key(studentId, aspect, periodId)) || [0, 0];
}

/** Summe über mehrere Schwerpunkte (Standard: nur die Matrix-Schwerpunkte, ohne Hausaufgaben). */
export function sumCounts(studentId, periodId, aspects = MATRIX_ASPECTS) {
  let p = 0;
  let m = 0;
  for (const a of aspects) {
    const c = getCount(studentId, a.key, periodId);
    p += c[0];
    m += c[1];
  }
  return [p, m];
}

/** Beobachtungen eines Kindes, neueste zuerst. */
export function observationsOf(studentId, periodId) {
  return S.obs
    .filter((o) => o.studentId === studentId && (periodId === ALL || o.periodId === periodId))
    .sort((a, b) => b.ts - a.ts);
}

export function periodObservations(periodId) {
  return S.obs.filter((o) => periodId === ALL || o.periodId === periodId);
}

/** Legt eine Beobachtung an. Der Zustand ändert sich sofort; `done` meldet das Speichern. */
export function addObservation({ studentId, aspect, v, periodId, note }) {
  const pid = periodId || S.ui.periodId;
  if (!S.cls || !pid || pid === ALL) throw new Error('Kein Beobachtungszeitraum gewählt.');
  const o = { id: uid(), classId: S.cls.id, studentId, periodId: pid, aspect, v: v > 0 ? 1 : -1, ts: Date.now() };
  if (note) o.note = note;
  S.obs.push(o);
  bump(o, 1);
  if (aspect === HW) touchHomework();
  const done = db.put('observations', o).catch((e) => {
    // Speichern fehlgeschlagen: Änderung zurücknehmen, damit nichts Falsches angezeigt wird.
    S.obs = S.obs.filter((x) => x.id !== o.id);
    bump(o, -1);
    if (aspect === HW) touchHomework();
    throw e;
  });
  return { obs: o, done };
}

export function removeObservation(id) {
  const o = S.obs.find((x) => x.id === id);
  if (!o) return Promise.resolve();
  S.obs = S.obs.filter((x) => x.id !== id);
  bump(o, -1);
  if (o.aspect === HW) touchHomework();
  return db.del('observations', id).catch((e) => {
    S.obs.push(o);
    bump(o, 1);
    if (o.aspect === HW) touchHomework();
    throw e;
  });
}

/** Stellt eine gelöschte Beobachtung wieder her (für "Rückgängig"). */
export function restoreObservation(o) {
  if (S.obs.some((x) => x.id === o.id)) return Promise.resolve();
  S.obs.push(o);
  bump(o, 1);
  if (o.aspect === HW) touchHomework();
  return db.put('observations', o).catch((e) => {
    S.obs = S.obs.filter((x) => x.id !== o.id);
    bump(o, -1);
    if (o.aspect === HW) touchHomework();
    throw e;
  });
}

export function setObservationNote(id, note) {
  const o = S.obs.find((x) => x.id === id);
  if (!o) return Promise.resolve();
  const text = note.trim();
  if (text) o.note = text;
  else delete o.note;
  return db.put('observations', o);
}

// ---------------------------------------------------------------- Hausaufgaben (offen / nachgeholt)

const isHw = (o) => o.aspect === HW;

/** Einträge "Hausaufgabe vergessen" eines Kindes (Standard: alle Zeiträume), unsortiert. */
export function homeworkEntries(studentId, periodId = ALL) {
  return S.obs.filter((o) => isHw(o) && o.studentId === studentId && (periodId === ALL || o.periodId === periodId));
}

/** { open, done } für ein Kind. periodId kann ALL sein. */
export function homeworkStats(studentId, periodId = ALL) {
  let open = 0;
  let done = 0;
  for (const o of homeworkEntries(studentId, periodId)) {
    if (o.doneTs) done++;
    else open++;
  }
  return { open, done };
}

/** Anzahl offener Hausaufgaben in der geöffneten Klasse (alle Zeiträume). */
export function openHomeworkCount() {
  return S.obs.reduce((n, o) => n + (isHw(o) && !o.doneTs ? 1 : 0), 0);
}

/**
 * Markiert einen Eintrag als nachgeholt (done = true) oder wieder offen (done = false).
 * Der Zustand ändert sich sofort; das Ergebnis meldet das Speichern. Funktioniert auch,
 * wenn der Eintrag nicht zur geöffneten Klasse gehört (Startseite).
 */
export function setHomeworkDone(id, done = true) {
  const o = S.obs.find((x) => x.id === id);
  if (o) {
    const prev = o.doneTs;
    if (done) o.doneTs = Date.now();
    else delete o.doneTs;
    touchHomework();
    return db.put('observations', o).catch((e) => {
      if (prev) o.doneTs = prev;
      else delete o.doneTs;
      touchHomework();
      throw e;
    });
  }
  return (async () => {
    const rec = await db.get('observations', id);
    if (!rec || rec.aspect !== HW) return;
    if (done) rec.doneTs = Date.now();
    else delete rec.doneTs;
    await db.put('observations', rec);
    touchHomework();
  })();
}

/** Hakt die älteste offene Hausaufgabe eines Kindes im Zeitraum ab. Gibt { obs, done } zurück oder null. */
export function completeOldestOpen(studentId, periodId) {
  const open = homeworkEntries(studentId, periodId).filter((o) => !o.doneTs).sort((a, b) => a.ts - b.ts);
  if (!open.length) return null;
  return { obs: open[0], done: setHomeworkDone(open[0].id, true) };
}

/** Alle offenen Hausaufgaben aller Klassen, älteste zuerst (für die Startseite und die Zahl am App-Symbol). */
export async function listOpenHomework() {
  const [obs, students, classes] = await Promise.all([db.getAll('observations'), db.getAll('students'), db.getAll('classes')]);
  const stu = new Map(students.map((s) => [s.id, s]));
  const cls = new Map(classes.map((c) => [c.id, c]));
  const rows = [];
  for (const o of obs) {
    if (o.aspect !== HW || o.doneTs) continue;
    const student = stu.get(o.studentId);
    const klass = cls.get(o.classId);
    if (student && klass) rows.push({ obs: o, student, cls: klass });
  }
  return rows.sort((a, b) => a.obs.ts - b.obs.ts);
}

// ---------------------------------------------------------------- Kinder

export async function renameClass(name) {
  S.cls = { ...S.cls, name: name.trim() };
  await db.put('classes', S.cls);
}

export async function addStudents(names) {
  let order = S.students.reduce((m, s) => Math.max(m, s.order ?? 0), -1) + 1;
  const created = names.map((name) => ({ id: uid(), classId: S.cls.id, name, order: order++ }));
  await db.putMany('students', created);
  S.students = sortStudents([...S.students, ...created]);
  return created;
}

export async function renameStudent(id, name) {
  const s = getStudent(id);
  if (!s) return;
  const next = { ...s, name: name.trim() };
  await db.put('students', next);
  S.students = sortStudents(S.students.map((x) => (x.id === id ? next : x)));
}

export async function removeStudent(id) {
  await db.deleteStudent(id);
  S.students = S.students.filter((s) => s.id !== id);
  S.obs = S.obs.filter((o) => o.studentId !== id);
  rebuildCounts();
  touchHomework();
}

export async function sortStudentsAZ() {
  const sorted = [...S.students].sort((a, b) => collator.compare(a.name, b.name)).map((s, i) => ({ ...s, order: i }));
  await db.putMany('students', sorted);
  S.students = sorted;
}

// ---------------------------------------------------------------- Zeiträume

export async function savePeriod({ id, name, start, end }) {
  const existing = id ? getPeriod(id) : null;
  const per = existing
    ? { ...existing, name: name.trim(), start: start || '', end: end || '' }
    : { id: uid(), classId: S.cls.id, name: name.trim(), start: start || '', end: end || '', createdAt: Date.now() };
  await db.put('periods', per);
  S.periods = sortPeriods([...S.periods.filter((p) => p.id !== per.id), per]);
  if (!S.ui.periodId) await setPeriod(per.id);
  return per;
}

export async function removePeriod(id) {
  await db.deletePeriod(id, S.cls.id);
  S.periods = S.periods.filter((p) => p.id !== id);
  S.obs = S.obs.filter((o) => o.periodId !== id);
  rebuildCounts();
  touchHomework();
  if (S.ui.periodId === id) await setPeriod(pickDefaultPeriod(S.periods)?.id ?? null);
}

export function periodRangeText(p) {
  if (!p) return '';
  const fmt = (iso) => iso.split('-').reverse().join('.');
  if (p.start && p.end) return `${fmt(p.start)} bis ${fmt(p.end)}`;
  if (p.start) return `ab ${fmt(p.start)}`;
  if (p.end) return `bis ${fmt(p.end)}`;
  return '';
}

/** Liegt heute außerhalb des Zeitraums? */
export function isOutsidePeriod(p) {
  if (!p) return false;
  const today = todayIso();
  return (!!p.start && today < p.start) || (!!p.end && today > p.end);
}

// ---------------------------------------------------------------- Sicherung

export async function lastBackupAt() {
  return db.metaGet('lastBackupAt', 0);
}

export async function markBackup() {
  await db.metaSet('lastBackupAt', Date.now());
}

export async function buildBackup() {
  const data = await db.dumpAll();
  return {
    format: 'kopfnoten-beobachter-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
  };
}

/** Prüft eine Sicherungsdatei und gibt bereinigte Daten zurück (wirft bei Fehlern). */
export function validateBackup(raw) {
  if (!raw || raw.format !== 'kopfnoten-beobachter-backup') throw new Error('Das ist keine Sicherungsdatei dieser App.');
  if (raw.version !== 1) throw new Error('Diese Sicherung stammt von einer neueren Version der App.');
  const arr = (x) => (Array.isArray(x) ? x : []);
  const data = {
    classes: arr(raw.classes).filter((c) => c && c.id && typeof c.name === 'string'),
    students: arr(raw.students).filter((s) => s && s.id && s.classId && typeof s.name === 'string'),
    periods: arr(raw.periods).filter((p) => p && p.id && p.classId && typeof p.name === 'string'),
    observations: arr(raw.observations)
      .filter((o) => o && o.id && o.classId && o.studentId && o.periodId && ASPECT_BY_KEY[o.aspect] && (o.v === 1 || o.v === -1) && Number.isFinite(o.ts))
      .map((o) => {
        if (!('doneTs' in o) || Number.isFinite(o.doneTs)) return o;
        const { doneTs, ...rest } = o; // ungültiges Nachgeholt-Datum verwerfen, Eintrag bleibt offen
        return rest;
      }),
  };
  if (!data.classes.length) throw new Error('Die Sicherung enthält keine Klassen.');
  return data;
}

export async function restoreBackup(data) {
  await db.restoreAll(data);
  unloadClass();
  touchHomework();
}

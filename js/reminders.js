// Erinnerungen an offene Hausaufgaben.
//
// Ohne Server kann eine Web-App sich nicht zu einer festen Uhrzeit melden, wenn sie geschlossen ist.
// Möglich sind:
//  - Zahl am App-Symbol (Badging-API): wird bei jeder Änderung gesetzt und bleibt danach stehen.
//  - Benachrichtigung am Schulmorgen über "Periodic Background Sync": nur Chrome auf Android/Desktop mit
//    installierter App, und der Browser entscheidet selbst, wann geprüft wird. Nicht garantiert.
//  - Erinnerung im Kalender: eine .ics-Datei mit wiederkehrendem Termin und Alarm, ohne Namen.
// Es verlässt nichts das Gerät.

import * as db from './db.js';
import { events, listOpenHomework } from './state.js';
import { plural } from './util.js';

const KEY_BADGE = 'remind:badge';
const KEY_PUSH = 'remind:push';
const PERIODIC_TAG = 'offene-hausaufgaben';

export const support = () => ({
  badge: 'setAppBadge' in navigator,
  notify: 'Notification' in window && 'serviceWorker' in navigator,
  periodic: 'serviceWorker' in navigator && 'PeriodicSyncManager' in window,
});

export const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');

async function ensurePermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

export async function getSettings() {
  const [badge, push] = await Promise.all([db.metaGet(KEY_BADGE, false), db.metaGet(KEY_PUSH, false)]);
  return { badge: !!badge, push: !!push };
}

// ------------------------------------------------------------------ Zahl am App-Symbol

/** Setzt die Zahl am App-Symbol auf die Anzahl offener Hausaufgaben (alle Klassen) oder entfernt sie. */
export async function updateBadge() {
  if (!support().badge) return;
  try {
    const enabled = await db.metaGet(KEY_BADGE, false);
    const n = enabled ? (await listOpenHomework()).length : 0;
    if (n > 0) await navigator.setAppBadge(n);
    else if (navigator.clearAppBadge) await navigator.clearAppBadge();
  } catch {
    // Badging ist optional; Fehler (z. B. fehlende Berechtigung) sind kein Problem für die App.
  }
}

export async function setBadge(on) {
  if (on) await ensurePermission(); // iPad/iPhone verlangen für die Zahl am Symbol die Erlaubnis für Mitteilungen
  await db.metaSet(KEY_BADGE, on);
  await updateBadge();
}

// ------------------------------------------------------------------ Benachrichtigung am Morgen (Android/Chrome)

export async function setMorningPush(on) {
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
  if (on) {
    const perm = await ensurePermission();
    if (perm !== 'granted') throw new Error('Benachrichtigungen sind nicht erlaubt. Erlaube sie in den Einstellungen deines Geräts oder Browsers für diese App.');
    if (!reg || !reg.periodicSync) throw new Error('Dieses Gerät kann die App nicht im Hintergrund wecken.');
    try {
      await reg.periodicSync.register(PERIODIC_TAG, { minInterval: 12 * 3600 * 1000 });
    } catch {
      throw new Error('Der Browser erlaubt das Wecken im Hintergrund nicht. Installiere die App über das Browsermenü und versuche es erneut.');
    }
  } else if (reg && reg.periodicSync) {
    try { await reg.periodicSync.unregister(PERIODIC_TAG); } catch { /* war nicht registriert */ }
  }
  await db.metaSet(KEY_PUSH, on);
}

/** Zeigt sofort eine Benachrichtigung mit der Zahl offener Hausaufgaben (ohne Namen). */
export async function sendTestNotification() {
  const perm = await ensurePermission();
  if (perm !== 'granted') throw new Error('Benachrichtigungen sind nicht erlaubt. Erlaube sie in den Einstellungen deines Geräts oder Browsers für diese App.');
  const reg = await navigator.serviceWorker.ready;
  const n = (await listOpenHomework()).length;
  await reg.showNotification('Offene Hausaufgaben', {
    body: n ? `${plural(n, 'Hausaufgabe', 'Hausaufgaben')} noch offen.` : 'Alle Hausaufgaben sind erledigt.',
    icon: 'icons/icon-192.png',
    tag: PERIODIC_TAG,
  });
}

// ------------------------------------------------------------------ Kalender-Erinnerung (.ics)

const pad = (n) => String(n).padStart(2, '0');
const esc = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Faltet Zeilen nach RFC 5545 (höchstens 75 Byte, nie mitten in einem Zeichen). */
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * Wiederkehrender Termin Mo bis Fr mit Alarm zur Terminzeit. Enthält keine Namen.
 * time: "HH:MM" (Ortszeit des Geräts, "schwebend", die Kalender-App nutzt die eigene Zeitzone).
 */
export function buildReminderIcs({ time = '07:30', now = new Date(), url = '' } = {}) {
  const [hh, mm] = time.split(':').map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 15 * 60000);
  const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const text = 'Öffne den Kopfnoten-Beobachter und sieh nach, welche Hausaufgaben noch offen sind.';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kopfnoten-Beobachter//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:hausaufgaben-erinnerung-${stamp}@kopfnoten-beobachter`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    `SUMMARY:${esc('Offene Hausaufgaben prüfen')}`,
    `DESCRIPTION:${esc(text)}`,
    url ? `URL:${url}` : null,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Offene Hausaufgaben prüfen')}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// ------------------------------------------------------------------ Start

export function initReminders() {
  let timer = null;
  events.addEventListener('homework', () => {
    clearTimeout(timer);
    timer = setTimeout(updateBadge, 350); // kurz warten, bis das Speichern abgeschlossen ist
  });
  updateBadge();
}

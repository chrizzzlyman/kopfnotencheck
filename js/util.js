// Kleine Hilfsfunktionen: DOM-Aufbau (ohne innerHTML für Nutzerdaten), IDs, Datumsformate.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Erzeugt ein Element. Texte werden immer als Text eingefügt (kein HTML-Parsing). */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'for') el.htmlFor = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && !k.includes('-')) {
      try { el[k] = v; } catch { el.setAttribute(k, v === true ? '' : v); }
    } else el.setAttribute(k, v === true ? '' : v);
  }
  appendKids(el, kids);
  return el;
}

function appendKids(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}

export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  appendKids(el, kids);
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  const r = () => Math.random().toString(16).slice(2, 10);
  return `${Date.now().toString(16)}-${r()}-${r()}`;
}

const pad = (n) => String(n).padStart(2, '0');

/** yyyy-mm-dd (für <input type=date>) */
export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-11-22" -> "22.11.2026" */
export function deDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function deDateTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export function deShortDateTime(ts) {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}., ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Mo, 22.11.2026, 16:35 Uhr" (Wochentag, volles Datum und Uhrzeit) */
export function deLongDateTime(ts) {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}

/** "Mo, 22.11.2026" */
export function deWeekdayDate(ts) {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Kalendertage zwischen zwei Zeitpunkten (nach lokalem Datum, nicht nach 24-Stunden-Blöcken). */
export function dayDiff(ts, now = Date.now()) {
  const a = new Date(ts);
  const b = new Date(now);
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

/** "heute", "gestern", "vor 6 Tagen" */
export function ageText(ts, now = Date.now()) {
  const n = dayDiff(ts, now);
  if (n <= 0) return 'heute';
  if (n === 1) return 'gestern';
  return `vor ${n} Tagen`;
}

export function todayIso() {
  return isoDate(new Date());
}

/** Vorschlag für den ersten Beobachtungszeitraum (Halbjahr), frei änderbar. */
export function suggestPeriod(now = new Date()) {
  const m = now.getMonth(); // 0 = Januar
  const y = now.getFullYear();
  const firstHalf = m >= 7 || m === 0; // Aug–Jan
  const startYear = m >= 7 ? y : y - 1; // Schuljahr beginnt im August
  const label = `${startYear}/${String(startYear + 1).slice(2)}`;
  if (firstHalf) {
    return { name: `1. Halbjahr ${label}`, start: `${startYear}-08-01`, end: `${startYear + 1}-01-31` };
  }
  return { name: `2. Halbjahr ${label}`, start: `${startYear + 1}-02-01`, end: `${startYear + 1}-07-31` };
}

/** Zerlegt eingefügten Text in Namen: eine Zeile pro Kind, Leerzeilen und doppelte Leerzeichen entfernt. */
export function parseNames(text) {
  return String(text || '')
    .split(/\r?\n|;/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

export function plural(n, one, many) {
  return `${n.toLocaleString('de-DE')} ${n === 1 ? one : many}`;
}

/** Dateinamen-tauglich machen (Umlaute bleiben lesbar umgeschrieben). */
export function safeFilename(s) {
  return String(s)
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'Datei';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 15000);
}

/** iPhone, iPad (auch als "Mac" getarnt) */
export function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Speichert eine Datei. Auf dem iPad/iPhone über den Teilen-Dialog ("In Dateien sichern"),
 * denn Downloads aus installierten Web-Apps sind dort unzuverlässig. Sonst als normaler Download.
 * Rückgabe: 'shared' | 'downloaded' | 'cancelled' | 'needs-gesture'
 * 'needs-gesture': Der Teilen-Dialog verlangt einen frischen Tipp; der Aufrufer soll die Datei bei
 * der nächsten Berührung erneut übergeben.
 * shareType: MIME-Typ für den Teilen-Dialog (iOS akzeptiert JSON nur als text/plain).
 */
export async function saveFile(blob, filename, { shareType = '', forceDownload = false } = {}) {
  if (!forceDownload && isIOS() && typeof File === 'function' && navigator.canShare && navigator.share) {
    const file = new File([blob], filename, { type: shareType || blob.type });
    let canShare = false;
    try { canShare = navigator.canShare({ files: [file] }); } catch { canShare = false; }
    if (canShare) {
      try {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        if (e && e.name === 'NotAllowedError') return 'needs-gesture';
        // anderer Fehler: auf normalen Download zurückfallen
      }
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

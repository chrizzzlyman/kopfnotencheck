// PDF-Erzeugung im Browser (jsPDF, lokal eingebunden). Es wird nichts hochgeladen.
// Schrift: Liberation Sans (SIL OFL), damit auch Namen mit ş, ğ, ł, ć, č, ő oder kyrillischen Buchstaben stimmen.

import { S, ALL, getCount, sumCounts, getPeriod, periodRangeText, observationsOf, getStudent } from './state.js';
import { ASPECTS, ASPECT_BY_KEY, CATEGORIES, aspectsOf } from './aspects.js';
import { deDate, deDateTime, safeFilename, todayIso } from './util.js';

const C = {
  ink: [23, 33, 47],
  muted: [90, 102, 118],
  line: [196, 205, 216],
  soft: [243, 245, 248],
  plus: [23, 128, 63],
  plusTint: [214, 238, 223],
  minus: [192, 57, 43],
  minusTint: [248, 218, 214],
  mitarbeit: [47, 91, 183],
  mitarbeitTint: [225, 234, 250],
  verhalten: [160, 94, 0],
  verhaltenTint: [250, 235, 204],
};

const MINUS = '−';
const FONT = 'Liberation';
const DISCLAIMER = 'Die Zählung dokumentiert Beobachtungen und ersetzt nicht die Bewertung nach den Bewertungsmatrizen Mitarbeit und Verhalten.';

// ------------------------------------------------------------------ Laden

let libPromise = null;
let fontPromise = null;

function loadLib() {
  if (globalThis.jspdf && globalThis.jspdf.jsPDF) return Promise.resolve(globalThis.jspdf.jsPDF);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/jspdf.umd.min.js', import.meta.url).href;
      s.onload = () => (globalThis.jspdf ? resolve(globalThis.jspdf.jsPDF) : reject(new Error('PDF-Baustein unvollständig geladen.')));
      s.onerror = () => {
        libPromise = null;
        reject(new Error('PDF-Baustein konnte nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut.'));
      };
      document.head.append(s);
    });
  }
  return libPromise;
}

async function toBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Schriftdatei konnte nicht geladen werden.');
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function loadFonts() {
  if (!fontPromise) {
    fontPromise = Promise.all([
      toBase64(new URL('../fonts/LiberationSans-Regular.ttf', import.meta.url).href),
      toBase64(new URL('../fonts/LiberationSans-Bold.ttf', import.meta.url).href),
    ]).then(([regular, bold]) => ({ regular, bold }))
      .catch((e) => {
        fontPromise = null;
        throw e;
      });
  }
  return fontPromise;
}

// Nur Zeichen, die in der eingebetteten Schrift vorhanden sind (Latein, Griechisch, Kyrillisch, übliche Satzzeichen).
const UNSUPPORTED = /[^ -~ -ɏͰ-ϿЀ-ӿḀ-ỿ‐-‧‰-›←-↓−€✓]/g;
const clean = (s) => String(s ?? '').normalize('NFC').replace(/[\r\n\t]+/g, ' ').replace(UNSUPPORTED, '?');

// ------------------------------------------------------------------ Zeichenhilfen

function setFont(doc, style = 'normal', size = 10, color = C.ink) {
  doc.setFont(FONT, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

const catColor = (cat) => (cat === 'mitarbeit' ? C.mitarbeit : C.verhalten);
const catTint = (cat) => (cat === 'mitarbeit' ? C.mitarbeitTint : C.verhaltenTint);

function cellBox(doc, x, y, w, h, fill = null) {
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.15);
  if (fill) {
    doc.setFillColor(...fill);
    doc.rect(x, y, w, h, 'FD');
  } else {
    doc.rect(x, y, w, h, 'S');
  }
}

function fitText(doc, text, maxW) {
  let t = clean(text);
  if (doc.getTextWidth(t) <= maxW) return t;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function periodLabel(periodId) {
  if (periodId === ALL) return 'Alle Zeiträume';
  const p = getPeriod(periodId);
  if (!p) return '';
  const r = periodRangeText(p);
  return r ? `${p.name} (${r})` : p.name;
}

function titleBlock(doc, ctx, title, y) {
  setFont(doc, 'bold', 16);
  doc.text(clean(title), ctx.m, y + 5);
  setFont(doc, 'normal', 10, C.muted);
  doc.text(clean(`Klasse ${S.cls.name}`), ctx.m, y + 11.5);
  doc.text(clean(`Zeitraum: ${ctx.periodText}`), ctx.m, y + 16.5);
  doc.text(`Erstellt am ${deDate(todayIso())}`, ctx.m, y + 21.5);
  return y + 27;
}

// ------------------------------------------------------------------ Klassenübersicht (Querformat)

function drawOverview(doc, ctx) {
  const { m, W, H } = ctx;
  const nameW = 46;
  const totalW = 24;
  const aspW = (W - 2 * m - nameW - totalW) / ASPECTS.length;
  const groupH = 7;
  const headH = 31;
  const rowH = 6.4;
  const bottom = H - m - 8;

  const drawHead = (y0) => {
    // Kind
    cellBox(doc, m, y0, nameW, groupH + headH, C.soft);
    setFont(doc, 'bold', 9.5);
    doc.text('Kind', m + 2, y0 + groupH + headH - 2.5);
    // Gruppen
    let x = m + nameW;
    for (const cat of CATEGORIES) {
      const n = aspectsOf(cat.key).length;
      cellBox(doc, x, y0, n * aspW, groupH, catTint(cat.key));
      setFont(doc, 'bold', 9.5, catColor(cat.key));
      doc.text(cat.label, x + (n * aspW) / 2, y0 + 4.8, { align: 'center' });
      x += n * aspW;
    }
    // Schwerpunkte (um 90 Grad gedreht)
    x = m + nameW;
    for (const a of ASPECTS) {
      cellBox(doc, x, y0 + groupH, aspW, headH, C.soft);
      setFont(doc, 'normal', 8.5);
      doc.text(clean(a.label), x + aspW / 2 + 1.2, y0 + groupH + headH - 2, { angle: 90 });
      x += aspW;
    }
    // Gesamt
    cellBox(doc, x, y0, totalW, groupH + headH, C.soft);
    setFont(doc, 'bold', 9.5);
    doc.text('Gesamt', x + totalW / 2, y0 + groupH + headH - 2.5, { align: 'center' });
    return y0 + groupH + headH;
  };

  let y = titleBlock(doc, ctx, 'Beobachtungen Mitarbeit und Verhalten', m);
  y = drawHead(y);

  S.students.forEach((s, i) => {
    if (y + rowH > bottom) {
      doc.addPage();
      y = drawHead(m);
    }
    const fill = i % 2 ? C.soft : null;
    cellBox(doc, m, y, nameW, rowH, fill);
    setFont(doc, 'normal', 9.5);
    doc.text(fitText(doc, s.name, nameW - 4), m + 2, y + rowH / 2 + 1.2);
    let x = m + nameW;
    for (const a of ASPECTS) {
      cellBox(doc, x, y, aspW, rowH, fill);
      const [p, mi] = getCount(s.id, a.key, ctx.periodId);
      // + steht immer links, − rechts; eine Null bleibt leer, damit die Tabelle ruhig wirkt
      if (p > 0) {
        setFont(doc, 'bold', 9, C.plus);
        doc.text(`+${p}`, x + aspW / 2 - 0.8, y + rowH / 2 + 1.2, { align: 'right' });
      }
      if (mi > 0) {
        setFont(doc, 'bold', 9, C.minus);
        doc.text(`${MINUS}${mi}`, x + aspW / 2 + 0.8, y + rowH / 2 + 1.2, { align: 'left' });
      }
      x += aspW;
    }
    cellBox(doc, x, y, totalW, rowH, fill);
    const [tp, tm] = sumCounts(s.id, ctx.periodId);
    if (tp + tm > 0) {
      if (tp > 0) {
        setFont(doc, 'bold', 9, C.plus);
        doc.text(`+${tp}`, x + totalW / 2 - 1, y + rowH / 2 + 1.2, { align: 'right' });
      }
      if (tm > 0) {
        setFont(doc, 'bold', 9, C.minus);
        doc.text(`${MINUS}${tm}`, x + totalW / 2 + 1, y + rowH / 2 + 1.2, { align: 'left' });
      }
    } else {
      setFont(doc, 'normal', 8.5, C.muted);
      doc.text('keine', x + totalW / 2, y + rowH / 2 + 1.2, { align: 'center' });
    }
    y += rowH;
  });

  y += 5;
  if (y + 5 > H - m) {
    doc.addPage();
    y = m;
  }
  setFont(doc, 'normal', 8.5, C.muted);
  doc.text(`Grün: positive Beobachtungen. Rot: negative Beobachtungen. Leere Felder: keine Beobachtung. Insgesamt ${S.obs.filter((o) => ctx.periodId === ALL || o.periodId === ctx.periodId).length} Beobachtungen im gewählten Zeitraum.`, m, y);
}

// ------------------------------------------------------------------ Bericht pro Kind (Hochformat)

function drawChild(doc, ctx, student, includeList, isFirst) {
  const { m, W, H } = ctx;
  const cw = W - 2 * m;
  const bottom = H - m - 8;
  if (!isFirst) doc.addPage();
  let y = titleBlock(doc, ctx, `Beobachtungen: ${student.name}`, m);

  const nameW = 86;
  const numW = 20;
  const barW = cw - nameW - 2 * numW;

  for (const cat of CATEGORIES) {
    const list = aspectsOf(cat.key);
    // Kopfzeile
    cellBox(doc, m, y, cw, 7, catTint(cat.key));
    setFont(doc, 'bold', 10, catColor(cat.key));
    doc.text(cat.label, m + 2, y + 4.9);
    setFont(doc, 'bold', 8.5, C.plus);
    doc.text('positiv', m + nameW + numW / 2, y + 4.9, { align: 'center' });
    setFont(doc, 'bold', 8.5, C.minus);
    doc.text('negativ', m + nameW + numW + numW / 2, y + 4.9, { align: 'center' });
    setFont(doc, 'bold', 8.5, C.muted);
    doc.text('Anteil positiv', m + nameW + 2 * numW + 3, y + 4.9);
    y += 7;

    for (const a of list) {
      setFont(doc, 'normal', 9.5);
      const lines = doc.splitTextToSize(clean(a.full), nameW - 4);
      const rh = Math.max(7, lines.length * 4.2 + 3);
      const [p, mi] = getCount(student.id, a.key, ctx.periodId);
      cellBox(doc, m, y, nameW, rh);
      cellBox(doc, m + nameW, y, numW, rh);
      cellBox(doc, m + nameW + numW, y, numW, rh);
      cellBox(doc, m + nameW + 2 * numW, y, barW, rh);
      setFont(doc, 'normal', 9.5);
      doc.text(lines, m + 2, y + (rh - lines.length * 4.2) / 2 + 3.2);
      setFont(doc, 'bold', 10, p ? C.plus : C.line);
      doc.text(String(p), m + nameW + numW / 2, y + rh / 2 + 1.3, { align: 'center' });
      setFont(doc, 'bold', 10, mi ? C.minus : C.line);
      doc.text(String(mi), m + nameW + numW + numW / 2, y + rh / 2 + 1.3, { align: 'center' });
      const bx = m + nameW + 2 * numW + 3;
      const bw = barW - 6;
      if (p + mi > 0) {
        doc.setFillColor(...C.minus);
        doc.rect(bx, y + rh / 2 - 1.6, bw, 3.2, 'F');
        doc.setFillColor(...C.plus);
        doc.rect(bx, y + rh / 2 - 1.6, (bw * p) / (p + mi), 3.2, 'F');
      } else {
        setFont(doc, 'normal', 8.5, C.muted);
        doc.text('keine Beobachtung', bx, y + rh / 2 + 1.2);
      }
      y += rh;
    }
    const [tp, tm] = sumCounts(student.id, ctx.periodId, list);
    cellBox(doc, m, y, nameW, 7, C.soft);
    cellBox(doc, m + nameW, y, numW, 7, C.soft);
    cellBox(doc, m + nameW + numW, y, numW, 7, C.soft);
    cellBox(doc, m + nameW + 2 * numW, y, barW, 7, C.soft);
    setFont(doc, 'bold', 9.5);
    doc.text(`Gesamt ${cat.label}`, m + 2, y + 4.9);
    setFont(doc, 'bold', 10, C.plus);
    doc.text(String(tp), m + nameW + numW / 2, y + 4.9, { align: 'center' });
    setFont(doc, 'bold', 10, C.minus);
    doc.text(String(tm), m + nameW + numW + numW / 2, y + 4.9, { align: 'center' });
    y += 12;
  }

  if (!includeList) return;

  // Einzelne Beobachtungen
  const dateW = 36;
  const aspW = 46;
  const signW = 14;
  const noteW = cw - dateW - aspW - signW;
  const obs = observationsOf(student.id, ctx.periodId).sort((a, b) => a.ts - b.ts);

  const listHead = (y0) => {
    cellBox(doc, m, y0, cw, 6.5, C.soft);
    setFont(doc, 'bold', 9);
    doc.text('Datum und Uhrzeit', m + 2, y0 + 4.5);
    doc.text('Schwerpunkt', m + dateW + 2, y0 + 4.5);
    doc.text('Wert', m + dateW + aspW + signW / 2, y0 + 4.5, { align: 'center' });
    doc.text('Notiz', m + dateW + aspW + signW + 2, y0 + 4.5);
    return y0 + 6.5;
  };

  if (y + 22 > bottom) {
    doc.addPage();
    y = m;
  }
  setFont(doc, 'bold', 12);
  doc.text('Einzelne Beobachtungen', m, y + 4);
  y += 7;
  if (!obs.length) {
    setFont(doc, 'normal', 10, C.muted);
    doc.text('Keine Beobachtungen in diesem Zeitraum.', m, y + 4);
    return;
  }
  y = listHead(y);
  for (const o of obs) {
    const a = ASPECT_BY_KEY[o.aspect];
    const when = deDateTime(o.ts);
    setFont(doc, 'normal', 9);
    const aLines = doc.splitTextToSize(clean(a ? a.label : o.aspect), aspW - 4);
    const nLines = o.note ? doc.splitTextToSize(clean(o.note), noteW - 4) : [''];
    const lines = Math.max(aLines.length, nLines.length);
    const rh = Math.max(6.2, lines * 4 + 2.4);
    if (y + rh > bottom) {
      doc.addPage();
      y = listHead(m);
    }
    cellBox(doc, m, y, dateW, rh);
    cellBox(doc, m + dateW, y, aspW, rh);
    cellBox(doc, m + dateW + aspW, y, signW, rh);
    cellBox(doc, m + dateW + aspW + signW, y, noteW, rh);
    setFont(doc, 'normal', 9);
    doc.text(when, m + 2, y + 4.3);
    doc.text(aLines, m + dateW + 2, y + 4.3);
    setFont(doc, 'bold', 11, o.v > 0 ? C.plus : C.minus);
    doc.text(o.v > 0 ? '+' : MINUS, m + dateW + aspW + signW / 2, y + 4.5, { align: 'center' });
    setFont(doc, 'normal', 9);
    doc.text(nLines, m + dateW + aspW + signW + 2, y + 4.3);
    y += rh;
  }
}

// ------------------------------------------------------------------ Fußzeilen

function drawFooters(doc, ctx) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const y = ctx.H - ctx.m + 3;
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.15);
    doc.line(ctx.m, y - 3.5, ctx.W - ctx.m, y - 3.5);
    setFont(doc, 'normal', 7.5, C.muted);
    doc.text(DISCLAIMER, ctx.m, y);
    doc.text(`Seite ${i} von ${total}`, ctx.W - ctx.m, y, { align: 'right' });
  }
}

// ------------------------------------------------------------------ Einstieg

/**
 * kind: 'overview' | 'child' | 'all'
 * Liefert { blob, filename }.
 */
export async function createPdf({ kind, studentId, periodId, includeList = true }) {
  const [JsPDF, fonts] = await Promise.all([loadLib(), loadFonts()]);
  const landscape = kind === 'overview';
  const doc = new JsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('LiberationSans-Regular.ttf', fonts.regular);
  doc.addFont('LiberationSans-Regular.ttf', FONT, 'normal');
  doc.addFileToVFS('LiberationSans-Bold.ttf', fonts.bold);
  doc.addFont('LiberationSans-Bold.ttf', FONT, 'bold');
  doc.setProperties({ title: `Kopfnoten-Beobachtungen ${S.cls.name}`, subject: 'Beobachtungen Mitarbeit und Verhalten', creator: 'Kopfnoten-Beobachter' });

  const ctx = {
    m: landscape ? 12 : 18,
    W: doc.internal.pageSize.getWidth(),
    H: doc.internal.pageSize.getHeight(),
    periodId,
    periodText: periodLabel(periodId),
  };

  let suffix;
  if (kind === 'overview') {
    drawOverview(doc, ctx);
    suffix = 'Klassenuebersicht';
  } else if (kind === 'child') {
    const s = getStudent(studentId);
    if (!s) throw new Error('Das Kind wurde nicht gefunden.');
    drawChild(doc, ctx, s, includeList, true);
    suffix = s.name;
  } else {
    S.students.forEach((s, i) => drawChild(doc, ctx, s, includeList, i === 0));
    suffix = 'Alle-Kinder';
  }
  drawFooters(doc, ctx);

  const per = periodId === ALL ? 'alle-Zeitraeume' : getPeriod(periodId)?.name || 'Zeitraum';
  const filename = `${['Kopfnoten', S.cls.name, per, suffix].map(safeFilename).join('_')}.pdf`;
  return { blob: doc.output('blob'), filename };
}

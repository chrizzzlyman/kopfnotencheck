// Dialog "Erinnerungen": was auf diesem Gerät möglich ist und wie man es einschaltet.

import { h, saveFile, isIOS } from '../util.js';
import { openSheet, toast, icon, errorText } from '../ui.js';
import {
  support, permission, getSettings, setBadge, setMorningPush, sendTestNotification, updateBadge, buildReminderIcs,
} from '../reminders.js';

export async function openRemindersSheet() {
  const sh = openSheet({ title: 'Erinnerungen' });
  const sup = support();
  const settings = await getSettings();
  const err = h('div');

  const permText = () => {
    const p = permission();
    if (p === 'granted') return 'Mitteilungen sind erlaubt.';
    if (p === 'denied') return 'Mitteilungen sind für diese App gesperrt. Das lässt sich nur in den Einstellungen des Geräts oder Browsers ändern.';
    if (p === 'unsupported') return 'Dieses Gerät oder dieser Browser unterstützt keine Mitteilungen.';
    return 'Beim Einschalten fragt das Gerät nach der Erlaubnis für Mitteilungen.';
  };
  const permLine = h('p', { class: 'hint' }, permText());

  const row = (id, label, sub, checked, disabled, onToggle) => {
    const box = h('input', { type: 'checkbox', id, checked, disabled });
    box.addEventListener('change', async () => {
      err.replaceChildren();
      box.disabled = true;
      try {
        await onToggle(box.checked);
      } catch (e) {
        box.checked = !box.checked;
        err.append(errorText(e.message));
      }
      box.disabled = false;
      permLine.textContent = permText();
    });
    return h('div', { class: `switch-row${disabled ? ' disabled' : ''}` },
      h('label', { class: 'check-row', for: id }, box, h('span', { class: 'switch-text' }, h('strong', {}, label), h('span', { class: 'hint' }, sub))));
  };

  const badgeSub = sup.badge
    ? 'Die Zahl der offenen Hausaufgaben steht am App-Symbol. Sie wird aktualisiert, sobald du etwas änderst, und bleibt auch nach dem Schließen stehen.'
    : isIOS()
      ? 'Dafür muss die App auf dem Home-Bildschirm liegen (iOS 16.4 oder neuer): Teilen, dann „Zum Home-Bildschirm“.'
      : 'Auf diesem Gerät oder in diesem Browser nicht verfügbar.';
  const pushSub = sup.periodic
    ? 'Am Schulmorgen eine Mitteilung mit der Anzahl offener Hausaufgaben, ohne Namen. Der Browser entscheidet, wann er die App kurz weckt. Deshalb ist das nicht garantiert. Funktioniert nur bei installierter App.'
    : 'Nur mit Chrome auf Android oder am Computer bei installierter App möglich. Auf iPad und iPhone gibt es das nicht.';

  const time = h('input', { type: 'time', value: '07:30', id: 'rem-time', 'aria-label': 'Uhrzeit der Erinnerung' });
  const icsBtn = h('button', {
    class: 'btn block',
    type: 'button',
    onclick: async () => {
      err.replaceChildren();
      try {
        const url = location.href.split('#')[0];
        const ics = buildReminderIcs({ time: time.value || '07:30', url });
        const blob = new Blob([ics], { type: 'text/calendar' });
        let status = await saveFile(blob, 'Erinnerung-Hausaufgaben.ics', { shareType: 'text/calendar' });
        if (status === 'needs-gesture') status = await saveFile(blob, 'Erinnerung-Hausaufgaben.ics', { forceDownload: true });
        if (status === 'cancelled') return;
        toast('Kalenderdatei gespeichert. Öffne sie, um den Termin zu übernehmen.', { duration: 6000 });
      } catch (e) {
        err.append(errorText(`Konnte die Datei nicht erstellen: ${e.message}`));
      }
    },
  }, icon('download', 18), 'Kalender-Erinnerung laden');

  const testBtn = h('button', {
    class: 'btn block',
    type: 'button',
    onclick: async () => {
      err.replaceChildren();
      try {
        await sendTestNotification();
        permLine.textContent = permText();
      } catch (e) {
        err.append(errorText(e.message));
        permLine.textContent = permText();
      }
    },
  }, icon('bell', 18), 'Testmitteilung senden');

  sh.body.append(...[
    h('p', { class: 'dialog-text' }, 'Offene Hausaufgaben stehen immer oben auf der Startseite. Zusätzlich kannst du dich erinnern lassen:'),
    h('div', { class: 'stack' },
      h('h3', { class: 'sub-title' }, 'Im Kalender'),
      h('p', { class: 'hint' }, 'Das ist die zuverlässigste Art. Die Kalender-App deines Geräts meldet sich Montag bis Freitag zur gewählten Uhrzeit mit „Offene Hausaufgaben prüfen“ und einem Link zur App. Der Termin enthält keine Namen.'),
      h('div', { class: 'field' }, h('label', { for: 'rem-time' }, 'Uhrzeit'), time),
      icsBtn),
    h('hr', { class: 'rule' }),
    h('div', { class: 'stack' },
      h('h3', { class: 'sub-title' }, 'In der App'),
      row('rem-badge', 'Zahl am App-Symbol', badgeSub, settings.badge, !sup.badge, async (on) => { await setBadge(on); }),
      row('rem-push', 'Mitteilung am Schulmorgen', pushSub, settings.push, !sup.periodic, async (on) => { await setMorningPush(on); await updateBadge(); }),
      permLine,
      sup.notify ? testBtn : null),
    err,
    h('p', { class: 'hint' }, 'Alle Erinnerungen entstehen auf deinem Gerät. Es wird kein Server genutzt und es werden keine Namen übertragen.'),
  ].filter(Boolean));
  sh.setActions(h('button', { class: 'btn primary', type: 'button', onclick: () => sh.close() }, 'Fertig'));
  return sh;
}

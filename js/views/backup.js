// Sicherung, Wiederherstellung und Datenschutzhinweis.

import { h, saveFile, deDateTime, isoDate, plural } from '../util.js';
import { buildBackup, markBackup, lastBackupAt, validateBackup, restoreBackup } from '../state.js';
import { openSheet, confirmDialog, toast, icon, errorText } from '../ui.js';

/** Erstellt die Sicherungsdatei. Gibt den Status von saveFile zurück ('cancelled' = nichts gespeichert). */
export async function downloadBackup() {
  const data = await buildBackup();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const name = `Kopfnoten-Sicherung_${isoDate(new Date())}.json`;
  let status = await saveFile(blob, name, { shareType: 'text/plain' });
  if (status === 'needs-gesture') status = await saveFile(blob, name, { forceDownload: true });
  if (status !== 'cancelled') await markBackup();
  return status;
}

export async function openBackupSheet({ onChanged = () => {} } = {}) {
  const sh = openSheet({ title: 'Sichern und wiederherstellen' });
  const last = await lastBackupAt();
  const status = h('p', { class: `backup-status${last ? '' : ' warn'}` }, last ? `Letzte Sicherung: ${deDateTime(last)}` : 'Noch keine Sicherung erstellt.');
  const err = h('div');
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });

  file.addEventListener('change', async () => {
    err.replaceChildren();
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    try {
      const data = validateBackup(JSON.parse(await f.text()));
      const ok = await confirmDialog({
        title: 'Sicherung wiederherstellen?',
        message: [
          `Die Datei enthält ${plural(data.classes.length, 'Klasse', 'Klassen')}, ${plural(data.students.length, 'Kind', 'Kinder')} und ${plural(data.observations.length, 'Beobachtung', 'Beobachtungen')}.`,
          'Vorhandene Daten bleiben erhalten. Einträge, die in beiden vorkommen, werden mit der Sicherung abgeglichen.',
        ],
        confirmLabel: 'Wiederherstellen',
      });
      if (!ok) return;
      await restoreBackup(data);
      toast('Sicherung wiederhergestellt.');
      sh.close();
      onChanged();
    } catch (e) {
      err.append(errorText(e instanceof SyntaxError ? 'Die Datei ist keine gültige Sicherung.' : e.message));
    }
  });

  sh.body.append(
    h('p', { class: 'dialog-text' }, 'Alle Daten liegen nur auf diesem Gerät. Mit einer Sicherung kannst du sie auf ein anderes Gerät übertragen oder nach einem Verlust zurückholen.'),
    status,
    h('div', { class: 'stack' },
      h('button', {
        class: 'btn primary block',
        type: 'button',
        onclick: async () => {
          err.replaceChildren();
          try {
            const status = await downloadBackup();
            if (status === 'cancelled') return;
            toast(status === 'shared' ? 'Sicherung gespeichert.' : 'Sicherung heruntergeladen.');
            sh.close();
            onChanged();
          } catch (e) {
            err.append(errorText(`Sicherung fehlgeschlagen: ${e.message}`));
          }
        },
      }, icon('download', 18), 'Sicherung herunterladen'),
      h('button', { class: 'btn block', type: 'button', onclick: () => file.click() }, icon('upload', 18), 'Sicherung wiederherstellen'),
    ),
    file,
    err,
    h('p', { class: 'hint' }, 'Die Sicherungsdatei enthält die Namen der Kinder. Bewahre sie nur an einem geschützten Ort auf und lade sie nie in ein öffentliches Verzeichnis hoch, auch nicht in ein GitHub-Repository.'),
  );
  return sh;
}

export function openPrivacySheet() {
  const sh = openSheet({ title: 'Datenschutz' });
  sh.body.append(
    h('p', { class: 'dialog-text' }, 'Namen und Beobachtungen werden ausschließlich im Speicher dieses Geräts abgelegt. Die App sendet nichts an einen Server und nutzt weder Tracking noch Cookies.'),
    h('p', { class: 'dialog-text' }, 'Auf GitHub liegt nur der Programmcode, keine Daten von Kindern.'),
    h('p', { class: 'dialog-text' }, 'Namen von Schülerinnen und Schülern sind personenbezogene Daten. Klär mit deiner Schulleitung oder dem Datenschutzbeauftragten, ob du sie auf diesem Gerät speichern darfst. Vornamen oder Kürzel genügen für die App.'),
    h('p', { class: 'dialog-text' }, 'Wenn du den Browserspeicher löschst oder das Gerät zurücksetzt, sind die Daten weg. Erstelle deshalb regelmäßig eine Sicherung.'),
  );
  sh.setActions(h('button', { class: 'btn primary', type: 'button', onclick: () => sh.close() }, 'Verstanden'));
  return sh;
}

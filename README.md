# Kopfnoten-Beobachter

Eine kleine Web-App für Lehrkräfte: Beobachtungen zu **Mitarbeit** und **Verhalten** im Unterricht mit einem Tipp festhalten und später als PDF dokumentieren. Die 13 Schwerpunkte stammen aus den Bewertungsmatrizen *Mitarbeit* und *Verhalten* (Stand 05.08.2025). Zusätzlich gibt es einen Zähler für **vergessene Hausaufgaben**.

Die App läuft komplett im Browser, lässt sich auf iPad, iPhone und Android als App installieren und funktioniert danach auch ohne Internet. **Alle Daten bleiben auf dem Gerät.** Es gibt keinen Server, kein Konto und kein Tracking.

## So funktioniert die Bedienung

1. **Klasse anlegen:** Name, Namen der Kinder (eine Zeile pro Kind, auch aus einer Tabelle einfügbar) und ein erster Beobachtungszeitraum (z. B. Halbjahr).
2. **Im Unterricht (Fokus-Modus):** Oben wählst du den Schwerpunkt, zum Beispiel *Beteiligung*. Unter dem Schwerpunkt steht, was ein **+** und was ein **−** bedeutet. Bei jedem Kind tippst du dann einfach auf **+** oder **−**. Jeder Tipp zeichnet einen Strich in die Strichliste über dem Button. So siehst du auf einen Blick, wen du noch nicht beobachtet hast.
3. **Vertippt?** Direkt nach dem Tipp erscheint unten „Rückgängig“.
4. **Hausaufgaben:** Der dritte Tab *Hausaufgaben* hat bei jedem Kind zwei Buttons: **Vergessen** (rot) und **✓** (grün, nachgeholt). Ein Tipp auf *Vergessen* merkt sich Tag und Uhrzeit und legt die Hausaufgabe als **offen** an. Ein Tipp auf ✓ hakt die **älteste offene** Hausaufgabe des Kindes ab. Links steht die Strichliste der nachgeholten (grün), rechts die der offenen (rot). Am Tab zeigt eine Zahl, wie viele Hausaufgaben in der Klasse noch offen sind. Im Kind-Detail steht jeder Eintrag mit Wochentag, Datum und Uhrzeit sowie dem Datum des Nachholens. Dort kannst du einzelne Einträge als nachgeholt markieren, wieder öffnen, mit Notiz versehen oder löschen. Der Zähler steht in Auswertung und PDF in einer eigenen Spalte (mit „davon offen“) und fließt **nicht** in „Gesamt“ ein, damit die Zählung der Matrix-Schwerpunkte sauber bleibt.
5. **Offene Hausaufgaben auf der Startseite:** Alle offenen Hausaufgaben aller Klassen stehen oben auf der Startseite, die älteste zuerst, mit genauem Datum. Ein Tipp auf **Nachgeholt** hakt sie ab (mit „Rückgängig“). Nach einer Woche färbt sich die Angabe gelb.
6. **Erinnerungen** (Glocke oben auf der Startseite): siehe unten.
7. **Sonderfälle:** Tipp auf den Namen öffnet alle 13 Schwerpunkte des Kindes mit + und − sowie den Hausaufgaben-Zähler, den Verlauf aller Beobachtungen und die Möglichkeit, Notizen anzufügen oder Einträge zu löschen.
8. **Auswertung:** Tabelle aller Kinder und Schwerpunkte mit Zählern und einem kleinen Tendenz-Balken. Mit „Wenigste zuerst“ findest du die Kinder, die du länger nicht beobachtet hast. Die App schlägt **keine Note** vor. Die Bewertung bleibt deine Entscheidung nach der Bewertungsmatrix.
9. **PDF:** Klassenübersicht (Querformat), Bericht für ein Kind (z. B. für Elterngespräche) oder Berichte für alle Kinder in einer Datei.
10. **Mehrere Klassen und Zeiträume:** Beliebig viele Klassen auf einem Gerät. Pro Klasse beliebig viele Beobachtungszeiträume. Neue Beobachtungen gehören immer zum gewählten Zeitraum, der oben als Pille angezeigt wird. Liegt der heutige Tag außerhalb des gewählten Zeitraums, färbt sich die Pille gelb.

## Erinnerungen an offene Hausaufgaben

Die App arbeitet ohne Server. Deshalb kann sie dich **nicht zu einer festen Uhrzeit benachrichtigen, wenn sie geschlossen ist**. Das geht nur mit einem Server, der Mitteilungen verschickt, und der müsste Namen oder zumindest Daten übertragen. Stattdessen gibt es Möglichkeiten, die lokal bleiben:

- **Startseite:** Offene Hausaufgaben stehen immer oben. Das funktioniert überall.
- **Kalender-Erinnerung (empfohlen):** Im Dialog *Erinnerungen* lädst du eine Kalenderdatei (.ics) mit einem Termin Montag bis Freitag zur gewählten Uhrzeit. Den Alarm schickt die Kalender-App deines Geräts, also zuverlässig und auch bei geschlossener App. Der Termin enthält einen Link zur App und keine Namen.
- **Zahl am App-Symbol:** Die Anzahl offener Hausaufgaben erscheint am Symbol der installierten App und wird bei jeder Änderung aktualisiert. Auf iPad und iPhone (iOS 16.4 oder neuer) muss die App dafür auf dem Home-Bildschirm liegen und die Mitteilungen erlauben. Auf Android erscheint meist nur ein Punkt statt der Zahl.
- **Mitteilung am Schulmorgen:** Nur mit Chrome auf Android oder am Computer bei installierter App. Der Browser weckt die App von Zeit zu Zeit selbst, und nur dann kann sie prüfen und eine Mitteilung mit der Anzahl (ohne Namen) zeigen. Wann das passiert, bestimmt der Browser. Verlass dich nicht allein darauf. Auf iPad und iPhone gibt es diese Möglichkeit nicht.
- **Testmitteilung:** Im Dialog kannst du prüfen, ob dein Gerät Mitteilungen dieser App anzeigt.

## Auf GitHub veröffentlichen (GitHub Pages)

1. Auf github.com ein neues Repository anlegen (z. B. `kopfnoten-beobachter`). Der Code enthält keine Daten von Kindern, das Repository darf deshalb öffentlich sein. Mit einem kostenlosen Konto funktioniert GitHub Pages nur bei öffentlichen Repositories.
2. Den **Inhalt** dieses Ordners hochladen, sodass `index.html` direkt im Hauptverzeichnis des Repositories liegt (über „Add file → Upload files“ oder mit `git`).
3. Im Repository: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“**, Branch `main`, Ordner `/ (root)`, speichern.
4. Nach ein bis zwei Minuten ist die App unter `https://DEIN-NAME.github.io/kopfnoten-beobachter/` erreichbar.

### Als App installieren

- **iPad und iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü → „App installieren“ oder „Zum Startbildschirm hinzufügen“.
- **Laptop (Chrome oder Edge):** Installationssymbol in der Adressleiste.

Einmal geöffnet, steht die App auch ohne Internet zur Verfügung. Updates holt sie sich selbst, sobald eine Verbindung besteht.

## Datenschutz und Sicherung

- Namen und Beobachtungen liegen im Browserspeicher (IndexedDB) dieses Geräts. Es verlässt nichts das Gerät, außer Dateien, die du selbst exportierst.
- **Namen von Kindern sind personenbezogene Daten.** Kläre mit der Schulleitung oder dem Datenschutzbeauftragten, ob die Nutzung auf deinem Gerät erlaubt ist. Vornamen oder Kürzel genügen für die App.
- **Sichere regelmäßig** (Startseite → „Sichern und wiederherstellen“). Löschst du die Browserdaten oder setzt das Gerät zurück, sind die Daten sonst weg. Die Startseite erinnert dich nach zwei Wochen ohne Sicherung. Die Sicherung ist eine JSON-Datei, mit der du auch auf ein neues Gerät wechseln kannst.
- **Lade Sicherungsdateien und PDFs nie ins GitHub-Repository hoch.** Die mitgelieferte `.gitignore` schützt vor versehentlichem Hochladen der Standard-Dateinamen.
- Safari kann Daten von Webseiten löschen, die lange nicht besucht wurden. Als Home-Bildschirm-App installierte Seiten sind davon ausgenommen. Installiere die App deshalb auf dem iPad und sichere trotzdem.

## Lokal ausprobieren

Im Ordner der App einen kleinen Webserver starten (Service Worker und Module brauchen `http://`, nicht `file://`):

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Aufbau

```
index.html            Einstieg
manifest.webmanifest  Installation als App
sw.js                 Offline-Betrieb (Service Worker)
css/style.css         Gestaltung (hell und dunkel)
js/aspects.js         Die 13 Schwerpunkte mit Hinweisen zu + und − und der Hausaufgaben-Zähler
js/db.js              Lokaler Speicher (IndexedDB)
js/state.js           Zustand und alle Änderungen (inkl. Hausaufgaben offen/nachgeholt)
js/reminders.js       Erinnerungen: Zahl am App-Symbol, Mitteilungen, Kalenderdatei
js/pdf.js             PDF-Erzeugung
js/views/             Startseite (mit Übersicht offener Hausaufgaben), Unterricht, Kind-Detail, Auswertung, Verwalten, Export, Sicherung, Erinnerungen
vendor/               jsPDF (MIT)
fonts/                Atkinson Hyperlegible (App) und Liberation Sans (PDF), beide SIL OFL
licenses/             Lizenztexte der enthaltenen Bausteine
```

### Anpassungen

- **Schwerpunkte und Hinweistexte** ändern: `js/aspects.js`.
- **Neue Datei zur App hinzufügen:** Pfad in der Liste `ASSETS` in `sw.js` ergänzen und `CACHE` hochzählen, damit sie auch offline verfügbar ist.
- Die Hinweistexte zu + und − sind Kurzfassungen der Kriterien aus den Bewertungsmatrizen, keine Zitate.

## Hinweise zur Prüfung

Getestet wurde in Chrome am Desktop sowie mit Tablet- und Handy-Emulation (Layout, Bedienung, PDF-Export, Sicherung, Offline-Betrieb, Hausaufgaben mit Nachholen, Startseiten-Übersicht, Mitteilungen, Kalenderdatei). Die Zahl am App-Symbol und die Mitteilung am Schulmorgen konnten nur teilweise geprüft werden, weil dafür eine installierte App auf einem echten Gerät nötig ist. Ob dein Gerät sie unterstützt, zeigt der Dialog *Erinnerungen*. Auf echten iPads, iPhones und Android-Geräten sollte vor dem ersten Einsatz einmal der komplette Ablauf ausprobiert werden, besonders das Speichern von PDF und Sicherung. Auf iPhone und iPad öffnet sich dafür der Teilen-Dialog („In Dateien sichern“).

PDF-Schrift: Latein, Griechisch und Kyrillisch werden vollständig dargestellt (z. B. ş, ğ, ł, ć, č, ő). Namen in arabischer, chinesischer oder anderer Schrift erscheinen im PDF als Fragezeichen, in der App selbst werden sie korrekt angezeigt.

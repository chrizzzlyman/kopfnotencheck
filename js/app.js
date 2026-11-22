// Start der App: Routing über die Adresse (#/, #/c/<id>, #/c/<id>/auswertung, #/c/<id>/verwalten).

import { h, clear } from './util.js';
import { S, loadClass, unloadClass } from './state.js';
import { open as openDb } from './db.js';
import { closeAllOverlays, clearToast, toast } from './ui.js';
import { renderHome } from './views/home.js';
import { renderLive } from './views/live.js';
import { renderEvaluate } from './views/evaluate.js';
import { renderManage } from './views/manage.js';

const app = document.getElementById('app');
const APP_NAME = 'Kopfnoten-Beobachter';
let token = 0;

function showFatal(err) {
  console.error(err);
  clear(app);
  app.append(
    h('main', { class: 'page' },
      h('section', { class: 'empty' },
        h('h2', {}, 'Die App konnte nicht starten'),
        h('p', {}, err && err.message ? err.message : 'Unbekannter Fehler.'),
        h('p', {}, 'Im privaten Modus mancher Browser ist der lokale Speicher gesperrt. Öffne die App in einem normalen Browserfenster.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, 'Neu laden'))),
  );
}

async function route() {
  const my = ++token;
  closeAllOverlays();
  clearToast();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    if (parts[0] === 'c' && parts[1]) {
      const ok = await loadClass(parts[1]);
      if (my !== token) return;
      if (!ok) {
        location.replace('#/');
        return;
      }
      const sub = parts[2];
      if (sub === 'auswertung') renderEvaluate(app);
      else if (sub === 'verwalten') renderManage(app);
      else renderLive(app);
      document.title = `${S.cls.name} – ${APP_NAME}`;
    } else {
      unloadClass();
      await renderHome(app, () => my === token);
      if (my !== token) return;
      document.title = APP_NAME;
    }
    window.scrollTo(0, 0);
  } catch (e) {
    if (my === token) showFatal(e);
  }
}

async function boot() {
  try {
    await openDb();
  } catch (e) {
    showFatal(e);
    return;
  }
  window.addEventListener('hashchange', route);
  await route();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker nicht registriert:', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // erste Installation: nichts melden
    toast('Eine neue Version der App ist bereit.', { action: 'Neu laden', onAction: () => location.reload(), duration: 15000 });
  });
}

boot();

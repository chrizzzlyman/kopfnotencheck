// Die 13 Schwerpunkte aus den Bewertungsmatrizen "Mitarbeit" und "Verhalten" (Stand 05.08.2025).
// label  = kurzer Name für Buttons und Tabellen
// full   = Bezeichnung wie in der Bewertungsmatrix
// pos/neg = kurze Alltagshinweise, was ein + bzw. − bedeutet (abgeleitet aus der Matrix)

export const CATEGORIES = [
  { key: 'mitarbeit', label: 'Mitarbeit' },
  { key: 'verhalten', label: 'Verhalten' },
];

export const ASPECTS = [
  // ---- Mitarbeit ----
  {
    key: 'beteiligung', cat: 'mitarbeit',
    label: 'Beteiligung', full: 'Beteiligung am Unterricht',
    pos: 'meldet sich, bringt Ideen ein',
    neg: 'beteiligt sich nicht, braucht Aufforderung',
  },
  {
    key: 'selbstaendig', cat: 'mitarbeit',
    label: 'Selbständig', full: 'Selbständiges Arbeiten',
    pos: 'arbeitet eigenständig und strukturiert',
    neg: 'braucht viel Unterstützung',
  },
  {
    key: 'team', cat: 'mitarbeit',
    label: 'Teamarbeit', full: 'Teamfähigkeit',
    pos: 'trägt fair zur Gruppenarbeit bei',
    neg: 'kooperiert kaum, stört die Gruppe',
  },
  {
    key: 'lernbereitschaft', cat: 'mitarbeit',
    label: 'Lernbereitschaft', full: 'Lernbereitschaft',
    pos: 'strengt sich an, hält durch',
    neg: 'gibt schnell auf, wenig Anstrengung',
  },
  {
    key: 'zielstrebigkeit', cat: 'mitarbeit',
    label: 'Zielstrebigkeit', full: 'Zielstrebigkeit',
    pos: 'bleibt konzentriert, setzt sich Ziele',
    neg: 'unkonzentriert, lässt sich ablenken',
  },
  {
    key: 'aufgaben', cat: 'mitarbeit',
    label: 'Aufgaben', full: 'Aufgabenerfüllung',
    pos: 'erledigt Aufgaben vollständig',
    neg: 'Aufgaben bleiben unvollständig',
  },
  // ---- Verhalten ----
  {
    key: 'regeln', cat: 'verhalten',
    label: 'Regeln', full: 'Einhaltung von Regeln',
    pos: 'hält Regeln ein, ermuntert andere',
    neg: 'verstößt gegen Regeln',
  },
  {
    key: 'sozial', cat: 'verhalten',
    label: 'Sozialer Umgang', full: 'Sozialer Umgang mit Mitgliedern der Schulgemeinschaft',
    pos: 'fair, respektvoll, höflich',
    neg: 'unhöflich, unkollegial, aggressiv',
  },
  {
    key: 'reflexion', cat: 'verhalten',
    label: 'Reflexion', full: 'Reflexion und Kritikfähigkeit',
    pos: 'reflektiert, nimmt Kritik an',
    neg: 'nimmt Kritik als Angriff wahr',
  },
  {
    key: 'hilfsbereit', cat: 'verhalten',
    label: 'Hilfsbereitschaft', full: 'Hilfsbereitschaft',
    pos: 'bietet Hilfe an, nimmt andere wahr',
    neg: 'hilft nicht, wenig Einfühlung',
  },
  {
    key: 'sorgfalt', cat: 'verhalten',
    label: 'Sorgfalt', full: 'Sorgfalt',
    pos: 'Platz ordentlich, Material vollständig',
    neg: 'Platz unordentlich, Material fehlt',
  },
  {
    key: 'puenktlich', cat: 'verhalten',
    label: 'Pünktlichkeit', full: 'Pünktlichkeit',
    pos: 'rechtzeitig da, Fristen eingehalten',
    neg: 'kommt zu spät, Frist verpasst',
  },
  {
    key: 'zuverlaessig', cat: 'verhalten',
    label: 'Zuverlässigkeit', full: 'Zuverlässigkeit',
    pos: 'hält Absprachen ein',
    neg: 'missachtet Absprachen',
  },
];

export const ASPECT_BY_KEY = Object.fromEntries(ASPECTS.map((a) => [a.key, a]));
export const aspectsOf = (cat) => ASPECTS.filter((a) => a.cat === cat);
export const DEFAULT_FOCUS = { mitarbeit: 'beteiligung', verhalten: 'regeln' };

#!/usr/bin/env node
/**
 * Test integracyjny warstwy arkusza: budowa szkieletu, wpisanie modułu,
 * narastanie kolejnych semestrów, konflikt wartości, stabilność wierszy
 * "wpisywanych" i blok UWAGI. Używa pamięciowej namiastki SpreadsheetApp.
 *
 *   node tests/integration.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Spreadsheet } = require('./sheets-mock');

const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({
  console,
  Logger: { log: () => {} },
  SpreadsheetApp: { getUi() { throw new Error('brak UI'); } },
  Utilities: { formatDate: () => '2026-02-01 10:00' },
});
for (const f of ['Config.gs', 'FormLayout.gs', 'CsvParser.gs', 'SubjectMapper.gs', 'WniosekBuilder.gs']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', f), 'utf8'), ctx, { filename: f });
}

let passed = 0;
const failures = [];
const ok = (n, c, d) => (c ? passed++ : failures.push(n + (d ? '\n      ' + d : '')));
const eq = (n, a, e) => ok(n, Object.is(a, e), `oczekiwano: ${JSON.stringify(e)}\n      otrzymano: ${JSON.stringify(a)}`);

const KOL = { KATEGORIA: 2, PRZEDMIOT: 3, MODUL1: 4 };

/** Odczyt komórki modułu dla danego klucza wiersza. */
function komorkaModulu(ark, key, modul) {
  const kolA = ark.getRange(1, 1, ark.getLastRow(), 1).getValues().map((r) => String(r[0] || ''));
  const wiersz = kolA.indexOf(key) + 1;
  if (!wiersz) return null;
  return ark.getRange(wiersz, KOL.MODUL1 + modul - 1).getDisplayValue();
}
function przedmiotWiersza(ark, key) {
  const kolA = ark.getRange(1, 1, ark.getLastRow(), 1).getValues().map((r) => String(r[0] || ''));
  const wiersz = kolA.indexOf(key) + 1;
  if (!wiersz) return null;
  return ark.getRange(wiersz, KOL.PRZEDMIOT).getDisplayValue();
}
function tekstUwag(ark) {
  return ark.getRange(1, KOL.KATEGORIA, ark.getLastRow(), 1).getValues().map((r) => String(r[0] || '')).join('\n');
}

const SLO = ctx.pobierzUklad('SLO');
const ss = new Spreadsheet('Wniosek_SLO_Nowak_Anna');

// --- semestr 1: klasa 1o, klasyfikacja roczna -> moduł II -------------------
const kontekst1 = {
  uczen: 'Nowak Anna', klasa: '1o', rokSzkolny: '2025/2026',
  modul: 2, typKlasyfikacji: 'roczna', kierunek: null, zrodloNazwa: 'Klasyfikacja_1o.csv',
};
const ark = ctx.zbudujSzkielet(ss, SLO, kontekst1);
eq('szkielet: usunięto domyślny arkusz', ss.getSheets().length, 1);
eq('szkielet: nazwa arkusza', ark.getName(), 'Wniosek');
eq('szkielet: wiersz "wpisywany" ma pustą kolumnę przedmiotu', przedmiotWiersza(ark, 'jezyk_podstawowy'), '');
eq('szkielet: wiersz stały ma nazwę przedmiotu', przedmiotWiersza(ark, 'historia'), 'historia');
eq('szkielet: nagłówki modułów', ark.getRange(5, KOL.MODUL1, 1, 8).getValues()[0].join(','),
  'I,II,III,IV,V,VI,VII,VIII');

const oceny1 = [
  { przedmiot: 'historia kl. 1', ocena: '5' },
  { przedmiot: 'język angielski', ocena: '4' },
  { przedmiot: 'język francuski', ocena: '3' },
  { przedmiot: 'etyka kl. 1', ocena: 'zal' },
  { przedmiot: 'biologia R kl. 1', ocena: '2' },
  { przedmiot: 'fotografia', ocena: '6' },
  { przedmiot: 'Ceramika', ocena: '4' },
  { przedmiot: 'Gotuj i jedz', ocena: '5' },
  { przedmiot: 'Zajęcia z wychowawcą', ocena: 'zal' },
];
const r1 = ctx.przypiszPrzedmioty(SLO, oceny1, { istniejaceEtykiety: ctx.wczytajEtykiety(ark) });
const w1 = ctx.zapiszModul(ss, SLO, kontekst1, r1);

eq('sem1: historia w module II', komorkaModulu(ark, 'historia', 2), 'bdb');
eq('sem1: angielski w module II', komorkaModulu(ark, 'jezyk_podstawowy', 2), 'db');
eq('sem1: nazwa języka wpisana', przedmiotWiersza(ark, 'jezyk_podstawowy'), 'język angielski');
eq('sem1: francuski w wierszu zindywidualizowanym', przedmiotWiersza(ark, 'jezyk_dodatkowy'), 'język francuski');
eq('sem1: etyka zal', komorkaModulu(ark, 'religia_etyka', 2), 'zal');
eq('sem1: rozszerzenie -> I zaj. rozszerzone', komorkaModulu(ark, 'rozszerzone_1', 2), 'dop');
eq('sem1: nazwa rozszerzenia bez "kl."', przedmiotWiersza(ark, 'rozszerzone_1'), 'biologia R');
eq('sem1: kierunkowe = cel', komorkaModulu(ark, 'kierunkowe', 2), 'cel');
eq('sem1: nazwa kierunkowego', przedmiotWiersza(ark, 'kierunkowe'), 'fotografia');
eq('sem1: kierunek w nagłówku', ark.getRange(1, KOL.MODUL1).getDisplayValue(), 'kierunek: fotografia');
eq('sem1: alternatywne #1', przedmiotWiersza(ark, 'alternatywne'), 'Ceramika');
eq('sem1: alternatywne #2 (dołożony wiersz)', przedmiotWiersza(ark, 'alternatywne#2'), 'Gotuj i jedz');
eq('sem1: ocena w dołożonym wierszu', komorkaModulu(ark, 'alternatywne#2', 2), 'bdb');
eq('sem1: moduł I pusty', komorkaModulu(ark, 'historia', 1), '');
eq('sem1: liczba wpisanych ocen', w1.wpisane, 8);
ok('sem1: uwaga o zajęciach z wychowawcą', /wychowawc/.test(tekstUwag(ark)), tekstUwag(ark));
ok('sem1: blok uwag ma nagłówek z datą i plikiem',
  /2026-02-01 10:00 — plik: Klasyfikacja_1o\.csv, moduł II/.test(tekstUwag(ark)), tekstUwag(ark));

// --- semestr 2: klasa 2o, śródroczna -> moduł III ---------------------------
const kontekst2 = {
  uczen: 'Nowak Anna', klasa: '2o', rokSzkolny: '2026/2027',
  modul: 3, typKlasyfikacji: 'srodroczna', kierunek: 'fotografia', zrodloNazwa: 'Klasyfikacja_2o_srodroczna.csv',
};
// Kolejny rok: te same pozycje, ale z innym oznaczeniem klasy w nazwie.
const oceny2 = [
  { przedmiot: 'historia kl. 2', ocena: '4' },
  { przedmiot: 'język angielski', ocena: '5' },
  { przedmiot: 'biologia R kl. 2', ocena: '4' },
  { przedmiot: 'fotografia', ocena: '5' },
  { przedmiot: 'Gotuj i jedz', ocena: '3' },
];
const r2 = ctx.przypiszPrzedmioty(SLO, oceny2, {
  istniejaceEtykiety: ctx.wczytajEtykiety(ark),
  istniejacyKierunek: 'fotografia',
});
ctx.zapiszModul(ss, SLO, kontekst2, r2);

eq('sem2: moduł II nienaruszony', komorkaModulu(ark, 'historia', 2), 'bdb');
eq('sem2: historia w module III', komorkaModulu(ark, 'historia', 3), 'db');
eq('sem2: angielski w module III', komorkaModulu(ark, 'jezyk_podstawowy', 3), 'bdb');
eq('sem2: rozszerzenie wróciło do swojego wiersza mimo zmiany "kl."',
  komorkaModulu(ark, 'rozszerzone_1', 3), 'db');
eq('sem2: etykieta rozszerzenia niezmieniona', przedmiotWiersza(ark, 'rozszerzone_1'), 'biologia R');
eq('sem2: "Gotuj i jedz" wrócił do wiersza #2', komorkaModulu(ark, 'alternatywne#2', 3), 'dst');
eq('sem2: wiersz alternatywne #1 pusty w module III', komorkaModulu(ark, 'alternatywne', 3), '');
eq('sem2: nie powstał kolejny wiersz alternatywny', przedmiotWiersza(ark, 'alternatywne#3'), null);
eq('sem2: nagłówek ucznia zaktualizowany', ark.getRange(2, KOL.MODUL1).getDisplayValue(),
  'Uczeń: Nowak Anna   |   Klasa: 2o   |   Rok szkolny: 2026/2027');

// --- konflikt: poprawiony eksport tego samego modułu ------------------------
const r3 = ctx.przypiszPrzedmioty(SLO, [{ przedmiot: 'historia kl. 2', ocena: '6' }], {
  istniejaceEtykiety: ctx.wczytajEtykiety(ark),
});
const w3 = ctx.zapiszModul(ss, SLO, Object.assign({}, kontekst2, { zrodloNazwa: 'poprawka.csv' }), r3);
eq('konflikt: wartość niezmieniona', komorkaModulu(ark, 'historia', 3), 'db');
eq('konflikt: nic nie wpisano', w3.wpisane, 0);
ok('konflikt: zgłoszony w uwagach',
  w3.uwagi.some((u) => /Konflikt w module III/.test(u) && /„db”/.test(u) && /„cel”/.test(u)),
  JSON.stringify(w3.uwagi));

// --- moduł poza zakresem szkoły --------------------------------------------
const w4 = ctx.zapiszModul(ss, SLO,
  Object.assign({}, kontekst1, { modul: 9, zrodloNazwa: 'klasa5.csv' }),
  { przypisania: [{ key: 'historia', przedmiot: 'historia kl. 1', ocena: '5', etykieta: null }], kierunek: null, uwagi: [] });
eq('poza zakresem: nic nie wpisano', w4.wpisane, 0);
ok('poza zakresem: zgłoszone w uwagach',
  w4.uwagi.some((u) => /wykracza poza 8 modu/.test(u)), JSON.stringify(w4.uwagi));

// --- metadane ---------------------------------------------------------------
ctx.zapiszMeta(ss, { szkola: 'SLO', uczen: 'Nowak Anna', kierunek: 'fotografia', przetworzonePliki: [{ id: 'abc', modul: 2 }] });
const meta = ctx.wczytajMeta(ss);
eq('meta: szkoła', meta.szkola, 'SLO');
eq('meta: kierunek', meta.kierunek, 'fotografia');
eq('meta: przetworzone pliki', meta.przetworzonePliki[0].id, 'abc');
ok('meta: arkusz ukryty', ss.getSheetByName('_meta').hidden);

// ---------------------------------------------------------------------------
console.log(`\n  zaliczone: ${passed}`);
if (failures.length) {
  console.log(`  BŁĘDY: ${failures.length}\n`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
}
console.log('  test integracyjny przeszedł\n');

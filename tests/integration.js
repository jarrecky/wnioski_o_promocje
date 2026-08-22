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
const { Spreadsheet, BorderStyle } = require('./sheets-mock');

const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({
  console,
  Logger: { log: () => {} },
  SpreadsheetApp: { getUi() { throw new Error('brak UI'); }, BorderStyle },
  Utilities: { formatDate: () => '2026-02-01 10:00' },
});
for (const f of ['Config.gs', 'FormLayout.gs', 'CsvParser.gs', 'SubjectMapper.gs', 'WniosekBuilder.gs']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', f), 'utf8'), ctx, { filename: f });
}

let passed = 0;
const failures = [];
const ok = (n, c, d) => (c ? passed++ : failures.push(n + (d ? '\n      ' + d : '')));
const eq = (n, a, e) => ok(n, Object.is(a, e), `oczekiwano: ${JSON.stringify(e)}\n      otrzymano: ${JSON.stringify(a)}`);

const KOL = { GRUPA: 2, KATEGORIA: 3, PRZEDMIOT: 4, MODUL1: 5 };

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
  return ark.getRange(1, KOL.GRUPA, ark.getLastRow(), 1).getValues().map((r) => String(r[0] || '')).join('\n');
}
function indeksWiersza(ark, key) {
  const kolA = ark.getRange(1, 1, ark.getLastRow(), 1).getValues().map((r) => String(r[0] || ''));
  return kolA.indexOf(key) + 1;
}
/** Styl ramki górnej krawędzi komórki modułu — 'SOLID_MEDIUM' albo 'DOTTED'. */
function stylRamkiArk(ark, key, modul) {
  const wiersz = indeksWiersza(ark, key);
  const kol = KOL.MODUL1 + modul - 1;
  const trafienia = ark.ramki.filter((z) => z.r <= wiersz && wiersz < z.r + z.nr
    && z.c <= kol && kol < z.c + z.nc);
  return trafienia.length ? trafienia[trafienia.length - 1].styl : null;
}
const stylRamki = stylRamkiArk;

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
eq('sem2: nagłówek ucznia zaktualizowany', ark.getRange(2, KOL.GRUPA).getDisplayValue(),
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

// --- ramki modułów wg formularza --------------------------------------------
eq('ramki: historia obejmuje wszystkie 8 modułów',
  JSON.stringify(ctx.zakresyModulow(ctx.wierszPoKluczu(SLO, 'historia'), 8)),
  JSON.stringify({ grube: [[1, 8]], kropkowane: [] }));
eq('ramki: biznes i zarządzanie tylko III-V',
  JSON.stringify(ctx.zakresyModulow(ctx.wierszPoKluczu(SLO, 'biznes_i_zarzadzanie'), 8)),
  JSON.stringify({ grube: [[3, 5]], kropkowane: [[1, 2], [6, 8]] }));
eq('ramki: SLSP plener tylko III-IV',
  JSON.stringify(ctx.zakresyModulow(ctx.wierszPoKluczu(ctx.pobierzUklad('SLSP'), 'plener'), 10)),
  JSON.stringify({ grube: [[3, 4]], kropkowane: [[1, 2], [5, 10]] }));
eq('ramki: w arkuszu moduł objęty ma grubą ramkę', stylRamki(ark, 'biznes_i_zarzadzanie', 4), 'SOLID_MEDIUM');
eq('ramki: w arkuszu moduł poza zakresem ma kropkowaną', stylRamki(ark, 'biznes_i_zarzadzanie', 8), 'DOTTED');
eq('ramki: informatyka moduł VII kropkowany', stylRamki(ark, 'informatyka', 7), 'DOTTED');

// --- scalenia kolumn opisowych ----------------------------------------------
ok('scalenia: grupa scalona pionowo przez wiele wierszy',
  ark.scalenia.some((z) => z.c === KOL.GRUPA && z.nr >= 5),
  JSON.stringify(ark.scalenia.filter((z) => z.c === KOL.GRUPA)));
ok('scalenia: pierwsza sekcja SLO zajmuje obie wąskie kolumny',
  ark.scalenia.some((z) => z.c === KOL.GRUPA && z.nc === 2 && z.nr >= 5));
ok('scalenia: podgrupa "zajęcia ogólnokształcące" scalona pionowo',
  ark.scalenia.some((z) => z.c === KOL.KATEGORIA && z.nr >= 5));
ok('obroty: kolumny opisowe mają tekst pionowy',
  ark.rotacje.some((z) => z.c === KOL.GRUPA && z.stopnie === 90));

// --- ostrzeżenie o module poza zakresem --------------------------------------
const rPoza = ctx.przypiszPrzedmioty(SLO, [{ przedmiot: 'biznes i zarządzanie', ocena: '4' }], {});
const wPoza = ctx.zapiszModul(ss, SLO,
  Object.assign({}, kontekst1, { modul: 8, zrodloNazwa: 'poza-zakresem.csv' }), rPoza);
ok('poza zakresem: ocena mimo wszystko wpisana', wPoza.wpisane === 1);
ok('poza zakresem: zgłoszone w uwagach',
  wPoza.uwagi.some((u) => /formularz przewiduje/.test(u) && /biznes/.test(u)),
  JSON.stringify(wPoza.uwagi));

// --- szkielet SLSP (10 modułów, trzy poziomy opisu) --------------------------
const SLSP = ctx.pobierzUklad('SLSP');
const ssS = new Spreadsheet('Wniosek_SLSP_Test');
const arkS = ctx.zbudujSzkielet(ssS, SLSP, {
  uczen: 'Testowa Maja', klasa: '3', rokSzkolny: '2025/2026',
  modul: 5, typKlasyfikacji: 'srodroczna', kierunek: null, zrodloNazwa: 'slsp.csv',
});
eq('SLSP: nagłówki modułów I-X',
  arkS.getRange(5, KOL.MODUL1, 1, 10).getValues()[0].join(','), 'I,II,III,IV,V,VI,VII,VIII,IX,X');
eq('SLSP: historia sztuki ma własny wiersz z kategorią I zaj. rozszerz.',
  arkS.getRange(indeksWiersza(arkS, 'historia_sztuki'), KOL.KATEGORIA).getDisplayValue(), 'I zaj. rozszerz.');
ok('SLSP: obie podgrupy scalone pionowo',
  arkS.scalenia.filter((z) => z.c === KOL.KATEGORIA && z.nr >= 5).length >= 2,
  JSON.stringify(arkS.scalenia.filter((z) => z.c === KOL.KATEGORIA)));
ok('SLSP: grupa "zindywidualizowany" obejmuje sekcje ogólne i artystyczne',
  arkS.scalenia.some((z) => z.c === KOL.GRUPA && z.nr >= 20),
  JSON.stringify(arkS.scalenia.filter((z) => z.c === KOL.GRUPA)));
eq('SLSP: plener — moduł V kropkowany', stylRamkiArk(arkS, 'plener', 5), 'DOTTED');
eq('SLSP: plener — moduł III gruby', stylRamkiArk(arkS, 'plener', 3), 'SOLID_MEDIUM');

// --- metadane ---------------------------------------------------------------
// Regresja: świeży arkusz nie ma jeszcze _meta, a Main.gs od razu sięga po
// meta.przetworzonePliki.some(...) — brak tego pola wywracał pierwszego ucznia.
const czysty = ctx.wczytajMeta(new Spreadsheet('bez-meta'));
ok('meta: świeży arkusz ma listę przetworzonych plików',
  Array.isArray(czysty.przetworzonePliki) && czysty.przetworzonePliki.length === 0,
  JSON.stringify(czysty));
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

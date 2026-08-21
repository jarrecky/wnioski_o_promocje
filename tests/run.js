#!/usr/bin/env node
/**
 * Lokalny harness testowy dla czystych części skryptu (bez API Google).
 * Ładuje pliki .gs do jednego kontekstu vm i uruchamia asercje na prawdziwym
 * eksporcie Klasyfikacja.csv oraz na syntetycznych danych SLSP.
 *
 *   node tests/run.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GS = ['Config.gs', 'FormLayout.gs', 'CsvParser.gs', 'SubjectMapper.gs', 'Tests.gs'];

// Namiastki API Google potrzebne wyłącznie przez Tests.gs.
const logi = [];
const ctx = vm.createContext({
  console,
  Logger: { log: (m) => logi.push(String(m)) },
  SpreadsheetApp: { getUi() { throw new Error('brak UI poza arkuszem'); } },
  Utilities: { formatDate: () => '2026-01-01 00:00' },
});
for (const f of GS) {
  const src = fs.readFileSync(path.join(ROOT, 'apps-script', f), 'utf8');
  vm.runInContext(src, ctx, { filename: f });
}

let passed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { passed++; return; }
  failures.push(name + (detail ? '\n      ' + detail : ''));
}
function eq(name, actual, expected) {
  ok(name, Object.is(actual, expected), `oczekiwano: ${JSON.stringify(expected)}\n      otrzymano: ${JSON.stringify(actual)}`);
}

/** Pomocnik: mapa key -> nazwa przedmiotu / ocena z wyniku routingu. */
const byKey = (wynik) => Object.fromEntries(wynik.przypisania.map((p) => [p.key, p]));

// ---------------------------------------------------------------------------
// 1. Prawdziwy plik: Klasyfikacja.csv (SLO, klasa 1, roczna -> moduł II)
// ---------------------------------------------------------------------------
const csv = new TextDecoder('windows-1250').decode(fs.readFileSync(path.join(ROOT, 'Klasyfikacja.csv')));
const dane = ctx.parsujKlasyfikacje(csv, 'Klasyfikacja.csv');

eq('csv: szkoła', dane.meta.szkola, 'SLO');
eq('csv: klasa', dane.meta.klasa, 1);
eq('csv: etykieta klasy', dane.meta.klasaEtykieta, '1o');
eq('csv: typ klasyfikacji', dane.meta.typKlasyfikacji, 'roczna');
eq('csv: rok szkolny', dane.meta.rokSzkolny, '2025/2026');
eq('csv: moduł (klasa 1 + roczna)', dane.meta.modul, 2);
eq('csv: liczba przedmiotów', dane.przedmioty.length, 31);
ok('csv: przedmioty nie zawierają bloku podsumowań',
  !dane.przedmioty.some((p) => /^[1-6]$|liczby|usp\.|nieus\./i.test(p.nazwa)),
  JSON.stringify(dane.przedmioty.map((p) => p.nazwa)));

eq('csv: tylko uczniowie z nazwiskiem', dane.uczniowie.length, 1);
const uczen = dane.uczniowie[0];
eq('csv: nazwisko ucznia', uczen.nazwisko, 'TestKowalski Sebastian');
eq('csv: nr ucznia', uczen.nr, '55');
eq('csv: liczba ocen ucznia', uczen.oceny.length, 1);
eq('csv: przedmiot oceny', uczen.oceny[0].przedmiot, 'Historia');
eq('csv: wartość oceny', uczen.oceny[0].ocena, '5');
ok('csv: ostrzeżenie o wierszach bez nazwiska',
  dane.ostrzezenia.some((o) => /bez nazwiska/.test(o)), JSON.stringify(dane.ostrzezenia));

// moduły
eq('moduł: klasa 1 śródroczna', ctx.numerModulu(1, 'srodroczna'), 1);
eq('moduł: klasa 2 śródroczna', ctx.numerModulu(2, 'srodroczna'), 3);
eq('moduł: klasa 3 roczna', ctx.numerModulu(3, 'roczna'), 6);
eq('moduł: klasa 4 roczna', ctx.numerModulu(4, 'roczna'), 8);
eq('moduł: klasa 5 śródroczna', ctx.numerModulu(5, 'srodroczna'), 9);
eq('moduł: klasa 5 roczna', ctx.numerModulu(5, 'roczna'), 10);

// oceny opisowe
eq('ocena 6', ctx.ocenaNaTekst('6').tekst, 'cel');
eq('ocena 5', ctx.ocenaNaTekst('5').tekst, 'bdb');
eq('ocena 4', ctx.ocenaNaTekst('4').tekst, 'db');
eq('ocena 3', ctx.ocenaNaTekst('3').tekst, 'dst');
eq('ocena 2', ctx.ocenaNaTekst('2').tekst, 'dop');
eq('ocena 1', ctx.ocenaNaTekst('1').tekst, 'ndst');
eq('ocena zal (przepisana)', ctx.ocenaNaTekst('zal').tekst, 'zal');
eq('ocena pusta', ctx.ocenaNaTekst('-').tekst, '');
ok('ocena nierozpoznana daje uwagę', !!ctx.ocenaNaTekst('bardzo dobry+').uwaga);

// normalizacja
eq('normalizacja: sufiks SLO', ctx.normalizujNazwe('Rzeźba SLO'), 'rzezba');
eq('normalizacja: myślnik', ctx.normalizujNazwe('Tutorial - nauki ścisłe'), 'tutorial nauki scisle');
eq('normalizacja: diakrytyki', ctx.normalizujNazwe('Język Angielski'), 'jezyk angielski');

// ---------------------------------------------------------------------------
// 2. Routing SLO
// ---------------------------------------------------------------------------
const SLO = ctx.pobierzUklad('SLO');
const ocenySLO = [
  { przedmiot: 'Język polski', ocena: '5' },
  { przedmiot: 'Język angielski', ocena: '4' },
  { przedmiot: 'Język francuski', ocena: '3' },
  { przedmiot: 'Matematyka', ocena: '2' },
  { przedmiot: 'Etyka', ocena: 'zal' },
  { przedmiot: 'Historia', ocena: '5' },
  { przedmiot: 'Tutorial - nauki ścisłe', ocena: '4' },
  { przedmiot: 'Tutorial - nauki społeczne', ocena: '3' },
  { przedmiot: 'Fotografia SLO', ocena: '6' },
  { przedmiot: 'Snycerstwo', ocena: '4' },
  { przedmiot: 'Zajęcia z wychowawcą', ocena: 'zal' },
  { przedmiot: 'Edukacja zdrowotna', ocena: 'zal' }
];
const rSLO = ctx.przypiszPrzedmioty(SLO, ocenySLO, {});
const kSLO = byKey(rSLO);

eq('SLO: język polski', kSLO.jezyk_polski.przedmiot, 'Język polski');
eq('SLO: angielski -> wiersz podstawowy', kSLO.jezyk_podstawowy.przedmiot, 'Język angielski');
eq('SLO: francuski -> wiersz zindywidualizowany', kSLO.jezyk_dodatkowy.przedmiot, 'Język francuski');
eq('SLO: etyka -> religia/etyka', kSLO.religia_etyka.przedmiot, 'Etyka');
eq('SLO: historia', kSLO.historia.ocena, '5');
eq('SLO: tutorial 1 -> I zaj. rozszerzone', kSLO.rozszerzone_1.przedmiot, 'Tutorial - nauki ścisłe');
eq('SLO: tutorial 2 -> II zaj. rozszerzone', kSLO.rozszerzone_2.przedmiot, 'Tutorial - nauki społeczne');
eq('SLO: kierunek wykryty', rSLO.kierunek, 'fotografia');
eq('SLO: przedmiot kierunkowy w wierszu', kSLO.kierunkowe.przedmiot, 'Fotografia SLO');
eq('SLO: snycerstwo -> zaj. alternatywne', kSLO.alternatywne.przedmiot, 'Snycerstwo');
ok('SLO: zajęcia z wychowawcą nie trafiają do tabeli', !rSLO.przypisania.some((p) => /wychowawc/i.test(p.przedmiot)));
ok('SLO: uwaga o zajęciach z wychowawcą',
  rSLO.uwagi.some((u) => /wychowawc/i.test(u)), JSON.stringify(rSLO.uwagi));
ok('SLO: uwaga o edukacji zdrowotnej',
  rSLO.uwagi.some((u) => /Edukacja zdrowotna/i.test(u)), JSON.stringify(rSLO.uwagi));
ok('SLO: snycerstwo bez zbędnej uwagi (jest na liście alternatywnych)',
  !rSLO.uwagi.some((u) => /Snycerstwo/i.test(u)), JSON.stringify(rSLO.uwagi));

// dwa kierunki naraz -> pole puste + obie oceny do alternatywnych
const rDwa = ctx.przypiszPrzedmioty(SLO, [
  { przedmiot: 'Fotografia SLO', ocena: '5' },
  { przedmiot: 'Film', ocena: '4' }
], {});
eq('SLO: dwa kierunki -> brak kierunku', rDwa.kierunek, null);
ok('SLO: dwa kierunki -> uwaga', rDwa.uwagi.some((u) => /jednoznacznie/.test(u)), JSON.stringify(rDwa.uwagi));
const kDwa = byKey(rDwa);
ok('SLO: dwa kierunki -> obie oceny w alternatywnych',
  !!kDwa.alternatywne && !!kDwa['alternatywne#2'], JSON.stringify(Object.keys(kDwa)));

// rozszerzanie wiersza alternatywnego
const rTrzy = ctx.przypiszPrzedmioty(SLO, [
  { przedmiot: 'Ceramika', ocena: '5' },
  { przedmiot: 'Gotuj i jedz', ocena: '4' },
  { przedmiot: 'Poznajemy Wrocław', ocena: '3' }
], {});
const kTrzy = byKey(rTrzy);
eq('SLO: alternatywne #1', kTrzy.alternatywne.przedmiot, 'Ceramika');
eq('SLO: alternatywne #2', kTrzy['alternatywne#2'].przedmiot, 'Gotuj i jedz');
eq('SLO: alternatywne #3', kTrzy['alternatywne#3'].przedmiot, 'Poznajemy Wrocław');

// stabilność slotów między semestrami
const rStab = ctx.przypiszPrzedmioty(SLO, [
  { przedmiot: 'Tutorial - nauki społeczne', ocena: '5' }
], { istniejaceEtykiety: { rozszerzone_1: 'Tutorial - nauki ścisłe', rozszerzone_2: 'Tutorial - nauki społeczne' } });
eq('SLO: tutorial wraca do swojego wiersza', byKey(rStab).rozszerzone_2.przedmiot, 'Tutorial - nauki społeczne');
ok('SLO: nie nadpisał wiersza rozszerzone_1', !byKey(rStab).rozszerzone_1);

// oba języki podstawowe -> pierwszy alfabetycznie do wiersza podstawowego
const rJez = ctx.przypiszPrzedmioty(SLO, [
  { przedmiot: 'Język niemiecki', ocena: '4' },
  { przedmiot: 'Język angielski', ocena: '5' }
], {});
const kJez = byKey(rJez);
eq('SLO: oba języki -> angielski podstawowy', kJez.jezyk_podstawowy.przedmiot, 'Język angielski');
eq('SLO: oba języki -> niemiecki zindywidualizowany', kJez.jezyk_dodatkowy.przedmiot, 'Język niemiecki');
ok('SLO: oba języki -> uwaga', rJez.uwagi.some((u) => /wi[ęe]cej ni[żz] jednego j[ęe]zyka/i.test(u)), JSON.stringify(rJez.uwagi));

// ---------------------------------------------------------------------------
// 3. Routing SLSP
// ---------------------------------------------------------------------------
const SLSP = ctx.pobierzUklad('SLSP');
eq('SLSP: 10 modułów', SLSP.liczbaModulow, 10);
eq('SLO: 8 modułów', SLO.liczbaModulow, 8);

const rSLSP = ctx.przypiszPrzedmioty(SLSP, [
  { przedmiot: 'Historia sztuki', ocena: '5' },
  { przedmiot: 'Rzeźba', ocena: '4' },
  { przedmiot: 'Rysunek i malarstwo', ocena: '5' },
  { przedmiot: 'Plener', ocena: 'zal' },
  { przedmiot: 'Tutorial - nauki ścisłe', ocena: '3' },
  { przedmiot: 'Tutorial - nauki społeczne', ocena: '4' },
  { przedmiot: 'Wizaż', ocena: '6' }
], {});
const kSLSP = byKey(rSLSP);
eq('SLSP: historia sztuki ma własny wiersz', kSLSP.historia_sztuki.ocena, '5');
eq('SLSP: rzeźba -> wiersz artystyczny, nie kierunek', kSLSP.rzezba.ocena, '4');
eq('SLSP: rysunek i malarstwo', kSLSP.rysunek_i_malarstwo.ocena, '5');
eq('SLSP: plener', kSLSP.plener.ocena, 'zal');
eq('SLSP: pierwszy tutorial -> II zaj. rozszerz.', kSLSP.rozszerzone_2.przedmiot, 'Tutorial - nauki ścisłe');
ok('SLSP: drugi tutorial nie ma miejsca -> uwaga',
  rSLSP.uwagi.some((u) => /zaj\. rozszerzone/.test(u) && /nauki spo/.test(u)), JSON.stringify(rSLSP.uwagi));
eq('SLSP: specjalizacja wykryta', rSLSP.kierunek, 'charakteryzacja i wizaż');
eq('SLSP: wizaż w wierszu specjalizacji', kSLSP.specjalizacja_art.przedmiot, 'Wizaż');
ok('SLSP: brak wiersza I zaj. rozszerzone (zarezerwowany)',
  ctx.slotyDla(SLSP, 'tutorial').length === 1, JSON.stringify(ctx.slotyDla(SLSP, 'tutorial').map((s) => s.key)));

// metadane SLSP z nazwy pliku, gdy nagłówek jest ubogi
const metaZNazwy = ctx.odczytajMetadane([['Klasyfikacja śródroczna'], [''], ['']], 'klasa 3 SLSP 2025.csv');
eq('SLSP: szkoła z nazwy pliku', metaZNazwy.meta.szkola, 'SLSP');
eq('SLSP: klasa z nazwy pliku', metaZNazwy.meta.klasa, 3);
eq('SLSP: moduł z nazwy pliku', metaZNazwy.meta.modul, 5);

// ---------------------------------------------------------------------------
// 4. Ten sam zestaw reguł uruchomiony przez wbudowane uruchomTesty()
// ---------------------------------------------------------------------------
const podsumowanie = ctx.uruchomTesty();
ok('Tests.gs: uruchomTesty() bez błędów', /b[łl][ęe]dy: 0/.test(podsumowanie), podsumowanie);

// ---------------------------------------------------------------------------
console.log(`\n  zaliczone: ${passed}`);
if (failures.length) {
  console.log(`  BŁĘDY: ${failures.length}\n`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
}
console.log('  wszystkie testy przeszły\n');

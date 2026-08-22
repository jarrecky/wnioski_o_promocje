#!/usr/bin/env node
/**
 * Lokalne uruchomienie skryptu na przykładowych plikach z katalogu przyklady/.
 *
 * Wykonuje PRAWDZIWĄ funkcję przetworzNowePliki() z Main.gs — podstawione są
 * tylko usługi Google (Dysk, Arkusze, Właściwości), a nie logika. Dzięki temu
 * widać dokładnie to, co powstałoby na Dysku, bez konta Google.
 *
 *   node narzedzia/uruchom-lokalnie.js
 *
 * Wyniki lądują w przyklady/wynik/ jako .csv (do przeglądania w gicie)
 * oraz .xlsx (do otwarcia w Arkuszach/Excelu).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { utworzSrodowisko } = require('../tests/drive-mock');

const ROOT = path.resolve(__dirname, '..');
const WYNIK = path.join(ROOT, 'przyklady', 'wynik');
const PLIKI_GS = ['Config.gs', 'FormLayout.gs', 'CsvParser.gs', 'SubjectMapper.gs',
  'WniosekBuilder.gs', 'Main.gs'];

const srodowisko = utworzSrodowisko();
const ctx = vm.createContext(srodowisko.globalne);
for (const f of PLIKI_GS) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', f), 'utf8'), ctx, { filename: f });
}

// Foldery na Dysku
const wejscie = srodowisko.zarejestruj(new srodowisko.Folder('Wnioski — wejście'));
const wyjscie = srodowisko.zarejestruj(new srodowisko.Folder('Wnioski — wyjście'));
ctx.CONFIG.INPUT_FOLDER_ID = wejscie.getId();
ctx.CONFIG.OUTPUT_FOLDER_ID = wyjscie.getId();

const wejsciowe = fs.readdirSync(path.join(ROOT, 'przyklady'))
  .filter((n) => n.endsWith('.csv')).sort();
if (!wejsciowe.length) {
  console.error('Brak plików CSV w przyklady/ — uruchom najpierw narzedzia/generuj-przyklady.py');
  process.exit(1);
}

// Semestry wrzucamy po kolei, tak jak działoby się to w ciągu roku szkolnego:
// najpierw klasyfikacja śródroczna, potem roczna.
const kolejnosc = wejsciowe.slice().sort((a, b) =>
  (a.includes('srodroczna') ? 0 : 1) - (b.includes('srodroczna') ? 0 : 1));

for (const nazwa of kolejnosc) {
  console.log('\n▸ wrzucam ' + nazwa);
  wejscie.dodajCsv(path.join(ROOT, 'przyklady', nazwa));
  ctx.przetworzNowePliki();
}

// --- zapis wyników ----------------------------------------------------------
fs.rmSync(WYNIK, { recursive: true, force: true });
fs.mkdirSync(WYNIK, { recursive: true });

const doXlsx = [];
const uzyte = new Map();
console.log('\n▸ wyniki w folderze wyjściowym:');
for (const plik of wyjscie.pliki) {
  const ss = plik.__ss;
  if (!ss) continue;
  const widoczne = ss.getSheets().filter((s) => !s.hidden);
  const arkusze = widoczne.map((s) => {
    // Tylko arkusz "Wniosek" ma techniczną kolumnę A z kluczem wiersza —
    // w eksporcie jest zbędna. Raport ma dane już od pierwszej kolumny.
    const odKol = s.getName() === 'Wniosek' ? 1 : 0;
    const przesun = (z) => ({ ...z, c: z.c - odKol });
    return {
      nazwa: s.getName(),
      wiersze: s.data.map((r) => (r || []).slice(odKol).map((v) => (v == null ? '' : String(v)))),
      scalenia: s.scalenia.filter((z) => z.c > odKol).map(przesun),
      rotacje: s.rotacje.filter((z) => z.c > odKol).map(przesun),
      ramki: s.ramki.filter((z) => z.c > odKol).map(przesun),
      tla: s.tla.filter((z) => z.c > odKol).map(przesun),
      szerokosci: [...s.szerokosci].filter(([k]) => k > odKol).map(([k, v]) => [k - odKol, v]),
    };
  });
  // Zegar w mocku stoi, więc oba przebiegi tworzą raport o tej samej nazwie.
  // Na Dysku byłyby to dwa osobne pliki — tutaj rozróżniamy je sufiksem.
  let bazowa = plik.getName();
  const ile = (uzyte.get(bazowa) || 0) + 1;
  uzyte.set(bazowa, ile);
  if (ile > 1) bazowa += '_' + ile;
  const csv = arkusze[0].wiersze
    .map((r) => r.map((v) => (/[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(';'))
    .join('\n');
  fs.writeFileSync(path.join(WYNIK, bazowa + '.csv'), csv + '\n', 'utf8');
  doXlsx.push({ nazwa: bazowa, arkusze });
  console.log('   ' + bazowa + '  (' + arkusze[0].wiersze.length + ' wierszy)');
}

const opis = path.join(WYNIK, '_dane.json');
fs.writeFileSync(opis, JSON.stringify(doXlsx, null, 1), 'utf8');
execFileSync('python3', [path.join(__dirname, 'zapisz-xlsx.py'), opis, WYNIK], { stdio: 'inherit' });
fs.unlinkSync(opis);
console.log('\nGotowe. Wyniki: przyklady/wynik/');

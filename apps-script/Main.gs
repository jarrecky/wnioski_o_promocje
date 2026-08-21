/**
 * Punkt wejścia: skanowanie folderu wejściowego i generowanie wniosków.
 *
 * Apps Script nie ma wyzwalacza "plik pojawił się w folderze", więc pracujemy
 * na wyzwalaczu czasowym co 5 minut. Logika jest niezależna od wyzwalacza —
 * przetworzNowePliki() można uruchomić także ręcznie z edytora lub z menu.
 */

var KLUCZ_PRZETWORZONE = 'przetworzonePlikiId';

// --- obsługa menu i wyzwalaczy ---------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Wnioski')
    .addItem('Przetwórz nowe pliki CSV', 'przetworzNowePliki')
    .addSeparator()
    .addItem('Zainstaluj wyzwalacz (co 5 min)', 'zainstalujWyzwalacz')
    .addItem('Usuń wyzwalacze', 'usunWyzwalacze')
    .addSeparator()
    .addItem('Uruchom testy wbudowane', 'uruchomTesty')
    .addToUi();
}

function zainstalujWyzwalacz() {
  usunWyzwalacze();
  ScriptApp.newTrigger('przetworzNowePliki').timeBased().everyMinutes(5).create();
  Logger.log('Zainstalowano wyzwalacz czasowy (co 5 minut).');
}

function usunWyzwalacze() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'przetworzNowePliki') ScriptApp.deleteTrigger(t);
  });
}

// --- pomocnicze -------------------------------------------------------------

function wczytajZbiorPrzetworzonych() {
  var raw = PropertiesService.getScriptProperties().getProperty(KLUCZ_PRZETWORZONE);
  try { return JSON.parse(raw || '[]'); } catch (e) { return []; }
}

function zapiszZbiorPrzetworzonych(lista) {
  var przyciete = lista.slice(-500);
  PropertiesService.getScriptProperties().setProperty(KLUCZ_PRZETWORZONE, JSON.stringify(przyciete));
}

function folderArchiwum(folderWe) {
  var istniejace = folderWe.getFoldersByName(CONFIG.ARCHIVE_FOLDER_NAME);
  return istniejace.hasNext() ? istniejace.next() : folderWe.createFolder(CONFIG.ARCHIVE_FOLDER_NAME);
}

function czyPlikCsv(plik) {
  return /\.csv$/i.test(plik.getName()) || plik.getMimeType() === MimeType.CSV;
}

function sprawdzKonfiguracje() {
  ['INPUT_FOLDER_ID', 'OUTPUT_FOLDER_ID'].forEach(function (k) {
    if (!CONFIG[k] || CONFIG[k].indexOf('WKLEJ_ID') === 0) {
      throw new Error('Uzupełnij CONFIG.' + k + ' w pliku Config.gs (ID folderu na Dysku Google).');
    }
  });
}

// --- główny przebieg --------------------------------------------------------

function przetworzNowePliki() {
  sprawdzKonfiguracje();
  var blokada = LockService.getScriptLock();
  if (!blokada.tryLock(30000)) {
    Logger.log('Inny przebieg jest w toku — pomijam.');
    return;
  }
  try {
    var folderWe = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
    var folderWy = DriveApp.getFolderById(CONFIG.OUTPUT_FOLDER_ID);
    var przetworzone = wczytajZbiorPrzetworzonych();
    var raport = [];
    var cokolwiek = false;

    var pliki = folderWe.getFiles();
    while (pliki.hasNext()) {
      var plik = pliki.next();
      if (!czyPlikCsv(plik)) continue;
      if (przetworzone.indexOf(plik.getId()) >= 0) continue;

      cokolwiek = true;
      try {
        przetworzPlik(plik, folderWy, raport);
      } catch (e) {
        raport.push({
          plik: plik.getName(), uczen: '—', status: 'BŁĄD',
          uwagi: [String(e && e.message ? e.message : e)]
        });
        Logger.log('Błąd przy pliku ' + plik.getName() + ': ' + e);
      }

      przetworzone.push(plik.getId());
      zapiszZbiorPrzetworzonych(przetworzone);
      if (CONFIG.ARCHIVE_PROCESSED) plik.moveTo(folderArchiwum(folderWe));
    }

    if (cokolwiek && CONFIG.CREATE_RUN_REPORT) zapiszRaport(folderWy, raport);
    Logger.log('Zakończono. Pozycji w raporcie: ' + raport.length);
  } finally {
    blokada.releaseLock();
  }
}

function przetworzPlik(plik, folderWy, raport) {
  var tekst = plik.getBlob().getDataAsString('windows-1250');
  var dane = parsujKlasyfikacje(tekst, plik.getName());

  if (!dane.meta.szkola || !dane.meta.klasa) {
    throw new Error('Nie udało się ustalić szkoły/klasy dla pliku "' + plik.getName() + '". ' +
      dane.ostrzezenia.join(' '));
  }
  var uklad = pobierzUklad(dane.meta.szkola);

  if (dane.ostrzezenia.length) {
    raport.push({ plik: plik.getName(), uczen: '—', status: 'informacja', uwagi: dane.ostrzezenia });
  }

  dane.uczniowie.forEach(function (uczen) {
    var wynik = przetworzUcznia(uczen, dane.meta, uklad, folderWy, plik);
    raport.push({
      plik: plik.getName(),
      uczen: uczen.nazwisko,
      status: wynik.status,
      uwagi: wynik.uwagi
    });
  });
}

function przetworzUcznia(uczen, meta, uklad, folderWy, plikZrodlowy) {
  var znaleziony = znajdzLubUtworzArkuszUcznia(folderWy, meta.szkola, uczen.nazwisko);
  var ss = znaleziony.ss;
  var metaArkusza = wczytajMeta(ss);

  var juzPrzetworzony = metaArkusza.przetworzonePliki.some(function (p) { return p.id === plikZrodlowy.getId(); });
  if (juzPrzetworzony) {
    return { status: 'pominięty (ten plik był już wczytany)', uwagi: [] };
  }

  var kontekst = {
    uczen: uczen.nazwisko,
    klasa: meta.klasaEtykieta || meta.klasa,
    rokSzkolny: meta.rokSzkolny,
    modul: meta.modul,
    typKlasyfikacji: meta.typKlasyfikacji,
    kierunek: metaArkusza.kierunek || null,
    zrodloNazwa: plikZrodlowy.getName()
  };

  var ark = ss.getSheetByName(ARKUSZ_WNIOSKU);
  if (!ark) ark = zbudujSzkielet(ss, uklad, kontekst);

  var uwagiWstepne = [];
  if (metaArkusza.szkola && metaArkusza.szkola !== meta.szkola) {
    uwagiWstepne.push('Arkusz był zbudowany dla szkoły ' + metaArkusza.szkola + ', a plik dotyczy ' +
      meta.szkola + '. Układ tabeli NIE został przebudowany — sprawdź, czy to właściwy uczeń.');
  }

  var routing = przypiszPrzedmioty(uklad, uczen.oceny, {
    istniejaceEtykiety: wczytajEtykiety(ark),
    istniejacyKierunek: metaArkusza.kierunek || null
  });
  routing.uwagi = uwagiWstepne.concat(routing.uwagi);

  var wynik = zapiszModul(ss, uklad, kontekst, routing);

  metaArkusza.szkola = meta.szkola;
  metaArkusza.klasa = String(kontekst.klasa);
  metaArkusza.rokSzkolny = meta.rokSzkolny || '';
  metaArkusza.uczen = uczen.nazwisko;
  if (routing.kierunek) metaArkusza.kierunek = routing.kierunek;
  metaArkusza.przetworzonePliki.push({
    id: plikZrodlowy.getId(),
    nazwa: plikZrodlowy.getName(),
    modul: meta.modul,
    data: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm')
  });
  zapiszMeta(ss, metaArkusza);

  return {
    status: (znaleziony.utworzony ? 'utworzono' : 'zaktualizowano') +
      ' — moduł ' + RZYMSKIE[meta.modul - 1] + ', wpisanych ocen: ' + wynik.wpisane,
    uwagi: wynik.uwagi
  };
}

// --- raport z przebiegu -----------------------------------------------------

function zapiszRaport(folderWy, raport) {
  var stempel = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd_HH-mm');
  var ss = SpreadsheetApp.create('Raport_wnioski_' + stempel);
  DriveApp.getFileById(ss.getId()).moveTo(folderWy);
  var ark = ss.getSheets()[0].setName('Raport');

  var wiersze = [['Plik źródłowy', 'Uczeń', 'Status', 'Uwagi']];
  raport.forEach(function (p) {
    wiersze.push([p.plik, p.uczen, p.status, (p.uwagi || []).join('\n')]);
  });
  ark.getRange(1, 1, wiersze.length, 4).setValues(wiersze);
  ark.getRange(1, 1, 1, 4).setFontWeight('bold');
  ark.setColumnWidth(1, 220);
  ark.setColumnWidth(2, 200);
  ark.setColumnWidth(3, 260);
  ark.setColumnWidth(4, 520);
  ark.getRange(1, 4, wiersze.length, 1).setWrap(true).setVerticalAlignment('top');
  ark.setFrozenRows(1);
  Logger.log('Raport: ' + ss.getUrl());
}

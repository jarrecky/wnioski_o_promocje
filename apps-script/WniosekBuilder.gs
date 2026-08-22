/**
 * Budowa i aktualizacja arkusza wniosku (jeden arkusz na ucznia).
 *
 * Układ arkusza "Wniosek":
 *   kolumna A  - ukryta, klucz wiersza (dzięki niemu kolejny semestr trafia
 *                do właściwego wiersza nawet po ręcznych zmianach w tabeli)
 *   kolumna B  - kategoria (wąska kolumna z papierowego formularza)
 *   kolumna C  - przedmiot nauczania
 *   kolumny D+ - moduły I..VIII (SLO) / I..X (SLSP)
 */

var ARKUSZ_WNIOSKU = 'Wniosek';
var ARKUSZ_META = '_meta';
var KOL_KATEGORIA = 2;
var KOL_PRZEDMIOT = 3;
var KOL_PIERWSZY_MODUL = 4;

var MARKER_UWAGI = '__UWAGI__';
var MARKER_SEKCJA = '__SEKCJA__';
var MAX_WIERSZY_UWAG = 300;

function bezpiecznaNazwaPliku(tekst) {
  return String(tekst).replace(/[\\\/:*?"<>|]/g, '-').replace(/\s+/g, '_').trim();
}

function nazwaPlikuUcznia(szkola, nazwisko) {
  return 'Wniosek_' + szkola + '_' + bezpiecznaNazwaPliku(nazwisko);
}

/** Znajduje arkusz ucznia w folderze wyjściowym albo tworzy nowy. */
function znajdzLubUtworzArkuszUcznia(folder, szkola, nazwisko) {
  var nazwa = nazwaPlikuUcznia(szkola, nazwisko);
  var pliki = folder.getFilesByName(nazwa);
  if (pliki.hasNext()) {
    return { ss: SpreadsheetApp.open(pliki.next()), utworzony: false };
  }
  var ss = SpreadsheetApp.create(nazwa);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  return { ss: ss, utworzony: true };
}

// --- metadane ---------------------------------------------------------------

function wczytajMeta(ss) {
  var ark = ss.getSheetByName(ARKUSZ_META);
  // Świeży arkusz nie ma jeszcze _meta — zwracamy komplet pól, żeby wywołujący
  // nie musiał sprawdzać każdego z osobna.
  if (!ark) return { przetworzonePliki: [] };
  var dane = ark.getDataRange().getValues();
  var meta = {};
  dane.forEach(function (w) {
    if (!w[0]) return;
    var v = String(w[1] == null ? '' : w[1]);
    if (w[0] === 'przetworzonePliki') {
      try { meta[w[0]] = JSON.parse(v || '[]'); } catch (e) { meta[w[0]] = []; }
    } else {
      meta[w[0]] = v;
    }
  });
  if (!meta.przetworzonePliki) meta.przetworzonePliki = [];
  return meta;
}

function zapiszMeta(ss, meta) {
  var ark = ss.getSheetByName(ARKUSZ_META);
  if (!ark) {
    ark = ss.insertSheet(ARKUSZ_META);
    ark.hideSheet();
  }
  ark.clear();
  var wiersze = Object.keys(meta).map(function (k) {
    var v = meta[k];
    return [k, (k === 'przetworzonePliki') ? JSON.stringify(v) : String(v == null ? '' : v)];
  });
  if (wiersze.length) ark.getRange(1, 1, wiersze.length, 2).setValues(wiersze);
}

// --- szkielet tabeli --------------------------------------------------------

/** Buduje pustą tabelę zgodną z układem formularza. */
function zbudujSzkielet(ss, uklad, kontekst) {
  var ark = ss.getSheetByName(ARKUSZ_WNIOSKU) || ss.insertSheet(ARKUSZ_WNIOSKU, 0);
  ark.clear();
  var domyslny = ss.getSheetByName('Arkusz1') || ss.getSheetByName('Sheet1');
  if (domyslny && domyslny.getSheetId() !== ark.getSheetId()) ss.deleteSheet(domyslny);

  var n = uklad.liczbaModulow;
  var ostatniaKol = KOL_PIERWSZY_MODUL + n - 1;
  var wiersze = [];

  wiersze.push(['__TYTUL__', 'ZREALIZOWANY MATERIAŁ PROGRAMOWY', '', uklad.polePozaTabela + ': ' + odKropek(kontekst.kierunek)]);
  wiersze.push(['__PODTYTUL__', uklad.naglowekSzkoly.replace('\n', ' '), '',
    'Uczeń: ' + kontekst.uczen + '   |   Klasa: ' + (kontekst.klasa || '—') + '   |   Rok szkolny: ' + (kontekst.rokSzkolny || '—')]);
  wiersze.push(['', '', '', '']);
  wiersze.push(['__NAGLOWEK1__', 'Przedmiot nauczania', '', 'Zrealizowane moduły (ocena słownie)']);

  var naglowek2 = ['__NAGLOWEK2__', '', ''];
  for (var i = 0; i < n; i++) naglowek2.push(RZYMSKIE[i]);
  wiersze.push(naglowek2);

  uklad.sekcje.forEach(function (sekcja) {
    wiersze.push([MARKER_SEKCJA, sekcja.tytul, '']);
    sekcja.wiersze.forEach(function (w) {
      var e = etykietyWiersza(w);
      wiersze.push([w.key, e.kategoria, e.przedmiot]);
    });
  });

  wiersze.push(['', '', '']);
  wiersze.push([MARKER_UWAGI, 'UWAGI — pozycje wymagające sprawdzenia', '']);

  var szerokosc = ostatniaKol;
  var siatka = wiersze.map(function (w) {
    var kopia = w.slice();
    while (kopia.length < szerokosc) kopia.push('');
    return kopia.slice(0, szerokosc);
  });
  ark.getRange(1, 1, siatka.length, szerokosc).setValues(siatka);

  sformatujSzkielet(ark, uklad, siatka.length, ostatniaKol);
  return ark;
}

/**
 * Etykiety startowe wiersza. Wiersz "wpisywany" (kropki na papierze) ma PUSTĄ
 * kolumnę przedmiotu — inaczej drukowana etykieta zablokowałaby slot i żaden
 * przedmiot nigdy by do niego nie trafił.
 */
function etykietyWiersza(w) {
  if (w.wpisywany) {
    return { kategoria: w.kategoria || w.przedmiot || '', przedmiot: '' };
  }
  return { kategoria: w.kategoria || '', przedmiot: w.przedmiot || '' };
}

function odKropek(wartosc) {
  return wartosc ? wartosc : '……………………………………';
}

function sformatujSzkielet(ark, uklad, liczbaWierszy, ostatniaKol) {
  ark.hideColumns(1);
  ark.setColumnWidth(KOL_KATEGORIA, 160);
  ark.setColumnWidth(KOL_PRZEDMIOT, 240);
  for (var c = KOL_PIERWSZY_MODUL; c <= ostatniaKol; c++) ark.setColumnWidth(c, 58);

  ark.getRange(1, KOL_KATEGORIA, 1, 2).merge().setFontWeight('bold').setFontSize(11);
  ark.getRange(1, KOL_PIERWSZY_MODUL, 1, ostatniaKol - KOL_PIERWSZY_MODUL + 1).merge()
    .setHorizontalAlignment('left');
  ark.getRange(2, KOL_KATEGORIA, 1, 2).merge().setFontWeight('bold');
  ark.getRange(2, KOL_PIERWSZY_MODUL, 1, ostatniaKol - KOL_PIERWSZY_MODUL + 1).merge();
  ark.getRange(4, KOL_KATEGORIA, 2, 2).merge()
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  ark.getRange(4, KOL_PIERWSZY_MODUL, 1, ostatniaKol - KOL_PIERWSZY_MODUL + 1).merge()
    .setFontWeight('bold').setHorizontalAlignment('center');
  ark.getRange(5, KOL_PIERWSZY_MODUL, 1, ostatniaKol - KOL_PIERWSZY_MODUL + 1)
    .setFontWeight('bold').setHorizontalAlignment('center');

  var zakresTabeli = ark.getRange(4, KOL_KATEGORIA, liczbaWierszy - 3, ostatniaKol - 1);
  zakresTabeli.setBorder(true, true, true, true, true, true);
  zakresTabeli.setVerticalAlignment('middle');
  ark.getRange(1, KOL_KATEGORIA, liczbaWierszy, 2).setWrap(true);
  ark.getRange(6, KOL_PIERWSZY_MODUL, liczbaWierszy - 5, ostatniaKol - KOL_PIERWSZY_MODUL + 1)
    .setHorizontalAlignment('center');

  // wiersze sekcji na szaro, przez całą szerokość
  var klucze = ark.getRange(1, 1, liczbaWierszy, 1).getValues();
  for (var r = 0; r < klucze.length; r++) {
    var key = String(klucze[r][0]);
    if (key === MARKER_SEKCJA) {
      ark.getRange(r + 1, KOL_KATEGORIA, 1, ostatniaKol - 1).merge()
        .setBackground('#efefef').setFontWeight('bold').setFontStyle('italic');
    } else if (key === MARKER_UWAGI) {
      ark.getRange(r + 1, KOL_KATEGORIA, 1, ostatniaKol - 1).merge()
        .setBackground('#fff2cc').setFontWeight('bold');
    }
  }
  ark.setFrozenRows(5);
  ark.setFrozenColumns(KOL_PRZEDMIOT);
}

// --- odczyt stanu arkusza ---------------------------------------------------

/** Mapa klucz wiersza -> numer wiersza w arkuszu. */
function indeksWierszy(ark) {
  var wartosci = ark.getRange(1, 1, ark.getLastRow() || 1, 1).getValues();
  var idx = {};
  for (var r = 0; r < wartosci.length; r++) {
    var k = String(wartosci[r][0] || '');
    if (k && k.indexOf('__') !== 0) idx[k] = r + 1;
  }
  return idx;
}

/** Etykiety już wpisane w wierszach "wpisywanych" — do stabilnego przydziału slotów. */
function wczytajEtykiety(ark) {
  var ostatni = ark.getLastRow() || 1;
  var dane = ark.getRange(1, 1, ostatni, KOL_PRZEDMIOT).getValues();
  var etykiety = {};
  dane.forEach(function (w) {
    var key = String(w[0] || '');
    var przedmiot = String(w[KOL_PRZEDMIOT - 1] || '').trim();
    if (key && key.indexOf('__') !== 0 && przedmiot) etykiety[key] = przedmiot;
  });
  return etykiety;
}

/** Numer wiersza markera UWAGI. */
function wierszUwag(ark) {
  var wartosci = ark.getRange(1, 1, ark.getLastRow() || 1, 1).getValues();
  for (var r = 0; r < wartosci.length; r++) {
    if (String(wartosci[r][0]) === MARKER_UWAGI) return r + 1;
  }
  return -1;
}

/**
 * Wstawia dodatkowy wiersz dla klucza rozszerzonego (np. "alternatywne#2")
 * bezpośrednio pod ostatnim wierszem tej samej rodziny.
 */
function wstawWierszRozszerzony(ark, uklad, key, ostatniaKol) {
  var baza = bazowyKlucz(key);
  var idx = indeksWierszy(ark);
  var wiersz = idx[baza];
  if (!wiersz) return -1;
  var n = 2;
  while (idx[baza + '#' + n]) { wiersz = idx[baza + '#' + n]; n++; }

  var wzorzec = null;
  wierszeUkladu(uklad).forEach(function (poz) { if (poz.wiersz.key === baza) wzorzec = poz.wiersz; });

  ark.insertRowAfter(wiersz);
  var nowy = wiersz + 1;
  ark.getRange(nowy, 1).setValue(key);
  ark.getRange(nowy, KOL_KATEGORIA).setValue(wzorzec ? etykietyWiersza(wzorzec).kategoria : '');
  ark.getRange(nowy, KOL_KATEGORIA, 1, ostatniaKol - 1).setBorder(true, true, true, true, true, true);
  ark.getRange(nowy, KOL_PIERWSZY_MODUL, 1, ostatniaKol - KOL_PIERWSZY_MODUL + 1)
    .setHorizontalAlignment('center');
  return nowy;
}

// --- zapis danych -----------------------------------------------------------

/**
 * Wpisuje oceny jednego modułu do arkusza ucznia.
 * Polityka nadpisywania: piszemy tylko do komórki pustej albo zawierającej
 * dokładnie tę samą wartość; różnica jest zgłaszana jako konflikt w uwagach.
 */
function zapiszModul(ss, uklad, kontekst, wynikRoutingu) {
  var ark = ss.getSheetByName(ARKUSZ_WNIOSKU);
  if (!ark) ark = zbudujSzkielet(ss, uklad, kontekst);

  var ostatniaKol = KOL_PIERWSZY_MODUL + uklad.liczbaModulow - 1;
  var kolModulu = KOL_PIERWSZY_MODUL + kontekst.modul - 1;
  var uwagi = wynikRoutingu.uwagi.slice();

  if (kontekst.modul < 1 || kontekst.modul > uklad.liczbaModulow) {
    uwagi.push('Wyliczony moduł ' + kontekst.modul + ' wykracza poza ' + uklad.liczbaModulow +
      ' modułów szkoły ' + uklad.szkola + ' — oceny z pliku "' + kontekst.zrodloNazwa + '" NIE zostały wpisane.');
    dopiszUwagi(ark, uklad, kontekst, uwagi, ostatniaKol);
    return { wpisane: 0, uwagi: uwagi };
  }

  var idx = indeksWierszy(ark);
  var wpisane = 0;

  wynikRoutingu.przypisania.forEach(function (p) {
    var wiersz = idx[p.key];
    if (!wiersz && p.key.indexOf('#') > 0) {
      wiersz = wstawWierszRozszerzony(ark, uklad, p.key, ostatniaKol);
      if (wiersz > 0) idx = indeksWierszy(ark);
    }
    if (!wiersz) {
      uwagi.push('Nie znaleziono wiersza "' + p.key + '" dla przedmiotu "' + p.przedmiot +
        '" (ocena: ' + p.ocena + ') — wpisz ręcznie.');
      return;
    }

    if (p.etykieta) {
      var komorkaNazwy = ark.getRange(wiersz, KOL_PRZEDMIOT);
      var obecna = String(komorkaNazwy.getDisplayValue()).trim();
      if (!obecna) komorkaNazwy.setValue(p.etykieta);
    }

    var przelicz = ocenaNaTekst(p.ocena);
    if (przelicz.uwaga) uwagi.push('„' + p.przedmiot + '”: ' + przelicz.uwaga);
    if (!przelicz.tekst) return;

    var cel = ark.getRange(wiersz, kolModulu);
    var stara = String(cel.getDisplayValue()).trim();
    if (stara === '') {
      cel.setValue(przelicz.tekst);
      wpisane++;
    } else if (stara !== przelicz.tekst) {
      uwagi.push('Konflikt w module ' + RZYMSKIE[kontekst.modul - 1] + ', przedmiot "' + p.przedmiot +
        '": w tabeli jest „' + stara + '”, a plik "' + kontekst.zrodloNazwa + '" podaje „' + przelicz.tekst +
        '”. Zostawiono dotychczasową wartość — popraw ręcznie, jeśli trzeba.');
    }
  });

  if (wynikRoutingu.kierunek) {
    var komorkaKierunku = ark.getRange(1, KOL_PIERWSZY_MODUL);
    var tekstKierunku = uklad.polePozaTabela + ': ' + wynikRoutingu.kierunek;
    if (String(komorkaKierunku.getDisplayValue()).indexOf('…') >= 0 || !komorkaKierunku.getDisplayValue()) {
      komorkaKierunku.setValue(tekstKierunku);
    }
  }

  ark.getRange(2, KOL_PIERWSZY_MODUL).setValue(
    'Uczeń: ' + kontekst.uczen + '   |   Klasa: ' + (kontekst.klasa || '—') + '   |   Rok szkolny: ' + (kontekst.rokSzkolny || '—'));

  dopiszUwagi(ark, uklad, kontekst, uwagi, ostatniaKol);
  return { wpisane: wpisane, uwagi: uwagi };
}

/** Dopisuje datowany blok uwag pod tabelą (najnowszy na górze bloku UWAGI). */
function dopiszUwagi(ark, uklad, kontekst, uwagi, ostatniaKol) {
  var wU = wierszUwag(ark);
  if (wU < 0) return;

  var stempel = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
  var naglowek = '▸ ' + stempel + ' — plik: ' + kontekst.zrodloNazwa +
    ', moduł ' + RZYMSKIE[kontekst.modul - 1] + ' (' +
    (kontekst.typKlasyfikacji === 'srodroczna' ? 'klasyfikacja śródroczna' : 'klasyfikacja roczna') + ')';

  var linie = [[naglowek]];
  if (uwagi.length) {
    uwagi.forEach(function (u) { linie.push(['    • ' + u]); });
  } else {
    linie.push(['    • brak uwag — wszystkie oceny z pliku trafiły do tabeli']);
  }

  ark.insertRowsAfter(wU, linie.length);
  var blok = ark.getRange(wU + 1, KOL_KATEGORIA, linie.length, ostatniaKol - 1);
  blok.breakApart();
  ark.getRange(wU + 1, KOL_KATEGORIA, linie.length, 1).setValues(linie);
  blok.mergeAcross().setWrap(true).setVerticalAlignment('top').setFontSize(9);
  ark.getRange(wU + 1, KOL_KATEGORIA).setFontWeight('bold');

  var nadmiar = ark.getLastRow() - (wU + MAX_WIERSZY_UWAG);
  if (nadmiar > 0) ark.deleteRows(wU + MAX_WIERSZY_UWAG + 1, nadmiar);
}

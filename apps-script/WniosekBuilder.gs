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
var KOL_GRUPA = 2;
var KOL_KATEGORIA = 3;
var KOL_PRZEDMIOT = 4;
var KOL_PIERWSZY_MODUL = 5;
var WIERSZ_PIERWSZY_DANYCH = 6;

var MARKER_UWAGI = '__UWAGI__';
var MAX_WIERSZY_UWAG = 300;

var KOLOR_RAMKI = '#000000';
var KOLOR_SIATKI = '#b7b7b7';

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

/**
 * Ciągłe zakresy modułów objętych i nieobjętych przedmiotem.
 * Pozwala narysować ramki kilkoma wywołaniami zamiast jednego na komórkę.
 * Funkcja czysta — testowana lokalnie.
 */
function zakresyModulow(wiersz, liczbaModulow) {
  var grube = [];
  var kropkowane = [];
  var biezacy = null;
  for (var m = 1; m <= liczbaModulow; m++) {
    var wZakresie = modulWZakresie(wiersz, m);
    if (biezacy && biezacy.wZakresie === wZakresie) {
      biezacy.do_ = m;
    } else {
      biezacy = { od: m, do_: m, wZakresie: wZakresie };
      (wZakresie ? grube : kropkowane).push(biezacy);
    }
  }
  var uprosc = function (lista) {
    return lista.map(function (z) { return [z.od, z.do_]; });
  };
  return { grube: uprosc(grube), kropkowane: uprosc(kropkowane) };
}

/**
 * Rysuje ramki modułów w jednym wierszu: gruba dla modułów objętych przedmiotem,
 * kropkowana dla pozostałych — tak jak na papierowym formularzu.
 */
function ramkiModulow(ark, wiersz, definicja, liczbaModulow) {
  var zakresy = zakresyModulow(definicja, liczbaModulow);
  var style = SpreadsheetApp.BorderStyle;
  zakresy.grube.forEach(function (z) {
    ark.getRange(wiersz, KOL_PIERWSZY_MODUL + z[0] - 1, 1, z[1] - z[0] + 1)
      .setBorder(true, true, true, true, true, null, KOLOR_RAMKI, style.SOLID_MEDIUM);
  });
  zakresy.kropkowane.forEach(function (z) {
    ark.getRange(wiersz, KOL_PIERWSZY_MODUL + z[0] - 1, 1, z[1] - z[0] + 1)
      .setBorder(true, true, true, true, true, null, KOLOR_SIATKI, style.DOTTED);
  });
}

/** Buduje pustą tabelę zgodną z układem formularza. */
function zbudujSzkielet(ss, uklad, kontekst) {
  var ark = ss.getSheetByName(ARKUSZ_WNIOSKU) || ss.insertSheet(ARKUSZ_WNIOSKU, 0);
  ark.clear();
  var domyslny = ss.getSheetByName('Arkusz1') || ss.getSheetByName('Sheet1');
  if (domyslny && domyslny.getSheetId() !== ark.getSheetId()) ss.deleteSheet(domyslny);

  var n = uklad.liczbaModulow;
  var ostatniaKol = KOL_PIERWSZY_MODUL + n - 1;
  var wiersze = [];
  var pusty = function () { var r = []; for (var i = 0; i < ostatniaKol; i++) r.push(''); return r; };
  var ustaw = function (r, kol, v) { r[kol - 1] = v; return r; };

  var w1 = ustaw(pusty(), 1, '__TYTUL__');
  ustaw(w1, KOL_GRUPA, 'ZREALIZOWANY MATERIAŁ PROGRAMOWY');
  ustaw(w1, KOL_PIERWSZY_MODUL, uklad.polePozaTabela + ': ' + odKropek(kontekst.kierunek));
  wiersze.push(w1);

  var w2 = ustaw(pusty(), 1, '__PODTYTUL__');
  ustaw(w2, KOL_GRUPA, opisUcznia(kontekst));
  wiersze.push(w2);

  wiersze.push(pusty());

  var w4 = ustaw(pusty(), 1, '__NAGLOWEK1__');
  ustaw(w4, KOL_GRUPA, uklad.naglowekSzkoly);
  ustaw(w4, KOL_PRZEDMIOT, 'Przedmiot nauczania');
  ustaw(w4, KOL_PIERWSZY_MODUL, 'Zrealizowane moduły (ocena słownie)');
  wiersze.push(w4);

  var w5 = ustaw(pusty(), 1, '__NAGLOWEK2__');
  for (var i = 0; i < n; i++) ustaw(w5, KOL_PIERWSZY_MODUL + i, RZYMSKIE[i]);
  wiersze.push(w5);

  // Scalenia kolumn B i C wyliczamy przy budowaniu wierszy.
  var scaleniaGrup = [];
  var scaleniaPodgrup = [];
  var grupaOtwarta = null;
  uklad.sekcje.forEach(function (sekcja) {
    var pierwszy = wiersze.length + 1;
    if (sekcja.grupa) {
      grupaOtwarta = { od: pierwszy, do_: pierwszy, tekst: sekcja.grupa, scalKolumny: !!sekcja.scalKolumny };
      scaleniaGrup.push(grupaOtwarta);
    }
    sekcja.wiersze.forEach(function (w) {
      var e = etykietyWiersza(w);
      var r = ustaw(pusty(), 1, w.key);
      ustaw(r, KOL_KATEGORIA, sekcja.podgrupa ? '' : e.kategoria);
      ustaw(r, KOL_PRZEDMIOT, e.przedmiot);
      wiersze.push(r);
    });
    var ostatni = wiersze.length;
    if (grupaOtwarta) grupaOtwarta.do_ = ostatni;
    if (sekcja.grupa) wiersze[pierwszy - 1][KOL_GRUPA - 1] = sekcja.grupa;
    if (sekcja.podgrupa) {
      wiersze[pierwszy - 1][KOL_KATEGORIA - 1] = sekcja.podgrupa;
      scaleniaPodgrup.push({ od: pierwszy, do_: ostatni });
    }
  });

  wiersze.push(pusty());
  wiersze.push(ustaw(ustaw(pusty(), 1, MARKER_UWAGI), KOL_GRUPA, 'UWAGI — pozycje wymagające sprawdzenia'));

  ark.getRange(1, 1, wiersze.length, ostatniaKol).setValues(wiersze);
  sformatujSzkielet(ark, uklad, wiersze.length, ostatniaKol, scaleniaGrup, scaleniaPodgrup);
  return ark;
}

function opisUcznia(kontekst) {
  return 'Uczeń: ' + kontekst.uczen +
    '   |   Klasa: ' + (kontekst.klasa || '—') +
    '   |   Rok szkolny: ' + (kontekst.rokSzkolny || '—');
}

function sformatujSzkielet(ark, uklad, liczbaWierszy, ostatniaKol, scaleniaGrup, scaleniaPodgrup) {
  var style = SpreadsheetApp.BorderStyle;
  ark.hideColumns(1);
  ark.setColumnWidth(KOL_GRUPA, 34);
  ark.setColumnWidth(KOL_KATEGORIA, 34);
  ark.setColumnWidth(KOL_PRZEDMIOT, 250);
  for (var c = KOL_PIERWSZY_MODUL; c <= ostatniaKol; c++) ark.setColumnWidth(c, 60);

  var szerModulow = ostatniaKol - KOL_PIERWSZY_MODUL + 1;

  ark.getRange(1, KOL_GRUPA, 1, KOL_PRZEDMIOT - KOL_GRUPA + 1).merge()
    .setFontWeight('bold').setFontSize(11);
  ark.getRange(1, KOL_PIERWSZY_MODUL, 1, szerModulow).merge().setHorizontalAlignment('left');
  ark.getRange(2, KOL_GRUPA, 1, ostatniaKol - KOL_GRUPA + 1).merge().setHorizontalAlignment('left');

  ark.getRange(4, KOL_GRUPA, 2, KOL_KATEGORIA - KOL_GRUPA + 1).merge()
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  ark.getRange(4, KOL_PRZEDMIOT, 2, 1).merge()
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  ark.getRange(4, KOL_PIERWSZY_MODUL, 1, szerModulow).merge()
    .setFontWeight('bold').setHorizontalAlignment('center');
  ark.getRange(5, KOL_PIERWSZY_MODUL, 1, szerModulow)
    .setFontWeight('bold').setHorizontalAlignment('center');
  ark.getRange(4, KOL_GRUPA, 2, ostatniaKol - KOL_GRUPA + 1)
    .setBorder(true, true, true, true, true, true, KOLOR_RAMKI, style.SOLID);

  // Kolumny opisowe: scalenia pionowe grup i podgrup, tekst pionowy jak na papierze.
  scaleniaGrup.forEach(function (z) {
    var szer = z.scalKolumny ? (KOL_KATEGORIA - KOL_GRUPA + 1) : 1;
    var zakres = ark.getRange(z.od, KOL_GRUPA, z.do_ - z.od + 1, szer);
    zakres.merge().setTextRotation(90)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFontStyle('italic').setBackground('#efefef').setWrap(true);
  });
  scaleniaPodgrup.forEach(function (z) {
    ark.getRange(z.od, KOL_KATEGORIA, z.do_ - z.od + 1, 1).merge().setTextRotation(90)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFontStyle('italic').setBackground('#efefef').setWrap(true);
  });
  ark.getRange(WIERSZ_PIERWSZY_DANYCH, KOL_KATEGORIA, liczbaWierszy - WIERSZ_PIERWSZY_DANYCH + 1, 1)
    .setFontSize(9);

  // Ramki wierszy danych: opis solidny, moduły wg zakresu z formularza.
  var klucze = ark.getRange(1, 1, liczbaWierszy, 1).getValues();
  for (var r = 0; r < klucze.length; r++) {
    var key = String(klucze[r][0]);
    if (!key || key.indexOf('__') === 0) continue;
    var wiersz = r + 1;
    ark.getRange(wiersz, KOL_GRUPA, 1, KOL_PRZEDMIOT - KOL_GRUPA + 1)
      .setBorder(true, true, true, true, true, null, KOLOR_RAMKI, style.SOLID);
    ark.getRange(wiersz, KOL_PRZEDMIOT).setWrap(true).setVerticalAlignment('middle');
    ramkiModulow(ark, wiersz, wierszPoKluczu(uklad, key), uklad.liczbaModulow);
  }

  var wU = wierszUwag(ark);
  if (wU > 0) {
    ark.getRange(wU, KOL_GRUPA, 1, ostatniaKol - KOL_GRUPA + 1).merge()
      .setBackground('#fff2cc').setFontWeight('bold');
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
  ark.getRange(nowy, KOL_GRUPA, 1, KOL_PRZEDMIOT - KOL_GRUPA + 1)
    .setBorder(true, true, true, true, true, null, KOLOR_RAMKI, SpreadsheetApp.BorderStyle.SOLID);
  ark.getRange(nowy, KOL_PIERWSZY_MODUL, 1, ostatniaKol - KOL_PIERWSZY_MODUL + 1)
    .setHorizontalAlignment('center');
  ramkiModulow(ark, nowy, wzorzec, uklad.liczbaModulow);
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

    // Formularz zaznacza grubą ramką, które moduły obejmuje dany przedmiot.
    // Ocena poza tym zakresem nie jest gubiona, ale wymaga sprawdzenia.
    var definicja = wierszPoKluczu(uklad, p.key);
    if (CONFIG.OSTRZEGAJ_O_MODULE_POZA_ZAKRESEM && !modulWZakresie(definicja, kontekst.modul)) {
      uwagi.push('Przedmiot „' + p.przedmiot + '” ma ocenę w module ' + RZYMSKIE[kontekst.modul - 1] +
        ', a formularz przewiduje dla tego wiersza moduły ' +
        (definicja && definicja.moduly ? definicja.moduly.map(function (m) { return RZYMSKIE[m - 1]; }).join(', ') : '—') +
        '. Ocena została wpisana — sprawdź, czy trafiła we właściwy wiersz.');
    }

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

  ark.getRange(2, KOL_GRUPA).setValue(opisUcznia(kontekst));

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
  var blok = ark.getRange(wU + 1, KOL_GRUPA, linie.length, ostatniaKol - KOL_GRUPA + 1);
  blok.breakApart();
  ark.getRange(wU + 1, KOL_GRUPA, linie.length, 1).setValues(linie);
  blok.mergeAcross().setWrap(true).setVerticalAlignment('top').setFontSize(9);
  ark.getRange(wU + 1, KOL_GRUPA).setFontWeight('bold');

  var nadmiar = ark.getLastRow() - (wU + MAX_WIERSZY_UWAG);
  if (nadmiar > 0) ark.deleteRows(wU + MAX_WIERSZY_UWAG + 1, nadmiar);
}

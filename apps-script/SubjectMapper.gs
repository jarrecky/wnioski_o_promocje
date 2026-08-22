/**
 * Routing: nazwa przedmiotu z CSV -> wiersz tabeli wniosku.
 * Funkcje czyste (bez API Google) — testowane lokalnie w tests/run.js.
 */

/**
 * Normalizacja nazwy przedmiotu: małe litery, bez polskich znaków, bez sufiksów
 * szkoły ("SLO", "SLSP", "ALA"), bez oznaczenia klasy ("kl. 2") i bez interpunkcji.
 *   "Rzeźba SLO"                -> "rzezba"
 *   "biologia R kl. 2"          -> "biologia r"
 *   "Tutorial - nauki ścisłe"   -> "tutorial nauki scisle"
 *
 * Usunięcie "kl. N" jest istotne: ta sama pozycja nazywa się w kolejnych latach
 * "biologia R kl. 2", "biologia R kl. 3" itd., a musi trafiać do tego samego wiersza.
 */
function normalizujNazwe(nazwa) {
  return String(nazwa == null ? '' : nazwa)
    .toLowerCase()
    .replace(/[ą]/g, 'a').replace(/[ć]/g, 'c').replace(/[ę]/g, 'e')
    .replace(/[ł]/g, 'l').replace(/[ń]/g, 'n').replace(/[ó]/g, 'o')
    .replace(/[ś]/g, 's').replace(/[żź]/g, 'z')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(slo|slsp|ala)\b/g, ' ')
    .replace(/\bkl\s+\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nazwa do wpisania w kropkowaną komórkę — bez oznaczenia klasy, reszta bez zmian. */
function wyczyscNazwe(nazwa) {
  return String(nazwa == null ? '' : nazwa)
    .replace(/\s*\bkl\.?\s*\d+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Czy przedmiot jest rozszerzeniem. W planie lekcji i w Librusie rozszerzenia
 * mają samodzielne wielkie "R": "biologia R kl. 2", "język polski R kl. 3".
 */
function czyRozszerzenie(nazwa) {
  return /(?:^|\s)R(?=\s|$)/.test(String(nazwa == null ? '' : nazwa));
}

/** Czy nazwa zaczyna się od któregoś ze znanych prefiksów (np. "fakultet", "tutorial"). */
function maPrefiks(nazwaZnorm, prefiksy) {
  for (var i = 0; i < prefiksy.length; i++) {
    var p = normalizujNazwe(prefiksy[i]);
    if (nazwaZnorm === p || nazwaZnorm.indexOf(p + ' ') === 0) return true;
  }
  return false;
}

function bazowyKlucz(key) {
  return String(key).split('#')[0];
}

/** Mapa: znormalizowany alias -> klucz wiersza (tylko wiersze o stałej nazwie). */
function indeksAliasow(uklad) {
  var idx = {};
  wierszeUkladu(uklad).forEach(function (poz) {
    var w = poz.wiersz;
    (w.aliasy || []).forEach(function (a) {
      idx[normalizujNazwe(a)] = w.key;
    });
    if (w.przedmiot && !w.przyjmuje) idx[normalizujNazwe(w.przedmiot)] = w.key;
  });
  return idx;
}

/** Wiersze układu przyjmujące dany rodzaj przedmiotu, w kolejności formularza. */
function slotyDla(uklad, rodzaj) {
  var out = [];
  wierszeUkladu(uklad).forEach(function (poz) {
    if (poz.wiersz.przyjmuje === rodzaj) out.push(poz.wiersz);
  });
  return out;
}

function dopasujKierunek(nazwaZnorm, tabela) {
  for (var i = 0; i < tabela.length; i++) {
    for (var j = 0; j < tabela[i].aliasy.length; j++) {
      if (normalizujNazwe(tabela[i].aliasy[j]) === nazwaZnorm) return tabela[i];
    }
  }
  return null;
}

function naLiscie(nazwaZnorm, lista) {
  for (var i = 0; i < lista.length; i++) {
    if (normalizujNazwe(lista[i]) === nazwaZnorm) return true;
  }
  return false;
}

/**
 * Przydział przedmiotów do wierszy "wpisywanych" (kropki na papierze).
 * Jeżeli przedmiot był już wpisany w poprzednim semestrze, wraca do TEGO SAMEGO
 * wiersza — dzięki temu kolumny modułów układają się w spójny wiersz historii.
 */
function PrzydzialSlotow(uklad, opcje) {
  this.uklad = uklad;
  this.istniejace = (opcje && opcje.istniejaceEtykiety) || {};
  this.zajete = {};   // key -> nazwa przedmiotu przypisana w tym przebiegu
  var self = this;
  Object.keys(this.istniejace).forEach(function (k) {
    if (self.istniejace[k]) self.zajete[k] = null; // slot zarezerwowany etykietą z pliku
  });
}

/** Zwraca klucz wiersza dla przedmiotu albo null, gdy zabrakło miejsc. */
PrzydzialSlotow.prototype.przydziel = function (rodzaj, nazwaPrzedmiotu) {
  var znorm = normalizujNazwe(nazwaPrzedmiotu);
  var sloty = slotyDla(this.uklad, rodzaj);
  var self = this;

  // 1. ten sam przedmiot z poprzedniego semestru -> ten sam wiersz
  var dopasowany = null;
  Object.keys(this.istniejace).forEach(function (key) {
    if (dopasowany) return;
    var pasujeRodzaj = sloty.some(function (s) { return s.key === bazowyKlucz(key); });
    if (pasujeRodzaj && normalizujNazwe(self.istniejace[key]) === znorm) dopasowany = key;
  });
  if (dopasowany) { this.zajete[dopasowany] = nazwaPrzedmiotu; return dopasowany; }

  // 2. pierwszy wolny wiersz tego rodzaju
  for (var i = 0; i < sloty.length; i++) {
    var k = sloty[i].key;
    if (!(k in this.zajete)) { this.zajete[k] = nazwaPrzedmiotu; return k; }
  }

  // 3. wiersz rozszerzalny -> dołóż kolejny
  if (CONFIG.EXPAND_WRITEIN_ROWS) {
    for (var j = 0; j < sloty.length; j++) {
      if (!sloty[j].rozszerzalny) continue;
      var n = 2;
      while ((sloty[j].key + '#' + n) in this.zajete) n++;
      var nowy = sloty[j].key + '#' + n;
      this.zajete[nowy] = nazwaPrzedmiotu;
      return nowy;
    }
  }
  return null;
};

/**
 * Główna funkcja routingu.
 *
 * @param {Object} uklad      UKLAD_SLO albo UKLAD_SLSP
 * @param {Array}  oceny      [{ przedmiot, ocena }] w kolejności kolumn CSV
 * @param {Object} opcje      { istniejaceEtykiety: {key: nazwa}, istniejacyKierunek: string }
 * @return {{przypisania: Array, kierunek: ?string, uwagi: Array<string>}}
 */
function przypiszPrzedmioty(uklad, oceny, opcje) {
  opcje = opcje || {};
  var aliasy = indeksAliasow(uklad);
  var tabelaKierunkow = uklad.szkola === 'SLSP' ? SPECJALIZACJE_SLSP : KIERUNKI_SLO;
  var nazwaPola = uklad.polePozaTabela; // "kierunek" / "specjalizacja"

  var uwagi = [];
  var przypisania = [];
  var przydzial = new PrzydzialSlotow(uklad, opcje);

  var jezyki = [];
  var rozszerzenia = [];
  var kandydaciKierunku = [];
  var alternatywne = [];
  var doWierszaStalego = []; // { key, wpis }

  // --- klasyfikacja wstępna ------------------------------------------------
  // Kolejność ma znaczenie: rozszerzenia sprawdzamy przed językami, bo
  // "język polski R" jest rozszerzeniem, a nie drugim językiem obcym.
  oceny.forEach(function (poz) {
    var znorm = normalizujNazwe(poz.przedmiot);
    if (!znorm) return;

    if (naLiscie(znorm, POZA_FORMULARZEM)) {
      uwagi.push('Przedmiot "' + poz.przedmiot + '" (ocena: ' + poz.ocena + ') nie ma wiersza na wniosku — nie został wpisany do tabeli.');
      return;
    }
    if (czyRozszerzenie(poz.przedmiot)) { rozszerzenia.push(poz); return; }
    if (aliasy[znorm]) { doWierszaStalego.push({ key: aliasy[znorm], wpis: poz }); return; }
    if (/^jezyk\s/.test(znorm)) { jezyki.push(poz); return; }
    if (znorm === 'etyka' || znorm === 'religia') {
      doWierszaStalego.push({ key: 'religia_etyka', wpis: poz, etykieta: poz.przedmiot });
      return;
    }
    if (maPrefiks(znorm, PREFIKSY_ALTERNATYWNE)) { alternatywne.push(poz); return; }

    var k = dopasujKierunek(znorm, tabelaKierunkow);
    if (k) { kandydaciKierunku.push({ wpis: poz, kierunek: k }); return; }

    alternatywne.push(poz);
  });

  function dodaj(key, wpis, etykieta) {
    przypisania.push({
      key: key,
      etykieta: etykieta ? wyczyscNazwe(etykieta) : null,
      przedmiot: wpis.przedmiot,
      ocena: wpis.ocena
    });
  }

  // --- wiersze o stałej nazwie --------------------------------------------
  var uzyteStale = {};
  doWierszaStalego.forEach(function (x) {
    if (uzyteStale[x.key]) {
      uwagi.push('Do wiersza "' + x.key + '" pasuje więcej niż jeden przedmiot: "' + uzyteStale[x.key] +
        '" oraz "' + x.wpis.przedmiot + '". Wpisano pierwszy, drugi wymaga ręcznego umieszczenia (ocena: ' + x.wpis.ocena + ').');
      return;
    }
    uzyteStale[x.key] = x.wpis.przedmiot;
    dodaj(x.key, x.wpis, x.etykieta);
  });

  // --- języki --------------------------------------------------------------
  var podstawowe = jezyki.filter(function (j) { return naLiscie(normalizujNazwe(j.przedmiot), JEZYKI_PODSTAWOWE); });
  var wybranyPodstawowy = null;
  if (podstawowe.length === 1) {
    wybranyPodstawowy = podstawowe[0];
  } else if (podstawowe.length > 1) {
    var posort = podstawowe.slice().sort(function (a, b) {
      return normalizujNazwe(a.przedmiot).localeCompare(normalizujNazwe(b.przedmiot));
    });
    wybranyPodstawowy = posort[0];
    uwagi.push('Uczeń ma oceny z więcej niż jednego języka podstawowego (' +
      podstawowe.map(function (j) { return j.przedmiot; }).join(', ') +
      '). Do wiersza podstawowego wpisano "' + wybranyPodstawowy.przedmiot +
      '" (pierwszy alfabetycznie), pozostałe trafiły do zajęć zindywidualizowanych — sprawdź.');
  } else if (jezyki.length) {
    uwagi.push('Brak oceny z języka angielskiego lub niemieckiego — wiersz "język angielski/niemiecki" pozostaje pusty.');
  }

  jezyki.forEach(function (j) {
    var rodzaj = (j === wybranyPodstawowy) ? 'jezyk_podstawowy' : 'jezyk_dodatkowy';
    var key = przydzial.przydziel(rodzaj, j.przedmiot);
    if (!key) {
      uwagi.push('Zabrakło miejsca na język "' + j.przedmiot + '" (ocena: ' + j.ocena + ') — wpisz ręcznie.');
      return;
    }
    dodaj(key, j, j.przedmiot);
  });

  // --- kierunek / specjalizacja -------------------------------------------
  var kierunek = opcje.istniejacyKierunek || null;
  var etykietaKierunkowa = opcje.istniejaceEtykiety && (opcje.istniejaceEtykiety.kierunkowe || opcje.istniejaceEtykiety.specjalizacja_art);

  if (kandydaciKierunku.length === 1) {
    var kand = kandydaciKierunku[0];
    if (etykietaKierunkowa && normalizujNazwe(etykietaKierunkowa) !== normalizujNazwe(kand.wpis.przedmiot)) {
      uwagi.push('W tabeli jest już ' + nazwaPola + ' oparty na przedmiocie "' + etykietaKierunkowa +
        '", a w tym pliku pojawia się "' + kand.wpis.przedmiot + '" (ocena: ' + kand.wpis.ocena +
        '). Nowy przedmiot wpisano do zajęć alternatywnych — sprawdź, który jest właściwy.');
      kand.wpis.znanyKierunkowy = true;
      alternatywne.push(kand.wpis);
    } else {
      var keyK = przydzial.przydziel('kierunek', kand.wpis.przedmiot);
      if (keyK) {
        dodaj(keyK, kand.wpis, kand.wpis.przedmiot);
        kierunek = kand.kierunek.nazwa;
      } else {
        uwagi.push('Nie udało się wpisać przedmiotu kierunkowego "' + kand.wpis.przedmiot + '" — wpisz ręcznie.');
      }
    }
  } else if (kandydaciKierunku.length > 1) {
    uwagi.push('Nie da się jednoznacznie ustalić pola "' + nazwaPola + '" — pasuje kilka przedmiotów: ' +
      kandydaciKierunku.map(function (k) { return k.wpis.przedmiot + ' (' + k.kierunek.nazwa + ')'; }).join(', ') +
      '. Pole pozostawiono puste, a oceny trafiły do zajęć alternatywnych.');
    kandydaciKierunku.forEach(function (k) { k.wpis.znanyKierunkowy = true; alternatywne.push(k.wpis); });
  }

  // --- rozszerzenia ("R") -> zaj. rozszerzone -------------------------------
  rozszerzenia.forEach(function (r) {
    var key = przydzial.przydziel('rozszerzenie', r.przedmiot);
    if (!key) {
      uwagi.push('Brak wolnego wiersza "zaj. rozszerzone" dla rozszerzenia "' + r.przedmiot + '" (ocena: ' + r.ocena +
        '). Na SLSP wiersz "I zaj. rozszerz." jest zarezerwowany dla historii sztuki — wpisz ręcznie.');
      return;
    }
    dodaj(key, r, r.przedmiot);
  });

  // --- pozostałe -> zaj. alternatywne --------------------------------------
  alternatywne.forEach(function (a) {
    var key = przydzial.przydziel('alternatywne', a.przedmiot);
    if (!key) {
      uwagi.push('Brak wolnego wiersza "zaj. alternatywne" dla "' + a.przedmiot + '" (ocena: ' + a.ocena + ') — wpisz ręcznie.');
      return;
    }
    dodaj(key, a, a.przedmiot);
    // Przedmiot rozpoznany jako kierunkowy ma już własną uwagę o niejednoznaczności
    // — nie dublujemy jej komunikatem "nie ma na znanej liście".
    var aZnorm = normalizujNazwe(a.przedmiot);
    if (!a.znanyKierunkowy && !naLiscie(aZnorm, ZAJECIA_ALTERNATYWNE) && !maPrefiks(aZnorm, PREFIKSY_ALTERNATYWNE)) {
      uwagi.push('Przedmiotu "' + a.przedmiot + '" nie ma na żadnej znanej liście — wpisano go do "zaj. alternatywne". ' +
        'Jeśli to błąd, popraw listy w Config.gs.');
    }
  });

  return { przypisania: przypisania, kierunek: kierunek, uwagi: uwagi };
}

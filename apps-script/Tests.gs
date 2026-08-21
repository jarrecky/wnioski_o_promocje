/**
 * Testy wbudowane — uruchamiane z edytora Apps Script (funkcja uruchomTesty)
 * albo z menu "Wnioski ▸ Uruchom testy wbudowane".
 * Sprawdzają logikę parsowania i routingu; nie dotykają Dysku ani arkuszy.
 *
 * Ten sam zestaw reguł jest testowany lokalnie przez `node tests/run.js`.
 */

var FIXTURE_CSV = [
  'Klasyfikacja roczna;;;;;;;;',
  ';;;;;;;;',
  'Klasa 2o SLO;;;;;;;;',
  'Rok szkolny 2025/2026;;;;;;;;',
  ';;;;;;;;',
  'Nr;Nazwisko i imię;Zachowanie;Nazwy zajęć edukacyjnych;;;;;Liczby ocen',
  ';;;Historia;Język angielski;Tutorial - nauki ścisłe;Fotografia SLO;Zajęcia z wychowawcą;',
  '1;Nowak Anna;wzorowe;5;4;3;6;zal;',
  '2;;dobre;;;;;;',
  ';;;;;;;;',
  'Liczby ocen;;;;;;;;'
].join('\n');

function uruchomTesty() {
  var zaliczone = 0;
  var bledy = [];

  function ok(nazwa, warunek, szczegol) {
    if (warunek) { zaliczone++; return; }
    bledy.push(nazwa + (szczegol ? ' — ' + szczegol : ''));
  }
  function eq(nazwa, otrzymano, oczekiwano) {
    ok(nazwa, otrzymano === oczekiwano, 'oczekiwano ' + JSON.stringify(oczekiwano) + ', otrzymano ' + JSON.stringify(otrzymano));
  }
  function wgKlucza(wynik) {
    var m = {};
    wynik.przypisania.forEach(function (p) { m[p.key] = p; });
    return m;
  }

  // --- parsowanie ---------------------------------------------------------
  var dane = parsujKlasyfikacje(FIXTURE_CSV, 'fixture.csv');
  eq('szkoła', dane.meta.szkola, 'SLO');
  eq('klasa', dane.meta.klasa, 2);
  eq('typ klasyfikacji', dane.meta.typKlasyfikacji, 'roczna');
  eq('moduł (klasa 2, roczna)', dane.meta.modul, 4);
  eq('liczba przedmiotów', dane.przedmioty.length, 5);
  eq('liczba uczniów z nazwiskiem', dane.uczniowie.length, 1);
  eq('nazwisko', dane.uczniowie[0].nazwisko, 'Nowak Anna');
  eq('liczba ocen', dane.uczniowie[0].oceny.length, 5);

  // --- moduły -------------------------------------------------------------
  eq('moduł 1o śródroczna', numerModulu(1, 'srodroczna'), 1);
  eq('moduł 3o śródroczna', numerModulu(3, 'srodroczna'), 5);
  eq('moduł 4o roczna', numerModulu(4, 'roczna'), 8);
  eq('moduł 5o roczna (SLSP)', numerModulu(5, 'roczna'), 10);

  // --- oceny opisowe ------------------------------------------------------
  eq('6 -> cel', ocenaNaTekst('6').tekst, 'cel');
  eq('5 -> bdb', ocenaNaTekst('5').tekst, 'bdb');
  eq('4 -> db', ocenaNaTekst('4').tekst, 'db');
  eq('3 -> dst', ocenaNaTekst('3').tekst, 'dst');
  eq('2 -> dop', ocenaNaTekst('2').tekst, 'dop');
  eq('1 -> ndst', ocenaNaTekst('1').tekst, 'ndst');
  eq('zal przepisane', ocenaNaTekst('zal').tekst, 'zal');

  // --- routing SLO --------------------------------------------------------
  var SLO = pobierzUklad('SLO');
  var rSLO = przypiszPrzedmioty(SLO, dane.uczniowie[0].oceny, {});
  var kSLO = wgKlucza(rSLO);
  eq('historia', kSLO.historia.ocena, '5');
  eq('angielski -> wiersz podstawowy', kSLO.jezyk_podstawowy.przedmiot, 'Język angielski');
  eq('tutorial -> I zaj. rozszerzone', kSLO.rozszerzone_1.przedmiot, 'Tutorial - nauki ścisłe');
  eq('kierunek', rSLO.kierunek, 'fotografia');
  ok('zajęcia z wychowawcą tylko w uwagach',
    rSLO.uwagi.join(' ').indexOf('wychowawc') >= 0 && !kSLO.alternatywne);

  // --- routing SLSP -------------------------------------------------------
  var SLSP = pobierzUklad('SLSP');
  eq('SLSP ma 10 modułów', SLSP.liczbaModulow, 10);
  eq('SLSP: jeden slot na tutoriale', slotyDla(SLSP, 'tutorial').length, 1);
  var rSLSP = przypiszPrzedmioty(SLSP, [
    { przedmiot: 'Historia sztuki', ocena: '5' },
    { przedmiot: 'Wizaż', ocena: '4' }
  ], {});
  eq('SLSP: specjalizacja', rSLSP.kierunek, 'charakteryzacja i wizaż');
  eq('SLSP: historia sztuki', wgKlucza(rSLSP).historia_sztuki.ocena, '5');

  // --- stabilność slotów między semestrami --------------------------------
  var rStab = przypiszPrzedmioty(SLO, [{ przedmiot: 'Ceramika', ocena: '5' }], {
    istniejaceEtykiety: { alternatywne: 'Gotuj i jedz', 'alternatywne#2': 'Ceramika' }
  });
  eq('przedmiot wraca do swojego wiersza', wgKlucza(rStab)['alternatywne#2'].przedmiot, 'Ceramika');

  var podsumowanie = 'Zaliczone: ' + zaliczone + ', błędy: ' + bledy.length +
    (bledy.length ? '\n' + bledy.join('\n') : '');
  Logger.log(podsumowanie);
  try {
    SpreadsheetApp.getUi().alert(bledy.length ? 'Testy: BŁĘDY' : 'Testy: OK', podsumowanie, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* uruchomiono spoza arkusza — wynik jest w logu */ }
  return podsumowanie;
}

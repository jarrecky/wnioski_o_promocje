/**
 * Definicja układu tabeli ze strony 2 wniosku o promowanie.
 * Ten plik PEŁNI ROLĘ SZABLONU — nie ma osobnych pustych plików wzorcowych.
 *
 * Wiersz:
 *   key          - stabilny identyfikator (zapisywany w ukrytej kolumnie A,
 *                  dzięki temu kolejny semestr trafia do właściwego wiersza)
 *   kategoria    - etykieta w wąskiej kolumnie (jak na papierze, np. "I zaj. rozszerzone")
 *   przedmiot    - stała nazwa przedmiotu w szerokiej kolumnie
 *   aliasy       - nazwy z CSV, które mają trafić do tego wiersza
 *   wpisywany    - true, jeżeli na papierze są tu kropki (miejsce do wpisania nazwy)
 *   przyjmuje    - reguła routingu: 'jezyk_podstawowy' | 'jezyk_dodatkowy' |
 *                  'religia_etyka' | 'kierunek' | 'tutorial' | 'alternatywne'
 *   rozszerzalny - można dołożyć kolejne wiersze tego typu (patrz EXPAND_WRITEIN_ROWS)
 */

var WIERSZE_OGOLNOKSZTALCACE = [
  { key: 'filozofia',            przedmiot: 'filozofia',            aliasy: ['filozofia'] },
  { key: 'historia',             przedmiot: 'historia',             aliasy: ['historia'] },
  { key: 'edukacja_obywatelska', przedmiot: 'edukacja obywatelska', aliasy: ['edukacja obywatelska', 'wiedza o społeczeństwie', 'wos'] },
  { key: 'biznes_i_zarzadzanie', przedmiot: 'biznes i zarządzanie', aliasy: ['biznes i zarządzanie', 'podstawy przedsiębiorczości'] },
  { key: 'geografia',            przedmiot: 'geografia',            aliasy: ['geografia'] },
  { key: 'biologia',             przedmiot: 'biologia',             aliasy: ['biologia'] },
  { key: 'chemia',               przedmiot: 'chemia',               aliasy: ['chemia'] },
  { key: 'fizyka',               przedmiot: 'fizyka',               aliasy: ['fizyka'] },
  { key: 'informatyka',          przedmiot: 'informatyka',          aliasy: ['informatyka'] },
  { key: 'edb',                  przedmiot: 'edukacja dla bezpieczeństwa', aliasy: ['edukacja dla bezpieczeństwa', 'edb'] }
];

var UKLAD_SLO = {
  szkola: 'SLO',
  naglowekSzkoly: 'SLO\n(4-letnie)',
  polePozaTabela: 'kierunek',
  liczbaModulow: 8,
  sekcje: [
    {
      tytul: 'zajęcia objęte szkolnym planem nauki (poziom podstawowy)',
      wiersze: [
        { key: 'jezyk_polski',        przedmiot: 'język polski', aliasy: ['język polski'] },
        { key: 'jezyk_podstawowy',    przedmiot: 'język angielski/niemiecki', wpisywany: true, przyjmuje: 'jezyk_podstawowy' },
        { key: 'matematyka',          przedmiot: 'matematyka', aliasy: ['matematyka'] },
        { key: 'wychowanie_fizyczne', przedmiot: 'wychowanie fizyczne', aliasy: ['wychowanie fizyczne', 'wf'] },
        { key: 'religia_etyka',       przedmiot: 'religia/etyka', przyjmuje: 'religia_etyka' },
        { key: 'kierunkowe',          kategoria: 'kierunkowe zajęcia artyst./akad.', wpisywany: true, przyjmuje: 'kierunek' }
      ]
    },
    {
      tytul: 'zajęcia objęte zindywidualizowanym planem nauki — zajęcia ogólnokształcące',
      wiersze: [
        { key: 'jezyk_dodatkowy', przedmiot: 'język angielski/niemiecki/francuski', wpisywany: true, przyjmuje: 'jezyk_dodatkowy', rozszerzalny: true }
      ].concat(WIERSZE_OGOLNOKSZTALCACE).concat([
        { key: 'rozszerzone_1', kategoria: 'I zaj. rozszerzone',  wpisywany: true, przyjmuje: 'tutorial' },
        { key: 'rozszerzone_2', kategoria: 'II zaj. rozszerzone', wpisywany: true, przyjmuje: 'tutorial' },
        { key: 'alternatywne',  kategoria: 'zaj. alternatywne',   wpisywany: true, przyjmuje: 'alternatywne', rozszerzalny: true },
        { key: 'doradztwo',     kategoria: 'doradztwo zawodowe',  wpisywany: true, aliasy: ['doradztwo zawodowe', 'doradztwo'] }
      ])
    }
  ]
};

var UKLAD_SLSP = {
  szkola: 'SLSP',
  naglowekSzkoly: 'SLSP\n(5-letnie)',
  polePozaTabela: 'specjalizacja',
  liczbaModulow: 10,
  sekcje: [
    {
      tytul: 'zajęcia objęte szkolnym planem nauki (poziom podstawowy)',
      wiersze: [
        { key: 'jezyk_polski',        przedmiot: 'język polski', aliasy: ['język polski'] },
        { key: 'jezyk_podstawowy',    przedmiot: 'język angielski/niemiecki', wpisywany: true, przyjmuje: 'jezyk_podstawowy' },
        { key: 'matematyka',          przedmiot: 'matematyka', aliasy: ['matematyka'] },
        { key: 'wychowanie_fizyczne', przedmiot: 'wychowanie fizyczne', aliasy: ['wychowanie fizyczne', 'wf'] },
        { key: 'religia_etyka',       przedmiot: 'religia/etyka', przyjmuje: 'religia_etyka' },
        { key: 'specjalizacja_art',   kategoria: 'specjaliz. artystyczna', wpisywany: true, przyjmuje: 'kierunek' },
        { key: 'rysunek_i_malarstwo', przedmiot: 'rysunek i malarstwo', aliasy: ['rysunek i malarstwo'] }
      ]
    },
    {
      tytul: 'zajęcia objęte zindywidualizowanym planem nauki — zajęcia ogólnokształcące',
      wiersze: [
        { key: 'jezyk_dodatkowy', przedmiot: 'język angielski/niemiecki/francuski', wpisywany: true, przyjmuje: 'jezyk_dodatkowy', rozszerzalny: true }
      ].concat(WIERSZE_OGOLNOKSZTALCACE).concat([
        { key: 'alternatywne',  kategoria: 'zaj. alternat.',    wpisywany: true, przyjmuje: 'alternatywne', rozszerzalny: true },
        { key: 'rozszerzone_2', kategoria: 'II zaj. rozszerz.', wpisywany: true, przyjmuje: 'tutorial' }
      ])
    },
    {
      // Uwaga: "I zaj. rozszerz." jest na papierze zarezerwowane dla historii sztuki,
      // dlatego tutoriale na SLSP mają do dyspozycji tylko "II zaj. rozszerz.".
      tytul: 'zajęcia objęte zindywidualizowanym planem nauki — zajęcia artystyczne',
      wiersze: [
        { key: 'historia_sztuki',       kategoria: 'I zaj. rozszerz.', przedmiot: 'historia sztuki', aliasy: ['historia sztuki'] },
        { key: 'podstawy_fot_i_filmu',  przedmiot: 'podstawy fotografii i filmu', aliasy: ['podstawy fotografii i filmu'] },
        { key: 'projekt_multimedialne', przedmiot: 'projektowanie multimedialne', aliasy: ['projektowanie multimedialne'] },
        { key: 'podstawy_projektowania',przedmiot: 'podstawy projektowania', aliasy: ['podstawy projektowania'] },
        { key: 'plener',                przedmiot: 'plener', aliasy: ['plener'] },
        { key: 'rzezba',                przedmiot: 'rzeźba', aliasy: ['rzeźba'] },
        { key: 'doradztwo',             przedmiot: 'doradztwo zawodowe', aliasy: ['doradztwo zawodowe', 'doradztwo'] },
        { key: 'specjalizacja_tutorial',przedmiot: 'specjalizacja artystyczna - tutorial', aliasy: ['specjalizacja artystyczna - tutorial', 'specjalizacja artystyczna tutorial'] }
      ]
    }
  ]
};

/** Rzymskie numery modułów używane w nagłówku tabeli. */
var RZYMSKIE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function pobierzUklad(szkola) {
  if (szkola === 'SLSP') return UKLAD_SLSP;
  if (szkola === 'SLO') return UKLAD_SLO;
  throw new Error('Nieznana szkoła: ' + szkola + ' (oczekiwano SLO albo SLSP)');
}

/** Wszystkie wiersze układu, spłaszczone, z zachowaniem kolejności i sekcji. */
function wierszeUkladu(uklad) {
  var out = [];
  uklad.sekcje.forEach(function (sekcja) {
    sekcja.wiersze.forEach(function (w) {
      out.push({ sekcja: sekcja.tytul, wiersz: w });
    });
  });
  return out;
}

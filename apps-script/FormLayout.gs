/**
 * Definicja układu tabeli ze strony 2 wniosku o promowanie.
 * Ten plik PEŁNI ROLĘ SZABLONU — nie ma osobnych pustych plików wzorcowych.
 *
 * Kolumny arkusza:
 *   A  ukryta, klucz wiersza      C  podgrupa / kategoria wiersza
 *   B  grupa (scalona pionowo)    D  przedmiot nauczania       E+  moduły
 *
 * Sekcja:
 *   grupa        - etykieta kolumny B; null = kontynuacja scalenia z poprzedniej sekcji
 *   podgrupa     - etykieta kolumny C scalona na całą sekcję; null = kategoria per wiersz
 *   scalKolumny  - true, gdy na papierze etykieta grupy zajmuje obie wąskie kolumny
 *
 * Wiersz:
 *   key          - stabilny identyfikator (zapisywany w ukrytej kolumnie A,
 *                  dzięki temu kolejny semestr trafia do właściwego wiersza)
 *   kategoria    - etykieta kolumny C dla tego jednego wiersza (np. "I zaj. rozszerzone")
 *   przedmiot    - stała nazwa przedmiotu w kolumnie D
 *   aliasy       - nazwy z CSV, które mają trafić do tego wiersza
 *   wpisywany    - true, jeżeli na papierze są tu kropki (miejsce do wpisania nazwy)
 *   przyjmuje    - reguła routingu: 'jezyk_podstawowy' | 'jezyk_dodatkowy' |
 *                  'religia_etyka' | 'kierunek' | 'rozszerzenie' | 'alternatywne'
 *   rozszerzalny - można dołożyć kolejne wiersze tego typu (patrz EXPAND_WRITEIN_ROWS)
 *   moduly       - numery modułów, które przedmiot obejmuje. Na papierze zaznaczone
 *                  GRUBĄ ramką (moduły poza zakresem mają ramkę kropkowaną).
 *                  Odczytane wprost z PDF-ów przez narzedzia/wyciagnij-moduly.py.
 */

/** Pomocnik: zakres(3, 7) -> [3, 4, 5, 6, 7]. */
function zakres(od, do_) {
  var out = [];
  for (var i = od; i <= do_; i++) out.push(i);
  return out;
}

/** Wiersze ogólnokształcące — identyczne w obu formularzach, łącznie z zakresami modułów. */
function wierszeOgolnoksztalcace() {
  return [
    { key: 'filozofia',            przedmiot: 'filozofia',            aliasy: ['filozofia'], moduly: zakres(1, 3) },
    { key: 'historia',             przedmiot: 'historia',             aliasy: ['historia'], moduly: zakres(1, 8) },
    { key: 'edukacja_obywatelska', przedmiot: 'edukacja obywatelska', aliasy: ['edukacja obywatelska', 'wiedza o społeczeństwie', 'wos'], moduly: zakres(3, 7) },
    { key: 'biznes_i_zarzadzanie', przedmiot: 'biznes i zarządzanie', aliasy: ['biznes i zarządzanie', 'podstawy przedsiębiorczości'], moduly: zakres(3, 5) },
    { key: 'geografia',            przedmiot: 'geografia',            aliasy: ['geografia'], moduly: zakres(1, 7) },
    { key: 'biologia',             przedmiot: 'biologia',             aliasy: ['biologia'], moduly: zakres(1, 7) },
    { key: 'chemia',               przedmiot: 'chemia',               aliasy: ['chemia'], moduly: zakres(1, 7) },
    { key: 'fizyka',               przedmiot: 'fizyka',               aliasy: ['fizyka'], moduly: zakres(1, 7) },
    { key: 'informatyka',          przedmiot: 'informatyka',          aliasy: ['informatyka'], moduly: zakres(3, 6) },
    { key: 'edb',                  przedmiot: 'edukacja dla bezpieczeństwa', aliasy: ['edukacja dla bezpieczeństwa', 'edb'], moduly: zakres(1, 3) }
  ];
}

var UKLAD_SLO = {
  szkola: 'SLO',
  naglowekSzkoly: 'SLO (4-letnie)',
  polePozaTabela: 'kierunek',
  liczbaModulow: 8,
  sekcje: [
    {
      grupa: 'zajęcia objęte szkolnym planem nauki (poziom podstawowy)',
      podgrupa: null,
      scalKolumny: true,
      wiersze: [
        { key: 'jezyk_polski',        przedmiot: 'język polski', aliasy: ['język polski'], moduly: zakres(1, 8) },
        { key: 'jezyk_podstawowy',    przedmiot: 'język angielski/niemiecki', wpisywany: true, przyjmuje: 'jezyk_podstawowy', moduly: zakres(1, 8) },
        { key: 'matematyka',          przedmiot: 'matematyka', aliasy: ['matematyka'], moduly: zakres(1, 8) },
        { key: 'wychowanie_fizyczne', przedmiot: 'wychowanie fizyczne', aliasy: ['wychowanie fizyczne', 'wf'], moduly: zakres(1, 8) },
        { key: 'religia_etyka',       przedmiot: 'religia/etyka', przyjmuje: 'religia_etyka', moduly: zakres(1, 8) },
        { key: 'kierunkowe',          kategoria: 'kierunkowe zajęcia artyst./akad.', wpisywany: true, przyjmuje: 'kierunek', moduly: zakres(1, 8) }
      ]
    },
    {
      grupa: 'zajęcia objęte zindywidualizowanym planem nauki',
      podgrupa: 'zajęcia ogólnokształcące',
      wiersze: [
        { key: 'jezyk_dodatkowy', przedmiot: 'język angielski/niemiecki/francuski', wpisywany: true, przyjmuje: 'jezyk_dodatkowy', rozszerzalny: true, moduly: zakres(1, 7) }
      ].concat(wierszeOgolnoksztalcace())
    },
    {
      grupa: null,
      podgrupa: null,
      wiersze: [
        { key: 'rozszerzone_1', kategoria: 'I zaj. rozszerzone',  wpisywany: true, przyjmuje: 'rozszerzenie', moduly: zakres(3, 8) },
        { key: 'rozszerzone_2', kategoria: 'II zaj. rozszerzone', wpisywany: true, przyjmuje: 'rozszerzenie', moduly: zakres(3, 8) },
        { key: 'alternatywne',  kategoria: 'zaj. alternatywne',   wpisywany: true, przyjmuje: 'alternatywne', rozszerzalny: true, moduly: zakres(3, 7) },
        { key: 'doradztwo',     kategoria: 'doradztwo zawodowe',  wpisywany: true, aliasy: ['doradztwo zawodowe', 'doradztwo'], moduly: zakres(4, 7) }
      ]
    }
  ]
};

var UKLAD_SLSP = {
  szkola: 'SLSP',
  naglowekSzkoly: 'SLSP (5-letnie)',
  polePozaTabela: 'specjalizacja',
  liczbaModulow: 10,
  sekcje: [
    {
      grupa: 'zajęcia objęte szkolnym planem nauki',
      podgrupa: '(poziom podstawowy)',
      wiersze: [
        { key: 'jezyk_polski',        przedmiot: 'język polski', aliasy: ['język polski'], moduly: zakres(1, 9) },
        { key: 'jezyk_podstawowy',    przedmiot: 'język angielski/niemiecki', wpisywany: true, przyjmuje: 'jezyk_podstawowy', moduly: zakres(1, 9) },
        { key: 'matematyka',          przedmiot: 'matematyka', aliasy: ['matematyka'], moduly: zakres(1, 9) },
        { key: 'wychowanie_fizyczne', przedmiot: 'wychowanie fizyczne', aliasy: ['wychowanie fizyczne', 'wf'], moduly: zakres(1, 10) },
        { key: 'religia_etyka',       przedmiot: 'religia/etyka', przyjmuje: 'religia_etyka', moduly: zakres(1, 9) }
      ]
    },
    {
      grupa: null,
      podgrupa: null,
      wiersze: [
        { key: 'specjalizacja_art',   kategoria: 'specjaliz. artystyczna', wpisywany: true, przyjmuje: 'kierunek', moduly: zakres(3, 10) },
        { key: 'rysunek_i_malarstwo', przedmiot: 'rysunek i malarstwo', aliasy: ['rysunek i malarstwo'], moduly: zakres(1, 10) }
      ]
    },
    {
      grupa: 'zajęcia objęte zindywidualizowanym planem nauki',
      podgrupa: 'zajęcia ogólnokształcące',
      wiersze: [
        { key: 'jezyk_dodatkowy', przedmiot: 'język angielski/niemiecki/francuski', wpisywany: true, przyjmuje: 'jezyk_dodatkowy', rozszerzalny: true, moduly: zakres(1, 7) }
      ].concat(wierszeOgolnoksztalcace())
    },
    {
      // "I zaj. rozszerz." jest na papierze zarezerwowane dla historii sztuki,
      // dlatego rozszerzeniom na SLSP zostaje tylko "II zaj. rozszerz.".
      grupa: null,
      podgrupa: null,
      wiersze: [
        { key: 'alternatywne',    kategoria: 'zaj. alternat.',    wpisywany: true, przyjmuje: 'alternatywne', rozszerzalny: true, moduly: zakres(5, 7) },
        { key: 'rozszerzone_2',   kategoria: 'II zaj. rozszerz.', wpisywany: true, przyjmuje: 'rozszerzenie', moduly: zakres(3, 9) },
        { key: 'historia_sztuki', kategoria: 'I zaj. rozszerz.',  przedmiot: 'historia sztuki', aliasy: ['historia sztuki'], moduly: zakres(3, 9) }
      ]
    },
    {
      grupa: null,
      podgrupa: 'zajęcia artystyczne',
      wiersze: [
        { key: 'podstawy_fot_i_filmu',   przedmiot: 'podstawy fotografii i filmu', aliasy: ['podstawy fotografii i filmu'], moduly: zakres(1, 7) },
        { key: 'projekt_multimedialne',  przedmiot: 'projektowanie multimedialne', aliasy: ['projektowanie multimedialne'], moduly: zakres(5, 10) },
        { key: 'podstawy_projektowania', przedmiot: 'podstawy projektowania', aliasy: ['podstawy projektowania'], moduly: zakres(1, 7) },
        { key: 'plener',                 przedmiot: 'plener', aliasy: ['plener'], moduly: zakres(3, 4) },
        { key: 'rzezba',                 przedmiot: 'rzeźba', aliasy: ['rzeźba'], moduly: zakres(1, 8) },
        { key: 'doradztwo',              przedmiot: 'doradztwo zawodowe', aliasy: ['doradztwo zawodowe', 'doradztwo'], moduly: zakres(4, 7) },
        { key: 'specjalizacja_tutorial', przedmiot: 'specjalizacja artystyczna - tutorial', aliasy: ['specjalizacja artystyczna - tutorial', 'specjalizacja artystyczna tutorial'], moduly: zakres(7, 10) }
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
      out.push({ sekcja: sekcja, wiersz: w });
    });
  });
  return out;
}

/** Czy dany moduł mieści się w zakresie przewidzianym dla wiersza. */
function modulWZakresie(wiersz, modul) {
  if (!wiersz || !wiersz.moduly) return true;
  return wiersz.moduly.indexOf(modul) >= 0;
}

/** Definicja wiersza po kluczu (także dla kluczy rozszerzonych "alternatywne#2"). */
function wierszPoKluczu(uklad, key) {
  var baza = String(key).split('#')[0];
  var out = null;
  wierszeUkladu(uklad).forEach(function (poz) { if (poz.wiersz.key === baza) out = poz.wiersz; });
  return out;
}

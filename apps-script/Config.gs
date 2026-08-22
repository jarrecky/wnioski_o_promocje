/**
 * Konfiguracja generatora wniosków o promowanie (ALA: SLO + SLSP).
 *
 * To jedyny plik, który normalnie trzeba edytować po zmianie oferty przedmiotów.
 * Nazwy przedmiotów porównywane są po normalizacji (małe litery, bez polskich
 * znaków, bez sufiksów "SLO"/"SLSP"/"ALA", bez interpunkcji) — patrz
 * normalizujNazwe() w SubjectMapper.gs. Aliasy można więc pisać naturalnie.
 */

var CONFIG = {
  /** Folder, do którego wrzucane są eksporty CSV z Librusa. */
  INPUT_FOLDER_ID: 'WKLEJ_ID_FOLDERU_WEJSCIOWEGO',

  /** Folder, w którym powstają arkusze wniosków (po jednym na ucznia). */
  OUTPUT_FOLDER_ID: 'WKLEJ_ID_FOLDERU_WYJSCIOWEGO',

  /** Podfolder archiwum tworzony wewnątrz folderu wejściowego. */
  ARCHIVE_FOLDER_NAME: 'Przetworzone',

  /** Czy po każdym przebiegu tworzyć zbiorczy raport w folderze wyjściowym. */
  CREATE_RUN_REPORT: true,

  /**
   * Gdy do jednego wiersza "wpisywanego" (kropki na papierowym formularzu)
   * trafia więcej przedmiotów niż jest miejsc — dołóż kolejne wiersze w tej
   * samej sekcji zamiast gubić dane. Zawsze dopisywana jest też uwaga.
   */
  EXPAND_WRITEIN_ROWS: true,

  /** Przenosić przetworzone pliki CSV do archiwum. */
  ARCHIVE_PROCESSED: true,

  TIMEZONE: 'Europe/Warsaw'
};

/** Oceny cyfrowe -> skróty opisowe używane na wniosku. */
var GRADE_TEXT = {
  '6': 'cel',
  '5': 'bdb',
  '4': 'db',
  '3': 'dst',
  '2': 'dop',
  '1': 'ndst'
};

/** Wartości nieliczbowe przepisywane do wniosku bez zmian. */
var GRADE_PASSTHROUGH = ['zal', 'nzal', 'zw', 'nb', 'nkl', 'np'];

/** Wartości oznaczające brak oceny — komórka pomijana. */
var GRADE_EMPTY = ['', '-', '—', 'brak'];

/**
 * Kierunki SLO. `aliasy` to nazwy tak, jak potrafią wystąpić w kolumnach CSV
 * z Librusa. Jeżeli uczeń ma ocenę z DOKŁADNIE JEDNEGO przedmiotu pasującego do
 * tej tabeli, staje się on kierunkiem ucznia (nagłówek "kierunek ..." oraz
 * wiersz "kierunkowe zajęcia artyst./akad."). Zero lub więcej niż jedno
 * dopasowanie => kierunek pusty + uwaga pod tabelą.
 */
var KIERUNKI_SLO = [
  { nazwa: 'film',                  aliasy: ['film'] },
  { nazwa: 'fotografia',            aliasy: ['fotografia'] },
  { nazwa: 'grafika projektowa',    aliasy: ['grafika projektowa'] },
  { nazwa: 'kreacja muzyczna',      aliasy: ['kreacja muzyczna'] },
  { nazwa: 'kreacja plastyczna',    aliasy: ['kreacja plastyczna'] },
  { nazwa: 'stylizacja i kreacja',  aliasy: ['stylizacja i kreacja'] },
  { nazwa: 'teatr',                 aliasy: ['teatr'] },
  // "techniki rzeźbiarkie" — tak (z literówką) figuruje w planie lekcji aSc.
  { nazwa: 'techniki rzeźbiarskie', aliasy: ['techniki rzeźbiarskie', 'techniki rzeźbiarkie'] },
  { nazwa: 'twórcze pisanie',       aliasy: ['twórcze pisanie'] }
];

/** Specjalizacje SLSP — analogicznie do KIERUNKI_SLO. */
var SPECJALIZACJE_SLSP = [
  { nazwa: 'charakteryzacja i wizaż',   aliasy: ['charakteryzacja i wizaż'] },
  { nazwa: 'fotografia artystyczna',    aliasy: ['fotografia artystyczna'] },
  { nazwa: 'projektowanie graficzne',   aliasy: ['projektowanie graficzne'] },
  { nazwa: 'projektowanie przestrzeni', aliasy: ['projektowanie przestrzeni'] },
  { nazwa: 'projektowanie ubioru',      aliasy: ['projektowanie ubioru'] }
];

/**
 * Znane zajęcia alternatywne. Lista zmienia się z roku na rok i NIE musi być
 * kompletna — każdy przedmiot z oceną, którego nie da się przypisać do innego
 * wiersza, i tak trafia do "zaj. alternatywne" (z uwagą pod tabelą).
 * Ta lista służy tylko do tego, żeby znane pozycje nie generowały uwagi.
 */
var ZAJECIA_ALTERNATYWNE = [
  'ceramika',
  'dyskusyjny klub filmowy',
  'gotuj i jedz',
  'latynoamerykańskie inspiracje',
  'poznajemy Wrocław',
  'poznajemy wrocławskie teatry',
  'snycerstwo',
  'zajęcia alternatywnie rozwijające',
  'zyśkaj wiedzę',
  // Na SLO historia sztuki nie ma własnego wiersza (to wiersz SLSP), więc trafia
  // do zajęć alternatywnych. Na SLSP dopasuje się wcześniej do wiersza drukowanego.
  'historia sztuki'
];

/**
 * Przedmioty zaczynające się od tych słów trafiają do "zaj. alternatywne"
 * bez uwagi — to znane rodziny nazw, których pełna lista zmienia się co roku.
 * "tutorial" jest tu świadomie: wiersze "zaj. rozszerzone" należą do
 * przedmiotów rozszerzonych (z dopiskiem "R"), nie do tutoriali.
 */
var PREFIKSY_ALTERNATYWNE = ['fakultet', 'tutorial'];

/**
 * Przedmioty, które w ogóle nie mają wiersza na wniosku. Trafiają wyłącznie do
 * uwag pod tabelą — nigdy nie są po cichu pomijane.
 */
var POZA_FORMULARZEM = [
  'konsultacje ITN',
  'zajęcia z wychowawcą',
  'godzina wychowawcza',
  'edukacja zdrowotna',
  'wychowanie do życia w rodzinie'
];

/** Języki obce rozpoznawane przy podziale na wiersz podstawowy / zindywidualizowany. */
var JEZYKI_PODSTAWOWE = ['jezyk angielski', 'jezyk niemiecki'];

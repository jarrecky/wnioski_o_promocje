# Generator wniosków o promowanie (ALA: SLO + SLSP)

Google Apps Script, który po wrzuceniu eksportu **Klasyfikacja** z Librusa do folderu na
Dysku Google generuje **po jednym arkuszu na ucznia** z tabelą ze **strony 2** wniosku
o promowanie (`ZREALIZOWANY MATERIAŁ PROGRAMOWY`).

Każdy kolejny semestr **dopisuje kolejną kolumnę modułu do tego samego arkusza**, więc
tabela narasta przez cały cykl kształcenia — 8 modułów w SLO (4-letnie), 10 w SLSP (5-letnie).
Arkusze udostępniasz uczniom ręcznie; skrypt niczego nie udostępnia.

Strona 1 wniosku (część opisowa z podpisem) jest poza zakresem tego narzędzia.

## Jak to działa

```
folder wejściowy ──(wyzwalacz co 5 min)──▶ przetworzNowePliki()
   Klasyfikacja.csv                              │
   (Windows-1250, ';')                           ├─ parsujKlasyfikacje()   → szkoła, klasa, typ, uczniowie, oceny
                                                 ├─ przypiszPrzedmioty()   → przedmiot z CSV → wiersz formularza
                                                 └─ zapiszModul()          → wpis do kolumny modułu
                                                            │
   folder wejściowy/Przetworzone/  ◀── archiwum  │          ▼
                                                 folder wyjściowy
                                                   Wniosek_SLO_Nowak_Anna
                                                   Wniosek_SLSP_...
                                                   Raport_wnioski_<data>
```

**Numer modułu** wynika z klasy i typu klasyfikacji:

| Klasa | Klasyfikacja śródroczna | Klasyfikacja roczna |
|:-----:|:-----------------------:|:-------------------:|
| 1 | I | II |
| 2 | III | IV |
| 3 | V | VI |
| 4 | VII | VIII |
| 5 | IX | X *(tylko SLSP)* |

**Oceny** zapisywane są opisowo: `6→cel`, `5→bdb`, `4→db`, `3→dst`, `2→dop`, `1→ndst`.
Wartości nieliczbowe (`zal`, `nb`, `nkl`, `zw`) przepisywane są bez zmian.

## Instalacja

1. Utwórz na Dysku dwa foldery: **wejściowy** (tu lądują CSV z Librusa) i **wyjściowy**
   (tu powstają arkusze uczniów). Skopiuj ich ID z adresu URL
   (`https://drive.google.com/drive/folders/`**`TO_JEST_ID`**).
2. Utwórz projekt na <https://script.google.com> i wklej pliki z katalogu `apps-script/`
   (albo wgraj je przez [clasp](https://github.com/google/clasp): `clasp push`).
3. W `Config.gs` uzupełnij `INPUT_FOLDER_ID` i `OUTPUT_FOLDER_ID`.
4. Uruchom raz `przetworzNowePliki` z edytora i zatwierdź uprawnienia
   (Dysk, Arkusze, wyzwalacze).
5. Uruchom `zainstalujWyzwalacz` — od tej pory folder jest sprawdzany **co 5 minut**.

> Apps Script nie ma wyzwalacza „pojawił się plik w folderze”, dlatego pracujemy na
> wyzwalaczu czasowym. Opóźnienie wynosi do 5 minut. `przetworzNowePliki` można też
> wywołać ręcznie w dowolnej chwili.

Menu `Wnioski` (Przetwórz / Zainstaluj wyzwalacz / Testy) pojawia się, jeśli skrypt
jest powiązany z arkuszem. W projekcie samodzielnym te same funkcje uruchamiasz
z listy funkcji w edytorze.

### Ważne: nie pozwól Dyskowi konwertować CSV

Plik musi zostać wrzucony **jako CSV**, nie jako Arkusz Google. Automatyczna konwersja
psuje kodowanie Windows-1250 i średniki. W ustawieniach Dysku wyłącz
„Konwertuj przesłane pliki na format Dokumentów Google”.

## Gdzie trafiają poszczególne przedmioty

Routing działa **osobno dla każdego ucznia**, tylko na przedmiotach, z których uczeń ma ocenę:

| Przedmiot z CSV | Wiersz formularza |
|---|---|
| `Historia`, `Biologia`, `Matematyka`, … | odpowiedni wiersz o stałej nazwie |
| pierwszy `Język angielski` / `Język niemiecki` | `język angielski/niemiecki` (plan podstawowy) |
| każdy kolejny język | `język angielski/niemiecki/francuski` (plan zindywidualizowany) |
| `Etyka`, `Religia` | `religia/etyka` |
| przedmiot kierunkowy / specjalizacyjny | `kierunkowe zajęcia artyst./akad.` (SLO) lub `specjaliz. artystyczna` (SLSP) — i nagłówek `kierunek:` / `specjalizacja:` |
| przedmiot z dopiskiem **`R`** (biologia R, matematyka R…) | `I zaj. rozszerzone`, potem `II zaj. rozszerzone` (SLO). W SLSP tylko `II zaj. rozszerz.` — `I zaj. rozszerz.` jest zarezerwowane dla *historii sztuki* |
| `Tutorial - …`, `fakultet …`, `historia sztuki` (SLO) | `zaj. alternatywne` |
| wszystko pozostałe z oceną | `zaj. alternatywne` |
| `Zajęcia z wychowawcą`, `Edukacja zdrowotna`, `konsultacje ITN` | brak wiersza na wniosku → **tylko uwaga pod tabelą** |

Nazwy porównywane są po normalizacji: małe litery, bez polskich znaków, bez sufiksów
`SLO`/`SLSP`/`ALA`, bez oznaczenia klasy (`kl. 2`) i bez interpunkcji:
`Rzeźba SLO` = `rzezba`, `biologia R kl. 2` = `biologia r`. Pominięcie `kl. N` jest
konieczne, bo ta sama pozycja nazywa się w kolejnych latach `biologia R kl. 2`,
`biologia R kl. 3` — a musi trafiać do tego samego wiersza. Dzięki temu skrypt
**nie opiera się na sztywnej liście** i znosi zmiany nazw z roku na rok.

**Kierunek / specjalizacja** jest wykrywany automatycznie: jeżeli uczeń ma ocenę
z **dokładnie jednego** przedmiotu pasującego do tabeli `KIERUNKI_SLO` /
`SPECJALIZACJE_SLSP`, ten przedmiot trafia do wiersza kierunkowego, a jego nazwa do
nagłówka. Zero albo kilka dopasowań → pole zostaje puste, a oceny idą do zajęć
alternatywnych z uwagą pod tabelą. Skrypt nigdy nie zgaduje kierunku „na siłę”.

## Blok UWAGI

Pod tabelą, w każdym arkuszu, jest datowany blok `UWAGI` z listą wszystkiego, czego
skrypt nie potrafił rozstrzygnąć — to jest miejsce, w które trzeba zajrzeć po każdym
przebiegu. Trafiają tam m.in.:

- przedmioty bez wiersza na wniosku (`Zajęcia z wychowawcą`, `Edukacja zdrowotna`),
- przedmioty przypisane automatycznie do zajęć alternatywnych, których nie ma na żadnej znanej liście,
- niejednoznaczny kierunek/specjalizacja (kilku kandydatów),
- brak wolnego wiersza `zaj. rozszerzone` (np. drugi tutorial w SLSP),
- uczeń z ocenami z dwóch języków podstawowych,
- **konflikty**: gdy w komórce modułu jest już inna ocena niż w nowym pliku,
- moduł spoza zakresu szkoły (np. moduł IX dla SLO),
- nierozpoznane wartości ocen.

Każdy przebieg dopisuje własny blok (z datą i nazwą pliku źródłowego), więc historia
jest zachowana. Zbiorcze zestawienie z całego przebiegu trafia dodatkowo do pliku
`Raport_wnioski_<data>` w folderze wyjściowym.

## Zasady zapisu

- **Nadpisywanie:** skrypt pisze tylko do komórki **pustej** albo zawierającej
  **dokładnie tę samą wartość**. Inna wartość zostaje nietknięta i jest zgłoszona jako
  konflikt. Poprawkę wprowadza się ręcznie (albo czyszcząc komórkę przed ponownym wrzutem).
- **Idempotencja:** ten sam plik źródłowy nie zostanie wczytany dwa razy — ID
  przetworzonych plików pamiętane są w `PropertiesService` oraz w ukrytym arkuszu `_meta`.
- **Wiersze „wpisywane”** (kropki na papierze) pamiętają, jaki przedmiot w nich siedzi,
  więc w kolejnym semestrze ten sam przedmiot wraca do **tego samego wiersza**.
- Gdy przedmiotów jest więcej niż miejsc (np. trzy zajęcia alternatywne), skrypt
  **dokłada kolejne wiersze** w tej samej sekcji zamiast gubić dane
  (`CONFIG.EXPAND_WRITEIN_ROWS`).
- Ukryta kolumna A trzyma klucz wiersza — nie usuwaj jej, to po niej skrypt trafia
  do właściwego wiersza w kolejnym semestrze.

## Co edytować, gdy zmienia się oferta przedmiotów

Wszystko w **`Config.gs`**:

| Zmiana | Co poprawić |
|---|---|
| nowe zajęcia alternatywne | `ZAJECIA_ALTERNATYWNE` (lista tylko wycisza uwagę — nieznane zajęcia i tak trafią do właściwego wiersza) |
| nowy kierunek / inna nazwa w Librusie | `KIERUNKI_SLO` / `SPECJALIZACJE_SLSP` — dopisz alias |
| przedmiot, którego nie ma na wniosku | `POZA_FORMULARZEM` |
| inne skróty ocen | `GRADE_TEXT` |

Struktura samej tabeli (wiersze, sekcje, liczba modułów) siedzi w **`FormLayout.gs`** —
ten plik pełni rolę szablonu, nie ma osobnych pustych plików wzorcowych.

Nazwy kierunków i specjalizacji pochodzą z `Plan_lekcji_2025-2026.pdf` — tak, jak
funkcjonują w szkole. Pełny rejestr ustaleń (łącznie z tymi, które straciły ważność)
jest w [`DECYZJE.md`](DECYZJE.md).

> **Do potwierdzenia po pierwszym prawdziwym eksporcie:** przyjęto, że Librus będzie
> podawał nazwy przedmiotów tak jak plan lekcji. Dotychczasowy `Klasyfikacja.csv` to
> wersja robocza i używa innych nazw (`Fotografia SLO`, `Warsztaty muzyczne`, `Wizaż`).
> Te, które po odcięciu sufiksu zgadzają się z planem, zadziałają; pozostałe wpadną do
> `zaj. alternatywne` z uwagą — skrypt nigdy nie wpisze błędnego kierunku.

## Uruchomienie na próbę, bez konta Google

```bash
npm run przyklady   # generuje dwa przykładowe eksporty z Librusa do przyklady/
npm run demo        # uruchamia skrypt na tych plikach, wyniki w przyklady/wynik/
```

`npm run demo` wykonuje **prawdziwą** funkcję `przetworzNowePliki()` z `Main.gs` —
podstawione są wyłącznie usługi Google (Dysk, Arkusze, Właściwości), a nie logika.
Wrzuca po kolei klasyfikację śródroczną i roczną klasy 4o SLO, więc widać, jak
kolumny modułów **VII** i **VIII** narastają w tym samym arkuszu.

Wyniki zapisywane są w dwóch postaciach: `.xlsx` (do otwarcia w Arkuszach/Excelu)
oraz `.csv` (czytelny w gicie). Zegar jest zamrożony, żeby powtórne uruchomienie
dawało identyczny wynik.

Przykładowe pliki obejmują sytuacje, które warto zobaczyć: ucznia z dwoma
przedmiotami kierunkowymi (kierunek zostaje pusty + uwaga), ucznia z dwoma językami
podstawowymi, oceny niedostateczne, fakultety i rozszerzenia „R".

## Testy

```bash
npm test                   # oba zestawy naraz
node tests/run.js          # parsowanie CSV + routing przedmiotów (na prawdziwym Klasyfikacja.csv)
node tests/integration.js  # warstwa arkusza: szkielet, narastanie modułów, konflikty
```

Testy działają lokalnie w Node — ładują pliki `.gs` do kontekstu `vm` i podstawiają
pamięciową namiastkę `SpreadsheetApp` (`tests/sheets-mock.js`). Nie wymagają konta Google.

Ten sam zestaw reguł można uruchomić w Apps Script funkcją `uruchomTesty`
(menu `Wnioski ▸ Uruchom testy wbudowane`).

## Pliki

| Plik | Rola |
|---|---|
| `apps-script/Config.gs` | jedyny plik do rutynowej edycji: ID folderów, listy przedmiotów, skróty ocen |
| `apps-script/FormLayout.gs` | struktura tabeli SLO i SLSP (szablon) |
| `apps-script/CsvParser.gs` | odczyt eksportu z Librusa *(funkcje czyste)* |
| `apps-script/SubjectMapper.gs` | routing: przedmiot → wiersz *(funkcje czyste)* |
| `apps-script/WniosekBuilder.gs` | budowa i aktualizacja arkusza ucznia |
| `apps-script/Main.gs` | skanowanie folderu, wyzwalacz, raport |
| `apps-script/Tests.gs` | testy uruchamiane wewnątrz Apps Script |
| `DECYZJE.md` | dziennik decyzji: wszystkie pytania o zasady i udzielone odpowiedzi, z zaznaczeniem unieważnionych |
| `Klasyfikacja.csv` | przykładowy eksport z Librusa (dane testowe) |
| `narzedzia/generuj-przyklady.py` | generator przykładowych eksportów z Librusa (zmyślone dane uczniów) |
| `narzedzia/uruchom-lokalnie.js` | uruchomienie `przetworzNowePliki()` lokalnie, na namiastkach usług Google |
| `przyklady/` | dwa przykładowe eksporty CSV i wyniki ich przetworzenia (`przyklady/wynik/`) |
| `Plan_lekcji_2025-2026.pdf` | plan lekcji z aSc — lista przedmiotów dla każdej klasy; źródło nazw przedmiotów (str. 1–5: SLSP kl. 1–5, str. 6–9: SLO kl. 1–4) |
| `SLO_wniosek.pdf`, `SLSP_wniosek.pdf` | oryginalne formularze — źródło struktury tabeli |

## Ograniczenia

- Jeden plik CSV = jedna klasa = jeden moduł. Skrypt nie rekonstruuje modułów wstecz —
  historia buduje się od pierwszego wrzuconego pliku.
- Uczniowie rozpoznawani są po nazwisku i imieniu (nazwa pliku
  `Wniosek_<SZKOŁA>_<Nazwisko_Imię>`). Zmiana nazwiska ucznia wymaga ręcznej zmiany
  nazwy arkusza, inaczej powstanie nowy plik.
- Wiersze eksportu bez nazwiska (eksport zanonimizowany) są pomijane i raportowane.
- Skrypt nie ustawia parametrów wydruku — przed drukowaniem wybierz orientację poziomą
  i „dopasuj do szerokości”.

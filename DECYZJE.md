# Dziennik decyzji

Rejestr wszystkich pytań o zasady wypełniania wniosku i udzielonych odpowiedzi.
Służy do tego, żeby po czasie dało się sprawdzić, **dlaczego** skrypt działa tak,
a nie inaczej — i które ustalenia straciły ważność.

Kolumna **Status**: `aktualna` — obowiązuje; `unieważniona` — zastąpiona
późniejszą decyzją (zostaje w rejestrze dla historii).

Każda decyzja ma odnośnik do miejsca w kodzie, które ją realizuje.

---

## Runda 1 — kształt rozwiązania (przed opisem zadania)

Na tym etapie nie było jeszcze opisu dziedziny; odpowiedź brzmiała „brak
preferencji", więc wybory należą do mnie i zostały potwierdzone dopiero
w kolejnych rundach.

| # | Pytanie | Decyzja | Status |
|---|---|---|---|
| 1.1 | Co ma powstawać z wrzuconego CSV? | Jeden arkusz Google na ucznia, z tabelą ze **strony 2** wniosku | aktualna |
| 1.2 | Jak uruchamiać skrypt po wrzuceniu pliku? | Wyzwalacz czasowy co 5 min (Apps Script nie ma zdarzenia „plik w folderze") | aktualna |
| 1.3 | Jak głęboko przetwarzać oceny? | Zamiana na opis + wpis do właściwej kolumny modułu | aktualna |
| 1.4 | Którzy uczniowie trafiają do wyniku? | Wszyscy z eksportu, którzy mają nazwisko | aktualna |

---

## Runda 2 — podstawowe zasady (po opisie zadania)

| # | Pytanie | Decyzja | Status |
|---|---|---|---|
| 2.1 | Jak rozpoznać ucznia w kolejnym semestrze? | Po nazwie pliku: `Wniosek_<SZKOŁA>_<Nazwisko_Imię>`, wyszukiwanej w folderze wyjściowym | aktualna |
| 2.2 | Skąd wziąć kierunek (SLO) / specjalizację (SLSP)? | Wykrywany automatycznie: jeżeli uczeń ma ocenę z **dokładnie jednego** przedmiotu z tabeli kierunków. Zero lub kilka → pole puste + uwaga | aktualna |
| 2.3 | Który język idzie do wiersza podstawowego? | Pierwszy angielski **albo** niemiecki. Każdy kolejny język → wiersz zindywidualizowany. Gdy uczeń ma oba i brak francuskiego → pierwszy alfabetycznie + uwaga | aktualna |
| 2.4 | Gdzie trafiają tutoriale (`Tutorial - nauki ścisłe` itp.)? | Do wierszy `I zaj. rozszerzone` / `II zaj. rozszerzone` | **unieważniona** przez 5.1 |

---

## Runda 3 — przedmioty artystyczne, oceny, nadpisywanie

| # | Pytanie | Decyzja | Status |
|---|---|---|---|
| 3.1 | Gdzie idą warsztaty i przedmioty artystyczne spoza kierunku ucznia? | Do `zaj. alternatywne`; nadmiar → kolejne dołożone wiersze + uwaga | aktualna |
| 3.2 | Co z przedmiotami bez wiersza na wniosku? | `Etyka`/`Religia` → wiersz `religia/etyka`. `Zajęcia z wychowawcą` i `Edukacja zdrowotna` → **tylko uwaga** pod tabelą, nigdy po cichu pominięte | aktualna |
| 3.3 | Jakie skróty ocen? | Standardowe: `6 cel`, `5 bdb`, `4 db`, `3 dst`, `2 dop`, `1 ndst`. Wartości nieliczbowe (`zal`, `nb`, `nkl`, `zw`) przepisywane bez zmian | aktualna |
| 3.4 | Co, gdy komórka modułu ma już ocenę? | Zapis tylko do komórki **pustej** albo o **identycznej** wartości. Inna wartość → zostaje nietknięta i zgłoszona jako konflikt | aktualna |

> **Sprostowanie do 3.3.** W pierwotnej liście padło „2 – dost". W standardowej
> skali `3` to *dostateczny* (dst), a `2` to *dopuszczający* (dop) — i tak też
> nazywa je blok podsumowań w samym eksporcie z Librusa. Przyjęto `2 → dop`.

---

## Runda 4 — zajęcia alternatywne

| # | Pytanie | Decyzja | Status |
|---|---|---|---|
| 4.1 | Pełna lista zajęć alternatywnych | ceramika, dyskusyjny klub filmowy, gotuj i jedz, latynoamerykańskie inspiracje, poznajemy Wrocław, poznajemy wrocławskie teatry, snycerstwo, zajęcia alternatywnie rozwijające, zyśkaj wiedzę | aktualna |
| 4.2 | Czy lista musi być kompletna? | Nie. Zmienia się co roku, więc służy tylko do **wyciszenia uwagi** — nieznany przedmiot i tak trafia do `zaj. alternatywne` | aktualna |

Wniosek z 4.1: `snycerstwo` jest zajęciem alternatywnym, a **nie** kierunkiem
*techniki rzeźbiarskie*.

---

## Runda 5 — po otrzymaniu planu lekcji 2025/2026

Plan (`Plan_lekcji_2025-2026.pdf`, aSc, str. 1–5 SLSP kl. 1–5, str. 6–9 SLO kl. 1–4)
pokazał nazwy przedmiotów tak, jak funkcjonują w szkole.

| # | Pytanie | Decyzja | Status |
|---|---|---|---|
| 5.1 | Przedmioty z dopiskiem `R` (biologia R, matematyka R, język polski R…) — czy to one, czy tutoriale zajmują wiersze `zaj. rozszerzone`? | **Rozszerzenia `R` → `I / II zaj. rozszerzone`. Tutoriale → `zaj. alternatywne`.** Unieważnia 2.4 | aktualna |
| 5.2 | Gdzie `fakultet …` i `konsultacje ITN`? | Wszystkie `fakultet *` → `zaj. alternatywne`. `konsultacje ITN` → brak wiersza na wniosku, tylko uwaga | aktualna |
| 5.3 | `historia sztuki` występuje też w SLO, a formularz SLO nie ma takiego wiersza | Na SLO → `zaj. alternatywne`. Na SLSP dopasowuje się wcześniej do wiersza drukowanego `I zaj. rozszerz.` | aktualna |
| 5.4 | Nazwy kierunków: te z planu czy te z CSV (`Fotografia SLO`, `Warsztaty muzyczne`, `Wizaż`…)? | **Wiążące są nazwy z planu lekcji.** Dotychczasowy `Klasyfikacja.csv` to wersja robocza; docelowy eksport z Librusa będzie miał nazwy jak w planie | aktualna |

Konsekwencje 5.4 — usunięto zgadywane aliasy (`Warsztaty muzyczne` → *kreacja
muzyczna* itd.). Nazwy z sufiksem `SLO` nadal działają tam, gdzie po odcięciu
sufiksu zgadzają się z planem (`Fotografia SLO` → `fotografia`); pozostałe trafiają
do `zaj. alternatywne` z uwagą, więc skrypt nigdy nie wpisze błędnego kierunku.

---

## Ustalenia wynikające wprost z dokumentów (bez pytania)

| # | Ustalenie | Źródło |
|---|---|---|
| D.1 | Numer modułu: `klasyfikacja śródroczna → 2·klasa − 1`, `roczna → 2·klasa` | opis zadania |
| D.2 | SLO ma 8 modułów (4-letnie), SLSP ma 10 (5-letnie) | `SLO_wniosek.pdf`, `SLSP_wniosek.pdf`, str. 2 |
| D.3 | Na SLSP wiersz `I zaj. rozszerz.` jest zarezerwowany dla *historii sztuki*, więc rozszerzeniom zostaje tylko `II zaj. rozszerz.` | `SLSP_wniosek.pdf`, str. 2 |
| D.4 | Eksport z Librusa: Windows-1250, separator `;`, blok podsumowań na końcu | `Klasyfikacja.csv` |
| D.5 | Nazwy przedmiotów zawierają oznaczenie klasy (`biologia kl. 2`), które zmienia się co roku — musi być pomijane przy dopasowaniu | `Plan_lekcji_2025-2026.pdf` |
| D.6 | W planie figuruje `techniki rzeźbiarkie` (literówka) — obsługiwane jako alias | `Plan_lekcji_2025-2026.pdf`, str. 6–9 |
| D.7 | Specjalizacja na SLSP zaczyna się od klasy 2; klasa 1 ma tylko przedmioty „podstawy…" | `Plan_lekcji_2025-2026.pdf`, str. 1–2 |

---

## Gdzie to jest w kodzie

| Decyzja | Plik |
|---|---|
| 2.2, 5.4 | `apps-script/Config.gs` → `KIERUNKI_SLO`, `SPECJALIZACJE_SLSP` |
| 3.2, 5.2 | `apps-script/Config.gs` → `POZA_FORMULARZEM` |
| 4.1, 4.2, 5.2, 5.3 | `apps-script/Config.gs` → `ZAJECIA_ALTERNATYWNE`, `PREFIKSY_ALTERNATYWNE` |
| 3.3 | `apps-script/Config.gs` → `GRADE_TEXT`, `GRADE_PASSTHROUGH` |
| 2.3, 2.4, 3.1, 5.1, 5.3 | `apps-script/SubjectMapper.gs` → `przypiszPrzedmioty()` |
| D.5, D.6 | `apps-script/SubjectMapper.gs` → `normalizujNazwe()`, `czyRozszerzenie()` |
| D.1 | `apps-script/CsvParser.gs` → `numerModulu()` |
| D.2, D.3 | `apps-script/FormLayout.gs` → `UKLAD_SLO`, `UKLAD_SLSP` |
| 2.1 | `apps-script/WniosekBuilder.gs` → `nazwaPlikuUcznia()` |
| 3.4 | `apps-script/WniosekBuilder.gs` → `zapiszModul()` |

---

## Otwarte / do potwierdzenia

- **Nazwy przedmiotów kierunkowych w Librusie.** Ustalenie 5.4 zakłada, że
  docelowy eksport będzie używał nazw z planu lekcji. Do sprawdzenia na pierwszym
  prawdziwym eksporcie z nazwiskami uczniów.
- **Liczba rozszerzeń na ucznia.** Formularz SLO ma dwa wiersze `zaj. rozszerzone`,
  SLSP tylko jeden. Jeżeli uczeń ma więcej rozszerzeń, nadmiar trafia do uwag.
- **`konsultacje ITN`** — przyjęto, że nie podlegają wpisowi na wniosek (5.2).
  Jeśli bywają oceniane i mają się pojawiać, trzeba je przenieść z
  `POZA_FORMULARZEM` do zajęć alternatywnych.

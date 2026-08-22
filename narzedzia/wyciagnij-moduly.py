#!/usr/bin/env python3
"""
Odczytuje z formularzy PDF, które moduły obowiązują dla którego przedmiotu.

Na papierze zaznaczone jest to grubością ramki: komórka z ramką CIĄGŁĄ
(rysowaną jako wypełniony prostokąt) oznacza moduł do zrealizowania, ramka
KRESKOWANA (linia ze wzorem [1.44 0.48]) — moduł, który przedmiotu nie dotyczy.

Wynik wypisywany jest w formie gotowej do wklejenia do FormLayout.gs.

    python3 narzedzia/wyciagnij-moduly.py
"""
import sys
import pymupdf

TOL = 3.0


# Na papierze ramka "gruba" to wypełniony prostokąt o grubości ~1.44 pkt;
# zwykła krawędź tabeli ma ~0.48 pkt, a siatka nieobowiązujących modułów jest
# rysowana linią kreskowaną. Interesują nas wyłącznie te grube.
GRUBA_MIN = 1.0
GRUBA_MAX = 2.5


def segmenty(strona):
    """Grube segmenty ramek: (pionowe, poziome) jako listy (stała, od, do)."""
    pion, poz = [], []
    for rys in strona.get_drawings():
        if rys['type'] != 'f':          # tylko wypełnienia; kreskowane są 's'
            continue
        for el in rys['items']:
            if el[0] != 're':
                continue
            r = el[1]
            if GRUBA_MIN <= r.width <= GRUBA_MAX and r.height > 2:
                pion.append((r.x0, r.y0, r.y1))
            elif GRUBA_MIN <= r.height <= GRUBA_MAX and r.width > 2:
                poz.append((r.y0, r.x0, r.x1))
    return pion, poz


def granice_kolumn(strona, ile):
    """Lewe krawędzie kolumn modułów — z pozycji nagłówków I, II, III..."""
    slowa = strona.get_text('words')          # x0, y0, x1, y1, tekst, ...
    RZ = ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X')
    naglowki = [w for w in slowa if w[4].strip('.') in RZ and w[0] > 250]
    y = min(w[1] for w in naglowki)
    rzad = sorted([w for w in naglowki if abs(w[1] - y) < 4], key=lambda w: w[0])
    srodki = []
    for w in rzad:                             # skleja rozbite numery ("VI" + "I")
        x = (w[0] + w[2]) / 2
        if srodki and x - srodki[-1] < 14:
            srodki[-1] = (srodki[-1] + x) / 2
        else:
            srodki.append(x)
    szer = (srodki[-1] - srodki[0]) / (len(srodki) - 1)
    return [x - szer / 2 for x in srodki], szer


def pasma_wierszy(pion, ymin):
    """Pionowe zakresy wierszy tabeli — z zakresów samych ramek, nie z tekstu."""
    pasma = []
    for _, y0, y1 in pion:
        if y1 <= ymin or y1 - y0 < 5:
            continue
        for i, (a, b) in enumerate(pasma):
            if abs(a - y0) < 4 and abs(b - y1) < 4:
                break
        else:
            pasma.append((y0, y1))
    return sorted(pasma)


def etykieta(strona, y0, y1):
    """Tekst wiersza: nazwa przedmiotu, a gdy jej brak — etykieta z wąskiej kolumny."""
    for zakres in ((118, 250), (60, 118)):
        czesci = [w[4] for w in sorted(strona.get_text('words'), key=lambda w: (w[1], w[0]))
                  if zakres[0] < w[0] < zakres[1] and y0 - 2 < (w[1] + w[3]) / 2 < y1 + 2]
        tekst = ' '.join(czesci).strip()
        if tekst and set(tekst) != {'.'}:
            return tekst
    return '(bez etykiety)'


def analizuj(sciezka, ile_modulow):
    strona = pymupdf.open(sciezka)[1]
    pion, _ = segmenty(strona)
    granice, szer = granice_kolumn(strona, ile_modulow)
    ynag = min(y0 for _, y0, _ in pion) if pion else 0
    wyniki = []
    for y0, y1 in pasma_wierszy(pion, ynag + 5):
        akt = [i + 1 for i, x in enumerate(granice)
               if any(abs(px - x) < TOL and py0 < y1 - 1 and py1 > y0 + 1
                      for px, py0, py1 in pion)]
        if not akt:
            continue
        wyniki.append((etykieta(strona, y0, y1), akt))
    return wyniki


def zwarty(akt):
    """[3,4,5,6] -> '3-6'; niesąsiadujące zostają wyliczone."""
    if akt == list(range(akt[0], akt[-1] + 1)):
        return '%d-%d' % (akt[0], akt[-1]) if len(akt) > 1 else str(akt[0])
    return ','.join(map(str, akt))


if __name__ == '__main__':
    for sciezka, ile in (('SLO_wniosek.pdf', 8), ('SLSP_wniosek.pdf', 10)):
        print('=' * 16, sciezka)
        for nazwa, akt in analizuj(sciezka, ile):
            print('  %-46s moduly: [%s]   (%s)'
                  % (nazwa[:46], ', '.join(map(str, akt)), zwarty(akt)))

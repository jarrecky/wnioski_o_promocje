#!/usr/bin/env python3
"""
Generator przykładowych eksportów "Klasyfikacja" z Librusa.

Odtwarza dokładnie strukturę prawdziwego pliku (Windows-1250, separator ';',
CRLF, pięć wierszy metadanych, dwuwierszowy nagłówek, blok podsumowań na końcu).
Dane uczniów są zmyślone; nazwy przedmiotów pochodzą z Plan_lekcji_2025-2026.pdf.

    python3 narzedzia/generuj-przyklady.py
"""
import os

KLASA = '4o'
SZKOLA = 'SLO'
ROK = '2025/2026'

# Przedmioty oferowane w klasie 4o SLO — wg planu lekcji (str. 9).
OGOLNE = [
    'etyka kl. 4', 'historia kl. 4', 'historia sztuki kl. 4',
    'język angielski', 'język francuski', 'język niemiecki',
    'język polski kl. 4', 'matematyka kl. 4', 'wychowanie fizyczne',
]
ROZSZERZENIA = [
    'biologia R kl. 4', 'chemia R kl. 4', 'filozofia R kl. 4',
    'historia R kl. 4', 'język polski R kl. 4', 'matematyka R kl. 4',
]
KIERUNKI = [
    'film', 'fotografia', 'grafika projektowa', 'kreacja muzyczna',
    'kreacja plastyczna', 'stylizacja i kreacja', 'teatr',
    'techniki rzeźbiarkie', 'twórcze pisanie',
]
FAKULTETY = [
    'fakultet historia sztuki', 'fakultet j. angielski',
    'fakultet j. polski', 'fakultet matematyka',
]
PRZEDMIOTY = OGOLNE + ROZSZERZENIA + KIERUNKI + FAKULTETY

# nr, nazwisko i imię, zachowanie, {przedmiot: (ocena śródroczna, ocena roczna)},
# (usprawiedliwione, nieusprawiedliwione, spóźnienia) dla obu okresów
UCZNIOWIE = [
    (3, 'Brzozowska Anna', ('bardzo dobre', 'wzorowe'), {
        'etyka kl. 4': ('zal', 'zal'),
        'historia kl. 4': ('4', '5'),
        'historia sztuki kl. 4': ('5', '5'),
        'język angielski': ('5', '5'),
        'język francuski': ('4', '4'),
        'język polski kl. 4': ('4', '4'),
        'matematyka kl. 4': ('3', '4'),
        'wychowanie fizyczne': ('5', '5'),
        'biologia R kl. 4': ('5', '5'),
        'chemia R kl. 4': ('4', '5'),
        'fotografia': ('6', '6'),
    }, ((12, 0, 3), (28, 2, 7))),

    (7, 'Dąbrowski Marcel', ('dobre', 'dobre'), {
        'etyka kl. 4': ('zal', 'zal'),
        'historia kl. 4': ('3', '3'),
        'język angielski': ('4', '4'),
        'język polski kl. 4': ('3', '4'),
        'matematyka kl. 4': ('2', '3'),
        'wychowanie fizyczne': ('4', '4'),
        'filozofia R kl. 4': ('4', '4'),
        'matematyka R kl. 4': ('3', '3'),
        'grafika projektowa': ('5', '6'),
        'fakultet matematyka': ('zal', 'zal'),
    }, ((31, 6, 11), (64, 14, 23))),

    (11, 'Kwiatkowska Zofia', ('wzorowe', 'wzorowe'), {
        'etyka kl. 4': ('zal', 'zal'),
        'historia kl. 4': ('5', '5'),
        'historia sztuki kl. 4': ('4', '5'),
        'język angielski': ('5', '5'),
        'język niemiecki': ('4', '5'),
        'język polski kl. 4': ('5', '5'),
        'matematyka kl. 4': ('4', '4'),
        'wychowanie fizyczne': ('5', '6'),
        'historia R kl. 4': ('5', '5'),
        'język polski R kl. 4': ('5', '6'),
        'teatr': ('6', '6'),
    }, ((4, 0, 0), (9, 0, 1))),

    (14, 'Lis Bartosz', ('poprawne', 'dobre'), {
        'etyka kl. 4': ('zal', 'zal'),
        'historia kl. 4': ('3', '4'),
        'język angielski': ('3', '4'),
        'język polski kl. 4': ('3', '3'),
        'matematyka kl. 4': ('3', '3'),
        'wychowanie fizyczne': ('4', '5'),
        'historia R kl. 4': ('3', '4'),
        # Dwa przedmioty kierunkowe naraz — celowo, żeby pokazać uwagę
        # o niejednoznacznym kierunku.
        'film': ('5', '5'),
        'teatr': ('4', '5'),
    }, ((22, 9, 14), (47, 19, 26))),

    (19, 'Nowicka Helena', ('bardzo dobre', 'bardzo dobre'), {
        'etyka kl. 4': ('zal', 'zal'),
        'historia kl. 4': ('4', '4'),
        'język angielski': ('4', '5'),
        'język francuski': ('3', '4'),
        'język polski kl. 4': ('5', '5'),
        'matematyka kl. 4': ('4', '4'),
        'wychowanie fizyczne': ('5', '5'),
        'język polski R kl. 4': ('5', '5'),
        'matematyka R kl. 4': ('4', '4'),
        'kreacja muzyczna': ('6', '6'),
        'fakultet historia sztuki': ('zal', 'zal'),
    }, ((8, 1, 2), (17, 3, 6))),

    (24, 'Wróbel Ignacy', ('nieodpowiednie', 'poprawne'), {
        'etyka kl. 4': ('zal', 'zal'),
        'historia kl. 4': ('2', '3'),
        'język angielski': ('3', '3'),
        'język polski kl. 4': ('2', '2'),
        'matematyka kl. 4': ('1', '2'),
        'wychowanie fizyczne': ('3', '4'),
        'biologia R kl. 4': ('2', '3'),
        'techniki rzeźbiarkie': ('5', '5'),
        'fakultet j. polski': ('zal', 'zal'),
    }, ((38, 21, 19), (73, 41, 35))),
]

SZER = 3 + len(PRZEDMIOTY) + 6 + 2 + 1 + 1  # nr/nazwisko/zachowanie + oceny + 6..1 + usp/nieus + spóźn. + średnia
KOL_LICZBY = 3 + len(PRZEDMIOTY)


def pusty():
    return [''] * SZER


def srednia(oceny):
    liczby = [int(o) for o in oceny if o.isdigit()]
    if not liczby:
        return '-'
    return ('%.2f' % (sum(liczby) / len(liczby))).replace('.', ',')


def zbuduj(okres):
    """okres: 0 = śródroczna, 1 = roczna."""
    idx = okres
    tytul = 'Klasyfikacja śródroczna' if okres == 0 else 'Klasyfikacja roczna'
    w = []

    for tekst in (tytul, '', 'Klasa %s %s' % (KLASA, SZKOLA), 'Rok szkolny %s' % ROK, ''):
        r = pusty()
        r[0] = tekst
        w.append(r)

    nag = pusty()
    nag[0], nag[1], nag[2], nag[3] = 'Nr', 'Nazwisko i imię', 'Zachowanie', 'Nazwy zajęć edukacyjnych'
    nag[KOL_LICZBY] = 'Liczby ocen'
    nag[KOL_LICZBY + 6] = 'Liczby opuszcz. lekcji'
    nag[KOL_LICZBY + 8] = 'Liczba spóźn.'
    nag[KOL_LICZBY + 9] = 'Średnia'
    w.append(nag)

    pod = pusty()
    for i, p in enumerate(PRZEDMIOTY):
        pod[3 + i] = p
    for i, s in enumerate(['6', '5', '4', '3', '2', '1']):
        pod[KOL_LICZBY + i] = s
    pod[KOL_LICZBY + 6], pod[KOL_LICZBY + 7] = 'usp.', 'nieus.'
    w.append(pod)

    sumy = {s: 0 for s in '654321'}
    for nr, nazwisko, zach, oceny, frek in UCZNIOWIE:
        r = pusty()
        r[0], r[1], r[2] = str(nr), nazwisko, zach[idx]
        moje = []
        for i, p in enumerate(PRZEDMIOTY):
            if p in oceny:
                v = oceny[p][idx]
                r[3 + i] = v
                moje.append(v)
        for i, s in enumerate('654321'):
            n = moje.count(s)
            r[KOL_LICZBY + i] = str(n)
            sumy[s] += n
        usp, nieus, spoz = frek[idx]
        r[KOL_LICZBY + 6], r[KOL_LICZBY + 7] = str(usp), str(nieus)
        r[KOL_LICZBY + 8] = str(spoz)
        r[KOL_LICZBY + 9] = srednia(moje)
        w.append(r)

    w.append(pusty())

    lo = pusty()
    lo[0] = 'Liczby ocen'
    for i, s in enumerate('654321'):
        lo[KOL_LICZBY + i] = str(sumy[s])
    w.append(lo)

    etykiety = ['celujących', 'bardzo dobrych', 'dobrych', 'dostatecznych',
                'dopuszczających', 'niedostatecznych', 'nieklasyfik.']
    for j, et in enumerate(etykiety):
        r = pusty()
        r[0] = et
        for i, p in enumerate(PRZEDMIOTY):
            if j < 6:
                ocena = '654321'[j]
                r[3 + i] = str(sum(1 for _, _, _, o, _ in UCZNIOWIE if p in o and o[p][idx] == ocena))
            else:
                r[3 + i] = '0'
        w.append(r)

    bez_ndst = sum(1 for _, _, _, o, _ in UCZNIOWIE
                   if not any(o[p][idx] == '1' for p in o))
    z_ndst = len(UCZNIOWIE) - bez_ndst
    boczne = [('bez ocen niedostatecznych', bez_ndst),
              ('z 1 lub 2 ocenami niedostat.', z_ndst),
              ('z 3 i więcej ocenami niedostat.', 0),
              ('nieklasyfikowanych', 0)]
    w[len(w) - 6][KOL_LICZBY + 1] = 'Liczby uczniów'
    for k, (et, n) in enumerate(boczne):
        r = w[len(w) - 5 + k]
        r[KOL_LICZBY + 1] = et
        r[KOL_LICZBY + 7] = str(n)

    return '\r\n'.join(';'.join(r) for r in w) + '\r\n'


if __name__ == '__main__':
    os.makedirs('przyklady', exist_ok=True)
    for okres, nazwa in ((0, 'Klasyfikacja_srodroczna_4o_SLO.csv'),
                         (1, 'Klasyfikacja_roczna_4o_SLO.csv')):
        sciezka = os.path.join('przyklady', nazwa)
        with open(sciezka, 'wb') as f:
            f.write(zbuduj(okres).encode('windows-1250'))
        print('zapisano %s (%d przedmiotów, %d uczniów)'
              % (sciezka, len(PRZEDMIOTY), len(UCZNIOWIE)))

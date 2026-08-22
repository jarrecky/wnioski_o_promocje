#!/usr/bin/env python3
"""
Zapis wyników uruchomienia do .xlsx (wywoływane przez uruchom-lokalnie.js).

Odtwarza formatowanie, o które poprosił kod skryptu: scalenia, obrót tekstu
w kolumnach opisowych oraz ramki modułów (gruba = moduł objęty przedmiotem,
kropkowana = poza zakresem). Dane o formatowaniu pochodzą z namiastki
SpreadsheetApp, która zapamiętuje wywołania merge/setTextRotation/setBorder.
"""
import datetime
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

STALA_DATA = datetime.datetime(2026, 8, 22, 9, 0, 0)

STYLE = {
    'SOLID': 'thin',
    'SOLID_MEDIUM': 'medium',
    'SOLID_THICK': 'thick',
    'DOTTED': 'dotted',
    'DASHED': 'dashed',
}


def kolor(x):
    return (x or '#000000').lstrip('#').upper()


def naloz_ramke(ws, z):
    bok = Side(style=STYLE.get(z['styl'], 'thin'), color=kolor(z['kolor']))
    r0, c0, nr, nc = z['r'], z['c'], z['nr'], z['nc']
    for i in range(nr):
        for j in range(nc):
            k = ws.cell(row=r0 + i, column=c0 + j)
            stara = k.border
            k.border = Border(
                top=bok if i == 0 else (stara.top or bok),
                bottom=bok if i == nr - 1 else (stara.bottom or bok),
                left=bok if j == 0 else (stara.left or bok),
                right=bok if j == nc - 1 else (stara.right or bok),
            )


def zapisz(wpis, katalog):
    wb = Workbook()
    wb.remove(wb.active)
    for ark in wpis['arkusze']:
        ws = wb.create_sheet(ark['nazwa'][:31])
        for wiersz in ark['wiersze']:
            ws.append(wiersz)

        for kol, szer in ark.get('szerokosci', []):
            ws.column_dimensions[get_column_letter(kol)].width = max(3, szer / 7.0)

        for z in ark.get('tla', []):
            wyp = PatternFill('solid', fgColor=kolor(z['kolor']))
            for i in range(z['nr']):
                for j in range(z['nc']):
                    ws.cell(row=z['r'] + i, column=z['c'] + j).fill = wyp

        for z in ark.get('ramki', []):
            naloz_ramke(ws, z)

        obrocone = set()
        for z in ark.get('rotacje', []):
            for i in range(z['nr']):
                for j in range(z['nc']):
                    obrocone.add((z['r'] + i, z['c'] + j))

        for w in ws.iter_rows():
            for k in w:
                if (k.row, k.column) in obrocone:
                    k.alignment = Alignment(textRotation=90, horizontal='center',
                                            vertical='center', wrap_text=True)
                elif k.column >= 4:
                    k.alignment = Alignment(horizontal='center', vertical='center')
                else:
                    k.alignment = Alignment(vertical='center', wrap_text=True)

        for z in ark.get('scalenia', []):
            if z['nr'] > 1 or z['nc'] > 1:
                ws.merge_cells(start_row=z['r'], start_column=z['c'],
                               end_row=z['r'] + z['nr'] - 1, end_column=z['c'] + z['nc'] - 1)

        for w in (ws[1], ws[4], ws[5]):
            for k in w:
                k.font = Font(bold=True)

        ws.freeze_panes = 'D6' if ark['nazwa'] == 'Wniosek' else 'A2'
        ws.page_setup.orientation = 'landscape'
        ws.page_setup.fitToWidth = 1
        ws.sheet_properties.pageSetUpPr.fitToPage = True

    wb.properties.created = STALA_DATA
    wb.properties.modified = STALA_DATA
    wb.properties.creator = 'generator wniosków ALA'
    sciezka = '%s/%s.xlsx' % (katalog, wpis['nazwa'])
    wb.save(sciezka)
    return sciezka


if __name__ == '__main__':
    dane = json.load(open(sys.argv[1], encoding='utf8'))
    for wpis in dane:
        print('   zapisano ' + zapisz(wpis, sys.argv[2]).split('/')[-1])

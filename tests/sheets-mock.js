/**
 * Minimalna, pamięciowa namiastka SpreadsheetApp — tyle, ile potrzebuje
 * WniosekBuilder.gs. Formatowanie (scalanie, ramki, szerokości) jest pomijane;
 * testujemy wyłącznie zawartość komórek i indeksowanie wierszy.
 */

function pad(row, n) {
  const r = row.slice();
  while (r.length < n) r.push('');
  return r;
}

class Range {
  constructor(sheet, r, c, nr, nc) {
    this.sheet = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc;
  }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sheet.data[this.r - 1 + i] || [];
      out.push(pad(row, this.c + this.nc - 1).slice(this.c - 1, this.c - 1 + this.nc));
    }
    return out;
  }
  setValues(v) {
    for (let i = 0; i < this.nr; i++) {
      this.sheet.ensureRow(this.r - 1 + i);
      for (let j = 0; j < this.nc; j++) {
        this.sheet.data[this.r - 1 + i][this.c - 1 + j] = (v[i] && v[i][j] !== undefined) ? v[i][j] : '';
      }
    }
    return this;
  }
  getValue() { return this.getValues()[0][0]; }
  setValue(x) {
    this.sheet.ensureRow(this.r - 1);
    this.sheet.data[this.r - 1][this.c - 1] = x;
    return this;
  }
  getDisplayValue() { const v = this.getValue(); return v === undefined || v === null ? '' : String(v); }
}

// Metody formatujące: łańcuchowe no-opy.
const NOOP_RANGE = ['merge', 'mergeAcross', 'breakApart', 'setBorder', 'setBackground', 'setFontWeight',
  'setFontStyle', 'setFontSize', 'setHorizontalAlignment', 'setVerticalAlignment', 'setWrap', 'setNumberFormat'];
for (const m of NOOP_RANGE) Range.prototype[m] = function () { return this; };

class Sheet {
  constructor(name) { this.name = name; this.data = []; this.hidden = false; }
  getName() { return this.name; }
  setName(n) { this.name = n; return this; }
  getSheetId() { return this.name; }
  ensureRow(i) { while (this.data.length <= i) this.data.push([]); if (!this.data[i]) this.data[i] = []; }
  clear() { this.data = []; return this; }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) {
      const row = this.data[i] || [];
      if (row.some((v) => v !== '' && v !== undefined && v !== null)) return i + 1;
    }
    return 0;
  }
  getLastColumn() { return Math.max(1, ...this.data.map((r) => (r || []).length)); }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), this.getLastColumn()); }
  insertRowAfter(r) { this.data.splice(r, 0, []); return this; }
  insertRowsAfter(r, n) { for (let i = 0; i < n; i++) this.data.splice(r, 0, []); return this; }
  deleteRows(r, n) { this.data.splice(r - 1, n); return this; }
  hideSheet() { this.hidden = true; return this; }
}
for (const m of ['hideColumns', 'setColumnWidth', 'setFrozenRows', 'setFrozenColumns', 'setRowHeight'])
  Sheet.prototype[m] = function () { return this; };

class Spreadsheet {
  constructor(name) { this.name = name; this.sheets = [new Sheet('Arkusz1')]; }
  getId() { return 'ss-' + this.name; }
  getUrl() { return 'https://example.invalid/' + this.name; }
  getSheets() { return this.sheets; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n, pos) {
    const s = new Sheet(n);
    if (pos === undefined) this.sheets.push(s); else this.sheets.splice(pos, 0, s);
    return s;
  }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); return this; }
}

module.exports = { Spreadsheet, Sheet, Range };

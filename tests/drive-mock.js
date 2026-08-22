/**
 * Pamięciowa namiastka usług Apps Script potrzebnych przez Main.gs:
 * DriveApp, SpreadsheetApp.create/open, PropertiesService, LockService,
 * Utilities.formatDate, MimeType, Logger.
 *
 * Pozwala uruchomić lokalnie prawdziwą funkcję przetworzNowePliki() —
 * bez konta Google. Formatowanie arkusza jest pomijane (patrz sheets-mock.js).
 */
const fs = require('fs');
const path = require('path');
const { Spreadsheet, BorderStyle } = require('./sheets-mock');

function utworzSrodowisko(opcje) {
  opcje = opcje || {};
  const teraz = opcje.teraz || new Date('2026-08-22T09:00:00Z');
  const arkusze = new Map();   // id pliku -> Spreadsheet
  let licznik = 0;
  const nowyId = (p) => p + '-' + (++licznik);

  class Plik {
    constructor(nazwa, dane, mime, folder) {
      this.nazwa = nazwa; this.dane = dane;
      this.mime = mime || 'text/csv';
      this.id = nowyId('file'); this.folder = folder;
    }
    getName() { return this.nazwa; }
    getId() { return this.id; }
    getMimeType() { return this.mime; }
    getBlob() {
      const bajty = this.dane;
      return {
        getDataAsString(kodowanie) {
          return new TextDecoder(kodowanie || 'utf-8').decode(bajty);
        },
      };
    }
    moveTo(folder) {
      if (this.folder) this.folder.pliki = this.folder.pliki.filter((f) => f !== this);
      folder.pliki.push(this);
      this.folder = folder;
      return this;
    }
  }

  const iterator = (tablica) => {
    const kopia = tablica.slice();
    let i = 0;
    return { hasNext: () => i < kopia.length, next: () => kopia[i++] };
  };

  class Folder {
    constructor(nazwa) { this.nazwa = nazwa; this.id = nowyId('folder'); this.pliki = []; this.foldery = []; }
    getName() { return this.nazwa; }
    getId() { return this.id; }
    getFiles() { return iterator(this.pliki); }
    getFilesByName(n) { return iterator(this.pliki.filter((f) => f.getName() === n)); }
    getFoldersByName(n) { return iterator(this.foldery.filter((f) => f.nazwa === n)); }
    createFolder(n) { const f = new Folder(n); this.foldery.push(f); return f; }
    dodajCsv(sciezka) {
      const p = new Plik(path.basename(sciezka), fs.readFileSync(sciezka), 'text/csv', this);
      this.pliki.push(p);
      return p;
    }
  }

  const foldery = new Map();
  const zarejestruj = (f) => { foldery.set(f.getId(), f); return f; };

  const DriveApp = {
    getFolderById: (id) => {
      const f = foldery.get(id);
      if (!f) throw new Error('Brak folderu o ID ' + id);
      return f;
    },
    getFileById: (id) => {
      for (const f of foldery.values()) {
        const trafienie = f.pliki.find((p) => p.getId() === id);
        if (trafienie) return trafienie;
      }
      // plik arkusza utworzony przez SpreadsheetApp.create — jeszcze bez folderu
      const ss = arkusze.get(id);
      if (ss) return ss.__plik;
      throw new Error('Brak pliku o ID ' + id);
    },
  };

  const SpreadsheetApp = {
    create: (nazwa) => {
      const ss = new Spreadsheet(nazwa);
      const plik = new Plik(nazwa, Buffer.alloc(0), 'application/vnd.google-apps.spreadsheet', null);
      ss.__plik = plik;
      plik.__ss = ss;
      Object.defineProperty(ss, 'getId', { value: () => plik.getId() });
      arkusze.set(plik.getId(), ss);
      return ss;
    },
    open: (plik) => {
      if (!plik.__ss) throw new Error('To nie jest arkusz: ' + plik.getName());
      return plik.__ss;
    },
    getUi: () => { throw new Error('brak UI poza arkuszem'); },
    BorderStyle,
  };

  const magazyn = new Map();
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (magazyn.has(k) ? magazyn.get(k) : null),
      setProperty: (k, v) => magazyn.set(k, v),
    }),
  };

  const LockService = {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
  };

  const dwa = (n) => String(n).padStart(2, '0');
  const Utilities = {
    formatDate: (data, strefa, wzorzec) => wzorzec
      .replace('yyyy', data.getUTCFullYear())
      .replace('MM', dwa(data.getUTCMonth() + 1))
      .replace('dd', dwa(data.getUTCDate()))
      .replace('HH', dwa(data.getUTCHours()))
      .replace('mm', dwa(data.getUTCMinutes())),
  };

  // Stały czas, żeby wynik uruchomienia był powtarzalny (i nie puchł w gicie).
  const StalaData = function () { return teraz; };
  StalaData.prototype = Date.prototype;

  return {
    Folder, zarejestruj, arkusze,
    globalne: {
      console,
      DriveApp, SpreadsheetApp, PropertiesService, LockService, Utilities,
      MimeType: { CSV: 'text/csv' },
      Logger: { log: (m) => console.log('  [log] ' + m) },
      Date: new Proxy(Date, { construct: (cel, args) => (args.length ? new cel(...args) : teraz) }),
    },
  };
}

module.exports = { utworzSrodowisko };

/**
 * Parser eksportu "Klasyfikacja" z Librusa.
 *
 * Plik jest zakodowany w Windows-1250, rozdzielany średnikami, z zakończeniami
 * CRLF i blokiem podsumowań na końcu. Funkcje w tym pliku są czyste (bez API
 * Google) — dzięki temu można je uruchomić lokalnie w tests/run.js.
 */

/** Rozbicie tekstu CSV na tablicę 2D. Obsługuje pola w cudzysłowach. */
function podzielCsv(tekst, separator) {
  var sep = separator || ';';
  var wiersze = [];
  var pole = '';
  var wiersz = [];
  var wCudzyslowie = false;
  var i = 0;
  var t = String(tekst).replace(/^﻿/, '');

  while (i < t.length) {
    var z = t.charAt(i);
    if (wCudzyslowie) {
      if (z === '"') {
        if (t.charAt(i + 1) === '"') { pole += '"'; i += 2; continue; }
        wCudzyslowie = false; i++; continue;
      }
      pole += z; i++; continue;
    }
    if (z === '"') { wCudzyslowie = true; i++; continue; }
    if (z === sep) { wiersz.push(pole); pole = ''; i++; continue; }
    if (z === '\r') { i++; continue; }
    if (z === '\n') { wiersz.push(pole); wiersze.push(wiersz); wiersz = []; pole = ''; i++; continue; }
    pole += z; i++;
  }
  wiersz.push(pole);
  wiersze.push(wiersz);
  return wiersze;
}

function komorka(wiersze, r, c) {
  var w = wiersze[r];
  if (!w) return '';
  return String(w[c] == null ? '' : w[c]).trim();
}

function pustyWiersz(w) {
  if (!w) return true;
  for (var i = 0; i < w.length; i++) {
    if (String(w[i] == null ? '' : w[i]).trim() !== '') return false;
  }
  return true;
}

/** Numer modułu: śródroczna -> 2*klasa-1, roczna -> 2*klasa. */
function numerModulu(klasa, typKlasyfikacji) {
  return typKlasyfikacji === 'srodroczna' ? (2 * klasa - 1) : (2 * klasa);
}

/**
 * Metadane z pierwszych wierszy pliku (typ klasyfikacji, szkoła, klasa, rok).
 * Gdy nagłówek jest nietypowy, brakujące pola uzupełniane są z nazwy pliku.
 */
function odczytajMetadane(wiersze, nazwaPliku) {
  var meta = { typKlasyfikacji: null, szkola: null, klasa: null, klasaEtykieta: null, rokSzkolny: null };
  var ostrzezenia = [];
  var zrodla = [];

  var limit = Math.min(wiersze.length, 12);
  for (var r = 0; r < limit; r++) {
    for (var c = 0; c < Math.min((wiersze[r] || []).length, 4); c++) {
      zrodla.push(komorka(wiersze, r, c));
    }
  }
  zrodla.push(String(nazwaPliku || ''));

  zrodla.forEach(function (tekst) {
    if (!tekst) return;
    var t = tekst.replace(/\s+/g, ' ').trim();

    if (meta.typKlasyfikacji === null) {
      if (/[śs]r[óo]droczn/i.test(t)) meta.typKlasyfikacji = 'srodroczna';
      else if (/roczn/i.test(t)) meta.typKlasyfikacji = 'roczna';
    }
    if (meta.klasa === null) {
      // "Klasa 1o SLO", "Klasa 3 SLSP", "3a SLSP"
      var m = t.match(/(?:klasa\s+)?(\d)\s*([a-zA-Zżźćńółęąś]?)\s*(SLO|SLSP)\b/i);
      if (m) {
        meta.klasa = parseInt(m[1], 10);
        meta.klasaEtykieta = (m[1] + (m[2] || '')).trim();
        meta.szkola = m[3].toUpperCase();
      }
    }
    if (meta.szkola === null) {
      var s = t.match(/\b(SLSP|SLO)\b/i);
      if (s) meta.szkola = s[1].toUpperCase();
    }
    if (meta.rokSzkolny === null) {
      var rk = t.match(/(\d{4}\s*\/\s*\d{4})/);
      if (rk) meta.rokSzkolny = rk[1].replace(/\s+/g, '');
    }
  });

  if (!meta.typKlasyfikacji) ostrzezenia.push('Nie rozpoznano typu klasyfikacji (śródroczna/roczna) — przyjęto roczną.');
  if (!meta.szkola) ostrzezenia.push('Nie rozpoznano szkoły (SLO/SLSP) w nagłówku ani w nazwie pliku.');
  if (!meta.klasa) ostrzezenia.push('Nie rozpoznano numeru klasy w nagłówku ani w nazwie pliku.');

  if (!meta.typKlasyfikacji) meta.typKlasyfikacji = 'roczna';
  if (meta.klasa) meta.modul = numerModulu(meta.klasa, meta.typKlasyfikacji);

  return { meta: meta, ostrzezenia: ostrzezenia };
}

/** Indeks wiersza nagłówka (tego z komórką "Nr" w pierwszej kolumnie). */
function znajdzWierszNaglowka(wiersze) {
  for (var r = 0; r < Math.min(wiersze.length, 30); r++) {
    if (/^nr\.?$/i.test(komorka(wiersze, r, 0))) return r;
  }
  return -1;
}

/**
 * Zakres kolumn z przedmiotami: od "Nazwy zajęć edukacyjnych" do "Liczby ocen".
 * Gdy nagłówków nie widać, fallback: od kolumny 3 do pierwszej kolumny bloku
 * podsumowań (nagłówek "6" w wierszu z nazwami przedmiotów).
 */
function zakresPrzedmiotow(wiersze, wierszNaglowka) {
  var naglowek = wiersze[wierszNaglowka] || [];
  var start = -1;
  var koniec = -1;
  for (var c = 0; c < naglowek.length; c++) {
    var v = String(naglowek[c] == null ? '' : naglowek[c]).trim();
    if (start < 0 && /nazwy\s+zaj/i.test(v)) start = c;
    if (koniec < 0 && /liczby\s+ocen/i.test(v)) koniec = c;
  }
  if (start < 0) start = 3;
  if (koniec < 0) koniec = naglowek.length;
  return { start: start, koniec: koniec };
}

/**
 * Pełny odczyt pliku klasyfikacji.
 * Zwraca { meta, przedmioty, uczniowie, ostrzezenia }.
 */
function parsujKlasyfikacje(tekst, nazwaPliku) {
  var wiersze = podzielCsv(tekst, ';');
  var wynikMeta = odczytajMetadane(wiersze, nazwaPliku);
  var ostrzezenia = wynikMeta.ostrzezenia.slice();

  var rNag = znajdzWierszNaglowka(wiersze);
  if (rNag < 0) {
    throw new Error('Nie znaleziono wiersza nagłówka (komórki "Nr") — czy to na pewno eksport klasyfikacji z Librusa?');
  }
  var rPrzedmioty = rNag + 1;
  var zakres = zakresPrzedmiotow(wiersze, rNag);

  var przedmioty = [];
  for (var c = zakres.start; c < zakres.koniec; c++) {
    var nazwa = komorka(wiersze, rPrzedmioty, c);
    if (nazwa) przedmioty.push({ kolumna: c, nazwa: nazwa });
  }
  if (!przedmioty.length) ostrzezenia.push('W pliku nie znaleziono żadnych kolumn z przedmiotami.');

  var uczniowie = [];
  var pominieteWiersze = 0;
  for (var r = rPrzedmioty + 1; r < wiersze.length; r++) {
    var w = wiersze[r];
    if (pustyWiersz(w)) break;
    var nr = komorka(wiersze, r, 0);
    if (/liczby\s+ocen/i.test(nr) || !/^\d+$/.test(nr)) break; // początek bloku podsumowań

    var nazwisko = komorka(wiersze, r, 1);
    if (!nazwisko) { pominieteWiersze++; continue; }

    var oceny = [];
    przedmioty.forEach(function (p) {
      var raw = komorka(wiersze, r, p.kolumna);
      if (GRADE_EMPTY.indexOf(raw.toLowerCase()) >= 0) return;
      oceny.push({ przedmiot: p.nazwa, ocena: raw });
    });

    uczniowie.push({
      nr: nr,
      nazwisko: nazwisko,
      zachowanie: komorka(wiersze, r, 2),
      oceny: oceny
    });
  }

  if (pominieteWiersze) {
    ostrzezenia.push('Pominięto ' + pominieteWiersze + ' wiersz(y) bez nazwiska ucznia (eksport zanonimizowany?).');
  }

  return {
    meta: wynikMeta.meta,
    przedmioty: przedmioty,
    uczniowie: uczniowie,
    ostrzezenia: ostrzezenia
  };
}

/** Zamiana oceny z CSV na skrót opisowy. Zwraca { tekst, uwaga }. */
function ocenaNaTekst(raw) {
  var v = String(raw == null ? '' : raw).trim();
  if (GRADE_EMPTY.indexOf(v.toLowerCase()) >= 0) return { tekst: '', uwaga: null };
  if (GRADE_TEXT[v]) return { tekst: GRADE_TEXT[v], uwaga: null };
  if (GRADE_PASSTHROUGH.indexOf(v.toLowerCase()) >= 0) return { tekst: v.toLowerCase(), uwaga: null };

  var m = v.match(/^([1-6])\s*[+\-]$/);
  if (m) {
    return {
      tekst: GRADE_TEXT[m[1]],
      uwaga: 'Ocena "' + v + '" zapisana jako "' + GRADE_TEXT[m[1]] + '" (pominięto znak +/-).'
    };
  }
  return { tekst: v, uwaga: 'Nierozpoznana ocena "' + v + '" — przepisana bez zmian, wymaga sprawdzenia.' };
}

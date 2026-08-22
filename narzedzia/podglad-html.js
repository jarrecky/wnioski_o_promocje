/**
 * Podgląd HTML arkusza wynikowego — odtwarza scalenia, obrót tekstu i style
 * ramek zapamiętane przez namiastkę SpreadsheetApp. Służy do obejrzenia wyniku
 * bez otwierania arkusza; nie jest częścią skryptu działającego na Dysku.
 */

const STYL_RAMKI = {
  SOLID_THICK: '3px solid #000',
  SOLID_MEDIUM: '2px solid #000',
  SOLID: '1px solid #000',
  DASHED: '1px dashed #b7b7b7',
  DOTTED: '1px dotted #b7b7b7',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (z) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));

function wKomorce(z, r, c) {
  return z.r <= r && r < z.r + z.nr && z.c <= c && c < z.c + z.nc;
}

function podgladArkusza(ark) {
  const wiersze = ark.wiersze;
  const liczbaKol = Math.max(1, ...wiersze.map((w) => w.length));

  // Komórki przykryte scaleniem pomijamy; lewy górny róg dostaje rowspan/colspan.
  const pominiete = new Set();
  const rozpietosci = new Map();
  for (const z of ark.scalenia || []) {
    if (z.nr <= 1 && z.nc <= 1) continue;
    rozpietosci.set(z.r + ':' + z.c, z);
    for (let i = 0; i < z.nr; i++) {
      for (let j = 0; j < z.nc; j++) {
        if (i || j) pominiete.add((z.r + i) + ':' + (z.c + j));
      }
    }
  }

  const szerokosci = new Map(ark.szerokosci || []);
  const kolgroup = [];
  let szerokoscTabeli = 0;
  for (let c = 1; c <= liczbaKol; c++) {
    const szer = szerokosci.get(c) || 70;
    szerokoscTabeli += szer;
    kolgroup.push(`<col style="width:${szer}px">`);
  }

  const html = [];
  for (let r = 1; r <= wiersze.length; r++) {
    html.push('<tr>');
    for (let c = 1; c <= liczbaKol; c++) {
      if (pominiete.has(r + ':' + c)) continue;
      const z = rozpietosci.get(r + ':' + c);
      const styl = [];

      // Ostatnia pasująca ramka wygrywa — tak samo jak w arkuszu.
      const ramka = (ark.ramki || []).filter((x) => wKomorce(x, r, c)).pop();
      if (ramka) styl.push(`border:${STYL_RAMKI[ramka.styl] || STYL_RAMKI.SOLID}`);

      const tlo = (ark.tla || []).filter((x) => wKomorce(x, r, c)).pop();
      if (tlo) styl.push(`background:${tlo.kolor}`);

      const obrot = (ark.rotacje || []).some((x) => wKomorce(x, r, c));
      if (obrot) styl.push('writing-mode:vertical-rl;transform:rotate(180deg);text-align:center');

      if (c >= 4 && !obrot) styl.push('text-align:center');
      const atrybuty = [
        z && z.nr > 1 ? ` rowspan="${z.nr}"` : '',
        z && z.nc > 1 ? ` colspan="${z.nc}"` : '',
        styl.length ? ` style="${styl.join(';')}"` : '',
      ].join('');
      html.push(`<td${atrybuty}>${esc(wiersze[r - 1][c - 1] || '')}</td>`);
    }
    html.push('</tr>');
  }
  // table-layout:fixed honoruje colgroup dopiero przy jawnej szerokości tabeli.
  return `<table style="width:${szerokoscTabeli}px"><colgroup>${kolgroup.join('')}</colgroup>${html.join('')}</table>`;
}

function podgladPliku(wpis) {
  const sekcje = wpis.arkusze.map((a) =>
    `<h2>${esc(wpis.nazwa)} — ${esc(a.nazwa)}</h2>${podgladArkusza(a)}`).join('');
  return `<!doctype html><html lang="pl"><meta charset="utf-8">
<title>${esc(wpis.nazwa)}</title>
<style>
 body{font:13px/1.35 "Segoe UI",Arial,sans-serif;margin:24px;color:#111;background:#fff}
 h2{font-size:15px;margin:22px 0 10px}
 table{border-collapse:collapse;table-layout:fixed}
 td{padding:4px 6px;vertical-align:middle;overflow:hidden;word-wrap:break-word;height:26px}
 tr:nth-child(1) td,tr:nth-child(4) td,tr:nth-child(5) td{font-weight:600}
</style>${sekcje}</html>`;
}

module.exports = { podgladPliku };

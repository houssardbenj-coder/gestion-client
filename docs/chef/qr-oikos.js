/* ===================== QR codes d'OIKOS (fiche outil, SQL 77) — 17/11/2026 =====================
   Fabrique un QR code sans rien demander à Internet (les pages n'ont le droit de charger aucun autre programme).
   Texte court seulement (une adresse de l'appli) : mode octet, correction M, versions 1 à 10 (jusqu'à 213 caractères).
   QROikos.svg(texte, taillePx) → dessin prêt à afficher ou imprimer ; QROikos.matrice(texte) → cases noires (true).
   Ce fichier est recopié à l'identique dans tableau-de-bord et appli-intervenante par « qr-oikos - recopier.py » :
   ne modifier que celui de la racine. */
(function () {
  "use strict";
  // Par version (correction M) : [codes de correction par bloc, [nombre de blocs, octets de données par bloc]...]
  const BLOCS = [null, [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]], [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const capacite = v => BLOCS[v].slice(1).reduce((s, [n, d]) => s + n * d, 0);

  // Corps de Galois GF(256), polynôme 0x11D
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
  function correction(donnees, n) {
    let gen = [1];
    for (let i = 0; i < n; i++) { const g = new Array(gen.length + 1).fill(0); gen.forEach((c, j) => { g[j] ^= c; g[j + 1] ^= mul(c, EXP[i]); }); gen = g; }
    const reste = new Array(n).fill(0);
    donnees.forEach(o => { const f = o ^ reste.shift(); reste.push(0); for (let j = 0; j < n; j++) reste[j] ^= mul(gen[j + 1], f); });
    return reste;
  }

  function octets(texte) {
    const o = Array.from(new TextEncoder().encode(String(texte)));
    let v = 1; while (v <= 10 && o.length + (v < 10 ? 2 : 3) > capacite(v)) v++;
    if (v > 10) throw new Error("Texte trop long pour un QR code");
    const bits = [], pousse = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    pousse(4, 4); pousse(o.length, v < 10 ? 8 : 16); o.forEach(x => pousse(x, 8));
    const max = capacite(v) * 8;
    pousse(0, Math.min(4, max - bits.length)); while (bits.length % 8) bits.push(0);
    const d = []; for (let i = 0; i < bits.length; i += 8) d.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    for (let p = 0; d.length < capacite(v); p ^= 1) d.push(p ? 0x11 : 0xEC);
    // découpe en blocs, correction, puis entrelacement
    const [ec, ...groupes] = BLOCS[v], blocs = []; let pos = 0;
    groupes.forEach(([n, taille]) => { for (let i = 0; i < n; i++) { const b = d.slice(pos, pos + taille); pos += taille; blocs.push([b, correction(b, ec)]); } });
    const sortie = [], long = Math.max(...blocs.map(b => b[0].length));
    for (let i = 0; i < long; i++) blocs.forEach(b => { if (i < b[0].length) sortie.push(b[0][i]); });
    for (let i = 0; i < ec; i++) blocs.forEach(b => sortie.push(b[1][i]));
    return { v, codes: sortie };
  }

  function matrice(texte, masqueImpose) {
    const { v, codes } = octets(texte), n = 17 + 4 * v;
    const m = Array.from({ length: n }, () => new Array(n).fill(false)), fixe = Array.from({ length: n }, () => new Array(n).fill(false));
    const pose = (x, y, noir) => { m[y][x] = !!noir; fixe[y][x] = true; };
    // repères de coin (avec leur marge blanche)
    [[3, 3], [n - 4, 3], [3, n - 4]].forEach(([cx, cy]) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy)); pose(x, y, d !== 2 && d !== 4);
      }
    });
    // petits repères d'alignement
    const a = ALIGN[v];
    a.forEach((cy, i) => a.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === a.length - 1) || (i === a.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) pose(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    // lignes de synchronisation
    for (let i = 8; i < n - 8; i++) { if (!fixe[6][i]) pose(i, 6, i % 2 === 0); if (!fixe[i][6]) pose(6, i, i % 2 === 0); }
    // place réservée : format (et version à partir de 7)
    const format = masque => {
      let rem = masque; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((masque << 10) | rem) ^ 0x5412, b = i => (bits >>> i) & 1;   // correction M = 00
      for (let i = 0; i <= 5; i++) pose(8, i, b(i));
      pose(8, 7, b(6)); pose(8, 8, b(7)); pose(7, 8, b(8));
      for (let i = 9; i < 15; i++) pose(14 - i, 8, b(i));
      for (let i = 0; i < 8; i++) pose(n - 1 - i, 8, b(i));
      for (let i = 8; i < 15; i++) pose(8, n - 15 + i, b(i));
      pose(8, n - 8, true);
    };
    format(0);
    if (v >= 7) {
      let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (v << 12) | rem;
      for (let i = 0; i < 18; i++) { const x = n - 11 + i % 3, y = Math.floor(i / 3), noir = (bits >>> i) & 1; pose(x, y, noir); pose(y, x, noir); }
    }
    // les données, en zigzag depuis le coin bas droit
    let k = 0;
    for (let droite = n - 1; droite >= 1; droite -= 2) {
      if (droite === 6) droite = 5;
      for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
        const x = droite - j, monte = ((droite + 1) & 2) === 0, y = monte ? n - 1 - vert : vert;
        if (!fixe[y][x] && k < codes.length * 8) { m[y][x] = ((codes[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
      }
    }
    // le masque : on essaie les 8 et on garde le plus lisible
    const MASQUES = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const applique = i => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fixe[y][x] && MASQUES[i](x, y)) m[y][x] = !m[y][x]; };
    const penalite = () => {
      let p = 0, noirs = 0;
      const ligne = l => {   // suites de 5 et plus, faux repères 1:1:3:1:1
        let suite = 1;
        for (let i = 1; i <= l.length; i++) { if (i < l.length && l[i] === l[i - 1]) suite++; else { if (suite >= 5) p += suite - 2; suite = 1; } }
        const s = l.map(c => c ? "1" : "0").join("");
        for (let i = 0; i + 11 <= s.length; i++) { const t = s.substr(i, 11); if (t === "10111010000" || t === "00001011101") p += 40; }
      };
      for (let y = 0; y < n; y++) { ligne(m[y]); m[y].forEach(c => { if (c) noirs++; }); }
      for (let x = 0; x < n; x++) ligne(m.map(r => r[x]));
      for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      p += Math.floor(Math.abs(noirs * 20 - n * n * 10) / (n * n)) * 10;
      return p;
    };
    let meilleur = masqueImpose;
    if (meilleur == null) {
      let min = Infinity;
      for (let i = 0; i < 8; i++) { applique(i); format(i); const p = penalite(); if (p < min) { min = p; meilleur = i; } applique(i); }
    }
    applique(meilleur); format(meilleur);
    return m;
  }

  // Dessin : un seul tracé, bords nets, marge blanche de 4 cases (demandée par la norme pour être lu)
  function svg(texte, taille, titre) {
    const m = matrice(texte), n = m.length, marge = 4, t = n + 2 * marge;
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!m[y][x]) continue;
      let l = 1; while (x + l < n && m[y][x + l]) l++;
      d += `M${x + marge} ${y + marge}h${l}v1h-${l}z`; x += l - 1;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${taille || 220}" height="${taille || 220}" shape-rendering="crispEdges" role="img" aria-label="${String(titre || "QR code").replace(/[&<>"]/g, "")}"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  window.QROikos = { svg, matrice };
})();

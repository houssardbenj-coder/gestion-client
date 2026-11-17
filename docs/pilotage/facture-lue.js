/* Lecture automatique d'une facture PDF de presta : son numéro et son montant total.
   pdf.js (Mozilla, 3.11.174, copié à côté) n'est chargé qu'au premier besoin.
   Une photo ou un PDF scanné n'a pas de texte : la lecture rend alors { lu: false } et on tape à la main.
   Utilisé par le pilote : fiche presta › Factures du mois (rattacher, Valider). */
(function () {
  let chargement = null;
  function pdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!chargement) chargement = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "pdf.min.js";
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.js"; ok(window.pdfjsLib); };
      s.onerror = () => { chargement = null; ko(new Error("Lecteur de PDF introuvable")); };
      document.head.appendChild(s);
    });
    return chargement;
  }

  // Texte du PDF, ligne par ligne (les morceaux d'une même hauteur sont recollés)
  async function textePdf(donnees) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: donnees, isEvalSupported: false }).promise;
    const lignes = [];
    for (let n = 1; n <= Math.min(doc.numPages, 5); n++) {
      const page = await doc.getPage(n), c = await page.getTextContent(), parY = new Map();
      c.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const y = Math.round(it.transform[5] / 3) * 3;
        if (!parY.has(y)) parY.set(y, []);
        parY.get(y).push({ x: it.transform[4], t: it.str });
      });
      [...parY.keys()].sort((a, b) => b - a).forEach(y => lignes.push(parY.get(y).sort((a, b) => a.x - b.x).map(m => m.t).join(" ").replace(/\s+/g, " ").trim()));
    }
    return lignes;
  }

  // « 1 234,56 », « 1 234.56 », « 1.234,56 », « 565 » → nombre
  const MONTANT = /(\d{1,3}(?:[   .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)?/i;
  function nombre(t) {
    t = String(t).replace(/[   ]/g, "");
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/\.\d{3}$/.test(t)) t = t.replace(/\./g, "");
    const v = +t;
    return isFinite(v) ? Math.round(v * 100) / 100 : null;
  }

  // Le total à payer : le libellé le plus sûr d'abord ; le montant est sur la même ligne, ou juste en dessous
  const LIBELLES = [/net\s*[àa]\s*payer/i, /total\s*t\.?t\.?c\.?/i, /total\s*[àa]\s*payer|montant\s*[àa]\s*payer|reste\s*[àa]\s*payer/i,
    /montant\s*total|total\s*(?:de\s*la\s*)?facture/i, /total\s*h\.?t\.?/i, /^\s*total\b/i];
  function montantDe(lignes) {
    for (const lib of LIBELLES) {
      const vus = [];
      lignes.forEach((l, i) => {
        const m = lib.exec(l); if (!m) return;
        if (/sous[\s-]*total/i.test(l.slice(Math.max(0, m.index - 6), m.index + 2))) return;
        const apres = l.slice(m.index + m[0].length);
        const x = MONTANT.exec(apres.replace(/^[\s:=-]*/, "")) || (lignes[i + 1] && /^[\s\d.,  €]+(?:eur)?\s*$/i.test(lignes[i + 1]) ? MONTANT.exec(lignes[i + 1]) : null);
        const v = x ? nombre(x[1]) : null;
        if (v != null && v > 0) vus.push(v);
      });
      if (vus.length) return Math.max(...vus);   // la même ligne de total est souvent répétée
    }
    return null;
  }

  // Le numéro de la facture, jamais celui du SIRET, du RCS, de la TVA, du téléphone ou du client
  const PAS_LUI = /siret|siren|rcs|tva|t[ée]l|tel\.|client|commande|devis|ape|naf|iban|bic|assurance|police|contrat|page|urssaf|agr[ée]ment/i;
  function numeroDe(lignes) {
    const cands = [];
    const re = /(?:\bfacture\s*)?(?:n\s*[°ºo]\.?|num[ée]ro|\bno\.?|#)\s*(?:de\s*(?:la\s*)?facture\s*)?[:.]?\s*([A-Z]{0,8}[\s\-\/_.]?\d[\w\-\/_.]{0,30})/gi;
    lignes.forEach((l, i) => {
      let m; re.lastIndex = 0;
      while ((m = re.exec(l))) {
        const avant = l.slice(Math.max(0, m.index - 18), m.index + 3).toLowerCase(), num = m[1].replace(/\s+/g, "").replace(/[.\-\/_]+$/, "");
        if (PAS_LUI.test(avant) || PAS_LUI.test(m[0].slice(0, m[0].length - m[1].length))) continue;
        if (/^\d{9,}$/.test(num) || /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(num)) continue;   // SIRET / date
        let score = 0;
        if (/factur/i.test(l.slice(Math.max(0, m.index - 30), m.index + m[0].length))) score += 3;
        if (i < 15) score += 1;
        if (/[A-Z]/i.test(num) && /\d/.test(num)) score += 1;
        cands.push({ num, score, i });
      }
    });
    // « Facture F-2026-0003 » sans « n° »
    lignes.forEach((l, i) => { const m = /\bfacture\s+([A-Z]{1,8}[\-\/_.]?\d[\w\-\/_.]{1,30})/i.exec(l); if (m && /\d/.test(m[1])) cands.push({ num: m[1].replace(/[.\-\/_]+$/, ""), score: 3 + (i < 15 ? 1 : 0), i }); });
    cands.sort((a, b) => b.score - a.score || a.i - b.i);
    return cands.length ? cands[0].num.slice(0, 60) : null;
  }

  // url : adresse du fichier (lien signé). Rend { lu, numero, montant, lignes, raison }
  window.lireFacture = async function (url) {
    try {
      const r = await fetch(url);
      if (!r.ok) return { lu: false, raison: "fichier introuvable" };
      const type = (r.headers.get("content-type") || "").toLowerCase(), donnees = new Uint8Array(await r.arrayBuffer());
      const estPdf = type.includes("pdf") || (donnees[0] === 0x25 && donnees[1] === 0x50 && donnees[2] === 0x44 && donnees[3] === 0x46);
      if (!estPdf) return { lu: false, raison: "c'est une photo : le texte ne se lit pas tout seul" };
      const lignes = await textePdf(donnees);
      if (!lignes.join("").trim()) return { lu: false, raison: "PDF scanné, sans texte" };
      const numero = numeroDe(lignes), montant = montantDe(lignes);
      return { lu: numero != null || montant != null, numero, montant, lignes, raison: numero == null && montant == null ? "ni numéro ni total trouvés" : "" };
    } catch (x) { return { lu: false, raison: "lecture impossible (" + (x && x.message || x) + ")" }; }
  };
  window.lireFactureTexte = lignes => ({ numero: numeroDe(lignes), montant: montantDe(lignes) });   // pour les essais
})();

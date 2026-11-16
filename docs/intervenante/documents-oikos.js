/* ===================== Bibliothèque de documents OIKOS (SQL 65) — 16/11/2026 =====================
   Un seul fichier, recopié tel quel dans les trois pages (à garder IDENTIQUE) :
     tableau-de-bord/documents-oikos.js   pilote : page « Documents » (bibliothèque + suivi des envois)
     appli-intervenante/documents-oikos.js presta et chef : « Mes documents » (lire, remplir, signer)
     appli-client/documents-oikos.js      client : en haut de l'onglet Documents
   Il se sert de ce que chaque page a déjà : sb (Supabase), esc, toast, ico, contenu / fenetre / feuille.
   Les tables ne sont lues que par le gérant ; le presta et le client passent par mes_docs, doc_vu et doc_repondre.
   Recopier : python « documents-oikos - recopier.py » (à la racine de Plateforme intervenantes). */
(function () {
  "use strict";
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const IC = n => { try { return typeof ico === "function" ? ico(n) : ""; } catch (e) { return ""; } };
  const dateFr = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
  const heureFr = d => d ? new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const ACTIONS = { signer: "à signer", accepter: "à accepter", lire: "à lire" };
  const CATEGORIES = { contrat: "Contrat", mandat: "Mandat", reglement: "Règlement", information: "Information", formulaire: "Formulaire", autre: "Autre" };
  const POUR = { presta: "Presta", chef: "Chef de réseau", client: "Client" };
  const MOTIFS = { introuvable: "Ce document n'est plus disponible.", deja_fait: "Ce document est déjà signé ou refusé.", lecture_seule: "Votre espace est en lecture seule : demandez à OIKOS.",
    nom: "Écris ton nom et ton prénom en entier.", signature: "Signe dans le cadre avec le doigt (ou la souris).", case_vide: "Une case obligatoire est vide." };

  /* ---------- Styles (une fois) ---------- */
  function styles() {
    if (document.getElementById("dz-styles")) return;
    const s = document.createElement("style"); s.id = "dz-styles";
    s.textContent = `
.dz-doc{background:var(--surface,var(--carte,#fff));color:var(--ink,inherit);border:1px solid var(--line,#ddd);border-radius:14px;padding:18px 16px;line-height:1.5;font-size:14px;overflow-wrap:anywhere}
.dz-doc h2{font-family:var(--titre,Georgia,serif);font-size:22px;margin:4px 0 6px}
.dz-doc h3{font-family:var(--titre,Georgia,serif);font-size:16px;margin:16px 0 4px;color:var(--accent,#525A44)}
.dz-doc .dz-sur{letter-spacing:.14em;text-transform:uppercase;font-size:11px;font-weight:700;color:var(--accent,#525A44);margin:14px 0 2px}
.dz-doc .dz-sous{color:var(--muted,#666);margin:0 0 8px}
.dz-doc p{margin:0 0 8px}.dz-doc ul{margin:0 0 8px;padding-left:18px}
.dz-doc table{width:100%;border-collapse:collapse;margin:4px 0 10px;font-size:13px}.dz-doc td,.dz-doc th{border:1px solid var(--line,#ddd);padding:5px 7px;text-align:left;vertical-align:top}
.dz-doc th{background:var(--accent-soft,#E7E8DA)}
.dz-doc hr.dz-saut{border:0;border-top:2px dashed var(--line,#ccc);margin:18px 0}
.dz-doc mark{background:var(--warn-soft,#F4E9CC);color:inherit;border-radius:4px;padding:0 3px}
.dz-champs{display:grid;gap:10px}.dz-champs label{display:grid;gap:4px;font-size:14px}.dz-champs input[type=text],.dz-champs textarea,.dz-champs select{width:100%;box-sizing:border-box;font:inherit;padding:9px 10px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit}
.dz-champs .dz-aide{font-size:12px;color:var(--muted,#666)}.dz-coches{display:grid;gap:6px}.dz-coches label{display:flex;gap:8px;align-items:flex-start}
.dz-pad{position:relative;border:1.5px dashed var(--accent,#525A44);border-radius:12px;background:#fff;touch-action:none;height:170px}.dz-pad canvas{width:100%;height:100%;display:block;border-radius:12px;cursor:crosshair}
.dz-pad span{position:absolute;left:12px;bottom:8px;font-size:12px;color:#8a8a80;pointer-events:none}
.dz-liste{display:grid;gap:8px}.dz-ligne{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface,var(--carte,#fff))}
.dz-ligne b{display:block}.dz-ligne .dz-m{font-size:12px;color:var(--muted,#666)}.dz-boutons{display:flex;gap:6px;flex-wrap:wrap}
.dz-tag{display:inline-block;font-size:11px;font-weight:600;border-radius:999px;padding:2px 8px;background:var(--accent-soft,#E7E8DA);color:var(--accent,#525A44)}
.dz-tag.ok{background:var(--paie,#DFF0DC);color:var(--paie-ink,#2C6B29)}.dz-tag.non{background:var(--delai,#FBE3DE);color:var(--delai-ink,#8E2F1C)}.dz-tag.att{background:var(--warn-soft,#F4E9CC);color:var(--warn,#8A5A0E)}
.dz-bandeau{display:flex;gap:10px;align-items:center;justify-content:space-between;border-radius:14px;padding:12px 14px;margin:0 0 14px;background:var(--warn-soft,#F4E9CC);color:var(--warn,#8A5A0E)}
.dz-bandeau b{color:var(--ink,#222)}
.dz-tab{width:100%;border-collapse:collapse;font-size:13px}.dz-tab td,.dz-tab th{padding:6px;border-bottom:1px solid var(--line,#ddd);text-align:left;vertical-align:top}.dz-tab input,.dz-tab select{width:100%;box-sizing:border-box}
.dz-actions{display:grid;gap:10px;margin-top:12px}`;
    document.head.appendChild(s);
  }

  /* ---------- Le texte : {{cases}} puis mise en forme ---------- */
  const vide = v => v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
  function remplacer(texte, champs, valeurs, signeLe, marquer) {
    let t = String(texte || "");
    for (const c of champs || []) {
      if (!c || !/^[a-z0-9_]{1,40}$/.test(c.cle || "")) continue;
      const v = (valeurs || {})[c.cle]; let s;
      if (c.type === "cases") s = (c.choix || []).map(ch => (Array.isArray(v) && v.includes(ch) ? "☑ " : "☐ ") + ch).join("\n");
      else if (vide(v)) s = c.vide || (marquer ? "\u0001" + (c.libelle || c.cle) + "\u0002" : "……");
      else if (Array.isArray(v)) s = v.join(", ");
      else if (c.type === "case") s = v === true ? "oui" : "non";
      else s = String(v);
      t = t.split("{{" + c.cle + "}}").join(s.replace(/\{\{|\}\}/g, ""));
    }
    return t.split("{{date_signature}}").join(signeLe ? new Date(signeLe).toLocaleDateString("fr-FR") : "……");
  }
  const enLigne = s => E(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\u0001(.*?)\u0002/g, "<mark>$1</mark>");
  function miseEnForme(t) {
    return String(t || "").replace(/\r/g, "").split(/\n{2,}/).map(b => {
      b = b.replace(/^\n+|\n+$/g, ""); if (!b) return "";
      if (/^---$/.test(b)) return `<hr class="dz-saut">`;
      const l = b.split("\n");
      if (l.every(x => /^\|.*\|$/.test(x.trim()))) {
        const cel = x => x.trim().slice(1, -1).split("|").map(c => c.trim());
        return `<table>${l.map((x, i) => `<tr>${cel(x).map(c => i ? `<td>${enLigne(c)}</td>` : `<th>${enLigne(c)}</th>`).join("")}</tr>`).join("")}</table>`;
      }
      if (l.every(x => /^- /.test(x))) return `<ul>${l.map(x => `<li>${enLigne(x.slice(2))}</li>`).join("")}</ul>`;
      if (/^### /.test(b)) return `<p class="dz-sur">${enLigne(b.slice(4))}</p>`;
      if (/^## /.test(b)) return `<h3>${enLigne(b.slice(3))}</h3>`;
      if (/^# /.test(b)) return `<h2>${enLigne(b.slice(2))}</h2>`;
      if (/^> /.test(b)) return `<p class="dz-sous">${enLigne(b.slice(2))}</p>`;
      return `<p>${l.map(enLigne).join("<br>")}</p>`;
    }).join("");
  }
  const rendre = (contenu, champs, valeurs, signeLe, marquer) => miseEnForme(remplacer(contenu, champs, valeurs, signeLe, marquer));

  /* ---------- Formulaire des cases d'un destinataire (ou d'OIKOS) ---------- */
  function champsHtml(champs, valeurs, qui) {
    return (champs || []).filter(c => (c.qui || "destinataire") === qui).map(c => {
      const v = (valeurs || {})[c.cle], n = `data-cle="${E(c.cle)}"`, ob = c.obligatoire ? " *" : "", aideH = c.aide ? `<span class="dz-aide">${E(c.aide)}</span>` : "";
      if (c.type === "cases") return `<div><b style="font-size:14px">${E(c.libelle)}${ob}</b>${aideH}<div class="dz-coches" ${n} data-type="cases">${(c.choix || []).map(ch =>
        `<label><input type="checkbox" value="${E(ch)}" ${Array.isArray(v) && v.includes(ch) ? "checked" : ""}><span>${E(ch)}</span></label>`).join("")}</div></div>`;
      if (c.type === "choix") return `<label>${E(c.libelle)}${ob}<select ${n}><option value=""></option>${(c.choix || []).map(ch => `<option ${v === ch ? "selected" : ""}>${E(ch)}</option>`).join("")}</select>${aideH}</label>`;
      if (c.type === "case") return `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${n} data-type="case" ${v === true ? "checked" : ""}>${E(c.libelle)}${ob}</label>${aideH}`;
      if (c.type === "long") return `<label>${E(c.libelle)}${ob}<textarea rows="4" ${n}>${E(v || "")}</textarea>${aideH}</label>`;
      return `<label>${E(c.libelle)}${ob}<input type="text" ${n} value="${E(v ?? "")}" ${c.type === "date" ? 'placeholder="jj/mm/aaaa"' : ""}>${aideH}</label>`;
    }).join("");
  }
  function lireChamps(zone) {
    const v = {};
    zone.querySelectorAll("[data-cle]").forEach(el => {
      if (el.dataset.type === "cases") v[el.dataset.cle] = [...el.querySelectorAll("input:checked")].map(i => i.value);
      else if (el.dataset.type === "case") v[el.dataset.cle] = el.checked;
      else v[el.dataset.cle] = el.value.trim();
    });
    return v;
  }
  const manque = (champs, v, qui) => (champs || []).find(c => (c.qui || "destinataire") === qui && c.obligatoire && (c.type === "case" ? v[c.cle] !== true : vide(v[c.cle])));

  /* ---------- Signature au doigt ---------- */
  function pad(zone) {
    zone.innerHTML = `<canvas></canvas><span>Signe ici avec le doigt</span>`;
    const cv = zone.querySelector("canvas"), aide = zone.querySelector("span"), ctx = cv.getContext("2d");
    let points = 0, dessine = false, dernier = null;
    const taille = () => { const r = cv.getBoundingClientRect(), k = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * k); cv.height = Math.round(r.height * k); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineWidth = 2.2; ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = "#1b2a4a"; points = 0; aide.hidden = false; };
    requestAnimationFrame(taille);
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", e => { dessine = true; dernier = pos(e); cv.setPointerCapture(e.pointerId); aide.hidden = true; e.preventDefault(); });
    cv.addEventListener("pointermove", e => { if (!dessine) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(...dernier); ctx.lineTo(...p); ctx.stroke(); dernier = p; points++; e.preventDefault(); });
    const fin = () => { dessine = false; }; cv.addEventListener("pointerup", fin); cv.addEventListener("pointercancel", fin);
    return { effacer: taille, image: () => points < 15 ? null : (() => { const c2 = document.createElement("canvas"); c2.width = cv.width; c2.height = cv.height; const x = c2.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c2.width, c2.height); x.drawImage(cv, 0, 0); return c2.toDataURL("image/png"); })() };
  }

  /* ---------- Ouvrir un document reçu (presta, chef ou client) : remplir, lire, signer ---------- */
  async function lienSigne(seau, chemin) { const { data, error } = await sb.storage.from(seau).createSignedUrl(chemin, 300); if (error) throw error; return data.signedUrl; }
  function ouvrirRecu(cible, d, retour, tutoie) {
    const tu = (a, b) => tutoie ? a : b;
    styles();
    sb.rpc("doc_vu", { p_id: d.id }).then(() => {}, () => {});
    let valeurs = Object.assign({}, d.valeurs || {});
    const aRemplir = (d.champs || []).some(c => (c.qui || "destinataire") === "destinataire"), fait = d.etat === "fait" || d.etat === "refuse";
    cible.innerHTML = `<div class="dz-boutons" style="margin-bottom:10px"><button class="btn flat" type="button" data-retour>‹ ${tu("Mes documents", "Retour")}</button></div>
      <h1 style="margin:0 0 4px">${E(d.titre)}${d.numero > 1 ? ` <span class="dz-tag">version ${d.numero}</span>` : ""}</h1>
      ${d.numero > 1 && !fait ? `<p class="small" style="margin:0 0 6px">${tu("Cette version remplace celle que tu avais déjà signée : relis-la, l'ancienne reste gardée telle quelle.", "Cette version remplace celle que vous aviez déjà signée : relisez-la, l'ancienne reste gardée telle quelle.")}</p>` : ""}
      ${d.etat === "fait" ? `<p class="small" style="margin:0 0 6px">${IC("cadenas")} ${tu("Document signé : il ne peut plus être modifié.", "Document signé : il ne peut plus être modifié.")}${d.remplace_par ? tu(" Une nouvelle version t'a été envoyée.", " Une nouvelle version vous a été envoyée.") : ""}</p>` : ""}
      <p class="muted small" style="margin:0 0 12px">${fait ? (d.etat === "fait" ? (d.action === "signer" ? "Signé" : d.action === "accepter" ? "Accepté" : "Lu") + " le " + heureFr(d.fait_le) : "Refusé le " + heureFr(d.fait_le)) : "Document " + ACTIONS[d.action] + (d.echeance ? " avant le " + dateFr(d.echeance) : "")}</p>
      ${!fait && aRemplir ? `<section class="card" style="margin-bottom:12px"><b>${tu("À remplir par toi", "À remplir")}</b><p class="muted small" style="margin:2px 0 10px">${tu("Ce que tu écris apparaît dans le document en dessous.", "Ce que vous écrivez apparaît dans le document en dessous.")}</p><div class="dz-champs" id="dz-champs">${champsHtml(d.champs, valeurs, "destinataire")}</div></section>` : ""}
      ${d.fichier ? `<button class="btn" type="button" data-fichier style="margin-bottom:10px">${IC("doc")} Ouvrir le document joint</button>` : ""}
      ${d.contenu ? `<div class="dz-doc" id="dz-texte"></div>` : ""}
      ${fait && d.pdf_chemin ? `<button class="btn" type="button" data-pdf style="margin-top:10px">${IC("telecharger")} Télécharger le PDF signé</button>` : ""}
      ${fait && !d.pdf_chemin && d.etat === "fait" && d.pdf_etat ? `<p class="muted small" style="margin-top:10px">Le PDF signé arrive dans quelques minutes.</p>` : ""}
      ${fait ? "" : `<section class="card dz-actions">
        ${d.action === "signer" ? `<label class="dz-champs"><span>${tu("Ton nom et ton prénom", "Votre nom et votre prénom")}</span><input type="text" id="dz-nom" autocomplete="name"></label>
          <div class="dz-pad" id="dz-pad"></div><div class="dz-boutons"><button class="btn flat" type="button" data-effacer>Effacer la signature</button></div>` : ""}
        ${d.action !== "lire" ? `<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="dz-lu"><span>${tu("J'ai lu ce document en entier et je l'accepte.", "J'ai lu ce document en entier et je l'accepte.")}</span></label>` : ""}
        <button class="btn primary" type="button" data-valider>${d.action === "signer" ? "Signer" : d.action === "accepter" ? "J'accepte" : "J'ai lu"}</button>
        ${d.action !== "lire" ? `<button class="btn flat" type="button" data-refuser>${tu("Je ne suis pas d'accord", "Je ne suis pas d'accord")}</button>` : ""}
        <p class="muted small" style="margin:0">${d.action === "signer" ? tu("Ta signature, l'heure et une empreinte du texte sont gardées par OIKOS : elles valent signature. Tu recevras le PDF signé ici.", "Votre signature, l'heure et une empreinte du texte sont gardées par OIKOS : elles valent signature. Le PDF signé arrivera dans vos documents.") : ""}</p></section>`}`;
    const texte = cible.querySelector("#dz-texte");
    const dessiner = () => { if (texte) texte.innerHTML = fait && d.texte_final ? miseEnForme(d.texte_final) : rendre(d.contenu, d.champs, valeurs, null, true); };
    dessiner();
    const zc = cible.querySelector("#dz-champs");
    if (zc) zc.addEventListener("input", () => { valeurs = Object.assign({}, d.valeurs || {}, lireChamps(zc)); dessiner(); });
    const sig = cible.querySelector("#dz-pad") ? pad(cible.querySelector("#dz-pad")) : null;
    cible.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-retour")) return retour();
      if (b.hasAttribute("data-effacer")) return sig && sig.effacer();
      try {
        if (b.hasAttribute("data-fichier")) return window.open(await lienSigne(d.fichier_seau || "modeles", d.fichier), "_blank", "noopener");
        if (b.hasAttribute("data-pdf")) return window.open(await lienSigne(d.pdf_seau, d.pdf_chemin), "_blank", "noopener");
      } catch (err) { return toast("Le fichier ne s'ouvre pas : " + (err.message || err)); }
      if (b.hasAttribute("data-refuser")) {
        const motif = prompt(tu("Dis à OIKOS ce qui ne va pas (facultatif) :", "Dites à OIKOS ce qui ne va pas (facultatif) :"), "");
        if (motif === null) return;
        const r = await sb.rpc("doc_repondre", { p_id: d.id, p_valeurs: {}, p_nom: null, p_signature: null, p_accepte: false, p_motif: motif });
        if (r.error || (r.data && r.data.ok === false)) return toast(r.error ? "Pas envoyé : " + r.error.message : MOTIFS[r.data.motif] || "Pas envoyé");
        toast("OIKOS est prévenu."); return retour();
      }
      if (b.hasAttribute("data-valider")) {
        const v = zc ? lireChamps(zc) : {};
        const m = manque(d.champs, Object.assign({}, d.valeurs || {}, v), "destinataire");
        if (m) { toast("Case à remplir : " + m.libelle); const el = zc && zc.querySelector(`[data-cle="${m.cle}"]`); if (el) el.focus && el.focus(); return; }
        let nom = null, image = null;
        if (d.action === "signer") {
          nom = (cible.querySelector("#dz-nom").value || "").trim();
          if (nom.length < 3) return toast(MOTIFS.nom);
          image = sig && sig.image(); if (!image) return toast(MOTIFS.signature);
        }
        if (d.action !== "lire" && !cible.querySelector("#dz-lu").checked) return toast(tu("Coche « J'ai lu ce document… » pour continuer.", "Cochez « J'ai lu ce document… » pour continuer."));
        b.disabled = true;
        const r = await sb.rpc("doc_repondre", { p_id: d.id, p_valeurs: v, p_nom: nom, p_signature: image, p_accepte: true, p_motif: null });
        b.disabled = false;
        if (r.error) return toast("Pas enregistré : " + r.error.message);
        if (r.data && r.data.ok === false) return toast(r.data.motif === "case_vide" ? "Case à remplir : " + (r.data.libelle || "") : MOTIFS[r.data.motif] || "Pas enregistré");
        toast(d.action === "signer" ? "Signé, merci !" : "Enregistré, merci !"); return retour();
      }
    };
  }
  async function mesDocs() { const { data, error } = await sb.rpc("mes_docs"); if (error) throw error; return data || []; }
  const aFaire = d => d.etat === "envoye" || d.etat === "vu";
  const ligneRecue = d => `<button class="dz-ligne" type="button" data-ouvrir="${d.id}" style="text-align:left;width:100%;cursor:pointer">
      <span><b>${E(d.titre)}${d.numero > 1 ? ` <span class="dz-tag">version ${d.numero}</span>` : ""}${d.remplace_par ? ` <span class="dz-tag">remplacé par une nouvelle version</span>` : ""}</b><span class="dz-m">${aFaire(d) ? "Envoyé le " + dateFr(d.envoye_le) + (d.echeance ? " · avant le " + dateFr(d.echeance) : "")
        : d.etat === "fait" ? (d.action === "signer" ? "Signé" : d.action === "accepter" ? "Accepté" : "Lu") + " le " + dateFr(d.fait_le) : "Refusé le " + dateFr(d.fait_le)}</span></span>
      ${aFaire(d) ? `<span class="dz-tag att">${ACTIONS[d.action]}</span>` : d.etat === "fait" ? `<span class="dz-tag ok">${IC("ok")} fait</span>` : `<span class="dz-tag non">refusé</span>`}</button>`;

  /* ---------- Appli presta / chef : écran « Mes documents » ---------- */
  async function presta() {
    styles();
    const z = document.getElementById("contenu");
    const liste = async () => {
      const docs = await mesDocs(), att = docs.filter(aFaire), autres = docs.filter(d => !aFaire(d));
      z.innerHTML = `<h1>Mes documents</h1><p class="muted" style="margin-bottom:14px">Les documents qu'OIKOS te demande de lire, de remplir ou de signer, et ceux que tu as déjà signés.</p>
        ${att.length ? `<h3>À faire</h3><div class="dz-liste">${att.map(ligneRecue).join("")}</div>` : `<div class="card"><p>Rien à signer pour l'instant.</p></div>`}
        ${autres.length ? `<h3 style="margin-top:18px">Déjà faits</h3><div class="dz-liste">${autres.map(ligneRecue).join("")}</div>` : ""}
        <p class="muted small" style="margin-top:18px">Tes papiers à envoyer (pièce d'identité, attestations…) sont dans Moi › Mes papiers pour OIKOS.</p>`;
      z.onclick = e => { const b = e.target.closest("[data-ouvrir]"); if (!b) return; const d = docs.find(x => x.id === b.dataset.ouvrir); if (d) { window.scrollTo(0, 0); ouvrirRecu(z, d, () => { liste().catch(erreur); }, true); } };
    };
    const erreur = e => { z.innerHTML = `<h1>Mes documents</h1><p class="muted">${E(e.message || e)}</p>`; };
    await liste();
  }
  /* Rappel sur Aujourd'hui et bouton dans Moi (appli presta) */
  async function rappel(onglet) {
    if (onglet !== "jour" && onglet !== "moi") return;
    styles();
    let docs = []; try { docs = await mesDocs(); } catch (e) { return; }
    const n = docs.filter(aFaire).length, z = document.getElementById("contenu"); if (!z) return;
    if (onglet === "jour" && n) z.insertAdjacentHTML("afterbegin", `<div class="dz-bandeau"><span><b>${n === 1 ? "Un document t'attend" : n + " documents t'attendent"}</b><br>À lire et signer dans ton appli.</span><button class="btn" type="button" id="dz-aller">Voir</button></div>`);
    if (onglet === "moi") {
      const ref = document.getElementById("papiers");
      const html = `<button class="btn${n ? " primary" : ""}" id="dz-aller" style="margin-top:14px;width:100%"><span class="ic">${IC("stylo")}</span>Mes documents à lire et signer${n ? " (" + n + ")" : ""}</button>`;
      if (ref) ref.insertAdjacentHTML("beforebegin", html); else z.insertAdjacentHTML("beforeend", html);
    }
    const b = document.getElementById("dz-aller"); if (b) b.onclick = () => accueil("docs");
  }

  /* ---------- Appli client : en haut de l'onglet Documents ---------- */
  async function client(z) {
    styles();
    let docs = []; try { docs = await mesDocs(); } catch (e) { return; }
    const att = docs.filter(aFaire), attente = docs.filter(d => d.etat === "fait" && !d.pdf_chemin && d.pdf_etat);
    if (!att.length && !attente.length) return;
    const h1 = z.querySelector("h1");
    const bloc = document.createElement("section"); bloc.id = "dz-client";
    bloc.innerHTML = `${att.length ? `<h3>À lire et signer</h3><div class="dz-liste">${att.map(ligneRecue).join("")}</div>` : ""}
      ${attente.length ? `<p class="muted small" style="margin-top:8px">${attente.length === 1 ? "Un document signé est en préparation" : attente.length + " documents signés sont en préparation"} : le PDF apparaîtra ici dans quelques minutes.</p>` : ""}`;
    if (h1 && h1.nextElementSibling) h1.nextElementSibling.after(bloc); else z.prepend(bloc);
    bloc.addEventListener("click", e => {
      const b = e.target.closest("[data-ouvrir]"); if (!b) return; e.stopPropagation();
      const d = docs.find(x => x.id === b.dataset.ouvrir); if (!d) return;
      feuille(`<div id="dz-feuille"></div>`, (el, fermer) => ouvrirRecu(el.querySelector("#dz-feuille"), d, () => { fermer(); const zz = document.getElementById("dz-client"); if (zz) zz.remove(); client(z); }, false));
    });
  }

  /* ===================== Pilote : page « Documents » ===================== */
  let vuePilote = "suivi", filtreSuivi = "attente";
  async function pilote() {
    styles();
    const [modeles, envois, profils, clientsL, comptes, pieces] = await Promise.all([
      q(sb.from("doc_modeles").select("*").order("ordre").order("titre")),
      q(sb.from("doc_envois").select("id,modele_id,titre,action,etat,intervenante_id,client_id,envoye_le,vu_le,fait_le,motif,echeance,pdf_etat,pdf_seau,pdf_chemin,pdf_erreur,signe_nom,numero,remplace").order("envoye_le", { ascending: false }).limit(500)),
      q(sb.from("profils").select("id,prenom,nom,email,telephone,adresse,siret,activites,actif,role,statut,cheffe_reseau").neq("role", "gerant")),
      q(sb.from("clients").select("id,nom,adresse,email,telephone,etat").order("nom")),
      sb.from("comptes_clients").select("id,client_id,actif").then(r => r.data || [], () => []),
      q(sb.from("pieces_demandees").select("id,libelle").order("ordre"))]);
    const parId = l => Object.fromEntries(l.map(x => [x.id, x]));
    const P = parId(profils), C = parId(clientsL), M = parId(modeles);
    const avecCompte = new Set(comptes.filter(k => k.actif).map(k => k.client_id));
    const qui = e => e.intervenante_id ? { nom: nomP(P[e.intervenante_id]), type: P[e.intervenante_id] && P[e.intervenante_id].cheffe_reseau ? "Chef" : "Presta" } : { nom: (C[e.client_id] || {}).nom || "Client", type: "Client" };
    const etatTag = e => e.etat === "fait" ? `<span class="dz-tag ok">${e.action === "signer" ? "Signé" : e.action === "accepter" ? "Accepté" : "Lu"} le ${dateFr(e.fait_le)}</span>`
      : e.etat === "refuse" ? `<span class="dz-tag non" title="${E(e.motif || "")}">Refusé${e.motif ? " : " + E(e.motif.slice(0, 40)) : ""}</span>`
      : e.etat === "retire" ? `<span class="dz-tag">Retiré</span>` : e.etat === "vu" ? `<span class="dz-tag att">Ouvert le ${dateFr(e.vu_le)}</span>` : `<span class="dz-tag att">Pas encore ouvert</span>`;
    const pdfTag = e => e.pdf_etat === "fait" && e.pdf_chemin ? `<button class="btn" data-pdf="${e.id}">${IC("doc")} PDF</button>` : e.pdf_etat === "erreur" ? `<span class="dz-tag non" title="${E(e.pdf_erreur || "")}">PDF en erreur</span>` : e.pdf_etat ? `<span class="dz-tag att">PDF en préparation</span>` : "";
    const filtres = { attente: ["À signer", e => e.etat === "envoye" || e.etat === "vu"], fait: ["Signés", e => e.etat === "fait"], refuse: ["Refusés", e => e.etat === "refuse"], tous: ["Tous", e => e.etat !== "retire"] };
    const nbAtt = envois.filter(filtres.attente[1]).length;
    const el = contenu(`<h1>Documents</h1>
      <p class="muted small" style="margin:6px 0 12px">Ta bibliothèque de modèles (contrats, mandats, règlements…) et ce que chaque presta, chef ou client doit lire ou signer. Une fois signé, le PDF part tout seul dans son dossier Drive.</p>
      <div class="sous-menu" style="margin-bottom:12px"><button class="chip" data-vue="suivi" aria-pressed="${vuePilote === "suivi"}">Suivi des envois${nbAtt ? " (" + nbAtt + ")" : ""}</button><button class="chip" data-vue="biblio" aria-pressed="${vuePilote === "biblio"}">Bibliothèque (${modeles.filter(m => m.actif).length})</button></div>
      <div id="dz-zone"></div>`);
    const zone = el.querySelector("#dz-zone");
    const dessinerSuivi = () => {
      const l = envois.filter(filtres[filtreSuivi][1]);
      zone.innerHTML = `<div class="sous-menu" style="margin-bottom:10px">${Object.entries(filtres).map(([k, [t, f]]) => `<button class="chip" data-filtre="${k}" aria-pressed="${k === filtreSuivi}">${t} (${envois.filter(f).length})</button>`).join("")}</div>
        ${l.length ? `<div class="dz-liste">${l.map(e => { const w = qui(e), apres = envois.find(v => v.remplace === e.id && v.etat !== "retire"); return `<div class="dz-ligne"><span><b>${E(e.titre)}${(e.numero || 1) > 1 ? ` <span class="dz-tag">version ${e.numero}</span>` : ""}${apres ? ` <span class="dz-tag">remplacé par la version ${apres.numero}</span>` : ""}</b><span class="dz-m">${E(w.type)} : ${E(w.nom)} · envoyé le ${dateFr(e.envoye_le)}${e.echeance ? " · avant le " + dateFr(e.echeance) : ""}${e.signe_nom ? " · signé par " + E(e.signe_nom) : ""}</span></span>
          <span class="dz-boutons">${etatTag(e)}${pdfTag(e)}<button class="btn flat" data-voir="${e.id}">Voir</button>${e.etat === "envoye" || e.etat === "vu" ? `<button class="btn flat stop" data-retirer="${e.id}">Retirer</button>` : ""}${e.etat === "fait" && !apres ? `<button class="btn flat" data-version="${e.id}" title="Le document signé reste tel quel ; une nouvelle version part à signer">Nouvelle version</button>` : ""}${e.etat === "refuse" || (e.etat === "fait" && e.pdf_etat === "erreur") ? `<button class="btn flat" data-renvoyer="${e.id}">${e.etat === "refuse" ? "Renvoyer" : "Refaire le PDF"}</button>` : ""}</span></div>`; }).join("")}</div>`
          : `<div class="card"><p class="muted">Rien ici. Pour envoyer un document : Bibliothèque › Mettre à disposition.</p></div>`}`;
    };
    const dessinerBiblio = () => {
      const ligne = m => { const n = envois.filter(e => e.modele_id === m.id && e.etat !== "retire"), s = n.filter(e => e.etat === "fait").length;
        return `<div class="dz-ligne" style="${m.actif ? "" : "opacity:.6"}"><span><b>${E(m.titre)}</b><span class="dz-m">${CATEGORIES[m.categorie] || ""} · ${ACTIONS[m.action]} · pour ${m.pour.map(p => POUR[p]).join(", ")} · version ${m.version}${m.fichier ? " · fichier joint" : ""}${n.length ? " · " + n.length + " envoyé" + (n.length > 1 ? "s" : "") + ", " + s + " fait" + (s > 1 ? "s" : "") : ""}</span></span>
          <span class="dz-boutons">${m.actif ? `<button class="btn primary" data-envoyer="${m.id}">Mettre à disposition</button>` : ""}<button class="btn" data-modifier="${m.id}">${IC("stylo")} Modifier</button><button class="btn flat" data-archiver="${m.id}">${m.actif ? "Archiver" : "Réactiver"}</button></span></div>`; };
      zone.innerHTML = `<div class="dz-boutons" style="margin-bottom:10px"><button class="btn" data-nouveau="texte">${IC("plus")} Nouveau modèle à remplir</button><button class="btn" data-nouveau="fichier">${IC("trombone")} Nouveau modèle à partir d'un fichier (PDF)</button></div>
        <div class="dz-liste">${modeles.filter(m => m.actif).map(ligne).join("") || `<div class="card"><p class="muted">Aucun modèle.</p></div>`}</div>
        ${modeles.some(m => !m.actif) ? `<details style="margin-top:14px"><summary class="muted">Modèles archivés (${modeles.filter(m => !m.actif).length})</summary><div class="dz-liste" style="margin-top:8px">${modeles.filter(m => !m.actif).map(ligne).join("")}</div></details>` : ""}
        <p class="muted small" style="margin-top:14px">Dans le texte : <b># Titre</b>, <b>## Article</b>, <b>- puce</b>, <b>**gras**</b>, <b>| case | case |</b> pour un tableau, <b>---</b> pour un saut de page, et <b>{{nom_de_case}}</b> pour une case à remplir. <b>{{date_signature}}</b> se remplit seul.</p>`;
    };
    const redessiner = () => { el.querySelectorAll("[data-vue]").forEach(b => b.setAttribute("aria-pressed", b.dataset.vue === vuePilote)); vuePilote === "suivi" ? dessinerSuivi() : dessinerBiblio(); };
    redessiner();
    el.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return;
      try {
        if (b.dataset.vue) { vuePilote = b.dataset.vue; return redessiner(); }
        if (b.dataset.filtre) { filtreSuivi = b.dataset.filtre; return dessinerSuivi(); }
        if (b.dataset.pdf) { const x = envois.find(v => v.id === b.dataset.pdf); return window.open(await lienSigne(x.pdf_seau, x.pdf_chemin), "_blank", "noopener"); }
        if (b.dataset.voir) return voirEnvoi(b.dataset.voir);
        if (b.dataset.version) return nouvelleVersion(b.dataset.version);
        if (b.dataset.retirer) { if (!confirm("Retirer ce document ? La personne ne le verra plus.")) return; await q(sb.from("doc_envois").update({ etat: "retire" }).eq("id", b.dataset.retirer)); toast("Retiré"); return afficher("documents"); }
        if (b.dataset.renvoyer) {
          const x = envois.find(v => v.id === b.dataset.renvoyer);
          if (x.etat === "refuse") { if (!confirm("Le remettre à signer ? (le texte reste le même)")) return; await q(sb.from("doc_envois").update({ etat: "envoye", fait_le: null, motif: null, vu_le: null }).eq("id", x.id)); }
          else await q(sb.from("doc_envois").update({ pdf_etat: "a_faire", pdf_erreur: null }).eq("id", x.id));
          toast("C'est reparti"); return afficher("documents");
        }
        if (b.dataset.archiver) { const m = M[b.dataset.archiver]; await q(sb.from("doc_modeles").update({ actif: !m.actif }).eq("id", m.id)); return afficher("documents"); }
        if (b.dataset.nouveau) return editerModele(null, b.dataset.nouveau, pieces);
        if (b.dataset.modifier) return editerModele(M[b.dataset.modifier], null, pieces);
        if (b.dataset.envoyer) return mettreADisposition(M[b.dataset.envoyer], { profils, clientsL, avecCompte });
      } catch (err) { toast("Ça n'a pas marché : " + (err.message || err)); }
    };
  }
  const nomP = p => p ? (((p.prenom || "") + " " + (p.nom || "")).trim() || p.email || "?") : "?";

  /* ---------- Nouvelle version d'un document signé (le signé ne bouge jamais : SQL 68) ---------- */
  async function nouvelleVersion(id) {
    const d = await q(sb.from("doc_envois").select("*").eq("id", id).single());
    const n = (d.numero || 1) + 1;
    const vals = Object.assign({}, d.valeurs || {});
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Nouvelle version (version ${n})</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <p class="muted small" style="margin:0">« ${E(d.titre)} » signé le ${heureFr(d.fait_le)} reste gardé tel quel, avec son PDF. Corrige le texte ci-dessous : la personne recevra la version ${n} à relire et signer, avec ses cases déjà remplies comme la dernière fois.</p>
      ${d.contenu ? `<textarea id="nv-contenu" rows="14" style="width:100%;box-sizing:border-box;font:13px/1.45 ui-monospace,Consolas,monospace">${E(d.contenu)}</textarea>` : `<p class="small">Document à partir d'un fichier : la même pièce jointe repart à accepter.</p>`}
      ${(d.champs || []).some(c => c.qui === "oikos") ? `<section class="card"><b>À remplir par OIKOS</b><div class="dz-champs" id="nv-oikos" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${champsHtml(d.champs, vals, "oikos")}</div></section>` : ""}
      <label class="dz-champs" style="max-width:260px"><span>À faire avant le (facultatif)</span><input type="date" id="nv-echeance"></label>
      <div class="dz-boutons" style="justify-content:flex-end"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="nv-ok">Envoyer la version ${n}</button></div>`, (f, fermer) => {
      f.querySelector("#nv-ok").onclick = async ev => {
        const bouton = ev.currentTarget;
        try {
          const zo = f.querySelector("#nv-oikos"), vo = zo ? lireChamps(zo) : {};
          const mq = manque(d.champs, vo, "oikos"); if (mq) return toast("Case à remplir : " + mq.libelle);
          const contenuN = f.querySelector("#nv-contenu") ? f.querySelector("#nv-contenu").value.trim() : null;
          if (d.contenu && !contenuN) return toast("Le texte ne peut pas être vide");
          bouton.disabled = true;
          await q(sb.from("doc_envois").insert({ modele_id: d.modele_id, version: d.version, titre: d.titre, categorie: d.categorie, action: d.action,
            contenu: d.contenu ? contenuN : null, fichier: d.fichier, fichier_seau: d.fichier_seau, champs: d.champs, valeurs: Object.assign({}, vals, vo),
            intervenante_id: d.intervenante_id, client_id: d.client_id, piece_id: d.piece_id, echeance: f.querySelector("#nv-echeance").value || null,
            remplace: d.id, numero: n }));
          toast("Version " + n + " envoyée"); fermer(); vuePilote = "suivi"; filtreSuivi = "attente"; afficher("documents");
        } catch (err) { bouton.disabled = false; toast("Pas envoyé : " + (err.message || err)); }
      };
    });
  }

  async function voirEnvoi(id) {
    const d = await q(sb.from("doc_envois").select("*").eq("id", id).single());
    const corps = d.contenu ? (d.etat === "fait" && d.texte_final ? miseEnForme(d.texte_final) : rendre(d.contenu, d.champs, d.valeurs, null, true)) : "";
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${E(d.titre)}</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      ${d.etat === "fait" && d.action === "signer" ? `<div class="card"><b>Signé par ${E(d.signe_nom)} le ${heureFr(d.fait_le)}</b>${d.signature ? `<img src="${E(d.signature)}" alt="Signature" style="max-width:280px;display:block;margin-top:6px;background:#fff;border-radius:8px">` : ""}<p class="muted small" style="margin:6px 0 0">Empreinte : <code>${E(d.empreinte || "")}</code></p></div>` : ""}
      ${d.fichier ? `<button class="btn" id="dz-f">${IC("doc")} Ouvrir le fichier joint</button>` : ""}
      ${corps ? `<div class="dz-doc" style="max-height:60vh;overflow:auto">${corps}</div>` : ""}`, (f) => {
      const bf = f.querySelector("#dz-f"); if (bf) bf.onclick = async () => window.open(await lienSigne(d.fichier_seau || "modeles", d.fichier), "_blank", "noopener");
    });
  }

  /* ---------- Créer ou modifier un modèle ---------- */
  const TYPES = [["texte", "Texte court"], ["long", "Texte long"], ["date", "Date"], ["cases", "Cases à cocher"], ["choix", "Liste de choix"], ["case", "Une case à cocher"]];
  const SOURCES = [["", "—"], ["nom_complet", "Nom et prénom"], ["adresse", "Adresse"], ["siret", "SIRET"], ["email", "E-mail"], ["telephone", "Téléphone"], ["activites", "Activités"]];
  function editerModele(m, sorte, pieces) {
    const nouveau = !m;
    m = m || { titre: "", categorie: sorte === "fichier" ? "information" : "contrat", pour: ["presta"], action: sorte === "fichier" ? "accepter" : "signer", contenu: sorte === "fichier" ? null : "# Titre du document\n\n{{nom_complet}}, …\n\nFait à Marseille, le {{date_signature}}.", fichier: null, champs: sorte === "fichier" ? [] : [{ cle: "nom_complet", libelle: "Nom et prénom", type: "texte", qui: "destinataire", source: "nom_complet", obligatoire: true }], piece_id: null, actif: true };
    let champs = JSON.parse(JSON.stringify(m.champs || [])), fichierNeuf = null;
    const ligneChamp = (c, i) => `<tr data-i="${i}"><td><input data-k="cle" value="${E(c.cle)}" placeholder="nom_de_case"></td><td><input data-k="libelle" value="${E(c.libelle || "")}"></td>
      <td><select data-k="qui"><option value="destinataire" ${c.qui !== "oikos" ? "selected" : ""}>La personne</option><option value="oikos" ${c.qui === "oikos" ? "selected" : ""}>OIKOS, à l'envoi</option></select></td>
      <td><select data-k="type">${TYPES.map(([k, t]) => `<option value="${k}" ${(c.type || "texte") === k ? "selected" : ""}>${t}</option>`).join("")}</select><input data-k="choix" value="${E((c.choix || []).join(" ; "))}" placeholder="choix ; choix" style="margin-top:3px"></td>
      <td><select data-k="source">${SOURCES.map(([k, t]) => `<option value="${k}" ${(c.source || "") === k ? "selected" : ""}>${t}</option>`).join("")}</select><input data-k="defaut" value="${E(c.defaut || "")}" placeholder="valeur par défaut" style="margin-top:3px"></td>
      <td><input data-k="aide" value="${E(c.aide || "")}" placeholder="aide"><input data-k="vide" value="${E(c.vide || "")}" placeholder="si vide : Néant…" style="margin-top:3px"></td>
      <td><label style="white-space:nowrap"><input type="checkbox" data-k="obligatoire" ${c.obligatoire ? "checked" : ""}> oblig.</label><button class="btn flat stop" data-suppr="${i}" title="Retirer">${IC("croix") || "×"}</button></td></tr>`;
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${nouveau ? "Nouveau modèle" : "Modifier le modèle"}</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <div class="dz-champs" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <label>Titre<input type="text" id="m-titre" value="${E(m.titre)}"></label>
        <label>Sorte<select id="m-cat">${Object.entries(CATEGORIES).map(([k, t]) => `<option value="${k}" ${m.categorie === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Ce qu'on demande<select id="m-action">${[["signer", "Signer"], ["accepter", "Accepter (case à cocher)"], ["lire", "Lire seulement"]].map(([k, t]) => `<option value="${k}" ${m.action === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Papier de l'appli rempli une fois signé<select id="m-piece"><option value="">—</option>${pieces.map(p => `<option value="${p.id}" ${m.piece_id === p.id ? "selected" : ""}>${E(p.libelle)}</option>`).join("")}</select></label>
      </div>
      <div><b style="font-size:14px">Pour qui</b> ${Object.entries(POUR).map(([k, t]) => `<label style="margin-left:10px"><input type="checkbox" data-pour="${k}" ${m.pour.includes(k) ? "checked" : ""}> ${t}</label>`).join("")}</div>
      <div><b style="font-size:14px">Fichier joint</b> <span class="muted small">${m.fichier ? "un fichier est joint" : "aucun"}</span> <button class="btn" id="m-fic">${IC("trombone")} ${m.fichier ? "Remplacer" : "Joindre un PDF"}</button>${m.fichier ? ` <button class="btn flat" id="m-ficvoir">Voir</button> <button class="btn flat stop" id="m-ficret">Retirer</button>` : ""}<input type="file" id="m-fichier" accept=".pdf,application/pdf" hidden></div>
      <div class="dz-boutons"><button class="btn" id="m-onglet-t" aria-pressed="true">Texte</button><button class="btn flat" id="m-onglet-a">Aperçu</button><span class="muted small">Texte vide = seulement le fichier joint.</span></div>
      <textarea id="m-contenu" rows="16" style="width:100%;box-sizing:border-box;font:13px/1.45 ui-monospace,Consolas,monospace">${E(m.contenu || "")}</textarea>
      <div id="m-apercu" class="dz-doc" style="display:none;max-height:55vh;overflow:auto"></div>
      <div><b style="font-size:14px">Les cases à remplir</b> <span class="muted small">« La personne » : elle les remplit dans son appli (préremplies si une source est choisie). « OIKOS » : tu les remplis au moment de l'envoi (valeur par défaut gardée ici).</span>
        <div style="overflow:auto"><table class="dz-tab"><tr><th>Nom de case</th><th>Libellé</th><th>Qui remplit</th><th>Type</th><th>Source / défaut</th><th>Aide / si vide</th><th></th></tr><tbody id="m-champs"></tbody></table></div>
        <div class="dz-boutons" style="margin-top:6px"><button class="btn" id="m-plus">${IC("plus")} Ajouter une case</button><button class="btn" id="m-detecter">Ajouter les cases du texte</button></div></div>
      <div class="dz-boutons" style="justify-content:flex-end"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="m-enr">Enregistrer</button></div>`, (f, fermer) => {
      f.style.maxWidth = "1100px";
      const tb = f.querySelector("#m-champs"), ta = f.querySelector("#m-contenu"), ap = f.querySelector("#m-apercu");
      const lireTable = () => [...tb.querySelectorAll("tr")].map(tr => { const v = k => tr.querySelector(`[data-k="${k}"]`); const c = { cle: v("cle").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40), libelle: v("libelle").value.trim(), qui: v("qui").value, type: v("type").value, obligatoire: v("obligatoire").checked };
        const ch = v("choix").value.split(";").map(s => s.trim()).filter(Boolean); if (ch.length && (c.type === "cases" || c.type === "choix")) c.choix = ch;
        if (v("source").value) c.source = v("source").value; if (v("defaut").value.trim()) c.defaut = v("defaut").value.trim(); if (v("aide").value.trim()) c.aide = v("aide").value.trim(); if (v("vide").value.trim()) c.vide = v("vide").value.trim();
        return c; }).filter(c => c.cle);
      const dessinerTable = () => { tb.innerHTML = champs.map(ligneChamp).join(""); };
      dessinerTable();
      tb.onclick = e => { const b = e.target.closest("[data-suppr]"); if (!b) return; champs = lireTable(); champs.splice(+b.dataset.suppr, 1); dessinerTable(); };
      f.querySelector("#m-plus").onclick = () => { champs = lireTable(); champs.push({ cle: "", libelle: "", qui: "destinataire", type: "texte" }); dessinerTable(); };
      f.querySelector("#m-detecter").onclick = () => { champs = lireTable(); const ks = [...new Set([...ta.value.matchAll(/\{\{([a-z0-9_]{1,40})\}\}/g)].map(x => x[1]))].filter(k => k !== "date_signature" && !champs.some(c => c.cle === k));
        ks.forEach(k => champs.push({ cle: k, libelle: k.replace(/_/g, " "), qui: "destinataire", type: "texte", obligatoire: true })); dessinerTable(); toast(ks.length ? ks.length + " case(s) ajoutée(s)" : "Toutes les cases du texte sont déjà là"); };
      const onglet = a => { f.querySelector("#m-onglet-t").className = "btn" + (a ? " flat" : ""); f.querySelector("#m-onglet-a").className = "btn" + (a ? "" : " flat"); ta.style.display = a ? "none" : ""; ap.style.display = a ? "" : "none"; if (a) { const ch = lireTable(), v = {}; ch.forEach(c => { if (c.defaut) v[c.cle] = c.defaut; }); ap.innerHTML = rendre(ta.value, ch, v, null, true); } };
      f.querySelector("#m-onglet-t").onclick = () => onglet(false); f.querySelector("#m-onglet-a").onclick = () => onglet(true);
      const fic = f.querySelector("#m-fichier");
      f.querySelector("#m-fic").onclick = () => { fic.value = ""; fic.click(); };
      fic.onchange = () => { fichierNeuf = fic.files[0] || null; if (fichierNeuf) toast("Fichier choisi : " + fichierNeuf.name + " (envoyé à l'enregistrement)"); };
      const voir = f.querySelector("#m-ficvoir"); if (voir) voir.onclick = async () => window.open(await lienSigne("modeles", m.fichier), "_blank", "noopener");
      const ret = f.querySelector("#m-ficret"); if (ret) ret.onclick = () => { if (confirm("Retirer le fichier joint ?")) { m.fichierRetire = true; toast("Le fichier sera retiré à l'enregistrement"); } };
      f.querySelector("#m-enr").onclick = async () => {
        try {
          const ch = lireTable(), pour = [...f.querySelectorAll("[data-pour]:checked")].map(x => x.dataset.pour);
          const d = { titre: f.querySelector("#m-titre").value.trim(), categorie: f.querySelector("#m-cat").value, action: f.querySelector("#m-action").value, pour, champs: ch,
            piece_id: f.querySelector("#m-piece").value || null, contenu: ta.value.trim() || null };
          if (!d.titre) return toast("Donne un titre au modèle");
          if (!pour.length) return toast("Coche au moins « pour qui »");
          const doubles = ch.map(c => c.cle).filter((k, i, a) => a.indexOf(k) !== i); if (doubles.length) return toast("Nom de case en double : " + doubles[0]);
          const oublis = d.contenu ? [...new Set([...d.contenu.matchAll(/\{\{([a-z0-9_]{1,40})\}\}/g)].map(x => x[1]))].filter(k => k !== "date_signature" && !ch.some(c => c.cle === k)) : [];
          if (oublis.length && !confirm("Ces cases du texte n'ont pas de ligne : " + oublis.join(", ") + ". Elles resteront telles quelles. Enregistrer quand même ?")) return;
          let ancien = null;
          if (fichierNeuf) {
            const nom = fichierNeuf.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.]+/g, "-");
            const chemin = `bibliotheque/${Date.now()}-${nom}`;
            const { error } = await sb.storage.from("modeles").upload(chemin, fichierNeuf, { contentType: fichierNeuf.type || "application/pdf" }); if (error) throw error;
            ancien = m.fichier; d.fichier = chemin;
          } else if (m.fichierRetire) { ancien = m.fichier; d.fichier = null; }
          if (!d.contenu && !(d.fichier !== undefined ? d.fichier : m.fichier)) return toast("Écris un texte ou joins un fichier");
          if (nouveau) await q(sb.from("doc_modeles").insert(d)); else await q(sb.from("doc_modeles").update(d).eq("id", m.id));
          if (ancien && /^bibliotheque\//.test(ancien)) await sb.storage.from("modeles").remove([ancien]);
          toast("Modèle enregistré"); fermer(); vuePilote = "biblio"; afficher("documents");
        } catch (err) { toast("Pas enregistré : " + (err.message || err)); }
      };
    });
  }

  /* ---------- Mettre à disposition ---------- */
  function sourceDe(p, src, c) {
    if (!p) return undefined;
    if (src === "nom_complet") return ((p.prenom || "") + " " + (p.nom || "").toUpperCase()).trim() || p.nom || undefined;
    if (src === "activites") { const a = (p.activites || []).map(x => String(x).toLowerCase()); const ch = (c.choix || []).filter(x => a.some(y => x.toLowerCase().includes(y.slice(0, 5)) || (/entretien|ménage|menage/.test(x.toLowerCase()) && /m[ée]nage/.test(y)) || (/jardin/.test(x.toLowerCase()) && /jardin/.test(y)) || (/bricol/.test(x.toLowerCase()) && /bricol/.test(y)))); return c.type === "cases" ? ch : ch.join(", "); }
    return p[src] || undefined;
  }
  function mettreADisposition(m, { profils, clientsL, avecCompte }) {
    const types = m.pour.slice();
    let type = types[0];
    const oikos = (m.champs || []).filter(c => c.qui === "oikos"), vals = {}; oikos.forEach(c => { if (c.defaut) vals[c.cle] = c.defaut; });
    const gens = t => t === "client" ? clientsL.filter(c => c.etat !== "termine").map(c => ({ id: c.id, nom: c.nom, info: avecCompte.has(c.id) ? "" : "sans espace client", ok: avecCompte.has(c.id) }))
      : profils.filter(p => p.actif && (t === "chef" ? p.cheffe_reseau : true)).map(p => ({ id: p.id, nom: nomP(p), info: p.cheffe_reseau ? "chef" : (p.statut === "salarie" ? "salarié" : ""), ok: true })).sort((a, b) => a.nom.localeCompare(b.nom));
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Mettre à disposition</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <p class="muted small" style="margin:0"><b>${E(m.titre)}</b> · ${ACTIONS[m.action]} · version ${m.version}. La personne le voit tout de suite dans son appli ; le texte envoyé ne changera plus.</p>
      ${types.length > 1 ? `<div class="sous-menu">${types.map(t => `<button class="chip" data-type="${t}" aria-pressed="${t === type}">${POUR[t]}</button>`).join("")}</div>` : ""}
      <input type="search" id="md-cherche" placeholder="Chercher un nom…" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#ccc)">
      <div id="md-gens" style="max-height:34vh;overflow:auto;display:grid;gap:4px"></div>
      ${oikos.length ? `<section class="card"><b>À remplir par OIKOS</b><div class="dz-champs" id="md-oikos" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${champsHtml(m.champs, vals, "oikos")}</div></section>` : ""}
      <label class="dz-champs" style="max-width:260px"><span>À faire avant le (facultatif)</span><input type="date" id="md-echeance"></label>
      <div class="dz-boutons" style="justify-content:flex-end"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="md-ok">Mettre à disposition</button></div>`, (f, fermer) => {
      const zg = f.querySelector("#md-gens"), ch = f.querySelector("#md-cherche"), coches = new Set();
      const dessiner = () => { const l = gens(type).filter(g => !ch.value || g.nom.toLowerCase().includes(ch.value.toLowerCase()));
        zg.innerHTML = l.map(g => `<label style="display:flex;gap:8px;align-items:center;${g.ok ? "" : "opacity:.55"}"><input type="checkbox" value="${g.id}" ${coches.has(g.id) ? "checked" : ""} ${g.ok ? "" : "disabled"}> ${E(g.nom)} ${g.info ? `<span class="dz-tag">${E(g.info)}</span>` : ""}</label>`).join("") || `<p class="muted small">Personne.</p>`;
        f.querySelector("#md-ok").textContent = "Mettre à disposition" + (coches.size ? " (" + coches.size + ")" : ""); };
      dessiner();
      ch.oninput = dessiner;
      zg.onchange = e => { const c = e.target; if (c.checked) coches.add(c.value); else coches.delete(c.value); dessiner(); };
      f.onclick = e => { const b = e.target.closest("[data-type]"); if (!b) return; type = b.dataset.type; coches.clear(); f.querySelectorAll("[data-type]").forEach(x => x.setAttribute("aria-pressed", x === b)); dessiner(); };
      f.querySelector("#md-ok").onclick = async ev => {
        const bouton = ev.currentTarget;
        try {
          if (!coches.size) return toast("Coche au moins une personne");
          const zo = f.querySelector("#md-oikos"), vo = zo ? lireChamps(zo) : {};
          const mq = manque(m.champs, vo, "oikos"); if (mq) return toast("Case à remplir : " + mq.libelle);
          // les valeurs par défaut gardées dans le modèle pour la prochaine fois
          if (oikos.length && oikos.some(c => (vo[c.cle] || "") !== (c.defaut || ""))) await q(sb.from("doc_modeles").update({ champs: m.champs.map(c => c.qui === "oikos" && typeof vo[c.cle] === "string" ? Object.assign({}, c, { defaut: vo[c.cle] || undefined }) : c) }).eq("id", m.id)).catch(() => {});
          bouton.disabled = true;
          const echeance = f.querySelector("#md-echeance").value || null;
          let n = 0;
          for (const id of coches) {
            const p = type === "client" ? clientsL.find(c => c.id === id) : profils.find(x => x.id === id);
            const valeurs = Object.assign({}, vo);
            (m.champs || []).filter(c => c.qui !== "oikos").forEach(c => { const v = c.source ? sourceDe(p, c.source, c) : undefined; if (!vide(v)) valeurs[c.cle] = v; else if (c.defaut) valeurs[c.cle] = c.defaut; });
            const ligne = { modele_id: m.id, version: m.version, titre: m.titre, categorie: m.categorie, action: m.action, contenu: m.contenu, champs: m.champs, valeurs, echeance, piece_id: m.piece_id };
            if (type === "client") {
              ligne.client_id = id;
              if (m.fichier) {   // le client ne lit que son propre espace : copie du fichier
                const blob = await sb.storage.from("modeles").download(m.fichier); if (blob.error) throw blob.error;
                const chemin = `${id}/documents/${crypto.randomUUID()}.pdf`;
                const up = await sb.storage.from("espace-client").upload(chemin, blob.data, { contentType: "application/pdf" }); if (up.error) throw up.error;
                await q(sb.from("client_documents").insert({ client_id: id, categorie: "autre", titre: m.titre, chemin, visible: true }));
                ligne.fichier = chemin; ligne.fichier_seau = "espace-client";
              }
            } else { ligne.intervenante_id = id; if (m.fichier) { ligne.fichier = m.fichier; ligne.fichier_seau = "modeles"; } }
            await q(sb.from("doc_envois").insert(ligne)); n++;
          }
          toast(n === 1 ? "Mis à disposition" : n + " documents mis à disposition"); fermer(); vuePilote = "suivi"; filtreSuivi = "attente"; afficher("documents");
        } catch (err) { bouton.disabled = false; toast("Pas envoyé : " + (err.message || err)); }
      };
    });
  }

  window.DocsOikos = { pilote, presta, rappel, client, rendre, miseEnForme, remplacer };
})();

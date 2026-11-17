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
    nom: "Écris ton nom et ton prénom en entier.", signature: "Signe dans le cadre avec le doigt (ou la souris).", case_vide: "Une case obligatoire est vide.",
    code_requis: "Demande d'abord ton code par e-mail.", code_expire: "Ce code n'est plus valable : demande un nouveau code.", code_faux: "Code faux.",
    modifie: "OIKOS vient de modifier ce document : relis la nouvelle version avant de signer.", trop_tot: "Attends une minute avant de redemander un code.", trop_de_codes: "Trop de codes demandés : réessaie dans une heure.", pas_email: "Ton compte n'a pas d'adresse e-mail : préviens OIKOS." };

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
.dz-champs{display:grid;gap:10px;align-items:start}.dz-champs label{display:grid;gap:4px;font-size:14px;align-content:start}.dz-champs input[type=text],.dz-champs textarea,.dz-champs select{width:100%;box-sizing:border-box;font:inherit;padding:9px 10px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit}
.dz-champs .dz-aide{font-size:12px;color:var(--muted,#666)}.dz-coches{display:grid;gap:6px}.dz-coches label{display:flex;gap:8px;align-items:flex-start}
.dz-pad{position:relative;border:1.5px dashed var(--accent,#525A44);border-radius:12px;background:#fff;touch-action:none;height:170px}.dz-pad canvas{width:100%;height:100%;display:block;border-radius:12px;cursor:crosshair}
.dz-pad span{position:absolute;left:12px;bottom:8px;font-size:12px;color:#8a8a80;pointer-events:none}
.dz-liste{display:grid;gap:8px}.dz-ligne{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface,var(--carte,#fff))}
.dz-ligne.dz-court{padding:6px 10px;border-radius:10px}.dz-ligne.dz-court .btn{padding:4px 10px;min-height:0}.dz-ligne b{display:block}.dz-ligne .dz-m{font-size:12px;color:var(--muted,#666)}.dz-boutons{display:flex;gap:6px;flex-wrap:wrap}
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
      else if (vide(v)) s = c.vide || (marquer ? "\u0001" + c.cle + "\u0003" + (c.libelle || c.cle) + "\u0002" : "……");
      else if (Array.isArray(v)) s = v.join(", ");
      else if (c.type === "case") s = v === true ? "oui" : "non";
      else s = String(v);
      t = t.split("{{" + c.cle + "}}").join(s.replace(/\{\{|\}\}/g, ""));
    }
    return t.split("{{date_signature}}").join(signeLe ? new Date(signeLe).toLocaleDateString("fr-FR") : marquer ? "\u0001\u0003date du jour, ajoutée à la signature\u0002" : "……");
  }
  const enLigne = s => E(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\u0001([a-z0-9_]*)\u0003(.*?)\u0002/g, (x, k, t) => k ? `<mark data-aller="${k}" title="Toucher pour remplir" style="cursor:pointer">${t}</mark>` : `<mark>${t}</mark>`);
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
      ${d.note ? `<div class="dz-bandeau" style="display:block;margin:6px 0 10px"><b>${IC("bulle")} Note d'OIKOS</b><br><span style="white-space:pre-line">${E(d.note)}</span></div>` : ""}
      ${d.numero > 1 && !fait ? `<p class="small" style="margin:0 0 6px">${tu("Cette version remplace celle que tu avais déjà signée : relis-la, l'ancienne reste gardée telle quelle.", "Cette version remplace celle que vous aviez déjà signée : relisez-la, l'ancienne reste gardée telle quelle.")}</p>` : ""}
      ${d.etat === "fait" ? `<p class="small" style="margin:0 0 6px">${IC("cadenas")} ${tu("Document signé : il ne peut plus être modifié.", "Document signé : il ne peut plus être modifié.")}${d.remplace_par ? tu(" Une nouvelle version t'a été envoyée.", " Une nouvelle version vous a été envoyée.") : ""}</p>` : ""}
      <p class="muted small" style="margin:0 0 12px">${fait ? (d.etat === "fait" ? (d.action === "signer" ? "Signé" : d.action === "accepter" ? "Accepté" : "Lu") + " le " + heureFr(d.fait_le) : "Refusé le " + heureFr(d.fait_le)) : "Document " + ACTIONS[d.action] + (d.echeance ? " avant le " + dateFr(d.echeance) : "")}</p>
      ${!fait && aRemplir ? `<section class="card" style="margin-bottom:12px"><b>${tu("À remplir par toi", "À remplir")}</b><p class="muted small" style="margin:2px 0 10px">${tu("Ce que tu écris apparaît dans le document en dessous.", "Ce que vous écrivez apparaît dans le document en dessous.")}</p><div class="dz-champs" id="dz-champs">${champsHtml(d.champs, valeurs, "destinataire")}</div></section>` : ""}
      ${d.fichier ? `<button class="btn" type="button" data-fichier style="margin-bottom:10px">${IC("doc")} Ouvrir le document joint</button>` : ""}
      ${d.contenu && !fait && aRemplir ? `<p class="small" style="margin:0 0 6px">${tu("Les mots surlignés en jaune sont tes cases : touche-les pour les remplir.", "Les mots surlignés en jaune sont vos cases : touchez-les pour les remplir.")}</p>` : ""}
      ${d.contenu ? `<div class="dz-doc" id="dz-texte"></div>` : ""}
      ${fait && d.pdf_chemin ? `<button class="btn" type="button" data-pdf style="margin-top:10px">${IC("telecharger")} Télécharger le PDF signé</button>` : ""}
      ${fait && !d.pdf_chemin && d.etat === "fait" && d.pdf_etat ? `<p class="muted small" style="margin-top:10px">Le PDF signé arrive dans quelques minutes.</p>` : ""}
      ${fait ? "" : `<section class="card dz-actions">
        ${d.action === "signer" ? `<label class="dz-champs"><span>${tu("Ton nom et ton prénom", "Votre nom et votre prénom")}</span><input type="text" id="dz-nom" autocomplete="name"></label>
          <div class="dz-pad" id="dz-pad"></div><div class="dz-boutons"><button class="btn flat" type="button" data-effacer>Effacer la signature</button></div>` : ""}
        ${d.action !== "lire" ? `<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="dz-lu"><span>${tu("J'ai lu ce document en entier et je l'accepte.", "J'ai lu ce document en entier et je l'accepte.")}</span></label>
          <div class="dz-champs" style="gap:6px"><b style="font-size:14px">${tu("Ton code de confirmation", "Votre code de confirmation")}</b>
            <span class="dz-aide">${tu("Pour être sûr que c'est bien toi, OIKOS t'envoie un code à 6 chiffres sur ton adresse e-mail.", "Pour être sûr que c'est bien vous, OIKOS vous envoie un code à 6 chiffres sur votre adresse e-mail.")}</span>
            <div class="dz-boutons" style="align-items:center"><button class="btn" type="button" data-code>${IC("bulle")} ${tu("Recevoir mon code par e-mail", "Recevoir mon code par e-mail")}</button><span class="small" id="dz-code-info"></span></div>
            <input type="text" id="dz-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 chiffres" style="max-width:180px;letter-spacing:4px;font-size:18px"></div>` : ""}
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
      const mk = e.target.closest("mark[data-aller]");
      if (mk && zc) {   // mot surligné : on remonte à sa case
        const champ = zc.querySelector(`[data-cle="${mk.dataset.aller}"]`), cadre = champ && (champ.closest("label") || champ.closest("div"));
        if (cadre) { cadre.scrollIntoView({ behavior: "smooth", block: "center" }); const i = champ.matches("input,select,textarea") ? champ : champ.querySelector("input"); if (i) setTimeout(() => i.focus({ preventScroll: true }), 350);
          cadre.style.transition = "background .6s"; cadre.style.background = "var(--warn-soft,#F4E9CC)"; setTimeout(() => { cadre.style.background = ""; }, 1400); }
        return;
      }
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
        const r = await sb.rpc("doc_repondre", { p_id: d.id, p_valeurs: {}, p_nom: null, p_signature: null, p_accepte: false, p_motif: motif, p_code: null });
        if (r.error || (r.data && r.data.ok === false)) return toast(r.error ? "Pas envoyé : " + r.error.message : MOTIFS[r.data.motif] || "Pas envoyé");
        toast("OIKOS est prévenu."); return retour();
      }
      if (b.hasAttribute("data-code")) {   // SQL 70 : le pont l'envoie depuis la boîte OIKOS, en moins d'une minute
        b.disabled = true;
        const r = await sb.rpc("doc_demander_code", { p_id: d.id });
        const info = cible.querySelector("#dz-code-info");
        if (r.error || (r.data && r.data.ok === false)) { b.disabled = r.data && r.data.motif === "trop_tot"; setTimeout(() => { b.disabled = false; }, 60000); return toast(r.error ? "Pas envoyé : " + r.error.message : MOTIFS[r.data.motif] || "Pas envoyé"); }
        info.textContent = tu("Code envoyé à ", "Code envoyé à ") + r.data.email + tu(" : il arrive en moins de 2 minutes (regarde aussi les indésirables).", " : il arrive en moins de 2 minutes (regardez aussi les indésirables).");
        b.textContent = tu("Renvoyer un code", "Renvoyer un code");
        setTimeout(() => { b.disabled = false; }, 60000);
        const c = cible.querySelector("#dz-code"); if (c) c.focus();
        return;
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
        const code = d.action !== "lire" ? (cible.querySelector("#dz-code").value || "").replace(/\D/g, "") : null;
        if (d.action !== "lire" && code.length !== 6) { cible.querySelector("#dz-code").focus(); return toast(cible.querySelector("#dz-code-info").textContent ? tu("Tape le code à 6 chiffres reçu par e-mail.", "Tapez le code à 6 chiffres reçu par e-mail.") : MOTIFS.code_requis); }
        b.disabled = true;
        const args = { p_id: d.id, p_valeurs: v, p_nom: nom, p_signature: image, p_accepte: true, p_motif: null, p_code: code };
        if (d.revision != null) args.p_revision = d.revision;   // SQL 76 : refusé si OIKOS a modifié le texte depuis l'ouverture
        const r = await sb.rpc("doc_repondre", args);
        b.disabled = false;
        if (r.error) return toast("Pas enregistré : " + r.error.message);
        if (r.data && r.data.motif === "modifie") {   // on remontre tout de suite le nouveau texte ; le code reste valable
          toast(tu("OIKOS vient de modifier ce document : relis-le, puis signe à nouveau (ton code reste valable).", "OIKOS vient de modifier ce document : relisez-le, puis signez à nouveau (votre code reste valable)."));
          try { const frais = (await mesDocs()).find(x => x.id === d.id); if (frais) { ouvrirRecu(cible, frais, retour, tutoie); cible.scrollIntoView && cible.scrollIntoView({ behavior: "smooth", block: "start" }); } } catch (err) {}
          return;
        }
        if (r.data && r.data.ok === false) return toast(r.data.motif === "case_vide" ? "Case à remplir : " + (r.data.libelle || "")
          : r.data.motif === "code_faux" ? MOTIFS.code_faux + (r.data.reste > 0 ? tu(" Encore ", " Encore ") + r.data.reste + tu(" essai(s).", " essai(s).") : " " + MOTIFS.code_expire) : MOTIFS[r.data.motif] || "Pas enregistré");
        toast(d.action === "signer" ? "Signé, merci !" : "Enregistré, merci !"); return retour();
      }
    };
  }
  async function mesDocs() { const { data, error } = await sb.rpc("mes_docs"); if (error) throw error; return data || []; }
  const aFaire = d => d.etat === "envoye" || d.etat === "vu";
  const ligneRecue = d => `<button class="dz-ligne" type="button" data-ouvrir="${d.id}" style="text-align:left;width:100%;cursor:pointer">
      <span><b>${E(d.titre)}${d.numero > 1 ? ` <span class="dz-tag">version ${d.numero}</span>` : ""}${d.remplace_par ? ` <span class="dz-tag">remplacé par une nouvelle version</span>` : ""}</b><span class="dz-m">${aFaire(d) ? "Envoyé le " + dateFr(d.envoye_le) + (d.echeance ? " · avant le " + dateFr(d.echeance) : "")
        : d.etat === "fait" ? (d.action === "signer" ? "Signé" : d.action === "accepter" ? "Accepté" : "Lu") + " le " + dateFr(d.fait_le) : "Refusé le " + dateFr(d.fait_le)}</span>${d.note && aFaire(d) ? `<span class="dz-m" style="font-style:italic">Note : ${E(d.note.length > 90 ? d.note.slice(0, 90) + "…" : d.note)}</span>` : ""}</span>
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
  // Trois entrées : « Envoyer à une personne » (le pilote propose selon son profil), le Suivi (par personne ou par document)
  // et la Bibliothèque (rangée par destinataire puis par moment : à l'arrivée, selon le cas, quand il se passe quelque chose).
  let vuePilote = "suivi", filtreSuivi = "attente", rangSuivi = "personne", pourBiblio = "presta", chercheSuivi = "", plusSuivi = 25;
  const choisis = new Set();
  const QUAND = { arrivee: "À l'arrivée", cas: "Selon le cas", evenement: "Quand il se passe quelque chose" };
  const QUAND_AIDE = { arrivee: "proposés d'office à une nouvelle personne", cas: "proposés sans être cochés", evenement: "à envoyer seulement le jour où ça arrive (clés, transfert, nouvelle grille, avenant…)" };
  const CONDITIONS = { ae_a_creer: "si OIKOS crée son auto-entreprise" };
  const roleDe = p => p && p.cheffe_reseau ? "chef" : "presta";
  async function chargerDocs() {
    const [modeles, envois, profils, clientsL, comptes, pieces] = await Promise.all([
      q(sb.from("doc_modeles").select("*").order("ordre").order("titre")),
      q(sb.from("doc_envois").select("id,modele_id,titre,action,etat,intervenante_id,client_id,envoye_le,vu_le,fait_le,motif,echeance,pdf_etat,pdf_seau,pdf_chemin,pdf_erreur,signe_nom,numero,remplace,note").order("envoye_le", { ascending: false }).limit(1000)),
      q(sb.from("profils").select("id,prenom,nom,email,telephone,adresse,siret,activites,actif,role,statut,cheffe_reseau,ae_a_creer").neq("role", "gerant")),
      q(sb.from("clients").select("id,nom,adresse,email,telephone,etat").order("nom")),
      sb.from("comptes_clients").select("id,client_id,actif").then(r => r.data || [], () => []),
      q(sb.from("pieces_demandees").select("id,libelle").order("ordre"))]);
    const anciens = await chargerAnciens(envois).catch(() => []);
    const parId = l => Object.fromEntries(l.map(x => [x.id, x]));
    return { modeles, envois, anciens, profils, clientsL, pieces, P: parId(profils), C: parId(clientsL), M: parId(modeles), avecCompte: new Set(comptes.filter(k => k.actif).map(k => k.client_id)) };
  }
  // Documents signés AVANT la bibliothèque (17/11/2026) : retrouvés dans les papiers des presta (table documents),
  // le dossier juridique des clients (client_juridique) et leur espace client (client_documents). Lecture seule.
  const SIGNE_RE = /sign|contrat|mandat|procuration|droit [àa] l.image|avenant|convention|engagement|charte|cgv|conditions g[ée]n[ée]rales|r[eè]glement int/i;
  async function chargerAnciens(envois) {
    const lire = p => p.then(r => r.error ? [] : (r.data || []), () => []);
    const [papiers, jur, cdocs] = await Promise.all([
      lire(sb.from("documents").select("id,intervenante_id,libelle,fichier,drive_url,etat,cree_le,facture_mois").neq("etat", "refuse").limit(3000)),
      lire(sb.from("client_juridique").select("id,client_id,type,titre,texte,date_evt,drive_url,cree_le").is("supprime_le", null).limit(3000)),
      lire(sb.from("client_documents").select("id,client_id,categorie,titre,date_doc,chemin,lien,ref,cree_le").in("categorie", ["contrat", "juridique", "feuille_signee"]).limit(3000))]);
    const faits = new Set(envois.map(e => e.pdf_chemin).filter(Boolean)), vus = new Set(), l = [];
    const garder = o => { const k = (o.client_id || o.intervenante_id) + "|" + String(o.titre).toLowerCase().trim() + "|" + String(o.quand || "").slice(0, 10); if (vus.has(k)) return; vus.add(k); l.push(Object.assign({ ancien: true, etat: "fait", action: "signer" }, o)); };
    papiers.forEach(d => {
      const t = d.libelle || "";
      if (d.facture_mois || faits.has(d.fichier) || /^factur/i.test(t) || !SIGNE_RE.test(t)) return;
      const drive = String(d.fichier || "").startsWith("drive:"), url = drive ? d.drive_url : /^https?:/.test(d.fichier || "") ? d.fichier : null;
      garder({ id: "p:" + d.id, titre: t, quand: d.cree_le, intervenante_id: d.intervenante_id, source: d.etat === "recu" ? "papier pas encore validé" : "ses papiers", url, seau: url || drive ? null : "documents", chemin: url || drive ? null : d.fichier });
    });
    jur.forEach(j => {
      if (/^Signé dans l'espace client/.test(j.texte || "") || !(j.type === "contrat" || SIGNE_RE.test(j.titre || ""))) return;
      garder({ id: "j:" + j.id, titre: j.titre, quand: j.date_evt || j.cree_le, client_id: j.client_id, source: "dossier juridique", url: j.drive_url || null });
    });
    cdocs.forEach(c => {
      if (String(c.ref || "").startsWith("doc:")) return;
      garder({ id: "c:" + c.id, titre: c.titre, quand: c.date_doc || c.cree_le, client_id: c.client_id, source: "espace client", url: c.chemin ? null : c.lien, seau: c.chemin ? "espace-client" : null, chemin: c.chemin || null });
    });
    return l;
  }
  // Tout le monde à qui on peut envoyer : presta, chefs, clients (ceux qui ont un espace client)
  function lesGens(x) {
    return x.profils.filter(p => p.actif).map(p => ({ cle: "i:" + p.id, id: p.id, type: roleDe(p), nom: nomP(p), p, ok: true }))
      .concat(x.clientsL.filter(c => c.etat !== "termine").map(c => ({ cle: "c:" + c.id, id: c.id, type: "client", nom: c.nom, p: c, ok: x.avecCompte.has(c.id) })))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }
  const envoisDe = (x, g) => x.envois.filter(e => e.etat !== "retire" && (g.type === "client" ? e.client_id === g.id : e.intervenante_id === g.id));
  // Où en est ce modèle pour cette personne : dernier envoi (signé, en attente, refusé) ou rien
  const etatModele = (x, g, m) => envoisDe(x, g).filter(e => e.modele_id === m.id).sort((a, b) => (b.numero || 1) - (a.numero || 1) || new Date(b.envoye_le) - new Date(a.envoye_le))[0] || null;
  const aProposer = (m, g, dernier) => !dernier || dernier.etat === "refuse" ? (m.quand === "arrivee" || (m.condition === "ae_a_creer" && g.p && g.p.ae_a_creer)) : false;

  async function pilote() {
    styles();
    const x = await chargerDocs();
    const { modeles, envois, anciens, P, C, M } = x;
    const qui = e => e.intervenante_id ? { nom: nomP(P[e.intervenante_id]), type: P[e.intervenante_id] && P[e.intervenante_id].cheffe_reseau ? "Chef" : "Presta" } : { nom: (C[e.client_id] || {}).nom || "Client", type: "Client" };
    const etatTag = e => e.ancien ? `<span class="dz-tag" title="Signé avant la bibliothèque : retrouvé dans ${E(e.source)}">Avant l'appli${e.quand ? " · " + dateFr(e.quand) : ""}</span>`
      : e.etat === "fait" ? `<span class="dz-tag ok">${e.action === "signer" ? "Signé" : e.action === "accepter" ? "Accepté" : "Lu"} le ${dateFr(e.fait_le)}</span>`
      : e.etat === "refuse" ? `<span class="dz-tag non" title="${E(e.motif || "")}">Refusé${e.motif ? " : " + E(e.motif.slice(0, 40)) : ""}</span>`
      : e.etat === "retire" ? `<span class="dz-tag">Retiré</span>` : e.etat === "vu" ? `<span class="dz-tag att">Ouvert le ${dateFr(e.vu_le)}</span>` : `<span class="dz-tag att">Pas encore ouvert</span>`;
    const pdfTag = e => e.pdf_etat === "fait" && e.pdf_chemin ? `<button class="btn" data-pdf="${e.id}">${IC("doc")} PDF</button>` : e.pdf_etat === "erreur" ? `<span class="dz-tag non" title="${E(e.pdf_erreur || "")}">PDF en erreur</span>` : e.pdf_etat ? `<span class="dz-tag att">PDF en préparation</span>` : "";
    // Une version remplacée ne prend plus de place : elle se replie sous la version qui la remplace
    const remplacees = new Set(envois.filter(v => v.remplace && v.etat !== "retire").map(v => v.remplace));
    const avant = e => { const l = []; let id = e.remplace; while (id) { const v = envois.find(z => z.id === id); if (!v || l.includes(v)) break; l.push(v); id = v.remplace; } return l; };
    const tout = envois.filter(e => !remplacees.has(e.id)).concat(anciens);
    const filtres = { attente: ["À signer", e => e.etat === "envoye" || e.etat === "vu"], fait: ["Signés", e => e.etat === "fait"], anciens: ["Avant l'appli", e => !!e.ancien], refuse: ["Refusés", e => e.etat === "refuse"], tous: ["Tous", e => e.etat !== "retire"] };
    const nbAtt = envois.filter(filtres.attente[1]).length;
    const el = contenu(`<div class="dz-boutons" style="justify-content:space-between;align-items:center"><h1 style="margin:0">Documents</h1><button class="btn primary" data-a-une-personne>${IC("personne")} Envoyer à une personne</button></div>
      <p class="muted small" style="margin:6px 0 12px">Choisis une personne : le pilote te dit quels documents lui envoyer selon son profil et ce qu'elle a déjà signé. Une fois signé, le PDF part tout seul dans son dossier Drive et ne se modifie plus.</p>
      <div class="sous-menu" style="margin-bottom:12px"><button class="chip" data-vue="suivi" aria-pressed="${vuePilote === "suivi"}">Suivi${nbAtt ? " (" + nbAtt + " à signer)" : ""}</button><button class="chip" data-vue="biblio" aria-pressed="${vuePilote === "biblio"}">Bibliothèque (${modeles.filter(m => m.actif).length})</button></div>
      <div id="dz-zone"></div>`);
    const zone = el.querySelector("#dz-zone");
    const ligneEnvoi = (e, avecNom) => { const w = qui(e);
      if (e.ancien) return `<div class="dz-ligne dz-court"><span><b>${E(e.titre)}</b><span class="dz-m">${avecNom ? E(w.type) + " : " + E(w.nom) + " · " : ""}retrouvé dans ${E(e.source)}</span></span>
        <span class="dz-boutons">${etatTag(e)}${e.url || e.chemin ? `<button class="btn flat" data-ancien="${E(e.id)}">${IC("doc")} Voir</button>` : `<span class="muted small">pas de fichier</span>`}</span></div>`;
      const apres = envois.find(v => v.remplace === e.id && v.etat !== "retire"), prec = avant(e), fait = e.etat === "fait";
      return `<div class="dz-ligne${fait ? " dz-court" : ""}"><span><b>${E(e.titre)}${(e.numero || 1) > 1 ? ` <span class="dz-tag">version ${e.numero}</span>` : ""}${apres ? ` <span class="dz-tag">remplacé par la version ${apres.numero}</span>` : ""}</b><span class="dz-m">${avecNom ? E(w.type) + " : " + E(w.nom) + " · " : ""}${fait ? (e.signe_nom ? "signé par " + E(e.signe_nom) : "envoyé le " + dateFr(e.envoye_le)) : "envoyé le " + dateFr(e.envoye_le) + (e.echeance ? " · avant le " + dateFr(e.echeance) : "")}</span>${e.note && !fait ? `<span class="dz-m" style="font-style:italic">Note : ${E(e.note.length > 120 ? e.note.slice(0, 120) + "…" : e.note)}</span>` : ""}
        ${prec.length ? `<details class="dz-m" style="margin-top:2px"><summary style="cursor:pointer">Versions précédentes (${prec.length})</summary>${prec.map(v => `<div style="display:flex;gap:6px;align-items:center;margin-top:4px">version ${v.numero || 1} · ${etatTag(v)}${v.pdf_etat === "fait" && v.pdf_chemin ? `<button class="btn flat" data-pdf="${v.id}">PDF</button>` : ""}<button class="btn flat" data-voir="${v.id}">Voir</button></div>`).join("")}</details>` : ""}</span>
        <span class="dz-boutons">${etatTag(e)}${pdfTag(e)}<button class="btn flat" data-voir="${e.id}">Voir</button>${e.etat === "envoye" || e.etat === "vu" ? `<button class="btn flat" data-modifier-envoi="${e.id}" title="Changer le texte, les cases d'OIKOS (prix…), la note ou la date, pour cette personne seulement : le modèle ne bouge pas">${IC("stylo")} Modifier</button>` : ""}${e.etat === "envoye" || e.etat === "vu" ? `<button class="btn flat stop" data-retirer="${e.id}">Retirer</button>` : ""}${fait && !apres ? `<button class="btn flat" data-version="${e.id}" title="Le document signé reste tel quel ; une nouvelle version part à signer">Nouvelle version</button>` : ""}${e.etat === "refuse" || (fait && e.pdf_etat === "erreur") ? `<button class="btn flat" data-renvoyer="${e.id}">${e.etat === "refuse" ? "Renvoyer" : "Refaire le PDF"}</button>` : ""}</span></div>`; };
    const sans = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const quandDe = e => e.ancien ? e.quand : e.fait_le || e.vu_le || e.envoye_le;
    const ordre = (a, b) => ((b.etat === "envoye" || b.etat === "vu") - (a.etat === "envoye" || a.etat === "vu")) || new Date(quandDe(b) || 0) - new Date(quandDe(a) || 0);
    const joignables = new Set(lesGens(x).map(g => g.cle));
    const plus = n => n > plusSuivi ? `<button class="btn flat" data-plus style="margin-top:8px">Afficher plus (${n - plusSuivi} de plus)</button>` : "";
    const dessinerSuivi = () => {
      const mot = sans(chercheSuivi.trim());
      const l = tout.filter(filtres[filtreSuivi][1]).filter(e => !mot || sans(e.titre).includes(mot) || sans(qui(e).nom).includes(mot)).sort(ordre);
      let corps = "";
      if (!l.length) corps = `<div class="card"><p class="muted">${mot ? "Rien ne correspond à « " + E(chercheSuivi) + " »." : filtreSuivi === "anciens" ? "Aucun document signé avant l'appli retrouvé dans les papiers des presta ni dans les dossiers juridiques des clients." : "Rien ici. Pour envoyer : « Envoyer à une personne », ou coche des modèles dans la Bibliothèque."}</p></div>`;
      else if (rangSuivi === "document") {   // par document : une ligne par sorte de document, les personnes dedans (replié)
        const groupes = {};
        l.forEach(e => { const k = sans(e.titre).replace(/\s*-\s*version \d+/, "").replace(/\s+(signee?s?|accepte)$/, "").trim(); (groupes[k] = groupes[k] || []).push(e); });
        const g = Object.values(groupes).sort((a, b) => b.length - a.length || a[0].titre.localeCompare(b[0].titre));
        corps = `<div class="dz-liste">${g.slice(0, plusSuivi).map(liste => { const nf = liste.filter(e => e.etat === "fait").length, na = liste.filter(e => e.etat === "envoye" || e.etat === "vu").length, nr = liste.filter(e => e.etat === "refuse").length, nv = liste.filter(e => e.ancien).length;
          return `<details class="card" style="padding:8px 12px" ${g.length === 1 ? "open" : ""}><summary style="cursor:pointer;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${E(liste[0].titre)}</b>
            ${nf ? `<span class="dz-tag ok">${nf} signé${nf > 1 ? "s" : ""}${nv ? " dont " + nv + " avant l'appli" : ""}</span>` : ""}${na ? `<span class="dz-tag att">${na} en attente</span>` : ""}${nr ? `<span class="dz-tag non">${nr} refusé${nr > 1 ? "s" : ""}</span>` : ""}</summary>
            <div class="dz-liste" style="margin-top:8px;gap:6px">${liste.map(e => ligneEnvoi(e, true)).join("")}</div></details>`; }).join("")}</div>${plus(g.length)}`;
      } else {   // par personne : une carte repliée par personne, ceux qui ont du retard en premier
        const groupes = {};
        l.forEach(e => { const k = e.intervenante_id ? "i:" + e.intervenante_id : "c:" + e.client_id; (groupes[k] = groupes[k] || []).push(e); });
        const ouvrir = Object.keys(groupes).length <= 3;
        const cartes = Object.entries(groupes).map(([k, liste]) => { const w = qui(liste[0]), siens = tout.filter(e => e.etat !== "retire" && (k[0] === "i" ? e.intervenante_id === k.slice(2) : e.client_id === k.slice(2)));
          const nbF = siens.filter(e => e.etat === "fait" && !e.ancien).length, nbV = siens.filter(e => e.ancien).length, nbA = siens.filter(e => e.etat === "envoye" || e.etat === "vu").length, nbR = siens.filter(e => e.etat === "refuse").length;
          return { k, w, nbA, html: `<details class="card" style="padding:8px 12px" ${ouvrir ? "open" : ""}><summary style="cursor:pointer;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${E(w.nom)}</b><span class="dz-tag">${E(w.type)}</span>
              ${nbF ? `<span class="dz-tag ok">${nbF} signé${nbF > 1 ? "s" : ""}</span>` : ""}${nbV ? `<span class="dz-tag">${nbV} avant l'appli</span>` : ""}${nbA ? `<span class="dz-tag att">${nbA} en attente</span>` : ""}${nbR ? `<span class="dz-tag non">${nbR} refusé${nbR > 1 ? "s" : ""}</span>` : ""}
              ${joignables.has(k) ? `<button class="btn flat" data-completer="${k}" style="margin-left:auto">Que lui envoyer ?</button>` : ""}</summary>
              <div class="dz-liste" style="margin-top:8px;gap:6px">${liste.map(e => ligneEnvoi(e, false)).join("")}</div></details>` }; })
          .sort((a, b) => b.nbA - a.nbA || a.w.nom.localeCompare(b.w.nom));
        corps = `<div class="dz-liste">${cartes.slice(0, plusSuivi).map(c => c.html).join("")}</div>${plus(cartes.length)}`;
      }
      zone.innerHTML = `<div class="dz-boutons" style="margin-bottom:10px;justify-content:space-between"><div class="sous-menu">${Object.entries(filtres).map(([k, [t, f]]) => `<button class="chip" data-filtre="${k}" aria-pressed="${k === filtreSuivi}">${t} (${tout.filter(f).length})</button>`).join("")}</div>
        <div class="sous-menu"><button class="chip" data-rang="personne" aria-pressed="${rangSuivi === "personne"}">Par personne</button><button class="chip" data-rang="document" aria-pressed="${rangSuivi === "document"}">Par document</button></div></div>
        <input type="search" id="dz-cherche" placeholder="Chercher une personne ou un document" value="${E(chercheSuivi)}" style="width:100%;box-sizing:border-box;margin-bottom:10px">${corps}`;
      const ch = zone.querySelector("#dz-cherche");
      ch.oninput = () => { chercheSuivi = ch.value; plusSuivi = 25; const pos = ch.selectionStart; dessinerSuivi(); const n = zone.querySelector("#dz-cherche"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) {} };
    };
    const dessinerBiblio = () => {
      const visibles = modeles.filter(m => m.actif && (pourBiblio === "tous" || m.pour.includes(pourBiblio)));
      const ligne = m => { const n = envois.filter(e => e.modele_id === m.id && e.etat !== "retire"), s = n.filter(e => e.etat === "fait").length;
        return `<div class="dz-ligne" style="${m.actif ? "" : "opacity:.6"}"><label style="display:flex;gap:10px;align-items:flex-start;flex:1;min-width:220px;cursor:pointer">${m.actif ? `<input type="checkbox" data-sel="${m.id}" ${choisis.has(m.id) ? "checked" : ""} style="margin-top:4px">` : ""}<span><b>${E(m.titre)}</b><span class="dz-m">${CATEGORIES[m.categorie] || ""} · ${ACTIONS[m.action]} · pour ${m.pour.map(p => POUR[p]).join(", ")}${m.condition ? " · " + CONDITIONS[m.condition] : ""}${m.fichier ? " · fichier joint" : ""}${n.length ? " · " + n.length + " envoyé" + (n.length > 1 ? "s" : "") + ", " + s + " fait" + (s > 1 ? "s" : "") : ""}</span>${m.note ? `<span class="dz-m" style="font-style:italic">Note : ${E(m.note.length > 120 ? m.note.slice(0, 120) + "…" : m.note)}</span>` : ""}</span></label>
          <span class="dz-boutons">${m.actif ? `<button class="btn" data-envoyer="${m.id}">Mettre à disposition</button>` : ""}<button class="btn flat" data-modifier="${m.id}">${IC("stylo")} Modifier</button><button class="btn flat" data-archiver="${m.id}">${m.actif ? "Archiver" : "Réactiver"}</button></span></div>`; };
      const sections = Object.keys(QUAND).map(k => { const l = visibles.filter(m => (m.quand || "cas") === k);
        return l.length ? `<h3 style="margin:16px 0 4px">${QUAND[k]} <span class="muted small" style="font-weight:normal">· ${QUAND_AIDE[k]}</span></h3><div class="dz-liste">${l.map(ligne).join("")}</div>` : ""; }).join("");
      const archives = modeles.filter(m => !m.actif);
      zone.innerHTML = `<div class="dz-boutons" style="margin-bottom:6px;justify-content:space-between"><div class="sous-menu">${[["presta", "Presta"], ["chef", "Chefs de réseau"], ["client", "Clients"], ["tous", "Tous"]].map(([k, t]) => `<button class="chip" data-pour-biblio="${k}" aria-pressed="${k === pourBiblio}">${t} (${modeles.filter(m => m.actif && (k === "tous" || m.pour.includes(k))).length})</button>`).join("")}</div>
          <div class="dz-boutons"><button class="btn flat" data-nouveau="texte">${IC("plus")} Nouveau modèle</button><button class="btn flat" data-nouveau="fichier">${IC("trombone")} À partir d'un PDF</button></div></div>
        <div id="dz-barre" class="dz-bandeau" style="position:sticky;top:8px;z-index:2;${choisis.size ? "" : "display:none"}"><span><b>${choisis.size} modèle${choisis.size > 1 ? "s" : ""} coché${choisis.size > 1 ? "s" : ""}</b></span><span class="dz-boutons"><button class="btn flat" data-decocher>Tout décocher</button><button class="btn primary" data-envoyer-choix>Mettre à disposition ensemble</button></span></div>
        ${sections || `<div class="card"><p class="muted">Aucun modèle ici.</p></div>`}
        ${archives.length ? `<details style="margin-top:14px"><summary class="muted">Modèles archivés (${archives.length})</summary><div class="dz-liste" style="margin-top:8px">${archives.map(ligne).join("")}</div></details>` : ""}
        <p class="muted small" style="margin-top:14px">Dans le texte : <b># Titre</b>, <b>## Article</b>, <b>- puce</b>, <b>**gras**</b>, <b>| case | case |</b> pour un tableau, <b>---</b> pour un saut de page, et <b>{{nom_de_case}}</b> pour une case à remplir. <b>{{date_signature}}</b> se remplit seul.</p>`;
    };
    const redessiner = () => { el.querySelectorAll("[data-vue]").forEach(b => b.setAttribute("aria-pressed", b.dataset.vue === vuePilote)); vuePilote === "suivi" ? dessinerSuivi() : dessinerBiblio(); };
    redessiner();
    el.onchange = e => { const c = e.target.closest("[data-sel]"); if (!c) return; c.checked ? choisis.add(c.dataset.sel) : choisis.delete(c.dataset.sel); dessinerBiblio(); };
    el.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return;
      try {
        if (b.hasAttribute("data-a-une-personne")) return envoyerAUnePersonne(x, null);
        if (b.dataset.completer) { e.preventDefault(); return envoyerAUnePersonne(x, b.dataset.completer); }
        if (b.dataset.vue) { vuePilote = b.dataset.vue; return redessiner(); }
        if (b.dataset.filtre) { filtreSuivi = b.dataset.filtre; plusSuivi = 25; return dessinerSuivi(); }
        if (b.dataset.rang) { rangSuivi = b.dataset.rang; plusSuivi = 25; return dessinerSuivi(); }
        if (b.hasAttribute("data-plus")) { plusSuivi += 25; return dessinerSuivi(); }
        if (b.dataset.ancien) { const v = anciens.find(z => z.id === b.dataset.ancien); if (!v) return; return window.open(v.url || await lienSigne(v.seau, v.chemin), "_blank", "noopener"); }
        if (b.dataset.pourBiblio) { pourBiblio = b.dataset.pourBiblio; return dessinerBiblio(); }
        if (b.hasAttribute("data-decocher")) { choisis.clear(); return dessinerBiblio(); }
        if (b.hasAttribute("data-envoyer-choix")) return mettreADisposition([...choisis].map(id => M[id]).filter(Boolean), x);
        if (b.dataset.pdf) { const v = envois.find(z => z.id === b.dataset.pdf); return window.open(await lienSigne(v.pdf_seau, v.pdf_chemin), "_blank", "noopener"); }
        if (b.dataset.voir) return voirEnvoi(b.dataset.voir);
        if (b.dataset.noteEnvoi) {   // note d'un document pas encore signé : modifiable (une fois signé, elle est figée)
          const v = envois.find(z => z.id === b.dataset.noteEnvoi);
          return fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Note pour la personne</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
            <p class="muted small" style="margin:0">« ${E(v.titre)} » pour ${E(qui(v).nom)}. Elle la voit en haut du document, tout de suite.</p>
            <textarea id="ne-texte" rows="4" style="width:100%;box-sizing:border-box" placeholder="Ex. : coche ménage et jardinage.">${E(v.note || "")}</textarea>
            <div class="dz-boutons" style="justify-content:flex-end"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="ne-ok">Enregistrer</button></div>`, (f, fermer) => {
            f.querySelector("#ne-texte").focus();
            f.querySelector("#ne-ok").onclick = async () => {
              try { await q(sb.from("doc_envois").update({ note: f.querySelector("#ne-texte").value.trim().slice(0, 2000) || null }).eq("id", v.id)); toast("Note enregistrée"); fermer(); afficher("documents"); }
              catch (err) { toast("Pas enregistré : " + (err.message || err)); }
            };
          });
        }
        if (b.dataset.modifierEnvoi) return modifierEnvoi(b.dataset.modifierEnvoi);
        if (b.dataset.version) return nouvelleVersion(b.dataset.version);
        if (b.dataset.retirer) { if (!confirm("Retirer ce document ? La personne ne le verra plus.")) return; await q(sb.from("doc_envois").update({ etat: "retire" }).eq("id", b.dataset.retirer)); toast("Retiré"); return afficher("documents"); }
        if (b.dataset.renvoyer) {
          const v = envois.find(z => z.id === b.dataset.renvoyer);
          if (v.etat === "refuse") { if (!confirm("Le remettre à signer ? (le texte reste le même)")) return; await q(sb.from("doc_envois").update({ etat: "envoye", fait_le: null, motif: null, vu_le: null }).eq("id", v.id)); }
          else await q(sb.from("doc_envois").update({ pdf_etat: "a_faire", pdf_erreur: null }).eq("id", v.id));
          toast("C'est reparti"); return afficher("documents");
        }
        if (b.dataset.archiver) { const m = M[b.dataset.archiver]; choisis.delete(m.id); await q(sb.from("doc_modeles").update({ actif: !m.actif }).eq("id", m.id)); return afficher("documents"); }
        if (b.dataset.nouveau) return editerModele(null, b.dataset.nouveau, x.pieces);
        if (b.dataset.modifier) return editerModele(M[b.dataset.modifier], null, x.pieces);
        if (b.dataset.envoyer) return mettreADisposition([M[b.dataset.envoyer]], x);
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
      <label class="dz-champs"><span>Note pour la personne (facultatif)</span><textarea id="nv-note" rows="2" placeholder="Ex. : relis l'article 6, seul le tarif a changé.">${E(d.note || "")}</textarea></label>
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
            remplace: d.id, numero: n, note: (f.querySelector("#nv-note").value || "").trim().slice(0, 2000) || null }));
          toast("Version " + n + " envoyée"); fermer(); vuePilote = "suivi"; filtreSuivi = "attente"; afficher("documents");
        } catch (err) { bouton.disabled = false; toast("Pas envoyé : " + (err.message || err)); }
      };
    });
  }

  /* ---------- Modifier un document envoyé tant qu'il n'est pas signé (17/11/2026) ----------
     Seulement CET envoi : le modèle de la bibliothèque ne bouge pas. Une fois signé, plus rien ne bouge (SQL 68) : il faut une nouvelle version.
     Après la modification, le document repasse en « pas encore ouvert » pour qu'on voie s'il a relu la nouvelle version. */
  async function modifierEnvoi(id) {
    const d = await q(sb.from("doc_envois").select("*").eq("id", id).single());
    if (d.etat !== "envoye" && d.etat !== "vu") { toast("Déjà signé ou refusé : utilise « Nouvelle version »"); return afficher("documents"); }
    const vals = Object.assign({}, d.valeurs || {}), aOikos = (d.champs || []).some(c => c.qui === "oikos");
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Modifier avant signature</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <p class="muted small" style="margin:0">« ${E(d.titre)} » : seulement pour cette personne, le modèle de la bibliothèque ne change pas. ${d.etat === "vu" ? "Il l'a déjà ouvert : s'il essaie de signer l'ancien texte resté à l'écran, l'appli refuse et lui montre la nouvelle version." : "Il ne l'a pas encore ouvert."}</p>
      ${aOikos ? `<section class="card"><b>Cases remplies par OIKOS</b> <span class="muted small">(prix, dates, missions…)</span><div class="dz-champs" id="me-oikos" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${champsHtml(d.champs, vals, "oikos")}</div></section>` : ""}
      ${d.contenu ? `<div class="dz-boutons"><button class="btn" id="me-t">Texte</button><button class="btn flat" id="me-a">Aperçu</button><span class="muted small">Pour une particularité de cette personne, change le texte ici.</span></div>
        <textarea id="me-contenu" rows="14" style="width:100%;box-sizing:border-box;font:13px/1.45 ui-monospace,Consolas,monospace">${E(d.contenu)}</textarea><div id="me-apercu" class="dz-doc" style="display:none;max-height:55vh;overflow:auto"></div>` : `<p class="small">Document à partir d'un fichier : le fichier joint ne se change pas ici (retire-le et envoie-en un autre).</p>`}
      <label class="dz-champs"><span>Note pour la personne (facultatif)</span><textarea id="me-note" rows="2" placeholder="Ex. : le prix a changé, relis l'article 6.">${E(d.note || "")}</textarea></label>
      <label class="dz-champs" style="max-width:260px"><span>À faire avant le (facultatif)</span><input type="date" id="me-echeance" value="${E(d.echeance || "")}"></label>
      <div class="dz-boutons" style="justify-content:flex-end"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="me-ok">Enregistrer</button></div>`, (f, fermer) => {
      const ta = f.querySelector("#me-contenu"), ap = f.querySelector("#me-apercu");
      const valeursVues = () => { const zo = f.querySelector("#me-oikos"); return Object.assign({}, vals, zo ? lireChamps(zo) : {}); };
      if (ta) {
        const onglet = a => { f.querySelector("#me-t").className = "btn" + (a ? " flat" : ""); f.querySelector("#me-a").className = "btn" + (a ? "" : " flat"); ta.style.display = a ? "none" : ""; ap.style.display = a ? "" : "none"; if (a) ap.innerHTML = rendre(ta.value, d.champs, valeursVues(), null, true); };
        f.querySelector("#me-t").onclick = () => onglet(false); f.querySelector("#me-a").onclick = () => onglet(true);
      }
      f.querySelector("#me-ok").onclick = async ev => {
        const bouton = ev.currentTarget;
        try {
          const vo = valeursVues(), mq = manque(d.champs, vo, "oikos"); if (mq) return toast("Case à remplir : " + mq.libelle);
          const contenuN = ta ? ta.value.trim() : null;
          if (ta && !contenuN) return toast("Le texte ne peut pas être vide");
          bouton.disabled = true;
          const frais = await q(sb.from("doc_envois").select("etat").eq("id", d.id).single());   // signé entre-temps ?
          if (frais.etat !== "envoye" && frais.etat !== "vu") { fermer(); toast("Il vient de le signer ou de le refuser : rien n'a été changé. Pour corriger : « Nouvelle version »."); return afficher("documents"); }
          const maj = { valeurs: vo, note: (f.querySelector("#me-note").value || "").trim().slice(0, 2000) || null, echeance: f.querySelector("#me-echeance").value || null };
          if (ta) maj.contenu = contenuN;
          const change = (ta && contenuN !== d.contenu) || JSON.stringify(vo) !== JSON.stringify(d.valeurs || {});
          if (change) { maj.etat = "envoye"; maj.vu_le = null; }   // le texte a changé : on repart de « pas encore ouvert »
          await q(sb.from("doc_envois").update(maj).eq("id", d.id).in("etat", ["envoye", "vu"]));
          toast(change ? "Modifié : il verra la nouvelle version en l'ouvrant" : "Enregistré"); fermer(); afficher("documents");
        } catch (err) { bouton.disabled = false; toast("Pas enregistré : " + (err.message || err)); }
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
        <label>Quand l'envoyer<select id="m-quand">${Object.entries(QUAND).map(([k, t]) => `<option value="${k}" ${(m.quand || "cas") === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Seulement…<select id="m-condition"><option value="">pour tout le monde</option>${Object.entries(CONDITIONS).map(([k, t]) => `<option value="${k}" ${m.condition === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Papier de l'appli rempli une fois signé<select id="m-piece"><option value="">—</option>${pieces.map(p => `<option value="${p.id}" ${m.piece_id === p.id ? "selected" : ""}>${E(p.libelle)}</option>`).join("")}</select></label>
      </div>
      <div><b style="font-size:14px">Pour qui</b> ${Object.entries(POUR).map(([k, t]) => `<label style="margin-left:10px"><input type="checkbox" data-pour="${k}" ${m.pour.includes(k) ? "checked" : ""}> ${t}</label>`).join("")}</div>
      <div><b style="font-size:14px">Fichier joint</b> <span class="muted small">${m.fichier ? "un fichier est joint" : "aucun"}</span> <button class="btn" id="m-fic">${IC("trombone")} ${m.fichier ? "Remplacer" : "Joindre un PDF"}</button>${m.fichier ? ` <button class="btn flat" id="m-ficvoir">Voir</button> <button class="btn flat stop" id="m-ficret">Retirer</button>` : ""}<input type="file" id="m-fichier" accept=".pdf,application/pdf" hidden></div>
      <div class="dz-boutons"><button class="btn" id="m-onglet-t" aria-pressed="true">Texte</button><button class="btn flat" id="m-onglet-a">Aperçu</button><span class="muted small">Texte vide = seulement le fichier joint.</span></div>
      <label class="dz-champs"><span>Note pour la personne <span class="muted small">(facultatif : reprise à chaque envoi, ex. « coche ménage et jardinage »)</span></span><textarea id="m-note" rows="2">${E(m.note || "")}</textarea></label>
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
            piece_id: f.querySelector("#m-piece").value || null, contenu: ta.value.trim() || null,
            quand: f.querySelector("#m-quand").value, condition: f.querySelector("#m-condition").value || null,
            note: (f.querySelector("#m-note").value || "").trim().slice(0, 2000) || null };
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
  // Une ligne doc_envois pour un modèle et une personne (copie figée ; cases de la personne préremplies depuis sa fiche)
  async function envoyerUn(m, g, vo, echeance, note) {
    const valeurs = Object.assign({}, vo);
    (m.champs || []).filter(c => c.qui !== "oikos").forEach(c => { const v = c.source ? sourceDe(g.p, c.source, c) : undefined; if (!vide(v)) valeurs[c.cle] = v; else if (c.defaut) valeurs[c.cle] = c.defaut; });
    const ligne = { modele_id: m.id, version: m.version, titre: m.titre, categorie: m.categorie, action: m.action, contenu: m.contenu, champs: m.champs, valeurs, echeance, piece_id: m.piece_id, note: note === undefined ? (m.note || null) : (note || null) };
    if (g.type === "client") {
      ligne.client_id = g.id;
      if (m.fichier) {   // le client ne lit que son propre espace : copie du fichier
        const blob = await sb.storage.from("modeles").download(m.fichier); if (blob.error) throw blob.error;
        const chemin = `${g.id}/documents/${crypto.randomUUID()}.pdf`;
        const up = await sb.storage.from("espace-client").upload(chemin, blob.data, { contentType: "application/pdf" }); if (up.error) throw up.error;
        await q(sb.from("client_documents").insert({ client_id: g.id, categorie: "autre", titre: m.titre, chemin, visible: true }));
        ligne.fichier = chemin; ligne.fichier_seau = "espace-client";
      }
    } else { ligne.intervenante_id = g.id; if (m.fichier) { ligne.fichier = m.fichier; ligne.fichier_seau = "modeles"; } }
    const r = await q(sb.from("doc_envois").insert(ligne).select("id"));
    return r && r[0] ? r[0].id : null;
  }
  // Pour les autres pages du pilote (Équipe › Matériel) : envoyer un modèle par sa clé à un presta ou un chef.
  // Rend l'id du document envoyé (pour le relier), ou null si le modèle n'existe pas ou est désactivé.
  async function envoyerModele(cle, profil, valeursOikos, note) {
    const m = (await q(sb.from("doc_modeles").select("*").eq("cle", cle).eq("actif", true).limit(1)))[0];
    if (!m) return null;
    return envoyerUn(m, { type: roleDe(profil), id: profil.id, p: profil }, valeursOikos || {}, null, note);
  }
  // Les cases d'OIKOS de plusieurs modèles : un bloc par modèle (même nom de case = valeur reprise d'un bloc à l'autre)
  const blocsOikos = modeles => modeles.filter(m => (m.champs || []).some(c => c.qui === "oikos")).map(m => { const v = {}; (m.champs || []).forEach(c => { if (c.qui === "oikos" && c.defaut) v[c.cle] = c.defaut; });
    // tout est déjà rempli par les valeurs habituelles : bloc replié sur une ligne, à ouvrir seulement pour changer
    const cases = (m.champs || []).filter(c => c.qui === "oikos"), complet = !manque(m.champs, v, "oikos");
    const resume = cases.filter(c => !vide(v[c.cle])).map(c => E(c.libelle) + " : " + E(v[c.cle])).join(" · ");
    const champsZ = `<div class="dz-champs" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${champsHtml(m.champs, v, "oikos")}</div>`;
    return complet ? `<details class="card" data-oikos="${m.id}" style="padding:10px 12px"><summary style="cursor:pointer"><b>${E(m.titre)}</b> <span class="dz-tag ok">${IC("ok")} déjà rempli</span> <span class="muted small">· changer pour cette fois</span></summary><p class="muted small" style="margin:6px 0 0">${resume || "—"}</p>${champsZ}</details>`
      : `<section class="card" data-oikos="${m.id}"><b>${E(m.titre)}</b> <span class="muted small">· à remplir par OIKOS (gardé ensuite pour les prochains envois)</span>${champsZ}</section>`; }).join("");
  // Une note par document, reprise du modèle et modifiable pour cet envoi
  const blocNotes = modeles => modeles.length ? `<details class="card" style="padding:10px 12px" ${modeles.some(m => m.note) ? "open" : ""}><summary style="cursor:pointer"><b>Notes pour la personne</b> <span class="muted small">· facultatif : ce qu'elle doit répondre, ce qui a changé…</span></summary>
    <div class="dz-champs" style="margin-top:8px">${modeles.map(m => `<label><span class="small">${E(m.titre)}</span><textarea rows="2" data-note-de="${m.id}" placeholder="Ex. : coche ménage et jardinage.">${E(m.note || "")}</textarea></label>`).join("")}</div></details>` : "";
  const lireNotes = f => { const o = {}; f.querySelectorAll("[data-note-de]").forEach(t => { o[t.dataset.noteDe] = t.value.trim().slice(0, 2000); }); return o; };
  async function lireOikos(f, modeles) {
    const par = {};
    for (const m of modeles) {
      const z = f.querySelector(`[data-oikos="${m.id}"]`), vo = z ? lireChamps(z) : {};
      const mq = manque(m.champs, vo, "oikos"); if (mq) { toast("« " + m.titre + " » : case à remplir : " + mq.libelle); return null; }
      par[m.id] = vo;
      const oikos = (m.champs || []).filter(c => c.qui === "oikos" && c.garder !== false);   // valeurs gardées comme défaut pour la prochaine fois (sauf « garder: false » : client, liste remise…)
      if (oikos.some(c => typeof vo[c.cle] === "string" && (vo[c.cle] || "") !== (c.defaut || "")))
        await q(sb.from("doc_modeles").update({ champs: m.champs.map(c => c.qui === "oikos" && c.garder !== false && typeof vo[c.cle] === "string" ? Object.assign({}, c, { defaut: vo[c.cle] || undefined }) : c) }).eq("id", m.id)).catch(() => {});
    }
    return par;
  }
  // Plusieurs modèles cochés → plusieurs personnes ; chaque personne ne reçoit que les modèles prévus pour son profil
  function mettreADisposition(modeles, x) {
    if (!modeles.length) return toast("Coche au moins un modèle");
    const types = ["presta", "chef", "client"].filter(t => modeles.some(m => m.pour.includes(t)));
    let type = types[0];
    const pour = t => modeles.filter(m => m.pour.includes(t));
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Mettre à disposition</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <p class="muted small" style="margin:0">${modeles.length === 1 ? `<b>${E(modeles[0].titre)}</b> · ${ACTIONS[modeles[0].action]}` : `<b>${modeles.length} documents</b> : ${modeles.map(m => E(m.titre)).join(", ")}`}. La personne les voit tout de suite dans son appli ; le texte envoyé ne changera plus.</p>
      ${types.length > 1 ? `<div class="sous-menu">${types.map(t => `<button class="chip" data-type="${t}" aria-pressed="${t === type}">${POUR[t]} (${pour(t).length} doc.)</button>`).join("")}</div>` : ""}
      <p class="small" id="md-quoi" style="margin:0"></p>
      <input type="search" id="md-cherche" placeholder="Chercher un nom…" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#ccc)">
      <div id="md-gens" style="max-height:30vh;overflow:auto;display:grid;gap:4px"></div>
      <div id="md-oikos" style="display:grid;gap:10px"></div>
      <label class="dz-champs" style="max-width:260px"><span>À faire avant le (facultatif)</span><input type="date" id="md-echeance"></label>
      <div class="dz-boutons" style="justify-content:flex-end"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="md-ok">Mettre à disposition</button></div>`, (f, fermer) => {
      f.style.maxWidth = "900px";
      const zg = f.querySelector("#md-gens"), ch = f.querySelector("#md-cherche"), coches = new Set();
      const dessiner = () => {
        const l = lesGens(x).filter(g => g.type === type && (!ch.value || g.nom.toLowerCase().includes(ch.value.toLowerCase())));
        zg.innerHTML = l.map(g => { const deja = pour(type).filter(m => { const d = etatModele(x, g, m); return d && d.etat !== "refuse"; });
          return `<label style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;${g.ok ? "" : "opacity:.55"}"><input type="checkbox" value="${g.id}" ${coches.has(g.id) ? "checked" : ""} ${g.ok ? "" : "disabled"}> ${E(g.nom)} ${g.ok ? "" : `<span class="dz-tag">sans espace client</span>`}${deja.length ? `<span class="dz-tag att" title="${E(deja.map(m => m.titre).join(", "))}">${deja.length} déjà envoyé${deja.length > 1 ? "s" : ""} ou signé${deja.length > 1 ? "s" : ""}</span>` : ""}</label>`; }).join("") || `<p class="muted small">Personne.</p>`;
        f.querySelector("#md-quoi").innerHTML = modeles.length > 1 ? `Pour un ${POUR[type].toLowerCase()} : ${pour(type).map(m => "<b>" + E(m.titre) + "</b>").join(", ")}.` : "";
        f.querySelector("#md-ok").textContent = "Mettre à disposition" + (coches.size ? " (" + coches.size + " personne" + (coches.size > 1 ? "s" : "") + ")" : "");
      };
      const dessinerOikos = () => { f.querySelector("#md-oikos").innerHTML = blocsOikos(pour(type)) + blocNotes(pour(type)); };
      dessiner(); dessinerOikos();
      ch.oninput = dessiner;
      zg.onchange = e => { const c = e.target; if (c.checked) coches.add(c.value); else coches.delete(c.value); dessiner(); };
      f.addEventListener("click", e => { const b = e.target.closest("[data-type]"); if (!b) return; type = b.dataset.type; coches.clear(); f.querySelectorAll("[data-type]").forEach(y => y.setAttribute("aria-pressed", y === b)); dessiner(); dessinerOikos(); });
      f.querySelector("#md-ok").onclick = async ev => {
        const bouton = ev.currentTarget;
        try {
          if (!coches.size) return toast("Coche au moins une personne");
          const liste = pour(type), vo = await lireOikos(f, liste); if (!vo) return;
          bouton.disabled = true;
          const echeance = f.querySelector("#md-echeance").value || null, gens = lesGens(x), notes = lireNotes(f);
          let n = 0;
          for (const id of coches) { const g = gens.find(y => y.id === id && y.type === type); if (!g) continue; for (const m of liste) { await envoyerUn(m, g, vo[m.id] || {}, echeance, notes[m.id]); n++; } }
          toast(n === 1 ? "Mis à disposition" : n + " documents mis à disposition"); fermer(); choisis.clear(); vuePilote = "suivi"; filtreSuivi = "attente"; afficher("documents");
        } catch (err) { bouton.disabled = false; toast("Pas envoyé : " + (err.message || err)); }
      };
    });
  }

  /* ---------- « Envoyer à une personne » : on choisit la personne, le pilote propose selon son profil ---------- */
  function envoyerAUnePersonne(x, cleDepart) {
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Envoyer à une personne</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div><div id="ep-corps"></div>`, (f, fermer) => {
      f.style.maxWidth = "900px";
      const corps = f.querySelector("#ep-corps");
      const choisir = () => {
        corps.innerHTML = `<p class="muted small" style="margin:0 0 8px">Presta, chef ou client : le pilote regarde son profil et ce qu'il a déjà signé.</p>
          <input type="search" id="ep-cherche" placeholder="Chercher un nom…" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#ccc)">
          <div id="ep-liste" style="max-height:52vh;overflow:auto;display:grid;gap:4px;margin-top:8px"></div>`;
        const ch = corps.querySelector("#ep-cherche"), zl = corps.querySelector("#ep-liste");
        const dessiner = () => { const l = lesGens(x).filter(g => !ch.value || g.nom.toLowerCase().includes(ch.value.toLowerCase()));
          zl.innerHTML = l.map(g => { const manquent = x.modeles.filter(m => m.actif && m.pour.includes(g.type) && aProposer(m, g, etatModele(x, g, m))).length;
            return `<button class="dz-ligne" type="button" data-qui="${g.cle}" ${g.ok ? "" : "disabled"} style="text-align:left;cursor:pointer;${g.ok ? "" : "opacity:.55"}"><span><b>${E(g.nom)}</b><span class="dz-m">${POUR[g.type]}${g.type !== "client" && g.p.ae_a_creer ? " · OIKOS crée son auto-entreprise" : ""}${g.ok ? "" : " · sans espace client"}</span></span>${manquent ? `<span class="dz-tag att">${manquent} à envoyer</span>` : `<span class="dz-tag ok">${IC("ok")} à jour</span>`}</button>`; }).join(""); };
        dessiner(); ch.oninput = dessiner; ch.focus();
        zl.onclick = e => { const b = e.target.closest("[data-qui]"); if (b) proposer(lesGens(x).find(g => g.cle === b.dataset.qui)); };
      };
      const proposer = g => {
        if (!g) return choisir();
        const liste = x.modeles.filter(m => m.actif && m.pour.includes(g.type));
        const etat = m => etatModele(x, g, m);
        const libEtat = d => !d ? "" : d.etat === "fait" ? `<span class="dz-tag ok">signé le ${dateFr(d.fait_le)}</span>` : d.etat === "refuse" ? `<span class="dz-tag non">refusé le ${dateFr(d.fait_le)}</span>` : `<span class="dz-tag att">envoyé le ${dateFr(d.envoye_le)}, en attente</span>`;
        const ligne = m => { const d = etat(m), bloque = d && d.etat !== "refuse", coche = aProposer(m, g, d);
          return `<label class="dz-ligne" style="cursor:${bloque ? "default" : "pointer"};${bloque ? "opacity:.7" : ""}"><span style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" data-m="${m.id}" ${coche ? "checked" : ""} ${bloque ? "disabled" : ""} style="margin-top:4px"><span><b>${E(m.titre)}</b><span class="dz-m">${ACTIONS[m.action]}${m.condition === "ae_a_creer" ? " · " + (g.p && g.p.ae_a_creer ? "proposé : OIKOS crée son auto-entreprise" : CONDITIONS[m.condition]) : ""}${d && d.etat === "fait" ? " · pour corriger : Suivi › Nouvelle version" : ""}</span></span></span>${libEtat(d)}</label>`; };
        corps.innerHTML = `<div class="dz-boutons" style="justify-content:space-between;align-items:center"><span><b style="font-size:17px">${E(g.nom)}</b> <span class="dz-tag">${POUR[g.type]}</span>${g.type !== "client" && g.p.ae_a_creer ? ` <span class="dz-tag">OIKOS crée son auto-entreprise</span>` : ""}</span><button class="btn flat" data-autre>Changer de personne</button></div>
          <p class="muted small" style="margin:6px 0 0">Cochés d'office : les documents d'arrivée qu'il n'a pas encore signés (et ceux de sa situation). Ce qui est déjà signé ou en attente ne repart pas.</p>
          ${Object.keys(QUAND).map(k => { const l = liste.filter(m => (m.quand || "cas") === k); return l.length ? `<h3 style="margin:14px 0 4px">${QUAND[k]}</h3><div class="dz-liste">${l.map(ligne).join("")}</div>` : ""; }).join("") || `<p class="muted">Aucun modèle prévu pour ce profil.</p>`}
          <div id="ep-oikos" style="display:grid;gap:10px;margin-top:12px"></div>
          <label class="dz-champs" style="max-width:260px;margin-top:10px"><span>À faire avant le (facultatif)</span><input type="date" id="ep-echeance"></label>
          <div class="dz-boutons" style="justify-content:flex-end;margin-top:10px"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="ep-ok"></button></div>`;
        const coches = () => [...corps.querySelectorAll("[data-m]:checked")].map(c => x.M[c.dataset.m]).filter(Boolean);
        const maj = () => { const l = coches(); corps.querySelector("#ep-oikos").innerHTML = blocsOikos(l) + blocNotes(l); corps.querySelector("#ep-ok").textContent = l.length ? "Envoyer " + (l.length === 1 ? "ce document" : "ces " + l.length + " documents") : "Coche au moins un document"; corps.querySelector("#ep-ok").disabled = !l.length; };
        maj();
        corps.onchange = e => { if (e.target.closest("[data-m]")) maj(); };
        corps.querySelector("[data-autre]").onclick = choisir;
        corps.querySelector("#ep-ok").onclick = async ev => {
          const bouton = ev.currentTarget;
          try {
            const l = coches(); if (!l.length) return;
            const vo = await lireOikos(corps, l); if (!vo) return;
            bouton.disabled = true;
            const echeance = corps.querySelector("#ep-echeance").value || null;
            const notes = lireNotes(corps);
            for (const m of l) await envoyerUn(m, g, vo[m.id] || {}, echeance, notes[m.id]);
            toast((l.length === 1 ? "Document envoyé à " : l.length + " documents envoyés à ") + g.nom); fermer(); vuePilote = "suivi"; filtreSuivi = "attente"; rangSuivi = "personne"; afficher("documents");
          } catch (err) { bouton.disabled = false; toast("Pas envoyé : " + (err.message || err)); }
        };
      };
      cleDepart ? proposer(lesGens(x).find(g => g.cle === cleDepart)) : choisir();
    });
  }

  window.DocsOikos = { pilote, presta, rappel, client, rendre, miseEnForme, remplacer, envoyerModele };
})();

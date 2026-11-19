/* ===================== Recrutement : démarcher des presta et des chefs de réseau (SQL 79) — 19/11/2026 =====================
   Pilote seulement : page Équipe › Recrutement. Comme les prospects clients, mais pour les intervenants.
   - une fiche par personne démarchée (presta ou chef de réseau) rangée par étape :
     À contacter › Contacté › Rendez-vous › Intéressé › Recruté (et Pas intéressé, replié) ;
   - prochaine relance (en rouge quand elle est passée), rendez-vous, d'où il vient, activités, statut ;
   - boutons Appeler / SMS / WhatsApp / Mail, et chaque échange noté dans l'historique (table recrues_echanges) ;
   - « Créer sa fiche presta » ou « Créer le chef » ouvre le formulaire habituel du pilote déjà rempli :
     une fois enregistré, la fiche passe en Recruté toute seule.
   Se sert de ce que le pilote a déjà : sb, q, toast, ico, contenu, fenetre, afficher, aide, numeroSms, nouveauPresta, ficheCheffe. */
(function () {
  "use strict";
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const IC = n => { try { return typeof ico === "function" ? ico(n) : ""; } catch (e) { return ""; } };
  const AIDE = t => { try { return typeof aide === "function" ? aide(t) : ""; } catch (e) { return ""; } };
  const auj = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const dansJours = n => { const d = new Date(Date.now() + n * 864e5); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const dateFr = d => d ? new Date(String(d).length === 10 ? d + "T12:00:00" : d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "";
  const heureFr = d => { d = new Date(d); return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) + " à " + d.getHours() + " h " + String(d.getMinutes()).padStart(2, "0"); };
  const local = d => { if (!d) return ""; d = new Date(d); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const nomR = r => ((r.prenom || "") + " " + (r.nom || "")).trim() || "?";
  const sansAccent = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const numSms = t => typeof numeroSms === "function" ? numeroSms(t) : String(t || "").replace(/[^\d+]/g, "");

  const ETAPES = [["a_contacter", "À contacter"], ["contacte", "Contacté"], ["rdv", "Rendez-vous"], ["interesse", "Intéressé"], ["recrute", "Recruté"], ["pas_interesse", "Pas intéressé"]];
  const NOM_ETAPE = Object.fromEntries(ETAPES);
  const SUITE = { a_contacter: "contacte", contacte: "rdv", rdv: "interesse" };
  const SORTES = { presta: "Presta", chef: "Chef de réseau" };
  const ACTIVITES = ["Ménage", "Jardinage", "Bricolage", "Cours", "Autre"];
  const SOURCES = ["Bouche à oreille", "Indeed", "Leboncoin", "Facebook", "France Travail", "Site OIKOS", "Un presta d'OIKOS", "Un client", "Autre"];
  const STATUTS_J = ["Auto-entrepreneur", "Société", "Auto-entreprise à créer", "Veut être salarié", "Pas encore connu"];
  const ECHANGES = { appel: "Appel", sms: "SMS", mail: "Mail", whatsapp: "WhatsApp", rdv: "Rendez-vous", livret: "Livret envoyé", note: "Note", etape: "Étape" };
  const ECH_ICO = { appel: "tel", sms: "bulle", mail: "mail", whatsapp: "portable", rdv: "agenda", livret: "doc", note: "stylo", etape: "drapeau" };
  let filtre = "tout", cherche = "", voirPerdus = false, sqlManque = false;

  function styles() {
    if (document.getElementById("rc-styles")) return;
    const s = document.createElement("style"); s.id = "rc-styles";
    s.textContent = `
.rc-barre{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}
.rc-barre input[type=search]{flex:1 1 220px;min-width:0;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#ccc);font:inherit;background:var(--bg,#fff);color:inherit}
.rc-chiffres{display:flex;gap:18px;flex-wrap:wrap;margin:6px 0 2px}.rc-chiffres b{font-size:18px;display:block}.rc-chiffres span{font-size:12px;color:var(--muted,#666)}
.rc-groupe{margin:18px 0 6px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.rc-groupe h3{margin:0;font-size:16px}
.rc-liste{display:grid;gap:6px}
.rc-ligne{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:9px 12px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface,var(--carte,#fff))}
.rc-ligne.rc-retard{border-color:var(--delai-ink,#8E2F1C)}
.rc-nom{flex:1 1 240px;min-width:0;text-align:left;background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer}
.rc-nom b{display:block}.rc-m{font-size:12px;color:var(--muted,#666)}
.rc-tag{display:inline-block;font-size:11px;font-weight:600;border-radius:999px;padding:2px 8px;background:var(--accent-soft,#E7E8DA);color:var(--accent,#525A44);white-space:nowrap}
.rc-tag.chef{background:var(--warn-soft,#F4E9CC);color:var(--warn,#8A5A0E)}
.rc-tag.non{background:var(--delai,#FBE3DE);color:var(--delai-ink,#8E2F1C)}.rc-tag.ok{background:var(--paie,#DFF0DC);color:var(--paie-ink,#2C6B29)}
.rc-act{display:flex;gap:4px;flex-wrap:wrap}
.rc-act .btn,.rc-act a.btn{padding:6px 9px}
.rc-form{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));align-items:start}
.rc-form label{display:grid;gap:4px;font-size:14px;align-content:start}
.rc-form input,.rc-form select,.rc-form textarea{width:100%;box-sizing:border-box;font:inherit;padding:9px 10px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit}
.rc-cases{display:flex;gap:10px;flex-wrap:wrap}.rc-cases label{display:flex;gap:6px;align-items:center}
.rc-histo{display:grid;gap:6px;margin:6px 0 0;padding:0;list-style:none;max-height:34vh;overflow:auto}
.rc-histo li{padding:7px 10px;border-left:3px solid var(--accent-soft,#E7E8DA);font-size:14px}
.rc-histo li .ico{width:14px;height:14px;vertical-align:-2px}
.rc-ajout{display:grid;gap:8px;padding:10px;border:1px solid var(--line,#ddd);border-radius:12px;margin-top:10px}
.rc-ajout .rc-sortes{display:flex;gap:6px;flex-wrap:wrap}
.rc-ajout textarea{width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit;min-height:56px}
.rc-pas{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0}.rc-pas .chip{font-size:13px}`;
    document.head.appendChild(s);
  }

  /* ---------- Les données ---------- */
  async function charger() {
    const r = await sb.from("recrues").select("*").order("relance_le", { ascending: true, nullsFirst: false }).order("cree_le", { ascending: false });
    if (r.error) { if (/recrues|relation|schema cache|does not exist/i.test(r.error.message || "") || r.error.code === "42P01" || r.error.code === "PGRST205") { sqlManque = true; return null; } throw r.error; }
    sqlManque = false;
    return r.data || [];
  }
  const enRetard = r => !["recrute", "pas_interesse"].includes(r.etape) && r.relance_le && r.relance_le <= auj();
  const telLien = t => String(t || "").replace(/[^\d+]/g, "");
  const waLien = t => { const n = numSms(t); return n ? "https://wa.me/" + n.replace(/^\+/, "") : ""; };

  /* ---------- La page ---------- */
  async function page() {
    styles();
    const liste = await charger();
    if (liste === null) return contenu(`<h1>Recrutement</h1><div class="card"><p>La base n'est pas encore prête pour le recrutement.</p>
      <p class="muted">Lance d'abord le fichier <b>base\\79 - recrutement des presta et chefs.sql</b> dans Supabase › SQL Editor (réponse attendue : recrutement_pret = 6), puis actualise la page.</p></div>`);
    const garde = r => (filtre === "tout" || (filtre === "relance" ? enRetard(r) : r.sorte === filtre))
      && (!cherche || sansAccent([nomR(r), r.ville, r.source, r.telephone, r.email, (r.activites || []).join(" "), r.note].join(" ")).includes(sansAccent(cherche)));
    const l = liste.filter(garde);
    const nbRelance = liste.filter(enRetard).length;
    const debutMois = auj().slice(0, 8) + "01";
    const enCours = liste.filter(r => !["recrute", "pas_interesse"].includes(r.etape));
    const recrutesMois = liste.filter(r => r.etape === "recrute" && r.recrute_le && r.recrute_le >= debutMois).length;
    const ligne = r => {
      const tel = telLien(r.telephone), wa = waLien(r.telephone), retard = enRetard(r);
      const infos = [(r.activites || []).join(", "), r.ville, r.source ? "via " + r.source : "", r.statut_juridique].filter(Boolean).map(E).join(" · ");
      const quand = r.etape === "rdv" && r.rdv_le ? `<span class="rc-tag">${IC("agenda")} rendez-vous ${E(heureFr(r.rdv_le))}</span>`
        : r.relance_le && !["recrute", "pas_interesse"].includes(r.etape) ? `<span class="rc-tag ${retard ? "non" : ""}">${retard ? "à relancer depuis le " : "relance le "}${E(dateFr(r.relance_le))}</span>` : "";
      const suite = SUITE[r.etape];
      return `<div class="rc-ligne ${retard ? "rc-retard" : ""}">
        <button class="rc-nom" type="button" data-fiche="${r.id}"><b>${E(nomR(r))} <span class="rc-tag ${r.sorte === "chef" ? "chef" : ""}">${SORTES[r.sorte] || ""}</span></b><span class="rc-m">${infos || "&nbsp;"}${r.dernier_contact ? " · dernier contact le " + E(dateFr(r.dernier_contact)) : ""}</span></button>
        ${quand}${r.etape === "recrute" && r.profil_cree ? `<span class="rc-tag ok">${E(r.profil_cree)}</span>` : ""}
        <span class="rc-act">${tel ? `<a class="btn flat" href="tel:${E(tel)}" data-trace="appel" data-id="${r.id}" title="Appeler ${E(r.telephone)}">${IC("tel")}</a>` : ""}${numSms(r.telephone) ? `<a class="btn flat" href="sms:${E(numSms(r.telephone))}" data-trace="sms" data-id="${r.id}" title="SMS">${IC("bulle")}</a>` : ""}${wa ? `<a class="btn flat" href="${E(wa)}" target="_blank" rel="noopener" data-trace="whatsapp" data-id="${r.id}" title="WhatsApp">${IC("portable")}</a>` : ""}${r.email ? `<a class="btn flat" href="mailto:${E(r.email)}" data-trace="mail" data-id="${r.id}" title="Mail à ${E(r.email)}">${IC("mail")}</a>` : ""}
        ${suite ? `<button class="btn" type="button" data-suite="${r.id}" title="Passer à l'étape suivante">${NOM_ETAPE[suite]} ›</button>` : ""}
        ${r.etape === "interesse" ? `<button class="btn primary" type="button" data-recruter="${r.id}">${r.sorte === "chef" ? "Créer le chef" : "Créer sa fiche presta"}</button>` : ""}</span></div>`;
    };
    const groupes = ETAPES.filter(([k]) => k !== "pas_interesse" || voirPerdus).map(([k, t]) => {
      const g = l.filter(r => r.etape === k);
      if (!g.length && (k === "recrute" || k === "pas_interesse")) return "";
      return `<div class="rc-groupe"><h3>${t}</h3><span class="muted small">${g.length}</span></div>
        <div class="rc-liste">${g.length ? g.map(ligne).join("") : `<p class="muted small" style="margin:0">Personne.</p>`}</div>`;
    }).join("");
    const z = contenu(`<div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h1 style="margin:0">Recrutement</h1>
        <span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="rc-csv">${IC("doc")} Exporter</button><button class="btn primary" id="rc-ajout">${IC("plus")} Nouveau prospect</button></span></div>
      <p class="muted small" style="margin:4px 0 0">Les presta et chefs de réseau que tu démarches, comme les prospects clients. ${AIDE("Une fiche par personne. Note chaque appel ou message avec sa prochaine relance : les relances passées remontent en rouge. Quand il est d'accord, « Créer sa fiche presta » ou « Créer le chef » ouvre le formulaire habituel déjà rempli, et la fiche passe en Recruté.")}</p>
      <div class="rc-chiffres"><div><b>${enCours.length}</b><span>en cours</span></div><div><b style="${nbRelance ? "color:var(--delai-ink,#8E2F1C)" : ""}">${nbRelance}</b><span>à relancer</span></div><div><b>${liste.filter(r => r.etape === "rdv").length}</b><span>rendez-vous</span></div><div><b>${recrutesMois}</b><span>recrutés ce mois</span></div></div>
      <div class="rc-barre"><input type="search" id="rc-cherche" placeholder="Nom, ville, activité, source…" value="${E(cherche)}">
        ${[["tout", "Tous"], ["presta", "Presta"], ["chef", "Chefs de réseau"], ["relance", "À relancer" + (nbRelance ? " (" + nbRelance + ")" : "")]].map(([k, t]) => `<button class="chip" data-filtre="${k}" aria-pressed="${filtre === k}">${t}</button>`).join("")}</div>
      ${liste.length ? groupes : `<div class="card"><p style="margin:0">Personne pour l'instant. Clique sur <b>Nouveau prospect</b> pour noter la première personne à démarcher.</p></div>`}
      ${liste.some(r => r.etape === "pas_interesse") ? `<p style="margin-top:16px"><button class="btn flat" id="rc-perdus">${voirPerdus ? "Cacher" : "Voir"} les « pas intéressé »${voirPerdus ? "" : " (" + liste.filter(r => r.etape === "pas_interesse").length + ")"}</button></p>` : ""}`);
    const c = z.querySelector("#rc-cherche");
    c.oninput = () => { cherche = c.value; const pos = c.selectionStart; page().then(() => { const n = document.getElementById("rc-cherche"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); };
    z.querySelector("#rc-ajout").onclick = () => fiche(null);
    z.querySelector("#rc-csv").onclick = () => exporter(liste);
    const perdus = z.querySelector("#rc-perdus"); if (perdus) perdus.onclick = () => { voirPerdus = !voirPerdus; page(); };
    z.onclick = async e => {
      const f = e.target.closest("[data-filtre]"); if (f) { filtre = f.dataset.filtre; return page(); }
      const b = e.target.closest("[data-fiche]"); if (b) return fiche(liste.find(r => r.id === b.dataset.fiche));
      const s = e.target.closest("[data-suite]"); if (s) { const r = liste.find(x => x.id === s.dataset.suite); return changerEtape(r, SUITE[r.etape]); }
      const rc = e.target.closest("[data-recruter]"); if (rc) return recruter(liste.find(r => r.id === rc.dataset.recruter));
      const t = e.target.closest("[data-trace]"); if (t) { const r = liste.find(x => x.id === t.dataset.id); setTimeout(() => noterApres(r, t.dataset.trace), 400); }
    };
  }

  /* Après un clic sur Appeler / SMS / WhatsApp / Mail : on propose de noter ce qui s'est dit et la prochaine relance */
  function noterApres(r, sorte) { if (r) fiche(r, sorte); }

  async function changerEtape(r, etape, texte) {
    const maj = { etape };
    if (etape === "contacte" && !r.relance_le) maj.relance_le = dansJours(7);
    if (["recrute", "pas_interesse"].includes(etape)) maj.relance_le = null;
    const { error } = await sb.from("recrues").update(maj).eq("id", r.id);
    if (error) return toast("Ça n'a pas marché : " + error.message);
    await sb.from("recrues_echanges").insert({ recrue_id: r.id, sorte: "etape", texte: (NOM_ETAPE[r.etape] || r.etape) + " → " + NOM_ETAPE[etape] + (texte ? " : " + texte : "") });
    toast(nomR(r) + " : " + NOM_ETAPE[etape]);
    if (typeof onglet === "undefined" || onglet === "recrutement") page();
  }

  /* ---------- La fiche ---------- */
  async function fiche(r, sorteEchange) {
    const neuf = !r, v = r || { sorte: filtre === "chef" ? "chef" : "presta", etape: "a_contacter", activites: [], relance_le: auj() };
    const echanges = neuf ? [] : await q(sb.from("recrues_echanges").select("*").eq("recrue_id", r.id).order("le", { ascending: false }));
    const tel = telLien(v.telephone), wa = waLien(v.telephone);
    const opts = (l, val) => `<option value="">—</option>` + [...new Set([...l, ...(val && !l.includes(val) ? [val] : [])])].map(x => `<option ${x === val ? "selected" : ""}>${E(x)}</option>`).join("");
    fenetre(`<h2 style="margin:0">${neuf ? "Nouveau prospect" : E(nomR(v))} ${neuf ? "" : `<span class="rc-tag ${v.sorte === "chef" ? "chef" : ""}">${SORTES[v.sorte]}</span>`}</h2>
      ${neuf ? "" : `<div class="rc-pas" role="group" aria-label="Étape">${ETAPES.map(([k, t]) => `<button type="button" class="chip" data-etape="${k}" aria-pressed="${v.etape === k}">${t}</button>`).join("")}</div>
        <div class="rc-act" style="margin-bottom:6px">${tel ? `<a class="btn" href="tel:${E(tel)}">${IC("tel")} Appeler</a>` : ""}${numSms(v.telephone) ? `<a class="btn" href="sms:${E(numSms(v.telephone))}">${IC("bulle")} SMS</a>` : ""}${wa ? `<a class="btn" href="${E(wa)}" target="_blank" rel="noopener">${IC("portable")} WhatsApp</a>` : ""}${v.email ? `<a class="btn" href="mailto:${E(v.email)}">${IC("mail")} Mail</a>` : ""}
          ${v.etape !== "recrute" ? `<button class="btn primary" type="button" id="rc-recruter">${v.sorte === "chef" ? "Créer le chef" : "Créer sa fiche presta"}</button>` : ""}</div>`}
      ${neuf ? "" : `<div class="rc-ajout"><b>Noter un échange</b>
        <div class="rc-sortes">${["appel", "sms", "whatsapp", "mail", "rdv", "livret", "note"].map(k => `<label class="chk" style="margin:0"><input type="radio" name="rc-es" value="${k}" ${k === (sorteEchange || "appel") ? "checked" : ""}>${ECHANGES[k]}</label>`).join("")}</div>
        <textarea id="rc-et" maxlength="2000" placeholder="Ce qui s'est dit : intéressé ? disponibilités, secteur, questions…"></textarea>
        <div class="rc-form"><label>Prochaine relance<input type="date" id="rc-er" value="${E(v.relance_le && v.relance_le > auj() ? v.relance_le : dansJours(7))}"></label>
          <label id="rc-erdv-l" ${(sorteEchange || "appel") === "rdv" ? "" : "hidden"}>Rendez-vous le<input type="datetime-local" id="rc-erdv" value="${E(local(v.rdv_le))}"></label></div>
        <div class="row"><button class="btn primary" type="button" id="rc-eok">Noter</button><label class="chk" style="margin:0"><input type="checkbox" id="rc-esans">Pas de relance</label></div></div>
        ${echanges.length ? `<h3 style="margin:14px 0 0">Historique</h3><ul class="rc-histo">${echanges.map(x => `<li>${IC(ECH_ICO[x.sorte] || "stylo")} <b>${ECHANGES[x.sorte] || E(x.sorte)}</b> <span class="muted small">· ${E(heureFr(x.le))}</span>${x.texte ? `<br>${E(x.texte)}` : ""}</li>`).join("")}</ul>` : ""}`}
      <details ${neuf ? "open" : ""} style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">${neuf ? "Ses informations" : "Modifier ses informations"}</summary>
      <form id="rc-f" style="margin-top:10px;display:grid;gap:10px">
        <div class="rc-form">
          <label>Prénom<input name="prenom" maxlength="60" autocomplete="off" value="${E(v.prenom || "")}"></label>
          <label>Nom<input name="nom" maxlength="60" autocomplete="off" value="${E(v.nom || "")}"></label>
          <label>On le démarche comme<select name="sorte">${Object.entries(SORTES).map(([k, t]) => `<option value="${k}" ${k === v.sorte ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <label>Portable<input name="telephone" type="tel" maxlength="30" autocomplete="off" placeholder="06 12 34 56 78" value="${E(v.telephone || "")}"></label>
          <label>E-mail<input name="email" type="email" maxlength="200" autocomplete="off" autocapitalize="none" spellcheck="false" value="${E(v.email || "")}"></label>
          <label>Ville ou secteur<input name="ville" maxlength="120" autocomplete="off" value="${E(v.ville || "")}"></label>
          <label>Trouvé par<select name="source">${opts(SOURCES, v.source)}</select></label>
          <label>Statut<select name="statut_juridique">${opts(STATUTS_J, v.statut_juridique)}</select></label>
          <label>SIRET (s'il en a un)<input name="siret" inputmode="numeric" maxlength="20" autocomplete="off" value="${E(v.siret || "")}"></label>
          ${neuf ? `<label>Première relance<input type="date" name="relance_le" value="${E(v.relance_le || "")}"></label>` : `<label>Prochaine relance<input type="date" name="relance_le" value="${E(v.relance_le || "")}"></label>`}
        </div>
        <div><span class="muted small">Activités</span><div class="rc-cases">${ACTIVITES.map(a => `<label class="chk" style="margin:0"><input type="checkbox" name="act" value="${a}" ${(v.activites || []).includes(a) ? "checked" : ""}>${a}</label>`).join("")}</div></div>
        <label class="f">Note<textarea name="note" maxlength="4000" rows="3" placeholder="Expérience, voiture, disponibilités, qui l'a recommandé…">${E(v.note || "")}</textarea></label>
        <p class="err" id="rc-err"></p>
        <div class="row"><button class="btn primary" type="submit">${neuf ? "Ajouter" : "Enregistrer"}</button>${neuf ? "" : `<button class="btn flat" type="button" id="rc-suppr">${IC("corbeille")} Supprimer</button>`}<button class="btn flat" type="button" data-fermer>Fermer</button></div>
      </form></details>`, (el, fermer) => {
      const f = el.querySelector("#rc-f"), err = el.querySelector("#rc-err");
      f.onsubmit = async ev => {
        ev.preventDefault();
        const net = s => s.trim().replace(/\s+/g, " ");
        const d = { prenom: net(f.prenom.value) || null, nom: net(f.nom.value) || null, sorte: f.sorte.value, telephone: net(f.telephone.value) || null, email: f.email.value.trim().toLowerCase() || null,
          ville: net(f.ville.value) || null, source: f.source.value || null, statut_juridique: f.statut_juridique.value || null, siret: f.siret.value.replace(/\s/g, "") || null,
          relance_le: f.relance_le.value || null, activites: [...f.querySelectorAll("[name=act]:checked")].map(x => x.value), note: f.note.value.trim() || null };
        if (!d.prenom && !d.nom) { err.textContent = "Il faut au moins un prénom ou un nom."; return; }
        if (d.telephone && !numSms(d.telephone)) { err.textContent = "Numéro non reconnu : écris-le comme 06 12 34 56 78."; return; }
        if (neuf) {
          const autres = await q(sb.from("recrues").select("id,prenom,nom,telephone"));
          const meme = autres.find(x => sansAccent(nomR(x)) === sansAccent(nomR(d)) || (d.telephone && x.telephone && numSms(x.telephone) === numSms(d.telephone)));
          if (meme && !confirm(`${nomR(meme)} est déjà dans le recrutement. L'ajouter quand même ?`)) return;
        }
        const r2 = neuf ? await sb.from("recrues").insert(d).select().single() : await sb.from("recrues").update(d).eq("id", r.id).select().single();
        if (r2.error) { err.textContent = r2.error.message; return; }
        toast(neuf ? "Ajouté au recrutement" : "Enregistré"); fermer(); page();
        if (neuf) fiche(r2.data);
      };
      if (neuf) return;
      el.querySelectorAll("[name=rc-es]").forEach(x => x.onchange = () => { el.querySelector("#rc-erdv-l").hidden = el.querySelector("[name=rc-es]:checked").value !== "rdv"; });
      el.querySelector("#rc-eok").onclick = async () => {
        const sorte = el.querySelector("[name=rc-es]:checked").value, texte = el.querySelector("#rc-et").value.trim();
        const relance = el.querySelector("#rc-esans").checked ? null : el.querySelector("#rc-er").value || null, rdv = el.querySelector("#rc-erdv").value;
        if (sorte === "rdv" && !rdv) return toast("Choisis la date du rendez-vous");
        if (sorte === "note" && !texte) return toast("Écris la note");
        const { error } = await sb.from("recrues_echanges").insert({ recrue_id: r.id, sorte, texte: (sorte === "rdv" ? "Rendez-vous le " + heureFr(rdv) + (texte ? " : " : "") : "") + texte || null });
        if (error) return toast("Ça n'a pas marché : " + error.message);
        const maj = { relance_le: relance };
        if (sorte === "rdv") { maj.rdv_le = new Date(rdv).toISOString(); if (["a_contacter", "contacte"].includes(r.etape)) maj.etape = "rdv"; }
        else if (r.etape === "a_contacter" && sorte !== "note") maj.etape = "contacte";
        await sb.from("recrues").update(maj).eq("id", r.id);
        toast("Noté" + (relance ? ", relance le " + dateFr(relance) : "")); fermer(); page();
      };
      el.querySelectorAll("[data-etape]").forEach(b => b.onclick = async () => {
        const e2 = b.dataset.etape; if (e2 === r.etape) return;
        if (e2 === "recrute") { fermer(); return recruter(r); }
        let pourquoi = "";
        if (e2 === "pas_interesse") { pourquoi = prompt("Pourquoi ? (facultatif, pour t'en souvenir)", ""); if (pourquoi === null) return; }
        fermer(); await changerEtape(r, e2, pourquoi.trim());
      });
      const rec = el.querySelector("#rc-recruter"); if (rec) rec.onclick = () => { fermer(); recruter(r); };
      el.querySelector("#rc-suppr").onclick = async () => {
        if (!confirm(`Supprimer ${nomR(r)} et tout son historique du recrutement ? (Rien d'autre n'est touché.) Pour le garder en mémoire, choisis plutôt « Pas intéressé ».`)) return;
        const { error } = await sb.from("recrues").delete().eq("id", r.id);
        if (error) return toast("Ça n'a pas marché : " + error.message);
        toast("Supprimé du recrutement"); fermer(); page();
      };
    });
  }

  /* ---------- Recruter : le formulaire habituel du pilote, déjà rempli ----------
     Presta : « Nouveau presta » (Créer et inviter ou Préparer sans inviter, table comptes_a_creer).
     Chef : « Nouveau chef » (table equipes). Quand la fenêtre se ferme, on regarde si la fiche a bien été créée :
     si oui, le prospect passe en Recruté ; sinon rien ne bouge. */
  function recruter(r) {
    const chef = r.sorte === "chef";
    const ouvrir = chef ? (typeof ficheCheffe === "function" ? () => ficheCheffe(null) : null) : (typeof nouveauPresta === "function" ? () => nouveauPresta(null) : null);
    if (!ouvrir) return toast("Le formulaire n'est pas disponible ici : crée-le depuis Équipe › Presta");
    if (chef && (typeof cacheEquipes === "undefined" || !cacheEquipes)) return toast("Les équipes ne sont pas encore chargées : ouvre Équipe › Réseau une fois, puis réessaie");
    const avant = Date.now();
    ouvrir();
    const form = document.getElementById(chef ? "fc" : "np"); if (!form) return;
    const mettre = (n, val) => { const c = form.elements[n]; if (c && val && !c.value) { c.value = val; c.dispatchEvent(new Event("input", { bubbles: true })); } };
    mettre("prenom", r.prenom); mettre(chef ? "nomc" : "nom", r.nom); mettre("email", r.email); mettre("telephone", r.telephone);
    if (chef) mettre("nom", "Équipe " + (r.prenom || r.nom || ""));
    if (!chef && /créer/i.test(r.statut_juridique || "") && form.elements.ae) form.elements.ae.checked = true;
    if (!chef && /salari/i.test(r.statut_juridique || "") && form.elements.statut) form.elements.statut.value = "salarie";
    const voile = form.closest(".voile");
    const garde = new MutationObserver(async () => {
      if (voile && document.body.contains(voile)) return;
      garde.disconnect();
      const cree = await verifierCree(r, chef, avant);
      if (!cree) return;
      await sb.from("recrues").update({ etape: "recrute", relance_le: null, profil_cree: cree }).eq("id", r.id);
      await sb.from("recrues_echanges").insert({ recrue_id: r.id, sorte: "etape", texte: (NOM_ETAPE[r.etape] || r.etape) + " → Recruté : " + cree });
      toast(nomR(r) + " recruté : " + cree);
      if (typeof onglet !== "undefined" && onglet === "recrutement") page();
    });
    garde.observe(document.body, { childList: true });
  }
  async function verifierCree(r, chef, avant) {
    const mots = sansAccent(nomR(r)).split(" ").filter(m => m.length > 1);
    const pareil = t => { const s = sansAccent(t); return mots.length && mots.every(m => s.includes(m)); };
    const depuis = new Date(avant - 60000).toISOString();
    try {
      if (chef) {
        const l = await q(sb.from("equipes").select("id,nom,cheffe_nom,cree_le").gte("cree_le", depuis));
        const e = l.find(x => pareil(x.cheffe_nom)); return e ? "chef, " + e.nom : null;
      }
      const l = await q(sb.from("comptes_a_creer").select("prenom,nom,etat,cree_le").gte("cree_le", depuis));
      const c = l.find(x => pareil(x.prenom + " " + x.nom)); return c ? (c.etat === "prepare" ? "fiche presta préparée" : "presta invité") : null;
    } catch (e) { return null; }
  }

  function exporter(liste) {
    const col = ["Prénom", "Nom", "Comme", "Étape", "Activités", "Portable", "E-mail", "Ville", "Trouvé par", "Statut", "SIRET", "Prochaine relance", "Rendez-vous", "Dernier contact", "Recruté le", "Note"];
    const cel = x => { x = String(x ?? ""); return /[";\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const lignes = liste.map(r => [r.prenom, r.nom, SORTES[r.sorte], NOM_ETAPE[r.etape], (r.activites || []).join(", "), r.telephone, r.email, r.ville, r.source, r.statut_juridique, r.siret, r.relance_le, r.rdv_le ? heureFr(r.rdv_le) : "", r.dernier_contact ? heureFr(r.dernier_contact) : "", r.recrute_le, r.note].map(cel).join(";"));
    const blob = new Blob(["﻿" + [col.join(";"), ...lignes].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Recrutement OIKOS " + auj() + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* Pour la page Aujourd'hui ou ailleurs : nombre de relances passées (null si le SQL 79 n'est pas lancé) */
  async function aRelancer() {
    const r = await sb.from("recrues").select("id", { count: "exact", head: true }).not("etape", "in", "(recrute,pas_interesse)").lte("relance_le", auj());
    return r.error ? null : r.count || 0;
  }

  window.RecrutementOikos = { page, aRelancer };
})();

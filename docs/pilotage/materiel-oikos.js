/* ===================== Matériel d'OIKOS : inventaire et où il se trouve (SQL 73 + 73b) — 16/11/2026 =====================
   Pilote seulement : page Équipe › Matériel.
   - une ligne par objet (repère M-001…, état, prix d'achat) rangée par endroit : au dépôt, chez tel presta ou chef,
     chez tel client, ailleurs (réparateur, garage…) ;
   - « Remettre à un presta » : le matériel passe chez lui ET il reçoit dans son appli le formulaire
     « Remise de clés, de matériel et de moyens d'accès » à signer, avec la liste déjà remplie ;
   - « Rentrer au dépôt », « Mettre ailleurs », « Changer l'état » ; chaque geste est noté dans l'historique
     (table materiel_mouvements, qui met la fiche à jour toute seule).
   Se sert de ce que le pilote a déjà : sb, q, esc, toast, ico, contenu, fenetre, afficher ; et DocsOikos.envoyerModele. */
(function () {
  "use strict";
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const IC = n => { try { return typeof ico === "function" ? ico(n) : ""; } catch (e) { return ""; } };
  const auj = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const dateFr = d => d ? new Date(d + (String(d).length === 10 ? "T12:00:00" : "")).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
  const euros = n => (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const ETATS = { neuf: "Neuf", bon: "Bon état", use: "Usé", a_reparer: "À réparer", hors_service: "Hors service", perdu: "Perdu", vole: "Volé", vendu: "Vendu ou jeté" };
  const ETAT_TON = { neuf: "ok", bon: "ok", use: "", a_reparer: "att", hors_service: "non", perdu: "non", vole: "non", vendu: "" };
  const SORTIS = ["perdu", "vole", "vendu"];   // ne compte plus dans le matériel disponible
  const SORTES = { entree: "Entrée dans l'inventaire", remise: "Remis", retour: "Rentré au dépôt", deplacement: "Déplacé", etat: "État changé" };
  const CATEGORIES = ["Jardin", "Ménage", "Bricolage", "Échelles et sécurité", "Informatique et téléphone", "Véhicule", "Autre"];
  const RECU = "remise-intervenant";
  const nomP = p => p ? (((p.prenom || "") + " " + (p.nom || "")).trim() || p.email || "?") : "?";
  let filtre = "tout", cherche = "";
  const coches = new Set();

  function styles() {
    if (document.getElementById("ma-styles")) return;
    const s = document.createElement("style"); s.id = "ma-styles";
    s.textContent = `
.ma-barre{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}
.ma-barre input[type=search]{flex:1 1 220px;min-width:0;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#ccc);font:inherit;background:var(--bg,#fff);color:inherit}
.ma-groupe{margin:18px 0 6px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.ma-groupe h3{margin:0;font-size:16px}
.ma-liste{display:grid;gap:6px}
.ma-ligne{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:9px 12px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface,var(--carte,#fff))}
.ma-ligne .ma-nom{flex:1 1 220px;min-width:0;text-align:left;background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer}
.ma-ligne .ma-nom b{display:block}.ma-m{font-size:12px;color:var(--muted,#666)}
.ma-rep{font:600 11px ui-monospace,Consolas,monospace;border:1px solid var(--line,#ccc);border-radius:6px;padding:1px 5px;color:var(--muted,#666)}
.ma-tag{display:inline-block;font-size:11px;font-weight:600;border-radius:999px;padding:2px 8px;background:var(--accent-soft,#E7E8DA);color:var(--accent,#525A44)}
.ma-tag.ok{background:var(--paie,#DFF0DC);color:var(--paie-ink,#2C6B29)}.ma-tag.non{background:var(--delai,#FBE3DE);color:var(--delai-ink,#8E2F1C)}.ma-tag.att{background:var(--warn-soft,#F4E9CC);color:var(--warn,#8A5A0E)}
.ma-sel{position:sticky;bottom:10px;z-index:5;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;border-radius:14px;background:var(--accent,#525A44);color:#fff;margin-top:14px;box-shadow:0 6px 20px rgba(0,0,0,.18)}
.ma-sel .btn{background:#fff;color:var(--accent,#525A44);border-color:transparent}
.ma-form{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));align-items:start}
.ma-form label{display:grid;gap:4px;font-size:14px;align-content:start}
.ma-form input,.ma-form select,.ma-form textarea,.ma-champ{width:100%;box-sizing:border-box;font:inherit;padding:9px 10px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit}
.ma-gens{max-height:32vh;overflow:auto;display:grid;gap:4px}.ma-gens label{display:flex;gap:8px;align-items:center}
.ma-histo{display:grid;gap:6px;margin:0;padding:0;list-style:none}.ma-histo li{padding:8px 10px;border-left:3px solid var(--accent-soft,#E7E8DA)}
.ma-chiffres{display:flex;gap:18px;flex-wrap:wrap;margin:4px 0 0}.ma-chiffres b{font-size:18px;display:block}`;
    document.head.appendChild(s);
  }

  /* ---------- Les données ---------- */
  async function charger() {
    const [mat, mvts, profils, clients] = await Promise.all([
      q(sb.from("materiel").select("*").order("etiquette", { nullsFirst: false })),
      q(sb.from("materiel_mouvements").select("*").order("le", { ascending: false }).order("cree_le", { ascending: false })),
      q(sb.from("profils").select("id,prenom,nom,email,telephone,adresse,siret,activites,actif,role,cheffe_reseau,ae_a_creer").neq("role", "gerant")),
      q(sb.from("clients").select("id,nom,etat").order("nom"))]);
    const ids = [...new Set(mvts.map(m => m.doc_envoi_id).filter(Boolean))];
    const docs = ids.length ? await q(sb.from("doc_envois").select("id,etat,fait_le,envoye_le").in("id", ids)) : [];
    const P = Object.fromEntries(profils.map(p => [p.id, p])), C = Object.fromEntries(clients.map(c => [c.id, c])), D = Object.fromEntries(docs.map(d => [d.id, d]));
    return { mat, mvts, profils, clients, P, C, D };
  }
  const ouEst = (x, m) => m.lieu === "presta" ? "Chez " + nomP(x.P[m.intervenante_id]) + (x.P[m.intervenante_id] && x.P[m.intervenante_id].cheffe_reseau ? " (chef)" : "")
    : m.lieu === "client" ? "Chez le client " + ((x.C[m.client_id] || {}).nom || "?") : m.lieu === "ailleurs" ? (m.lieu_detail || "Ailleurs") : "Au dépôt OIKOS" + (m.lieu_detail ? " · " + m.lieu_detail : "");
  // Le reçu de la dernière remise encore en cours (si le matériel est chez un presta)
  function recuDe(x, m) {
    if (m.lieu !== "presta") return "";
    const mv = x.mvts.find(v => v.materiel_id === m.id && v.lieu === "presta" && v.intervenante_id === m.intervenante_id && (v.sorte === "remise" || v.sorte === "entree"));
    const d = mv && mv.doc_envoi_id && x.D[mv.doc_envoi_id];
    if (!d) return `<span class="ma-tag" title="Remettre à nouveau pour lui faire signer le reçu">pas de reçu signé</span>`;
    if (d.etat === "fait") return `<span class="ma-tag ok">reçu signé le ${dateFr(String(d.fait_le).slice(0, 10))}</span>`;
    if (d.etat === "refuse") return `<span class="ma-tag non">reçu refusé</span>`;
    if (d.etat === "retire") return `<span class="ma-tag">reçu retiré</span>`;
    return `<span class="ma-tag att">reçu en attente de signature</span>`;
  }
  const decrire = m => m.nom + (m.quantite > 1 ? " ×" + m.quantite : "") + (m.marque ? " (" + m.marque + ")" : "") + (m.etiquette ? ", repère " + m.etiquette : "") + (m.numero_serie ? ", n° de série " + m.numero_serie : "") + ", " + ({ neuf: "neuf", bon: "en bon état", use: "usé", a_reparer: "à réparer", hors_service: "hors service" }[m.etat] || (ETATS[m.etat] || m.etat).toLowerCase());
  function prochaineEtiquette(x) {
    const n = Math.max(0, ...x.mat.map(m => /^M-(\d+)$/.exec(m.etiquette || "")).filter(Boolean).map(r => +r[1]));
    return "M-" + String(n + 1).padStart(3, "0");
  }

  /* ---------- La page ---------- */
  async function page() {
    styles();
    const x = await charger();
    coches.forEach(id => { if (!x.mat.some(m => m.id === id)) coches.delete(id); });
    const FILTRES = [["tout", "Tout"], ["depot", "Au dépôt"], ["presta", "Chez un presta"], ["client", "Chez un client"], ["ailleurs", "Ailleurs"], ["soucis", "À réparer, hors service"], ["sortis", "Perdu, volé, vendu"]];
    const garde = m => (filtre === "sortis" ? SORTIS.includes(m.etat) : !SORTIS.includes(m.etat))
      && (filtre === "tout" || filtre === "sortis" || (filtre === "soucis" ? ["a_reparer", "hors_service"].includes(m.etat) : m.lieu === filtre))
      && (!cherche || [m.nom, m.etiquette, m.marque, m.numero_serie, m.categorie, ouEst(x, m)].join(" ").toLowerCase().includes(cherche.toLowerCase()));
    const l = x.mat.filter(garde);
    // groupes : dépôt, puis chaque presta, chaque client, ailleurs
    const groupes = new Map();
    l.forEach(m => { const k = m.lieu + ":" + (m.intervenante_id || m.client_id || (m.lieu === "ailleurs" ? m.lieu_detail || "" : "")); if (!groupes.has(k)) groupes.set(k, { titre: ouEst(x, Object.assign({}, m, m.lieu === "depot" ? { lieu_detail: null } : {})), lieu: m.lieu, l: [] }); groupes.get(k).l.push(m); });
    const ordre = { depot: 0, presta: 1, client: 2, ailleurs: 3 };
    const gl = [...groupes.values()].sort((a, b) => ordre[a.lieu] - ordre[b.lieu] || a.titre.localeCompare(b.titre));
    const actifs = x.mat.filter(m => !SORTIS.includes(m.etat));
    const valeur = actifs.reduce((s, m) => s + (Number(m.prix) || 0) * (m.quantite || 1), 0);
    const ligne = m => `<div class="ma-ligne"><input type="checkbox" data-coche="${m.id}" ${coches.has(m.id) ? "checked" : ""} aria-label="Choisir ${E(m.nom)}">
      <button class="ma-nom" type="button" data-fiche="${m.id}"><b>${m.etiquette ? `<span class="ma-rep">${E(m.etiquette)}</span> ` : ""}${E(m.nom)}${m.quantite > 1 ? " ×" + m.quantite : ""}</b><span class="ma-m">${E(m.categorie)}${m.marque ? " · " + E(m.marque) : ""}${m.lieu_detail && m.lieu !== "ailleurs" ? " · " + E(m.lieu_detail) : ""} · depuis le ${dateFr(m.depuis)}</span></button>
      <span class="ma-tag ${ETAT_TON[m.etat] || ""}">${ETATS[m.etat] || E(m.etat)}</span>${recuDe(x, m)}</div>`;
    const z = contenu(`<div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h1 style="margin:0">Matériel d'OIKOS</h1>
        <span class="dz-boutons" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="ma-csv">${IC("doc")} Exporter l'inventaire</button><button class="btn primary" id="ma-ajout">${IC("plus")} Ajouter du matériel</button></span></div>
      <p class="muted small" style="margin:4px 0 0">Ce qui appartient à OIKOS et où ça se trouve. Coche des objets pour les remettre à un presta (il signe le reçu dans son appli), les rentrer au dépôt ou changer leur état. Clique un nom pour sa fiche et son historique.</p>
      <div class="ma-chiffres"><span><b>${actifs.length}</b><span class="muted small">objets</span></span><span><b>${actifs.filter(m => m.lieu === "depot").length}</b><span class="muted small">au dépôt</span></span><span><b>${actifs.filter(m => m.lieu !== "depot").length}</b><span class="muted small">sortis</span></span><span><b>${euros(valeur)}</b><span class="muted small">prix d'achat</span></span>${actifs.filter(m => ["a_reparer", "hors_service"].includes(m.etat)).length ? `<span><b>${actifs.filter(m => ["a_reparer", "hors_service"].includes(m.etat)).length}</b><span class="muted small">à réparer ou hors service</span></span>` : ""}</div>
      <div class="sous-menu" style="margin-top:12px">${FILTRES.map(([k, t]) => `<button class="chip" data-filtre="${k}" aria-pressed="${filtre === k}">${t}</button>`).join("")}</div>
      <div class="ma-barre"><input type="search" id="ma-cherche" placeholder="Chercher : nom, repère, presta, client…" value="${E(cherche)}"></div>
      ${gl.length ? gl.map(g => `<div class="ma-groupe"><h3>${E(g.titre)}</h3><span class="muted small">${g.l.length} objet${g.l.length > 1 ? "s" : ""}</span><button class="btn flat small" data-tout="${g.l.map(m => m.id).join(",")}">tout cocher</button></div><div class="ma-liste">${g.l.map(ligne).join("")}</div>`).join("")
        : `<p class="muted" style="margin-top:16px">${x.mat.length ? "Rien ne correspond." : "L'inventaire est vide : commence par « Ajouter du matériel »."}</p>`}
      <div id="ma-sel"></div>`);
    const barreSel = () => {
      const n = coches.size, zs = z.querySelector("#ma-sel");
      zs.innerHTML = n ? `<div class="ma-sel"><b>${n} choisi${n > 1 ? "s" : ""}</b><button class="btn" data-geste="remettre">Remettre à un presta</button><button class="btn" data-geste="depot">Rentrer au dépôt</button><button class="btn" data-geste="ailleurs">Mettre ailleurs</button><button class="btn" data-geste="etat">Changer l'état</button><button class="btn flat" data-geste="vider" style="background:transparent;color:#fff">Tout décocher</button></div>` : "";
    };
    barreSel();
    const recherche = z.querySelector("#ma-cherche");
    recherche.oninput = () => { cherche = recherche.value; clearTimeout(page.t); page.t = setTimeout(async () => { await page(); const r = document.getElementById("ma-cherche"); if (r) { r.focus(); r.setSelectionRange(r.value.length, r.value.length); } }, 250); };
    z.onchange = e => { const c = e.target.closest("[data-coche]"); if (!c) return; if (c.checked) coches.add(c.dataset.coche); else coches.delete(c.dataset.coche); barreSel(); };
    z.onclick = e => {
      const f = e.target.closest("[data-filtre]"); if (f) { filtre = f.dataset.filtre; return page(); }
      const t = e.target.closest("[data-tout]"); if (t) { t.dataset.tout.split(",").forEach(id => coches.add(id)); z.querySelectorAll("[data-coche]").forEach(c => { c.checked = coches.has(c.dataset.coche); }); return barreSel(); }
      const fi = e.target.closest("[data-fiche]"); if (fi) return fiche(x, x.mat.find(m => m.id === fi.dataset.fiche));
      const g = e.target.closest("[data-geste]"); if (!g) return;
      const choisis = x.mat.filter(m => coches.has(m.id));
      if (g.dataset.geste === "vider") { coches.clear(); z.querySelectorAll("[data-coche]").forEach(c => { c.checked = false; }); return barreSel(); }
      if (g.dataset.geste === "remettre") return remettre(x, choisis);
      if (g.dataset.geste === "depot") return deplacer(x, choisis, "depot");
      if (g.dataset.geste === "ailleurs") return deplacer(x, choisis, "ailleurs");
      if (g.dataset.geste === "etat") return changerEtat(x, choisis);
    };
    z.querySelector("#ma-ajout").onclick = () => editer(x, null);
    z.querySelector("#ma-csv").onclick = () => exporter(x);
  }

  /* ---------- Ajouter ou modifier un objet ---------- */
  function editer(x, m) {
    const nouveau = !m;
    m = m || { etiquette: prochaineEtiquette(x), nom: "", categorie: "Jardin", quantite: 1, etat: "bon" };
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${nouveau ? "Ajouter du matériel" : "Modifier"}</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <div class="ma-form">
        <label>Nom *<input id="e-nom" value="${E(m.nom)}" placeholder="Taille-haie sur batterie"></label>
        <label>Repère collé dessus<input id="e-etiq" value="${E(m.etiquette || "")}" placeholder="M-001"></label>
        <label>Catégorie<input id="e-cat" list="e-cats" value="${E(m.categorie)}"><datalist id="e-cats">${[...new Set(CATEGORIES.concat(x.mat.map(y => y.categorie)))].map(c => `<option value="${E(c)}">`).join("")}</datalist></label>
        <label>Marque et modèle<input id="e-marque" value="${E(m.marque || "")}"></label>
        <label>N° de série<input id="e-serie" value="${E(m.numero_serie || "")}"></label>
        <label>Quantité<input id="e-qte" type="number" min="1" max="9999" value="${m.quantite || 1}"></label>
        <label>Acheté le<input id="e-achat" type="date" value="${E(m.achete_le || "")}"></label>
        <label>Prix d'achat TTC à l'unité (€)<input id="e-prix" type="number" min="0" step="0.01" value="${m.prix ?? ""}"></label>
        ${nouveau ? `<label>État<select id="e-etat">${Object.entries(ETATS).filter(([k]) => !SORTIS.includes(k)).map(([k, t]) => `<option value="${k}" ${m.etat === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>` : ""}
      </div>
      ${nouveau ? `<div class="ma-form" style="margin-top:10px"><label>Où il est aujourd'hui<select id="e-lieu"><option value="depot">Au dépôt OIKOS</option><option value="presta">Chez un presta ou un chef</option><option value="client">Laissé chez un client</option><option value="ailleurs">Ailleurs</option></select></label>
        <label id="e-l-presta" hidden>Lequel<select id="e-presta">${x.profils.filter(p => p.actif).sort((a, b) => nomP(a).localeCompare(nomP(b))).map(p => `<option value="${p.id}">${E(nomP(p))}${p.cheffe_reseau ? " (chef)" : ""}</option>`).join("")}</select></label>
        <label id="e-l-client" hidden>Lequel<select id="e-client">${x.clients.filter(c => c.etat !== "termine").map(c => `<option value="${c.id}">${E(c.nom)}</option>`).join("")}</select></label>
        <label id="e-l-detail">Précision (facultatif)<input id="e-detail" placeholder="garage, local, réparateur…"></label></div>
        <p class="muted small" style="margin:6px 0 0">Déjà chez un presta : il est noté chez lui sans reçu. Pour lui faire signer le reçu, coche-le ensuite et fais « Remettre à un presta ».</p>` : ""}
      <label class="ma-form" style="grid-template-columns:1fr;margin-top:10px"><span>Remarque</span><textarea id="e-rem" rows="2">${E(m.remarque || "")}</textarea></label>
      <div class="dz-boutons" style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px">${nouveau ? "" : `<button class="btn flat stop" id="e-suppr" style="margin-right:auto">Effacer cette fiche</button>`}<button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="e-ok">${nouveau ? "Ajouter" : "Enregistrer"}</button></div>`, (f, fermer) => {
      f.style.maxWidth = "820px";
      const lieu = f.querySelector("#e-lieu");
      if (lieu) lieu.onchange = () => { f.querySelector("#e-l-presta").hidden = lieu.value !== "presta"; f.querySelector("#e-l-client").hidden = lieu.value !== "client"; f.querySelector("#e-l-detail").hidden = lieu.value === "presta" || lieu.value === "client"; };
      const sup = f.querySelector("#e-suppr");
      if (sup) sup.onclick = async () => {
        if (!confirm("Effacer « " + m.nom + " » et tout son historique ? Ça ne se rattrape pas.\n\nS'il a été perdu, volé, vendu ou jeté, préfère « Changer l'état » : il reste une trace.")) return;
        try { await q(sb.from("materiel").delete().eq("id", m.id)); coches.delete(m.id); toast("Fiche effacée"); fermer(); page(); } catch (err) { toast("Pas effacé : " + (err.message || err)); }
      };
      f.querySelector("#e-ok").onclick = async ev => {
        const v = k => f.querySelector(k) ? f.querySelector(k).value.trim() : "";
        const d = { nom: v("#e-nom"), etiquette: v("#e-etiq") || null, categorie: v("#e-cat") || "Autre", marque: v("#e-marque") || null, numero_serie: v("#e-serie") || null,
          quantite: Math.max(1, parseInt(v("#e-qte"), 10) || 1), achete_le: v("#e-achat") || null, prix: v("#e-prix") === "" ? null : Number(v("#e-prix")), remarque: v("#e-rem") || null };
        if (!d.nom) return toast("Donne un nom");
        if (d.etiquette && x.mat.some(y => y.etiquette === d.etiquette && (!m.id || y.id !== m.id))) return toast("Le repère " + d.etiquette + " est déjà pris");
        ev.currentTarget.disabled = true;
        try {
          if (nouveau) {
            d.etat = v("#e-etat") || "bon";
            const r = await q(sb.from("materiel").insert(d).select("id"));
            const l = v("#e-lieu") || "depot";
            await q(sb.from("materiel_mouvements").insert({ materiel_id: r[0].id, sorte: "entree", lieu: l, intervenante_id: l === "presta" ? v("#e-presta") : null, client_id: l === "client" ? v("#e-client") : null,
              lieu_detail: l === "depot" || l === "ailleurs" ? v("#e-detail") || null : null, etat: d.etat, le: auj() }));
            toast("Ajouté : " + d.nom + (d.etiquette ? " (" + d.etiquette + ")" : ""));
          } else { await q(sb.from("materiel").update(d).eq("id", m.id)); toast("Enregistré"); }
          fermer(); page();
        } catch (err) { ev.currentTarget.disabled = false; toast("Pas enregistré : " + (err.message || err)); }
      };
      f.querySelector("#e-nom").focus();
    });
  }

  /* ---------- La fiche : tout sur un objet + historique ---------- */
  function fiche(x, m) {
    if (!m) return;
    const h = x.mvts.filter(v => v.materiel_id === m.id);
    const ou = v => v.lieu === "presta" ? "chez " + nomP(x.P[v.intervenante_id]) : v.lieu === "client" ? "chez le client " + ((x.C[v.client_id] || {}).nom || "?") : v.lieu === "ailleurs" ? (v.lieu_detail || "ailleurs") : v.lieu === "depot" ? "au dépôt" + (v.lieu_detail ? " (" + v.lieu_detail + ")" : "") : "";
    const doc = v => { const d = v.doc_envoi_id && x.D[v.doc_envoi_id]; return !d ? "" : d.etat === "fait" ? ` <span class="ma-tag ok">reçu signé</span>` : d.etat === "refuse" ? ` <span class="ma-tag non">reçu refusé</span>` : d.etat === "retire" ? ` <span class="ma-tag">reçu retiré</span>` : ` <span class="ma-tag att">reçu en attente</span>`; };
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${m.etiquette ? `<span class="ma-rep">${E(m.etiquette)}</span> ` : ""}${E(m.nom)}</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <p style="margin:6px 0"><b>${E(ouEst(x, m))}</b> depuis le ${dateFr(m.depuis)} · <span class="ma-tag ${ETAT_TON[m.etat] || ""}">${ETATS[m.etat]}</span> ${recuDe(x, m)}</p>
      <p class="muted small" style="margin:0">${E(m.categorie)}${m.marque ? " · " + E(m.marque) : ""}${m.numero_serie ? " · n° de série " + E(m.numero_serie) : ""}${m.quantite > 1 ? " · quantité " + m.quantite : ""}${m.achete_le ? " · acheté le " + dateFr(m.achete_le) : ""}${m.prix != null ? " · " + euros(m.prix) : ""}</p>
      ${m.remarque ? `<p class="small" style="margin:6px 0 0">${E(m.remarque)}</p>` : ""}
      <h3 style="margin:14px 0 6px;font-size:15px">Historique</h3>
      <ul class="ma-histo">${h.map(v => `<li><b>${dateFr(v.le)}</b> · ${SORTES[v.sorte] || v.sorte}${v.lieu ? " " + E(ou(v)) : ""}${v.etat && v.sorte !== "entree" ? " · " + ETATS[v.etat] : ""}${doc(v)}${v.remarque ? `<div class="ma-m">${E(v.remarque)}</div>` : ""}</li>`).join("") || `<li class="muted">Rien encore.</li>`}</ul>
      <div class="dz-boutons" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px"><button class="btn" data-g="modifier">Modifier la fiche</button><button class="btn" data-g="etat">Changer l'état</button>${m.lieu !== "depot" ? `<button class="btn" data-g="depot">Rentrer au dépôt</button>` : ""}<button class="btn primary" data-g="remettre">Remettre à un presta</button></div>`, (f, fermer) => {
      f.style.maxWidth = "720px";
      f.onclick = e => { const b = e.target.closest("[data-g]"); if (!b) return; fermer();
        ({ modifier: () => editer(x, m), etat: () => changerEtat(x, [m]), depot: () => deplacer(x, [m], "depot"), remettre: () => remettre(x, [m]) })[b.dataset.g](); };
    });
  }

  /* ---------- Remettre à un presta ou un chef (+ reçu à signer) ---------- */
  function remettre(x, choisis) {
    if (!choisis.length) return toast("Coche au moins un objet");
    const sortis = choisis.filter(m => SORTIS.includes(m.etat));
    if (sortis.length) return toast("« " + sortis[0].nom + " » est noté " + ETATS[sortis[0].etat].toLowerCase() + " : change d'abord son état");
    const gens = x.profils.filter(p => p.actif).sort((a, b) => nomP(a).localeCompare(nomP(b)));
    const deja = choisis.filter(m => m.lieu === "presta");
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Remettre à un presta</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <p class="small" style="margin:0"><b>${choisis.length} objet${choisis.length > 1 ? "s" : ""}</b> : ${choisis.map(m => E(m.nom) + (m.etiquette ? " (" + E(m.etiquette) + ")" : "")).join(", ")}.</p>
      ${deja.length ? `<p class="muted small" style="margin:4px 0 0">Déjà sorti : ${deja.map(m => E(m.nom) + " " + E(ouEst(x, m).toLowerCase())).join(", ")}. Il passera chez la personne choisie.</p>` : ""}
      <input type="search" id="r-cherche" class="ma-champ" placeholder="Chercher un nom…" style="margin-top:10px">
      <div class="ma-gens" id="r-gens" style="margin-top:6px"></div>
      <div class="ma-form" style="margin-top:10px">
        <label>Date de remise<input type="date" id="r-date" value="${auj()}"></label>
        <label>Pour les interventions chez (facultatif)<select id="r-client"><option value="">toutes ses missions</option>${x.clients.filter(c => c.etat !== "termine").map(c => `<option value="${c.id}">${E(c.nom)}</option>`).join("")}</select></label>
      </div>
      <label class="ma-form" style="grid-template-columns:1fr;margin-top:10px"><span>Clés, badges ou télécommandes remis en même temps (facultatif)</span><textarea id="r-cles" rows="2" placeholder="2 clés de la porte d'entrée, 1 badge du portail. Jamais les codes."></textarea></label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px"><input type="checkbox" id="r-recu" checked style="margin-top:4px"><span>Lui faire signer le reçu dans son appli <span class="muted small">(« Remise de clés, de matériel et de moyens d'accès », la liste du matériel est déjà remplie)</span></span></label>
      <label class="ma-form" style="grid-template-columns:1fr;margin-top:6px"><span>Note pour lui (facultatif) <span class="muted small">et remarque gardée dans l'historique</span></span><textarea id="r-note" rows="2"></textarea></label>
      <div class="dz-boutons" style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="r-ok">Remettre</button></div>`, (f, fermer) => {
      f.style.maxWidth = "820px";
      let qui = null;
      const zg = f.querySelector("#r-gens"), ch = f.querySelector("#r-cherche");
      const dessiner = () => { zg.innerHTML = gens.filter(p => !ch.value || nomP(p).toLowerCase().includes(ch.value.toLowerCase())).map(p => `<label><input type="radio" name="r-qui" value="${p.id}" ${qui === p.id ? "checked" : ""}> ${E(nomP(p))}${p.cheffe_reseau ? ` <span class="ma-tag">chef</span>` : ""}</label>`).join("") || `<p class="muted small">Personne.</p>`; };
      dessiner(); ch.oninput = dessiner; ch.focus();
      zg.onchange = e => { qui = e.target.value; };
      f.querySelector("#r-ok").onclick = async ev => {
        const bouton = ev.currentTarget;
        if (!qui) return toast("Choisis la personne");
        const p = x.P[qui], le = f.querySelector("#r-date").value || auj(), cl = f.querySelector("#r-client").value || null;
        const cles = f.querySelector("#r-cles").value.trim(), note = f.querySelector("#r-note").value.trim(), recu = f.querySelector("#r-recu").checked;
        bouton.disabled = true;
        try {
          let docId = null;
          if (recu) {
            if (!window.DocsOikos || !DocsOikos.envoyerModele) throw new Error("documents-oikos.js manque à côté de la page");
            docId = await DocsOikos.envoyerModele(RECU, p, { client: cl ? (x.C[cl] || {}).nom || "" : "", date_remise: dateFr(le), cles, materiel: choisis.map(m => "- " + decrire(m)).join("\n") }, note || undefined);
            if (!docId) throw new Error("le modèle « Remise de clés, de matériel… » n'est pas dans la bibliothèque : lance d'abord le SQL 73b");
          }
          await q(sb.from("materiel_mouvements").insert(choisis.map(m => ({ materiel_id: m.id, sorte: "remise", lieu: "presta", intervenante_id: qui, le, doc_envoi_id: docId,
            remarque: [cl ? "pour " + (x.C[cl] || {}).nom : "", note].filter(Boolean).join(" · ") || null }))));
          toast(choisis.length + " objet" + (choisis.length > 1 ? "s" : "") + " chez " + nomP(p) + (recu ? " · reçu envoyé dans son appli" : ""));
          coches.clear(); fermer(); page();
        } catch (err) { bouton.disabled = false; toast("Pas fait : " + (err.message || err)); }
      };
    });
  }

  /* ---------- Rentrer au dépôt / mettre ailleurs (chez un client, réparateur…) ---------- */
  function deplacer(x, choisis, vers) {
    if (!choisis.length) return toast("Coche au moins un objet");
    const titre = vers === "depot" ? "Rentrer au dépôt" : "Mettre ailleurs";
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${titre}</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <p class="small" style="margin:0"><b>${choisis.length} objet${choisis.length > 1 ? "s" : ""}</b> : ${choisis.map(m => E(m.nom) + " <span class='muted'>(" + E(ouEst(x, m).toLowerCase()) + ")</span>").join(", ")}.</p>
      <div class="ma-form" style="margin-top:10px">
        <label>Date<input type="date" id="d-date" value="${auj()}"></label>
        ${vers === "ailleurs" ? `<label>Où<select id="d-ou"><option value="ailleurs">Un autre endroit</option><option value="client">Laissé chez un client</option></select></label>
          <label id="d-l-client" hidden>Quel client<select id="d-client">${x.clients.filter(c => c.etat !== "termine").map(c => `<option value="${c.id}">${E(c.nom)}</option>`).join("")}</select></label>` : ""}
        <label id="d-l-detail">${vers === "depot" ? "Où au dépôt (facultatif)" : "Lequel *"}<input id="d-detail" placeholder="${vers === "depot" ? "garage, local…" : "chez le réparateur Untel…"}"></label>
        <label>État au retour<select id="d-etat"><option value="">inchangé</option>${Object.entries(ETATS).filter(([k]) => !SORTIS.includes(k)).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label>
      </div>
      <label class="ma-form" style="grid-template-columns:1fr;margin-top:10px"><span>Remarque (facultatif)</span><textarea id="d-rem" rows="2"></textarea></label>
      <div class="dz-boutons" style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="d-ok">${titre}</button></div>`, (f, fermer) => {
      f.style.maxWidth = "720px";
      const ou = f.querySelector("#d-ou");
      if (ou) ou.onchange = () => { f.querySelector("#d-l-client").hidden = ou.value !== "client"; f.querySelector("#d-l-detail").hidden = ou.value === "client"; };
      f.querySelector("#d-ok").onclick = async ev => {
        const lieu = vers === "depot" ? "depot" : ou.value, detail = f.querySelector("#d-detail").value.trim();
        if (lieu === "ailleurs" && !detail) return toast("Dis où il est");
        ev.currentTarget.disabled = true;
        try {
          await q(sb.from("materiel_mouvements").insert(choisis.map(m => ({ materiel_id: m.id, sorte: lieu === "depot" ? "retour" : "deplacement", lieu, client_id: lieu === "client" ? f.querySelector("#d-client").value : null,
            lieu_detail: lieu === "client" ? null : detail || null, etat: f.querySelector("#d-etat").value || null, le: f.querySelector("#d-date").value || auj(), remarque: f.querySelector("#d-rem").value.trim() || null }))));
          toast("C'est noté"); coches.clear(); fermer(); page();
        } catch (err) { ev.currentTarget.disabled = false; toast("Pas fait : " + (err.message || err)); }
      };
    });
  }

  /* ---------- Changer l'état (à réparer, perdu, vendu…) ---------- */
  function changerEtat(x, choisis) {
    if (!choisis.length) return toast("Coche au moins un objet");
    fenetre(`<div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Changer l'état</h2><button class="btn flat" data-fermer>${IC("croix")}</button></div>
      <p class="small" style="margin:0"><b>${choisis.length} objet${choisis.length > 1 ? "s" : ""}</b> : ${choisis.map(m => E(m.nom)).join(", ")}.</p>
      <div class="ma-form" style="margin-top:10px"><label>Nouvel état<select id="t-etat">${Object.entries(ETATS).map(([k, t]) => `<option value="${k}" ${choisis.length === 1 && choisis[0].etat === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Date<input type="date" id="t-date" value="${auj()}"></label></div>
      <p class="muted small" style="margin:6px 0 0">Perdu, volé, vendu ou jeté : il sort de l'inventaire (filtre « Perdu, volé, vendu ») mais garde son historique.</p>
      <label class="ma-form" style="grid-template-columns:1fr;margin-top:10px"><span>Ce qui s'est passé (facultatif)</span><textarea id="t-rem" rows="2" placeholder="Lame cassée, déposé chez le réparateur…"></textarea></label>
      <div class="dz-boutons" style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px"><button class="btn flat" data-fermer>Annuler</button><button class="btn primary" id="t-ok">Enregistrer</button></div>`, (f, fermer) => {
      f.style.maxWidth = "620px";
      f.querySelector("#t-ok").onclick = async ev => {
        ev.currentTarget.disabled = true;
        try {
          await q(sb.from("materiel_mouvements").insert(choisis.map(m => ({ materiel_id: m.id, sorte: "etat", etat: f.querySelector("#t-etat").value, le: f.querySelector("#t-date").value || auj(), remarque: f.querySelector("#t-rem").value.trim() || null }))));
          toast("État changé"); coches.clear(); fermer(); page();
        } catch (err) { ev.currentTarget.disabled = false; toast("Pas fait : " + (err.message || err)); }
      };
    });
  }

  /* ---------- Export de l'inventaire (assurance, comptable) ---------- */
  function exporter(x) {
    const c = s => '"' + String(s ?? "").replace(/"/g, '""') + '"';
    const lignes = [["Repère", "Nom", "Catégorie", "Marque et modèle", "N° de série", "Quantité", "Acheté le", "Prix d'achat TTC", "État", "Où", "Depuis", "Remarque"].map(c).join(";")]
      .concat(x.mat.map(m => [m.etiquette, m.nom, m.categorie, m.marque, m.numero_serie, m.quantite, m.achete_le ? dateFr(m.achete_le) : "", m.prix != null ? String(m.prix).replace(".", ",") : "", ETATS[m.etat], ouEst(x, m), dateFr(m.depuis), m.remarque].map(c).join(";")));
    const b = new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "Inventaire matériel OIKOS " + auj() + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  window.MaterielOikos = { page };
})();

/* ===================== Mon matériel : fiche outil, QR code et prise en charge signée (SQL 77) — 17/11/2026 =====================
   Appli intervenant seulement. Écran « Mon matériel » (bouton dans Moi, bandeau sur Aujourd'hui) :
   - scanner le QR code collé sur un outil d'OIKOS (ou ouvert par l'appareil photo du téléphone : ?outil=CODE) ;
   - lire le petit contrat, dire l'état, prendre une photo, signer au doigt : l'outil passe sous sa responsabilité ;
   - « Passer à un autre intervenant » : affiche un QR code de passage (30 minutes) que l'autre scanne pour signer à son tour ;
   - un chef d'équipe voit en plus le matériel emprunté par les membres de son équipe.
   Rien n'est lu ni écrit dans les tables : tout passe par mon_materiel, materiel_voir, materiel_prendre, materiel_passe,
   materiel_fiche_signee. Se sert de ce que l'appli a déjà : sb, esc, toast, ico, accueil, feuille ; et QROikos (qr-oikos.js). */
(function () {
  "use strict";
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const IC = n => { try { return typeof ico === "function" ? ico(n) : ""; } catch (e) { return ""; } };
  const ETATS = [["neuf", "Neuf"], ["tres_bon", "Très bon état"], ["bon", "Bon état"], ["fonctionnel", "Fonctionnel"], ["hors_service", "Hors service"]];
  const ETAT_MOT = Object.assign(Object.fromEntries(ETATS), { use: "Usé", a_reparer: "À réparer" });
  const dateFr = d => d ? new Date(String(d).length === 10 ? d + "T12:00:00" : d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
  const heureFr = d => { d = new Date(d); return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) + " à " + d.getHours() + " h " + String(d.getMinutes()).padStart(2, "0"); };
  const MOTIFS = {
    acces: "Ton compte ne permet pas de prendre du matériel.",
    inconnu: "Ce code ne correspond à aucun matériel d'OIKOS. Vérifie-le ou rescanne le QR code.",
    sorti: "Ce matériel est noté perdu, volé ou sorti de l'inventaire : préviens OIKOS.",
    gerant: "Le compte gérant ne prend pas de matériel : la fiche se signe depuis l'appli d'un intervenant.",
    deja: "Ce matériel est déjà sous ta responsabilité et ta fiche est signée.",
    passe_fini: "Le QR code de passage n'est plus valable (30 minutes, 5 essais). Demande à ton collègue d'en afficher un nouveau.",
    code: "Le code de passage est faux. Regarde les 6 chiffres sur l'écran de ton collègue.",
    qr: "Pour un outil au dépôt, scanne le QR code collé dessus ou tape le code de 10 caractères écrit dessous (le repère M-… ne suffit pas).",
    gele: "Ton compte est gelé : tu ne peux pas prendre de matériel pour l'instant."
  };
  const CLE = "oikos-int-outil";
  let aOuvrir = null;

  /* Arrivée par l'appareil photo du téléphone : …/intervenante/?outil=CODE&passe=123456.
     On garde le code le temps de la connexion et on nettoie l'adresse. */
  try {
    const p = new URLSearchParams(location.search), c = p.get("outil");
    if (c) {
      sessionStorage.setItem(CLE, JSON.stringify({ code: c.slice(0, 40), passe: (p.get("passe") || "").slice(0, 10), le: Date.now() }));
      history.replaceState(null, "", location.pathname);
    }
  } catch (e) {}
  function enAttente() {
    try { const a = JSON.parse(sessionStorage.getItem(CLE) || "null"); sessionStorage.removeItem(CLE); return a && Date.now() - a.le < 30 * 60000 ? a : null; } catch (e) { return null; }
  }
  // Ce qu'un QR code (ou une saisie) contient : une adresse de l'appli, ou le code tout seul
  function lireCode(texte) {
    const t = String(texte || "").trim();
    try { const u = new URL(t); const c = u.searchParams.get("outil"); if (c) return { code: c, passe: u.searchParams.get("passe") || "" }; } catch (e) {}
    return /^[A-Za-z0-9-]{3,20}$/.test(t) ? { code: t, passe: "" } : null;
  }

  function styles() {
    if (document.getElementById("ou-styles")) return;
    const s = document.createElement("style"); s.id = "ou-styles";
    s.textContent = `
.ou-liste{display:grid;gap:8px}
.ou-carte{border:1px solid var(--line,#ddd);border-radius:16px;background:var(--surface,var(--carte,#fff));padding:12px 14px;display:grid;gap:8px}
.ou-carte b{display:block}.ou-m{font-size:13px;color:var(--muted,#666)}
.ou-rep{font:600 11px ui-monospace,Consolas,monospace;border:1px solid var(--line,#ccc);border-radius:6px;padding:1px 5px;color:var(--muted,#666);vertical-align:middle}
.ou-tag{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;background:var(--accent-soft,#E7E8DA);color:var(--accent,#525A44)}
.ou-tag.ok{background:var(--paie,#DFF0DC);color:var(--paie-ink,#2C6B29)}.ou-tag.att{background:var(--warn-soft,#F4E9CC);color:var(--warn,#8A5A0E)}.ou-tag.non{background:var(--delai,#FBE3DE);color:var(--delai-ink,#8E2F1C)}
.ou-boutons{display:flex;gap:8px;flex-wrap:wrap}
.ou-bandeau{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:16px;background:var(--warn-soft,#F4E9CC);color:var(--warn,#8A5A0E);margin-bottom:12px}
.ou-doc{white-space:pre-line;background:#fff;color:#1b2a4a;border:1px solid var(--line,#ddd);border-radius:14px;padding:14px;font-size:14.5px;line-height:1.5}
.ou-doc mark{background:#FFF1B8;color:inherit;border-radius:4px;padding:0 3px}
.ou-etats{display:flex;gap:6px;flex-wrap:wrap}
.ou-pad{position:relative;border:1.5px dashed var(--accent,#525A44);border-radius:12px;background:#fff;touch-action:none;height:170px}
.ou-pad canvas{width:100%;height:100%;display:block;border-radius:12px;cursor:crosshair}
.ou-pad span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9a9a9a;pointer-events:none;font-size:14px}
.ou-photo{max-width:100%;max-height:260px;border-radius:12px;border:1px solid var(--line,#ddd);display:block}
.ou-qr{display:grid;justify-items:center;gap:8px;text-align:center}
.ou-qr svg{width:min(70vw,260px);height:auto;border-radius:12px;border:1px solid var(--line,#ddd)}
.ou-code{font:700 30px ui-monospace,Consolas,monospace;letter-spacing:6px}
.ou-video{width:100%;max-height:55vh;border-radius:14px;background:#000;display:block;object-fit:cover}
.ou-champ{width:100%;box-sizing:border-box;font:inherit;padding:11px 12px;border-radius:12px;border:1px solid var(--line,#ccc);background:var(--bg,#fff);color:inherit}`;
    document.head.appendChild(s);
  }

  async function rpc(nom, args) { const { data, error } = await sb.rpc(nom, args); if (error) throw error; return data; }
  const pasPret = e => /mon_materiel|materiel_voir|materiel_prendre|materiel_passe|schema cache|PGRST202|42883/i.test(String((e && (e.code + " " + e.message)) || e));
  const zone = () => document.getElementById("contenu");

  /* ---------- Signature au doigt ---------- */
  function pad(z) {
    z.innerHTML = `<canvas></canvas><span>Signe ici avec le doigt</span>`;
    const cv = z.querySelector("canvas"), aide = z.querySelector("span"), ctx = cv.getContext("2d");
    let points = 0, dessine = false, dernier = null;
    const taille = () => { const r = cv.getBoundingClientRect(), k = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * k); cv.height = Math.round(r.height * k); ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineWidth = 2.2; ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = "#1b2a4a"; points = 0; aide.hidden = false; };
    requestAnimationFrame(taille);
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", e => { dessine = true; dernier = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} aide.hidden = true; e.preventDefault(); });
    cv.addEventListener("pointermove", e => { if (!dessine) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(...dernier); ctx.lineTo(...p); ctx.stroke(); dernier = p; points++; e.preventDefault(); });
    const fin = () => { dessine = false; }; cv.addEventListener("pointerup", fin); cv.addEventListener("pointercancel", fin);
    return { effacer: taille, image: () => { if (points < 15) return null; const c2 = document.createElement("canvas"), k = Math.min(1, 700 / cv.width); c2.width = Math.round(cv.width * k); c2.height = Math.round(cv.height * k); const x = c2.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c2.width, c2.height); x.drawImage(cv, 0, 0, c2.width, c2.height); return c2.toDataURL("image/png"); } };
  }

  /* ---------- Photo : réduite sur le téléphone avant l'envoi (elle reste dans la base, à côté de la fiche) ---------- */
  async function photoReduite(f) {
    let img;
    try { img = await createImageBitmap(f); }
    catch (e) { img = await new Promise((ok, ko) => { const i = new Image(), u = URL.createObjectURL(f); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); ko(new Error("photo illisible : reprends-la avec l'appareil photo")); }; i.src = u; }); }
    for (const [max, q] of [[1000, 0.72], [800, 0.6], [640, 0.5]]) {
      const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      const d = cv.toDataURL("image/jpeg", q);
      if (d.startsWith("data:image/jpeg;base64,") && d.length < 580000) return d;
    }
    throw new Error("photo trop lourde : reprends-la d'un peu plus loin");
  }

  /* ---------- L'écran « Mon matériel » ---------- */
  const tagEtat = e => `<span class="ou-tag ${e === "hors_service" || e === "a_reparer" ? "non" : ""}">${E(ETAT_MOT[e] || e || "")}</span>`;
  const titreOutil = m => `${m.etiquette ? `<span class="ou-rep">${E(m.etiquette)}</span> ` : ""}${E(m.nom)}${m.quantite > 1 ? " ×" + m.quantite : ""}`;
  async function page() {
    styles();
    const z = zone(); if (!z) return;
    const ouvre = aOuvrir || enAttente(); aOuvrir = null;
    if (ouvre) return examiner(ouvre.code, ouvre.passe);
    let x;
    try { x = await rpc("mon_materiel"); }
    catch (e) { z.innerHTML = `<h1>Mon matériel</h1><p class="muted">${pasPret(e) ? "Cette partie arrive bientôt : OIKOS termine la mise en place." : E(e.message || e)}</p>`; return; }
    const carte = m => `<div class="ou-carte"><div><b>${titreOutil(m)}</b><span class="ou-m">${E(m.categorie || "")}${m.marque ? " · " + E(m.marque) : ""} · chez toi depuis le ${dateFr(m.depuis)}</span></div>
        <div class="ou-boutons" style="align-items:center">${tagEtat(m.etat)}${m.prise ? `<span class="ou-tag ok">fiche signée le ${dateFr(m.prise.signe_le)}</span>` : `<span class="ou-tag att">fiche à signer</span>`}</div>
        <div class="ou-boutons">${m.prise ? `<button class="btn" type="button" data-passer="${m.id}">${IC("partage")} Passer à un autre intervenant</button><button class="btn flat" type="button" data-fiche="${m.prise.id}">Voir ma fiche</button>`
          : `<button class="btn primary" type="button" data-signer="${E(m.etiquette || "")}" data-id="${m.id}">${IC("stylo")} Signer la fiche</button>`}</div></div>`;
    const groupes = {}; (x.equipe || []).forEach(m => { (groupes[m.chez] = groupes[m.chez] || []).push(m); });
    z.innerHTML = `<h1>Mon matériel</h1><p class="muted" style="margin-bottom:12px">Le matériel d'OIKOS dont tu as la responsabilité. Pour en prendre un : scanne son QR code, regarde son état, prends une photo et signe.</p>
      <div class="ou-boutons" style="margin-bottom:16px"><button class="btn primary" type="button" id="ou-scanner">${IC("photo")} Scanner un QR code</button><button class="btn" type="button" id="ou-taper">${IC("code")} Taper le code</button></div>
      <h3>Sous ma responsabilité</h3>
      ${(x.a_moi || []).length ? `<div class="ou-liste">${x.a_moi.map(carte).join("")}</div>` : `<div class="card"><p>Tu n'as aucun matériel d'OIKOS pour l'instant.</p></div>`}
      ${(x.a_moi || []).some(m => !m.prise && !m.etiquette) ? `<p class="muted small" style="margin-top:6px">Un outil sans repère se signe en scannant son QR code.</p>` : ""}
      <p class="muted small" style="margin-top:8px">Pour le rendre, rapporte-le à OIKOS, qui note le retour : tu en restes responsable jusque-là, ou jusqu'à ce qu'un autre intervenant signe à son tour.</p>
      ${x.chef ? `<h3 style="margin-top:22px">Matériel de mon équipe</h3>
        ${Object.keys(groupes).length ? Object.keys(groupes).sort((a, b) => a.localeCompare(b)).map(nom => `<p style="margin:10px 0 6px"><b>${E(nom)}</b> <span class="ou-m">${groupes[nom].length} objet${groupes[nom].length > 1 ? "s" : ""}</span></p><div class="ou-liste">${groupes[nom].map(m => `<div class="ou-carte"><div><b>${titreOutil(m)}</b><span class="ou-m">${E(m.categorie || "")}${m.marque ? " · " + E(m.marque) : ""} · depuis le ${dateFr(m.depuis)}</span></div>
            <div class="ou-boutons" style="align-items:center">${tagEtat(m.etat)}${m.prise ? `<span class="ou-tag ok">fiche signée le ${dateFr(m.prise.signe_le)}</span><button class="btn flat" type="button" data-fiche="${m.prise.id}">Voir la fiche</button>` : `<span class="ou-tag att">fiche pas encore signée</span>`}</div></div>`).join("")}</div>`).join("")
          : `<div class="card"><p>Aucun membre de ton équipe n'a de matériel d'OIKOS en ce moment.</p></div>`}` : ""}
      ${(x.passes || []).length ? `<h3 style="margin-top:22px">Ce que j'ai passé à un collègue</h3><div class="ou-liste">${x.passes.map(p => `<button class="ou-carte" type="button" data-fiche="${p.id}" style="text-align:left;cursor:pointer;font:inherit;color:inherit"><span><b>${titreOutil(p)}</b><span class="ou-m">à ${E(p.a)} le ${heureFr(p.signe_le)} · ${E(ETAT_MOT[p.etat] || p.etat)} · tu n'en es plus responsable</span></span></button>`).join("")}</div>` : ""}`;
    z.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "ou-scanner") return scanner();
      if (b.id === "ou-taper") return taper();
      if (b.dataset.passer) return passer((x.a_moi || []).find(m => m.id === b.dataset.passer));
      if (b.dataset.fiche) return voirFiche(b.dataset.fiche);
      if (b.hasAttribute("data-signer")) return b.dataset.signer ? examiner(b.dataset.signer, "") : toast("Scanne le QR code collé sur cet outil pour signer sa fiche.");
    };
  }

  /* ---------- Scanner avec la caméra (si le téléphone sait lire les QR codes dans une page) ---------- */
  function scanner() {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return taper("Ce téléphone ne lit pas les QR codes depuis l'appli. Ouvre son appareil photo et vise le QR code : il rouvre l'appli tout seul. Ou tape le code ici.");
    let flux = null, tourne = true;
    const arreter = () => { tourne = false; if (flux) flux.getTracks().forEach(t => t.stop()); flux = null; };
    feuille(`<h2 style="margin:0">Scanner un QR code</h2><p class="muted small" style="margin:0">Vise le QR code collé sur l'outil, ou celui affiché sur le téléphone de ton collègue.</p>
      <video class="ou-video" playsinline muted></video>
      <button class="btn" type="button" id="ou-sc-taper">Taper le code à la place</button><button class="btn flat" data-fermer>Annuler</button>`, async (el, fermer) => {
      el.querySelector("#ou-sc-taper").onclick = () => { fermer(); taper(); };
      const video = el.querySelector("video");
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!tourne) return arreter();
        video.srcObject = flux; await video.play();
        const det = new BarcodeDetector({ formats: ["qr_code"] });
        const boucle = async () => {
          if (!tourne) return;
          try {
            const codes = await det.detect(video);
            const lu = codes.map(c => lireCode(c.rawValue)).find(Boolean);
            if (lu) { try { navigator.vibrate && navigator.vibrate(30); } catch (x) {} fermer(); return examiner(lu.code, lu.passe); }
          } catch (x) {}
          setTimeout(boucle, 250);
        };
        boucle();
      } catch (e) { fermer(); taper("La caméra n'est pas disponible (autorisation refusée ?). Ouvre l'appareil photo du téléphone et vise le QR code, ou tape le code ici."); }
    }, arreter);
  }
  function taper(message) {
    styles();
    feuille(`<h2 style="margin:0">Taper le code</h2>${message ? `<p class="small" style="margin:0">${E(message)}</p>` : ""}
      <label class="f">Code écrit sous le QR code de l'outil<input class="ou-champ" id="ou-t-code" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="20" placeholder="10 caractères, ou le repère M-…"></label>
      <label class="f">Code de passage <span class="muted small">(seulement si un collègue te passe l'outil : les 6 chiffres de son écran)</span><input class="ou-champ" id="ou-t-passe" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="6 chiffres"></label>
      <button class="btn primary" type="button" id="ou-t-ok">Continuer</button><button class="btn flat" data-fermer>Annuler</button>`, (el, fermer) => {
      const c = el.querySelector("#ou-t-code"); setTimeout(() => c.focus(), 80);
      el.querySelector("#ou-t-ok").onclick = () => {
        const lu = lireCode(c.value.replace(/\s+/g, ""));
        if (!lu) return toast("Tape le code écrit sous le QR code.");
        fermer(); examiner(lu.code, lu.passe || el.querySelector("#ou-t-passe").value.replace(/\D/g, ""));
      };
    });
  }

  /* ---------- Après le scan : la fiche de l'outil et le petit contrat à signer ---------- */
  async function examiner(code, passe) {
    styles();
    const z = zone(); if (!z) return;
    if (document.querySelector(".nav [aria-current]") && typeof onglet !== "undefined" && onglet !== "materiel") { aOuvrir = { code, passe }; return accueil("materiel"); }
    z.onclick = null;
    z.innerHTML = `<div class="charge" role="status" aria-label="Chargement"><svg viewBox="0 0 20 18" aria-hidden="true"><path pathLength="100" d="M10 1.6 18.6 16.6H1.4Z"/></svg></div>`;
    let v;
    try { v = await rpc("materiel_voir", { p_code: code, p_passe: passe || null }); }
    catch (e) { z.innerHTML = `<div class="ou-boutons" style="margin-bottom:10px"><button class="btn flat" type="button" id="ou-retour">‹ Mon matériel</button></div><h1>Matériel</h1><p class="muted">${pasPret(e) ? "Cette partie arrive bientôt : OIKOS termine la mise en place." : E(e.message || e)}</p>`; z.querySelector("#ou-retour").onclick = () => page(); return; }
    const m = v.materiel, retour = `<div class="ou-boutons" style="margin-bottom:10px"><button class="btn flat" type="button" id="ou-retour">‹ Mon matériel</button></div>`;
    window.scrollTo(0, 0);
    if (!v.peut) {
      const msg = v.motif === "passe" ? `Ce matériel est sous la responsabilité de ${E(v.responsable || "un autre intervenant")}. Pour le prendre, demande-lui d'afficher son QR code de passage (Mon matériel › Passer à un autre intervenant) et scanne-le, ou tape ses 6 chiffres.` : E(MOTIFS[v.motif] || "Ce n'est pas possible pour l'instant.");
      z.innerHTML = `${retour}<h1>${m ? titreOutil(m) : "Matériel"}</h1>${m ? `<p class="muted">${E(m.categorie || "")}${m.marque ? " · " + E(m.marque) : ""}</p>` : ""}
        <div class="card" style="margin-top:12px"><p>${msg}</p>
        ${v.motif === "passe" || v.motif === "code" || v.motif === "passe_fini" ? `<label class="f">Code de passage (6 chiffres)<input class="ou-champ" id="ou-re-passe" inputmode="numeric" maxlength="6" autocomplete="off"></label><button class="btn primary" type="button" id="ou-re">Réessayer avec ce code</button>` : ""}
        ${v.motif === "inconnu" || v.motif === "qr" ? `<div class="ou-boutons"><button class="btn primary" type="button" id="ou-re-scan">Scanner à nouveau</button><button class="btn" type="button" id="ou-re-taper">Taper le code</button></div>` : ""}</div>`;
      z.onclick = e => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.id === "ou-retour") return page();
        if (b.id === "ou-re") { const p = z.querySelector("#ou-re-passe").value.replace(/\D/g, ""); return p.length === 6 ? examiner(code, p) : toast("Tape les 6 chiffres."); }
        if (b.id === "ou-re-scan") { page(); return scanner(); }
        if (b.id === "ou-re-taper") { page(); return taper(); }
      };
      return;
    }
    let etat = null, photo = null, sig = null;
    z.innerHTML = `${retour}<h1 style="margin:0 0 4px">${titreOutil(m)}</h1>
      <p class="muted" style="margin:0 0 12px">${E(m.categorie || "")}${m.marque ? " · " + E(m.marque) : ""}${m.numero_serie ? " · n° de série " + E(m.numero_serie) : ""}${v.de ? ` · passé par <b>${E(v.de)}</b>` : v.via === "attribue" ? " · remis par OIKOS" : ""}</p>
      <section class="card" style="margin-bottom:12px"><b>1. Dans quel état est-il ?</b>
        <div class="ou-etats" id="ou-etats">${ETATS.map(([k, t]) => `<button class="chip" type="button" data-etat="${k}" aria-pressed="false">${t}</button>`).join("")}</div>
        <b style="margin-top:6px">2. Prends-le en photo</b>
        <input type="file" id="ou-fichier" accept="image/*" capture="environment" hidden>
        <img class="ou-photo" id="ou-apercu" alt="Photo du matériel" hidden>
        <div class="ou-boutons"><button class="btn" type="button" id="ou-photo">${IC("photo")} Prendre la photo</button></div>
        <label class="f" style="margin-top:6px">Remarque (facultatif)<textarea class="ou-champ" id="ou-rem" rows="2" maxlength="1000" placeholder="Rayure, pièce manquante, accessoires fournis…"></textarea></label></section>
      <b>3. Lis la fiche</b>
      <div class="ou-doc" id="ou-texte" style="margin:6px 0 12px"></div>
      <section class="card"><b>4. Signe</b>
        <div class="ou-pad" id="ou-pad"></div>
        <div class="ou-boutons"><button class="btn flat" type="button" id="ou-effacer">Effacer la signature</button></div>
        <label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="ou-lu"><span>J'ai lu cette fiche en entier et je l'accepte.</span></label>
        <button class="btn primary big" type="button" id="ou-signer">Je signe et je prends ce matériel</button>
        <p class="muted small" style="margin:0">Ta signature, l'heure, la photo et une empreinte du texte sont gardées par OIKOS : elles valent signature. Prendre du matériel d'OIKOS est facultatif.</p></section>`;
    const texte = z.querySelector("#ou-texte"), rem = z.querySelector("#ou-rem");
    const dessiner = () => {
      const maintenant = heureFr(new Date());
      texte.innerHTML = E(v.texte).replace("{{date}}", () => E(maintenant)).replace("{{etat}}", () => etat ? `<mark>${E(ETAT_MOT[etat])}</mark>` : `<mark>à choisir ci-dessus</mark>`)
        .replace("{{remarque}}", () => rem.value.trim() ? "\nRemarque : " + E(rem.value.trim()) : "");
    };
    dessiner(); rem.oninput = dessiner;
    sig = pad(z.querySelector("#ou-pad"));
    const fichier = z.querySelector("#ou-fichier"), apercu = z.querySelector("#ou-apercu");
    fichier.onchange = async () => {
      const f = fichier.files && fichier.files[0]; if (!f) return;
      try { photo = await photoReduite(f); apercu.src = photo; apercu.hidden = false; z.querySelector("#ou-photo").innerHTML = IC("photo") + " Reprendre la photo"; }
      catch (e) { photo = null; apercu.hidden = true; toast(e.message || "Photo illisible"); }
      fichier.value = "";
    };
    z.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "ou-retour") return page();
      if (b.dataset.etat) { etat = b.dataset.etat; z.querySelectorAll("[data-etat]").forEach(c => c.setAttribute("aria-pressed", c === b)); return dessiner(); }
      if (b.id === "ou-photo") return fichier.click();
      if (b.id === "ou-effacer") return sig.effacer();
      if (b.id !== "ou-signer") return;
      if (!etat) { z.querySelector("#ou-etats").scrollIntoView({ behavior: "smooth", block: "center" }); return toast("Choisis l'état du matériel."); }
      if (!photo) { z.querySelector("#ou-photo").scrollIntoView({ behavior: "smooth", block: "center" }); return toast("Prends le matériel en photo."); }
      const image = sig.image(); if (!image) return toast("Signe dans le cadre avec le doigt.");
      if (!z.querySelector("#ou-lu").checked) return toast("Coche « J'ai lu cette fiche… » pour continuer.");
      b.disabled = true; b.textContent = "Envoi…";
      try {
        const r = await rpc("materiel_prendre", { p_code: code, p_passe: passe || null, p_etat: etat, p_photo: photo, p_signature: image, p_remarque: rem.value.trim() || null });
        if (!r || r.ok === false) { b.disabled = false; b.textContent = "Je signe et je prends ce matériel"; toast(MOTIFS[r && r.motif] || (r && r.motif === "passe" ? "Ce matériel est chez un autre intervenant : il faut son QR code de passage." : "Pas enregistré.")); if (r && r.motif !== "gele") examiner(code, passe); return; }
        toast("Signé : " + (r.nom || "le matériel") + " est sous ta responsabilité."); page();
      } catch (err) { b.disabled = false; b.textContent = "Je signe et je prends ce matériel"; toast(typeof reseau === "function" && reseau(err) ? "Pas de réseau : réessaie dans un instant." : "Pas enregistré : " + (err.message || err)); }
    };
  }

  /* ---------- Passer l'outil à un autre intervenant : QR code de passage ---------- */
  async function passer(m) {
    if (!m) return;
    let p;
    try { p = await rpc("materiel_passe", { p_materiel: m.id }); } catch (e) { return toast("Pas possible : " + (e.message || e)); }
    const adresse = location.origin + location.pathname.replace(/[^/]*$/, "") + "?outil=" + encodeURIComponent(p.jeton) + "&passe=" + p.code;
    const fin = new Date(p.expire_le);
    feuille(`<h2 style="margin:0">Passer ${E(m.nom)}</h2>
      <div class="ou-qr">${window.QROikos ? QROikos.svg(adresse, 260, "QR code de passage") : ""}
        <div><span class="ou-m">Code de passage</span><div class="ou-code">${E(p.code)}</div></div>
        ${m.etiquette ? `<span class="ou-m">Repère de l'outil : <b>${E(m.etiquette)}</b></span>` : ""}</div>
      <p class="small" style="margin:0">Ton collègue scanne ce QR code avec son téléphone (ou Moi › Mon matériel › Scanner), ou tape ${m.etiquette ? "le repère et " : ""}les 6 chiffres. Valable jusqu'à ${fin.getHours()} h ${String(fin.getMinutes()).padStart(2, "0")}.</p>
      <p class="small" style="margin:0"><b>Tu restes responsable tant qu'il n'a pas signé sa fiche.</b></p>
      <button class="btn primary" data-fermer>C'est fait</button>`, null, () => { if (typeof onglet !== "undefined" && onglet === "materiel") page(); });
  }

  /* ---------- Relire une fiche signée ---------- */
  async function voirFiche(id) {
    let f;
    try { f = await rpc("materiel_fiche_signee", { p_prise: id }); } catch (e) { return toast("Fiche indisponible : " + (e.message || e)); }
    feuille(`<h2 style="margin:0">${titreOutil(f)}</h2>
      <p class="muted small" style="margin:0">${IC("cadenas")} Signée par ${E(f.signataire)} le ${heureFr(f.signe_le)}${f.de ? " · passée par " + E(f.de) : ""} · ${E(ETAT_MOT[f.etat] || f.etat)}</p>
      <img class="ou-photo" src="${E(f.photo)}" alt="Photo du matériel à la prise en charge">
      <div class="ou-doc">${E(f.texte)}</div>
      <img src="${E(f.signature)}" alt="Signature" style="max-width:240px;border:1px solid var(--line,#ddd);border-radius:10px;background:#fff">
      <p class="muted small" style="margin:0;word-break:break-all">Empreinte : ${E(f.empreinte)}</p>
      <button class="btn flat" data-fermer>Fermer</button>`);
  }

  /* ---------- Rappels : arrivée par un QR code, bandeau sur Aujourd'hui, bouton dans Moi, carte du chef ---------- */
  async function rappel(ongletVu) {
    if (ongletVu !== "materiel") { const a = enAttente(); if (a) { aOuvrir = a; return accueil("materiel"); } }
    if (ongletVu !== "jour" && ongletVu !== "moi" && ongletVu !== "ch-accueil") return;
    styles();
    let x; try { x = await rpc("mon_materiel"); } catch (e) { return; }
    const z = zone(); if (!z || (typeof onglet !== "undefined" && onglet !== ongletVu)) return;
    const aSigner = (x.a_moi || []).filter(m => !m.prise).length, n = (x.a_moi || []).length;
    if (ongletVu === "jour" && aSigner && !document.getElementById("ou-aller")) z.insertAdjacentHTML("afterbegin", `<div class="ou-bandeau"><span><b>${aSigner === 1 ? "Un outil attend ta signature" : aSigner + " outils attendent ta signature"}</b><br>OIKOS t'a remis du matériel : signe sa fiche.</span><button class="btn" type="button" id="ou-aller">Voir</button></div>`);
    if (ongletVu === "moi" && !document.getElementById("ou-aller")) {
      const ref = document.getElementById("papiers");
      const html = `<button class="btn${aSigner ? " primary" : ""}" id="ou-aller" style="margin-top:14px;width:100%"><span class="ic">${IC("sac")}</span>Mon matériel${n ? " (" + n + ")" : ""}${x.chef && (x.equipe || []).length ? " · équipe (" + x.equipe.length + ")" : ""}</button>`;
      if (ref) ref.insertAdjacentHTML("beforebegin", html); else z.insertAdjacentHTML("beforeend", html);
    }
    if (ongletVu === "ch-accueil" && x.chef && !document.getElementById("ou-aller")) {
      const sans = (x.equipe || []).filter(m => !m.prise).length;
      z.insertAdjacentHTML("beforeend", `<section class="card" style="margin-top:14px"><b>Matériel d'OIKOS dans mon équipe</b>
        <p class="muted small" style="margin:0">${(x.equipe || []).length ? (x.equipe.length === 1 ? "1 objet emprunté" : x.equipe.length + " objets empruntés") + " par tes presta" + (sans ? " · " + sans + " sans fiche signée" : "") : "Aucun objet emprunté par tes presta en ce moment."}</p>
        <button class="btn" type="button" id="ou-aller">${IC("sac")} Voir le matériel de mon équipe</button></section>`);
    }
    const b = document.getElementById("ou-aller"); if (b) b.onclick = () => accueil("materiel");
  }

  window.OutilsOikos = { page, rappel, lireCode };
})();

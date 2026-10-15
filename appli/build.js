// Assemble l'interface de l'appli à partir de ../pense-bete.html + src/ :
//  - www/index.html  : version embarquée dans l'APK (avec les données de départ de seed-export/, jamais publiées)
//  - ../docs/app.html + ../docs/version.json : version publiée sur GitHub Pages, SANS aucune donnée,
//    que l'appli télécharge toute seule (mise à jour automatique).
// Numéro de version de l'interface : version-interface.txt (à augmenter à chaque mise à jour).
// Adresse de publication : adresse-mise-a-jour.txt (ex. https://pseudo.github.io/pense-bete/).
const fs = require("fs");
const path = require("path");
const here = __dirname;
const read = f => fs.readFileSync(path.join(here, f), "utf8");
const readOpt = f => (fs.existsSync(path.join(here, f)) ? read(f).trim() : "");

const version = Number(readOpt("version-interface.txt") || 1);
const updateUrl = readOpt("adresse-mise-a-jour.txt");
const notes = readOpt("notes-version.txt");

const seed = {};
const seedDir = path.join(here, "seed-export");
if (fs.existsSync(seedDir)) {
  for (const col of fs.readdirSync(seedDir)) {
    const dir = path.join(seedDir, col);
    if (!fs.statSync(dir).isDirectory()) continue;
    seed[col] = {};
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")))
      seed[col][f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  }
}

const page = fs.readFileSync(path.join(here, "..", "pense-bete.html"), "utf8");
const localdb = read("src/localdb.js");
const native = read("src/native.js");
const safe = s => s.replace(/<\/script/gi, "<\\/script");

const html = withSeed => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<!--PB_APP_MARKER-->
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:max(env(safe-area-inset-top,0px),var(--safe-area-inset-top,0px));padding-bottom:max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px))}
body{margin:0;font:14px system-ui,sans-serif;-webkit-tap-highlight-color:transparent}img{max-width:100%}[hidden]{display:none!important}</style>
<script>window.PB_VERSION=${version};window.PB_UPDATE_URL=${JSON.stringify(updateUrl)};</script>
<script>window.PB_SEED=${withSeed ? safe(JSON.stringify(seed)) : "{}"};</script>
<script>${safe(localdb)}</script>
<script>${safe(native)}</script>
</head><body>
${page}
</body></html>`;

fs.mkdirSync(path.join(here, "www"), { recursive: true });
fs.writeFileSync(path.join(here, "www", "index.html"), html(true));

const docs = path.join(here, "..", "docs");
fs.mkdirSync(docs, { recursive: true });
const pub = html(false);
for (const col of Object.keys(seed))
  for (const id of Object.keys(seed[col]))
    if (id.length > 3 && pub.includes(id)) throw new Error("Donnée personnelle trouvée dans la version publique : " + col + "/" + id);
fs.writeFileSync(path.join(docs, "app.html"), pub);
fs.writeFileSync(path.join(docs, "version.json"), JSON.stringify({ version, notes }, null, 1) + "\n");
fs.writeFileSync(path.join(docs, "index.html"), `<!doctype html><meta charset="utf-8"><title>Pense-bête</title><p>Fichiers de mise à jour de l'appli Pense-bête (version ${version}). Aucune donnée personnelle n'est stockée ici.</p>\n`);

console.log(`Interface v${version} ; www/index.html ${Math.round(html(true).length / 1024)} Ko ; docs/app.html ${Math.round(pub.length / 1024)} Ko ; mise à jour : ${updateUrl || "(adresse non configurée)"}`);

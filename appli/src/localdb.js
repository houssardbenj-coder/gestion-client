// Base de données locale : remplace le stockage Claude par le stockage du téléphone.
// Même interface que la page Claude (collection / doc / onSnapshot / set / delete),
// donc l'interface fonctionne sans modification.
// Chaque collection est rangée sous sa propre clé (pb-c-<nom>) : une modification
// ne réécrit que sa collection, ce qui reste rapide même avec des années de tâches.
(function(){
  const OLD_KEY="pb-data-v1", PREFIX="pb-c-";
  let data={};
  const load=()=>{const out={};
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
      if(k&&k.startsWith(PREFIX)){try{out[k.slice(PREFIX.length)]=JSON.parse(localStorage.getItem(k))||{}}catch(e){}}}
    return out};
  try{
    data=load();
    const old=localStorage.getItem(OLD_KEY);
    if(old){ // ancien format (une seule clé) : on le découpe une fois
      const o=JSON.parse(old)||{};
      for(const c of Object.keys(o)){if(!data[c]){data[c]=o[c];localStorage.setItem(PREFIX+c,JSON.stringify(o[c]))}}
      localStorage.removeItem(OLD_KEY);
    }
    if(!Object.keys(data).length&&window.PB_SEED&&Object.keys(window.PB_SEED).length){
      data=JSON.parse(JSON.stringify(window.PB_SEED));Object.keys(data).forEach(persist);
    }
  }catch(e){console.error("Lecture des données impossible",e)}
  const subs={};

  function persist(c){try{localStorage.setItem(PREFIX+c,JSON.stringify(data[c]||{}))}catch(e){console.error("Sauvegarde locale impossible",e);
    const s=document.getElementById("status");if(s)s.textContent="⚠️ Mémoire de l'appli pleine : fais une sauvegarde puis contacte-moi.";}}
  function snap(c,order){
    let docs=Object.entries(data[c]||{}).map(([id,b])=>({id,exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>JSON.parse(JSON.stringify(b))}));
    if(order)docs.sort((a,b)=>{const x=a.data()[order],y=b.data()[order];return (x??Infinity)-(y??Infinity)});
    return {docs,size:docs.length,empty:!docs.length,docChanges:()=>[]};
  }
  function fire(c){(subs[c]||[]).forEach(s=>s.cb(snap(c,s.order)));window.dispatchEvent(new Event("pb-data-changed"))}

  const db={
    collection(c){
      const q={_order:null,
        orderBy(f){const n=Object.create(q);n._order=f;return n},
        where(){return this},limit(){return this},
        async get(){return snap(c,this._order)},
        onSnapshot(cb){const s={cb,order:this._order};(subs[c]=subs[c]||[]).push(s);setTimeout(()=>cb(snap(c,s.order)));return()=>{subs[c]=(subs[c]||[]).filter(x=>x!==s)}},
        doc(id){return db.doc(c+"/"+(id||Math.random().toString(36).slice(2,11)))}};
      return q;
    },
    doc(path){
      const [c,id]=path.split("/");
      return {id,path,
        async get(){const b=(data[c]||{})[id];return {id,exists:!!b,data:()=>b&&JSON.parse(JSON.stringify(b))}},
        async set(body){(data[c]=data[c]||{})[id]=JSON.parse(JSON.stringify(body));persist(c);fire(c)},
        async update(body){if(!(data[c]||{})[id])throw {code:"invalid_argument"};Object.assign(data[c][id],JSON.parse(JSON.stringify(body)));persist(c);fire(c)},
        async delete(){if(data[c]){delete data[c][id];persist(c);fire(c)}}};
    }
  };

  window.PB_store={
    all:()=>data,
    sizeKB:()=>{let n=0;for(const c of Object.keys(data))n+=(localStorage.getItem(PREFIX+c)||"").length;return Math.round(n*2/1024)},
    exportJSON:()=>JSON.stringify({app:"pense-bete",version:1,exportedAt:new Date().toISOString(),data},null,1),
    importJSON(text){
      const o=JSON.parse(text);
      if(!o||o.app!=="pense-bete"||typeof o.data!=="object")throw new Error("format");
      Object.keys(data).forEach(c=>localStorage.removeItem(PREFIX+c));
      data=o.data;Object.keys(data).forEach(persist);Object.keys(subs).forEach(fire);
    }
  };
  window.claude={use:async n=>n==="db"?db:null};
})();

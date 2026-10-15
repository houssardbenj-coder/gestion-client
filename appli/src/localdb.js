// Base de données locale : remplace le stockage Claude par le stockage du téléphone.
// Même interface que la page Claude (collection / doc / onSnapshot / set / delete),
// donc le Pense-bête fonctionne sans modification.
(function(){
  const KEY="pb-data-v1";
  let data={};
  try{data=JSON.parse(localStorage.getItem(KEY)||"null")||null}catch(e){data=null}
  if(!data){data=JSON.parse(JSON.stringify(window.PB_SEED||{}));persist()}
  const subs={};

  function persist(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){console.error("Sauvegarde locale impossible",e)}}
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
        async set(body){(data[c]=data[c]||{})[id]=JSON.parse(JSON.stringify(body));persist();fire(c)},
        async update(body){if(!(data[c]||{})[id])throw {code:"invalid_argument"};Object.assign(data[c][id],JSON.parse(JSON.stringify(body)));persist();fire(c)},
        async delete(){if(data[c]){delete data[c][id];persist();fire(c)}}};
    }
  };

  window.PB_store={
    all:()=>data,
    exportJSON:()=>JSON.stringify({app:"pense-bete",version:1,exportedAt:new Date().toISOString(),data},null,1),
    importJSON(text){
      const o=JSON.parse(text);
      if(!o||o.app!=="pense-bete"||typeof o.data!=="object")throw new Error("format");
      data=o.data;persist();Object.keys(subs).forEach(fire);
    }
  };
  window.claude={use:async n=>n==="db"?db:null};
})();

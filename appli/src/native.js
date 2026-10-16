// Fonctions propres au téléphone : alarmes, agenda Android, sauvegarde, bouton retour.
(function(){
  const C=window.Capacitor;
  if(!C||!C.isNativePlatform||!C.isNativePlatform())return;
  // registerPlugin vient du module Capacitor inclus dans la page (capacitorExports) ; le pont natif seul ne le fournit pas
  const REG=(window.capacitorExports&&window.capacitorExports.registerPlugin)||(C.registerPlugin&&C.registerPlugin.bind(C));
  if(!REG){console.error("Capacitor : registerPlugin introuvable");return}
  const LN=REG("LocalNotifications");
  const CAL=REG("CapacitorCalendar");
  const FS=REG("Filesystem");
  const SH=REG("Share");
  const APP=REG("App");
  const pad=n=>String(n).padStart(2,"0");
  const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const dim=(y,m)=>new Date(y,m+1,0).getDate();
  function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=t.getUTCFullYear();const w=Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);return y+"-W"+pad(w)}
  function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)%2000000000+1}
  const name=x=>[x.firstName,x.lastName].filter(Boolean).join(" ")||x.title||"Sans nom";
  let exact=false;

  // Prochaines échéances d'une routine : [{at:Date, key:période}]
  function occurrences(r){
    const [hh,mm]=String(r.time||"09:00").split(":").map(Number);
    const now=new Date(), out=[];
    const y=now.getFullYear(), m=now.getMonth();
    if(r.freq==="daily"){for(let k=0;k<31;k++){const d=new Date(y,m,now.getDate()+k,hh,mm);out.push({at:d,key:ymd(d)})}}
    else if(r.freq==="weekly"){const wd=Number(r.weekday||1),cur=now.getDay()||7;
      for(let k=0;k<26;k++){const d=new Date(y,m,now.getDate()+(wd-cur)+7*k,hh,mm);out.push({at:d,key:isoWeek(d)})}}
    else if(r.freq==="quarterly"){const qs=Math.floor(m/3)*3;
      for(let k=0;k<5;k++){const mo=qs+3*k+Number(r.monthOffset||0);const d=new Date(y,mo,1,hh,mm);d.setDate(Math.min(Number(r.day||1),dim(d.getFullYear(),d.getMonth())));
        const q=Math.floor((qs+3*k)%12/3)+1, qy=new Date(y,qs+3*k,1).getFullYear();out.push({at:d,key:qy+"-T"+q})}}
    else{for(let k=0;k<13;k++){const d=new Date(y,m+k,1,hh,mm);d.setDate(Math.min(Number(r.day||1),dim(d.getFullYear(),d.getMonth())));out.push({at:d,key:d.getFullYear()+"-"+pad(d.getMonth()+1)})}}
    return out;
  }

  function buildNotifications(){
    const D=window.PB_store.all(), now=Date.now(), list=[];
    Object.entries(D.routines||{}).forEach(([id,r])=>{
      const tasks=r.tasks||[];
      occurrences(r).forEach(o=>{
        if(o.at.getTime()<=now)return;
        const run=(D.runs||{})[id+"__"+o.key];const done=run&&run.done||{};
        if(tasks.length&&tasks.every(t=>done[t.id]))return;
        const body=tasks.length?tasks.length+" tâche"+(tasks.length>1?"s":"")+" : "+tasks.slice(0,3).map(t=>t.label).join(", ")+(tasks.length>3?"…":""):"Ouvre ta checklist";
        list.push({key:"r:"+id+":"+o.key,at:o.at,title:"📋 "+(r.title||"Routine"),body});
      });
    });
    Object.entries(D.leads||{}).forEach(([id,l])=>{
      if((l.status&&l.status!=="open")||!l.when)return;
      if(l.type==="rdv"){const at=l.when-3600e3;if(at>now)list.push({key:"l:"+id+":"+l.when,at:new Date(at),title:"📅 RDV dans 1 h : "+name(l),body:[l.address,l.phone].filter(Boolean).join(" · ")||"Rendez-vous"});}
      else if(l.when>now)list.push({key:"l:"+id+":"+l.when,at:new Date(l.when),title:"📞 À rappeler : "+name(l),body:[l.phone,l.reason].filter(Boolean).join(" · ")||"Rappel client"});
    });
    Object.entries(D.projects||{}).forEach(([id,p])=>{
      if(!p.rdv)return;const at=p.rdv-3600e3;
      if(at>now)list.push({key:"p:"+id+":"+p.rdv,at:new Date(at),title:"📅 RDV dans 1 h : "+name(p),body:[p.address,p.phone].filter(Boolean).join(" · ")||"Rendez-vous client"});
    });
    return list.sort((a,b)=>a.at-b.at).slice(0,400);
  }

  let timer=null, running=false, again=false;
  function reschedule(){clearTimeout(timer);timer=setTimeout(doReschedule,800)}
  async function doReschedule(){
    if(running){again=true;return}
    running=true;
    try{
      const pend=await LN.getPending();
      if(pend.notifications&&pend.notifications.length)await LN.cancel({notifications:pend.notifications.map(n=>({id:n.id}))});
      const list=buildNotifications();
      if(list.length)await LN.schedule({notifications:list.map(n=>({id:hash(n.key),title:n.title,body:n.body,channelId:"rappels",
        schedule:{at:n.at,allowWhileIdle:true},isExactNotification:exact,foreground:true}))});
    }catch(e){console.error("Programmation des rappels impossible",e)}
    running=false; if(again){again=false;reschedule()}
  }

  async function setup(){
    try{await LN.createChannel({id:"rappels",name:"Rappels",description:"Routines, rendez-vous et rappels clients",importance:5,visibility:1,vibration:true})}catch(e){}
    try{const p=await LN.checkPermissions();if(p.display!=="granted")await LN.requestPermissions()}catch(e){}
    try{const s=await LN.checkExactNotificationSetting();exact=s.exact_alarm==="granted"}catch(e){}
    reschedule();
  }

  // ===== Mise à jour automatique de l'interface depuis GitHub =====
  // version.json : {"version": N, "notes": "..."} ; app.html : la nouvelle interface complète.
  // Elle est copiée dans le stockage de l'appli puis chargée à la place de celle d'origine
  // (même adresse interne, donc les données restent). Un nouvel APK installé reprend la main.
  const WV=REG("WebView");
  let checking=false,lastCheck=0;
  async function checkUpdate(manual){
    const base=window.PB_UPDATE_URL;
    if(!base||checking)return manual?"none":undefined;
    checking=true;lastCheck=Date.now();
    try{
      const r=await fetch(base+"version.json?t="+Date.now(),{cache:"no-store"});
      if(!r.ok)throw new Error("http "+r.status);
      const info=await r.json();
      if(!(Number(info.version)>Number(window.PB_VERSION||0)))return "uptodate";
      if(!manual&&document.querySelector(".sheet-bg"))return "later"; // une fiche est ouverte : on attend
      const page=await (await fetch(base+"app.html?v="+info.version,{cache:"no-store"})).text();
      if(!page.includes("<!--PB_APP_MARKER-->")||!page.includes("window.PB_VERSION="+Number(info.version)+";"))throw new Error("fichier incomplet");
      const dir="live/"+Number(info.version);
      await FS.writeFile({path:dir+"/index.html",data:page,directory:"DATA",encoding:"utf8",recursive:true});
      const {uri}=await FS.getUri({path:dir,directory:"DATA"});
      try{localStorage.setItem("pb-just-updated",JSON.stringify({v:info.version,notes:info.notes||""}))}catch(e){}
      WV.setServerBasePath({path:decodeURIComponent(uri.replace(/^file:\/\//,""))});
      WV.persistServerBasePath();
      return "updated";
    }catch(e){console.error("Mise à jour impossible",e);window.PB_lastUpdateError=String(e&&(e.message||e.errorMessage)||e);return "error"}
    finally{checking=false}
  }
  document.addEventListener("DOMContentLoaded",()=>{
    let j=null;try{j=JSON.parse(localStorage.getItem("pb-just-updated")||"null");localStorage.removeItem("pb-just-updated")}catch(e){}
    if(j)setTimeout(()=>{const s=document.getElementById("status");if(s)s.textContent="✓ Appli mise à jour (version "+j.v+")"+(j.notes?" : "+j.notes:"")},800);
    setTimeout(()=>checkUpdate(false),2500);
  });

  window.addEventListener("pb-data-changed",reschedule);
  APP.addListener("resume",async()=>{
    try{const s=await LN.checkExactNotificationSetting();exact=s.exact_alarm==="granted"}catch(e){}
    window.dispatchEvent(new Event("pb-resume"));reschedule();
    if(Date.now()-lastCheck>2*60e3)checkUpdate(false);
  });
  APP.addListener("backButton",()=>{
    if(document.querySelector(".sheet-bg"))document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}));
    else APP.exitApp();
  });

  async function canWrite(){
    let s=(await CAL.checkPermission({scope:"writeCalendar"})).result;
    if(s!=="granted")s=(await CAL.requestFullCalendarAccess()).result;
    return s==="granted";
  }

  // Agenda cible : celui choisi dans les réglages, sinon l'agenda principal du compte Gmail
  async function chosenCalendar(){
    let id="";try{id=localStorage.getItem("pb-cal-id")||""}catch(e){}
    let list=[];try{list=(await CAL.listCalendars()).result||[]}catch(e){return id||undefined}
    if(id&&list.some(c=>String(c.id)===id))return id;
    const google=list.filter(c=>/@(gmail|googlemail)\.com$/i.test(c.accountName||""));
    const best=google.find(c=>(c.ownerAccount||"")===(c.accountName||"")&&(c.title===c.accountName||c.internalTitle===c.accountName))
      ||google.find(c=>(c.ownerAccount||"")===(c.accountName||""))||google[0];
    if(best){id=String(best.id);try{localStorage.setItem("pb-cal-id",id)}catch(e){}return id}
    return undefined;
  }

  window.PB_native={
    async agendaPermission(){try{return (await CAL.checkPermission({scope:"readCalendar"})).result}catch(e){return "denied"}},
    async askAgenda(){try{return (await CAL.requestFullCalendarAccess()).result}catch(e){return "denied"}},
    async listEvents(from,to){const r=await CAL.listEventsInRange({from,to});return (r.result||[]).map(e=>({id:e.id,title:e.title,startDate:e.startDate,endDate:e.endDate,location:e.location,isAllDay:e.isAllDay}))},
    // Crée l'événement dans l'agenda Google (ou le met à jour s'il existe déjà : calId)
    async addEvent({title,start,end,minutes,location,description,calId}){
      if(!(await canWrite()))throw new Error("denied");
      const calendarId=await chosenCalendar();
      const body={title,startDate:start,endDate:end&&end>start?end:start+3600e3,location,description,alerts:[-(minutes||60)]};
      if(calId&&calId!=="ok"){
        try{await CAL.modifyEvent({id:String(calId),...body});return calId}catch(e){/* supprimé de l'agenda : on le recrée */}
      }
      const r=await CAL.createEvent(calendarId?{...body,calendarId}:body);
      return r&&r.id;
    },
    async calendars(){
      if(!(await canWrite()))return [];
      const r=await CAL.listCalendars();
      return (r.result||[]).map(c=>({id:c.id,title:c.title||c.internalTitle||c.accountName||"Agenda",account:c.accountName||""}));
    },
    chosenCalendarId:()=>{try{return localStorage.getItem("pb-cal-id")||""}catch(e){return ""}},
    setCalendar(id){try{localStorage.setItem("pb-cal-id",id)}catch(e){}},
    async exportData(){
      const file="pense-intelligent-sauvegarde-"+ymd(new Date())+".json";
      const w=await FS.writeFile({path:file,data:window.PB_store.exportJSON(),directory:"CACHE",encoding:"utf8"});
      await SH.share({title:"Sauvegarde Pense intelligent",text:"Sauvegarde de mes données Pense intelligent",files:[w.uri],dialogTitle:"Où enregistrer la sauvegarde ?"});
    },
    version:()=>window.PB_VERSION||0,
    checkUpdate:()=>checkUpdate(true),
    async importData(text){window.PB_store.importJSON(text);reschedule()},
    async openAlarmSettings(){
      try{await LN.requestPermissions()}catch(e){}
      try{const s=await LN.changeExactNotificationSetting();exact=s.exact_alarm==="granted"}catch(e){}
      reschedule();
    }
  };
  setup();
})();

/* ===== Helpers ===== */
const $ = (s, d=document) => d.querySelector(s);
const norm = (str="") => str.toString().toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu,'')
  .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const getFirst = (o,k,f=null)=>{for(const x of k) if(o&&o[x]!=null) return o[x]; return f;};
const asNumber = (v,d=0)=>{const n=Number(String(v).replace('%','').trim()); return Number.isFinite(n)?n:d;};

/* ===== Config ===== */
const DB_URL = 'data/base_de_datos.json';
const AUDIO_URL = 'media/audio.mp3';

/* ===== Estado ===== */
let DATA=[], INDEX=[], NAMES=[];

/* ===== Data ===== */
async function cargarDatos(){
  const s=$('#dbStatus');
  try{
    const res=await fetch(`${DB_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw=await res.json();
    if(!Array.isArray(raw)) throw new Error('JSON no es array');
    DATA=normalizar(raw); construirIndices();
    if(s) s.textContent=`Base de datos cargada: ${DATA.length} ocupaciones.`;
  }catch(e){
    console.warn('Base fallback',e);
    DATA=normalizar([
      {codigo_isco:"4311", ocupacion_es:"Empleados de contabilidad y teneduría de libros", riesgo_automatizacion_porcentaje:64, explicacion:"Tareas repetitivas con reglas claras; alto potencial de automatización.", sinonimos:["Auxiliar contable","Asistente contable","Tenedor de libros","Administrativo contable"]},
      {codigo_isco:"7112", ocupacion_es:"Albañiles", riesgo_automatizacion_porcentaje:9, explicacion:"Destreza manual y entornos no estructurados; difícil de automatizar por completo.", sinonimos:["Maestro de obra","Oficial de construcción","Oficial albañil"]}
    ]);
    construirIndices(); if(s) s.textContent="⚠️ No se pudo cargar data/base_de_datos.json.";
  }
}
function normalizar(arr){
  return arr.map(it=>{
    const ocup=getFirst(it,['ocupacion_es','ocupación_es','ocupacion','ocupación'],'').toString();
    const syn=getFirst(it,['sinonimos','sinónimos'],[]);
    const riesgo=asNumber(getFirst(it,['riesgo_automatizacion_porcentaje','riesgo','riesgo_porcentaje'],0));
    const exp=getFirst(it,['explicacion','explicación','descripcion','descripción'],'');
    return {codigo_isco:getFirst(it,['codigo_isco','código_isco','isco','isco08'],''), ocupacion_es:ocup,
      riesgo_automatizacion_porcentaje:Math.max(0,Math.min(100,riesgo)), explicacion:exp,
      sinonimos:Array.isArray(syn)?syn.filter(Boolean):[]};
  }).filter(x=>x.ocupacion_es);
}
function construirIndices(){
  const s=new Set();
  INDEX=DATA.map((it,i)=>{const base=[it.ocupacion_es,...(it.sinonimos||[])].join(' ');
    [it.ocupacion_es,...(it.sinonimos||[])].forEach(n=>s.add(n)); return {i,tokens:norm(base)};});
  NAMES=Array.from(s).sort((a,b)=>a.localeCompare(b,'es'));
}

/* ===== Buscador ===== */
function score(h,n){ if(!n) return 0; if(h.startsWith(n+' '))return 120; if(h===n)return 110; if(h.includes(' '+n+' '))return 90; if(h.includes(n))return Math.min(80,Math.floor(n.length*2)); let s=0; for(const p of n.split(' ')) if(p&&h.includes(p)) s+=10; return s;}
function buscar(t){ const q=norm(t); let best=null,bestS=0; INDEX.forEach(o=>{const s=score(o.tokens,q); if(s>bestS){bestS=s; best=DATA[o.i];}}); return best;}
function sugerencias(t,lim=10){ const q=norm(t); if(!q) return NAMES.slice(0,lim);
  return NAMES.map(n=>{const t=norm(n); let s=0; if(t.startsWith(q))s+=100; else if(t.includes(q))s+=60; q.split(' ').forEach(p=>{if(t.includes(p))s+=8}); return {n,s};})
    .filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,lim).map(x=>x.n);
}
function pintarSugerencias(list){
  const c=$('#sugerencias'); c.innerHTML=''; list.forEach(txt=>{const b=document.createElement('button'); b.type='button'; b.textContent=txt; b.onclick=()=>{$('#search').value=txt;c.innerHTML='';accionBuscar();}; c.appendChild(b);});
  const dl=$('#opts'); if(dl){ dl.innerHTML=''; list.forEach(txt=>{const o=document.createElement('option'); o.value=txt; dl.appendChild(o);});}
}

/* ===== Gauge ===== */
function etiquetaRiesgo(p){ if(p<=16.6)return{txt:'Muy bajo',color:'#0fa15d'}; if(p<=33.3)return{txt:'Bajo',color:'#23b46b'}; if(p<=50)return{txt:'Moderado',color:'#a6e42b'}; if(p<=66.6)return{txt:'Moderado-alto',color:'#f1c40f'}; if(p<=83.3)return{txt:'Alto',color:'#e67e22'}; return{txt:'Inminente',color:'#e74c3c'};}
function setGauge(p

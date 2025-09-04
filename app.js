/* ===== Helpers ===== */
const $ = (s, d=document) => d.querySelector(s);
const stripDiacritics = (txt) => {
  // compatible con navegadores sin soporte \p{Diacritic}
  try { return txt.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  catch { return txt; }
};
const norm = (str="") => stripDiacritics(
  String(str).toLowerCase()
).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const getFirst = (o,k,f=null)=>{for(const x of k) if(o&&o[x]!=null) return o[x]; return f;};
const asNumber = (v,d=0)=>{const n=Number(String(v).replace('%','').trim()); return Number.isFinite(n)?n:d;};

/* ===== Config ===== */
const DB_URL = 'data/base_de_datos.json';
const AUDIO_URL = 'media/audio.mp3';

/* ===== Estado ===== */
let DATA=[], INDEX=[], NAMES=[];

/* ===== Carga de datos ===== */
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
    construirIndices();
    if(s) s.textContent="⚠️ No se pudo cargar data/base_de_datos.json.";
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

/* ===== Buscador & sugerencias ===== */
function score(h,n){ if(!n) return 0; if(h.startsWith(n+' '))return 120; if(h===n)return 110; if(h.includes(' '+n+' '))return 90; if(h.includes(n))return Math.min(80,Math.floor(n.length*2)); let s=0; for(const p of n.split(' ')) if(p&&h.includes(p)) s+=10; return s;}
function buscar(t){ const q=norm(t); let best=null,bestS=0; INDEX.forEach(o=>{const s=score(o.tokens,q); if(s>bestS){bestS=s; best=DATA[o.i];}}); return best;}
function sugerencias(t,lim=10){ const q=norm(t); if(!q) return NAMES.slice(0,lim);
  return NAMES.map(n=>{const tt=norm(n); let s=0; if(tt.startsWith(q))s+=100; else if(tt.includes(q))s+=60; q.split(' ').forEach(p=>{if(tt.includes(p))s+=8}); return {n,s};})
    .filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,lim).map(x=>x.n);
}
function pintarSugerencias(list){
  const c=$('#sugerencias'); c.innerHTML='';
  list.forEach(txt=>{
    const b=document.createElement('button'); b.type='button'; b.textContent=txt;
    b.addEventListener('click',()=>{ $('#search').value=txt; c.innerHTML=''; accionBuscar(); });
    c.appendChild(b);
  });
  const dl=$('#opts'); if(dl){ dl.innerHTML=''; list.forEach(txt=>{ const o=document.createElement('option'); o.value=txt; dl.appendChild(o); }); }
}

/* ===== Gauge ===== */
function etiquetaRiesgo(p){ if(p<=16.6)return{txt:'Muy bajo',color:'#0fa15d'}; if(p<=33.3)return{txt:'Bajo',color:'#23b46b'}; if(p<=50)return{txt:'Moderado',color:'#a6e42b'}; if(p<=66.6)return{txt:'Moderado-alto',color:'#f1c40f'}; if(p<=83.3)return{txt:'Alto',color:'#e67e22'}; return{txt:'Inminente',color:'#e74c3c'};}
function setGauge(pct){
  const v=Math.max(0,Math.min(100,Number(pct)||0)), angle=-90+(v/100)*180;
  const needle=document.getElementById('needle'); if(needle) needle.style.transform=`rotate(${angle}deg)`;
  const {txt,color}=etiquetaRiesgo(v);
  document.getElementById('porcentaje').textContent=`${Math.round(v)}%`;
  document.getElementById('riesgoEtiqueta').textContent=txt;
  const lab=document.getElementById('gaugeLabel'); lab.textContent=`Riesgo ${txt.toLowerCase()}`; lab.style.background=color; lab.style.color=v>66.6?'#fff':'#0d1117';
}

/* ===== Compartir ===== */
function svg(icon){
  const I={wa:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.5 3.5A11.5 11.5 0 1 0 3.5 20.5 11.5 11.5 0 0 0 20.5 3.5Zm-8.2 16.4a9 9 0 1 1 9-9 9 9 0 0 1-9 9Zm4.6-6.1c-.2-.1-1.3-.7-1.5-.8s-.4-.1-.6.1-.7.8-.8.9-.3.1-.5 0a6.9 6.9 0 0 1-2-1.3 7.5 7.5 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.5a1.6 1.6 0 0 0 .2-.6.6.6 0 0 0 0-.6c0-.1-.6-1.5-.8-2s-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.6 4.5 10.3 10.3 0 0 0 2.1.8 4.9 4.9 0 0 0 2.2.1 2.5 2.5 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c-.1-.1-.3-.2-.5-.3Z"/></svg>',
    tg:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.04 15.31 8.9 19.1a.77.77 0 0 0 1.2.67l2.72-1.85 3.94 2.9c.72.52 1.66.13 1.9-.78L21.9 5.49c.22-.83-.4-1.57-1.2-1.26L2.3 12.02c-.9.36-.89 1.66.03 1.98l4.42 1.55 10.24-8.29-7.95 8.05Z"/></svg>',
    fb:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13 3h4a1 1 0 0 1 1 1v3h-3a1 1 0 0 0-1 1v3h4l-.5 4H14v8h-4v-8H7v-4h3V8a5 5 0 0 1 5-5Z"/></svg>',
    tw:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.6 7.2c.01.2.01.4.01.7 0 7-5.3 15-15 15A15 15 0 0 1 0 20a10.6 10.6 0 0 0 7.8-2.2A5.3 5.3 0 0 1 3 14a6.7 6.7 0 0 0 1-.1A5.3 5.3 0 0 1 1 8.7V8.6a5.4 5.4 0 0 0 2.4.7A5.3 5.3 0 0 1 1.8 3 15 15 0 0 0 12.7 9.7a6 6 0 0 1-.1-1.2 5.3 5.3 0 0 1 9-3.6 10.5 10.5 0 0 0 3.4-1.3 5.3 5.3 0 0 1-2.3 2.9 10.6 10.6 0 0 0 3-.8 11.4 11.4 0 0 1-2.7 2.8Z"/></svg>',
    pi:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.3 19.4c-.1-.8-.2-2 .1-2.8l1.3-5.4s-.3-.7-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.3.7 1.3 1.5 0 .9-.6 2.2-.9 3.4-.3 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4-4.1-4-2.8 0-4.4 2.1-4.4 4.2 0 .8.3 1.6.7 2.1.1.1.1.2.1.3-.1.4-.3 1.2-.4 1.4-.1.2-.3.3-.6.2-1.7-.8-2.5-2.8-2.5-4.5 0-3.7 2.7-7.1 7.9-7.1 4.2 0 7.5 3 7.5 7.1 0 4.2-2.6 7.6-6.3 7.6-1.2 0-2.3-.6-2.7-1.3l-.7 2.6c-.3 1-1 2.2-1.5 3 .9.3 1.9.4 2.9.4A10 10 0 0 0 12 2Z"/></svg>',
    in:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.9 6.5A2 2 0 1 1 3 6.5a2 2 0 0 1 3.9 0ZM3.4 8.8h3.6V21H3.4V8.8ZM9.2 8.8h3.4v1.7c.5-1 1.7-2 3.6-2 3.9 0 4.6 2.6 4.6 5.9V21h-3.6v-5.3c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21H9.2V8.8Z"/></svg>',
    ig:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 4.5A5.5 5.5 0 1 0 17.5 12 5.5 5.5 0 0 0 12 6.5Zm0 2A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5ZM18 5.8a1.2 1.2 0 1 0 1.2 1.2A1.2 1.2 0 0 0 18 5.8Z"/></svg>',
    cp:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>'};
  return I[icon]||'';
}
function buildShareButtons(item){
  const text=`Riesgo de automatización para “${item.ocupacion_es}”: ${item.riesgo_automatizacion_porcentaje}%`;
  const url=location.href.split('#')[0];
  const encodedText=encodeURIComponent(text), encodedURL=encodeURIComponent(url), imgURL=encodeURIComponent(new URL('./images/i1.png',location.href).toString());
  const list=[
    {cls:'wa',href:`https://api.whatsapp.com/send?text=${encodedText}%20${encodedURL}`,label:'WhatsApp',icon:'wa'},
    {cls:'tg',href:`https://t.me/share/url?url=${encodedURL}&text=${encodedText}`,label:'Telegram',icon:'tg'},
    {cls:'fb',href:`https://www.facebook.com/sharer/sharer.php?u=${encodedURL}&quote=${encodedText}`,label:'Facebook',icon:'fb'},
    {cls:'tw',href:`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedURL}`,label:'X/Twitter',icon:'tw'},
    {cls:'pi',href:`https://pinterest.com/pin/create/button/?url=${encodedURL}&description=${encodedText}&media=${imgURL}`,label:'Pinterest',icon:'pi'},
    {cls:'in',href:`https://www.linkedin.com/sharing/share-offsite/?url=${encodedURL}`,label:'LinkedIn',icon:'in'},
    {cls:'ig',href:'#',label:'Instagram',icon:'ig',action:'copy'},
    {cls:'cp',href:'#',label:'Copiar link',icon:'cp',action:'copy'}
  ];
  const wrap=$('#shareButtons'); wrap.innerHTML='';
  for(const b of list){
    const a=document.createElement('a');
    a.className=`share-btn ${b.cls}`;
    a.innerHTML=`${svg(b.icon)}<span>${b.label}</span>`;
    if(b.action==='copy'){
      a.href='#';
      a.addEventListener('click',e=>{e.preventDefault(); navigator.clipboard?.writeText(`${text} ${url}`); alert('Enlace copiado. Pégalo en Instagram u otras apps.');});
    }else{
      a.href=b.href; a.target='_blank'; a.rel='noopener';
    }
    wrap.appendChild(a);
  }
  if(navigator.share){
    const n=document.createElement('a');
    n.className='share-btn';
    n.innerHTML=`${svg('cp')}<span>Compartir…</span>`;
    n.href='#';
    n.onclick=async e=>{e.preventDefault(); try{await navigator.share({title:'Riesgo de automatización',text,url});}catch{}};
    wrap.prepend(n);
  }
}

/* ===== UI ===== */
function pintarResultado(item){
  $('#resultado').classList.remove('hidden');
  $('#ocupacionTitulo').textContent=item.ocupacion_es;
  $('#explicacion').textContent=item.explicacion||'—';
  setGauge(asNumber(item.riesgo_automatizacion_porcentaje,0));
  buildShareButtons(item);
}
async function accionBuscar(){
  const term=$('#search').value.trim(); if(!term) return;
  const found=buscar(term);
  if(found) pintarResultado(found);
  else { $('#resultado').classList.remove('hidden'); $('#ocupacionTitulo').textContent='No encontramos esa ocupación'; $('#explicacion').textContent='Prueba otros sinónimos o un nombre más corto.'; setGauge(0); buildShareButtons({ocupacion_es:'(desconocida)',riesgo_automatizacion_porcentaje:0}); }
}

/* ===== Audio: BlobURL (fiable) ===== */
async function initAudio(){
  const el=$('#player'); if(!el) return;
  try{
    const r=await fetch(`${AUDIO_URL}?v=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const b=await r.blob(); if(!b||!b.size) throw new Error('archivo vacío');
    el.src=URL.createObjectURL(b);
  }catch{ el.src=AUDIO_URL; }
}

/* ===== Eventos ===== */
document.addEventListener('DOMContentLoaded', async ()=>{
  $('#year').textContent=new Date().getFullYear();
  await cargarDatos();

  const input=$('#search');

  // pintar primeras sugerencias
  function pintar(){ pintarSugerencias(sugerencias(input.value,10)); }
  pintar();

  input.addEventListener('input', pintar);
  $('#btnBuscar').addEventListener('click', accionBuscar);
  input.addEventListener('change', accionBuscar);     // al seleccionar del datalist
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') accionBuscar(); });

  // ?q=
  const params=new URLSearchParams(location.search);
  const q=params.get('q')||params.get('busqueda');
  if(q){ input.value=q; accionBuscar(); }

  // Audio
  initAudio();
});

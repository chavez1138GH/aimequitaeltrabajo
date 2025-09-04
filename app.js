/* ========= Helpers ========= */
const $ = (s, d=document) => d.querySelector(s);
const norm = (str="") => str.toString().toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu,'')
  .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const getFirst = (o,k,f=null)=>{for(const x of k) if(o&&o[x]!=null) return o[x]; return f;};
const asNumber = (v,d=0)=>{const n=Number(String(v).replace('%','').trim());return Number.isFinite(n)?n:d;};

/* ========= Config ========= */
const DB_URL = 'data/base_de_datos.json';

/* ========= Estado ========= */
let DATA=[], INDEX=[], NAMES=[];

/* ========= Carga JSON ========= */
async function cargarDatos(){
  const s=$('#dbStatus');
  try{
    const res = await fetch(`${DB_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const raw = await res.json();
    if(!Array.isArray(raw)) throw new Error('JSON no es array');
    DATA = raw.map(it=>{
      const ocup = getFirst(it,['ocupacion_es','ocupación_es','ocupacion','ocupación'],'').toString();
      const syn  = getFirst(it,['sinonimos','sinónimos'],[]);
      const riesgo = asNumber(getFirst(it,['riesgo_automatizacion_porcentaje','riesgo','riesgo_porcentaje'],0));
      const exp = getFirst(it,['explicacion','explicación','descripcion','descripción'],'');
      return {ocupacion_es:ocup, sinonimos:Array.isArray(syn)?syn.filter(Boolean):[], riesgo_automatizacion_porcentaje:Math.max(0,Math.min(100,riesgo)), explicacion:exp};
    }).filter(x=>x.ocupacion_es);
    const set = new Set();
    INDEX = DATA.map((it,i)=>{ const base=[it.ocupacion_es,...it.sinonimos].join(' '); [it.ocupacion_es,...it.sinonimos].forEach(n=>set.add(n)); return {i,tokens:norm(base)}; });
    NAMES = Array.from(set).sort((a,b)=>a.localeCompare(b,'es'));
    if(s) s.textContent=`Base de datos cargada: ${DATA.length} ocupaciones.`;
  }catch(e){
    if(s) s.textContent='⚠️ No se pudo cargar data/base_de_datos.json';
    console.warn(e);
  }
}

/* ========= Búsqueda ========= */
function score(hay, nee){ if(!nee) return 0;
  if(hay===nee) return 120; if(hay.startsWith(nee+' ')) return 110; if(hay.includes(` ${nee} `)) return 90;
  let sc=0; if(hay.includes(nee)) sc+=60; nee.split(' ').forEach(p=>{if(hay.includes(p)) sc+=10}); return sc;
}
function buscar(term){ const q=norm(term); let best=null,bs=0; INDEX.forEach(o=>{const s=score(o.tokens,q); if(s>bs){bs=s; best=DATA[o.i];}}); return best; }
function sugerencias(term,limit=10){ const q=norm(term); if(!q) return NAMES.slice(0,limit);
  return NAMES.map(n=>({n, t:norm(n)})).map(x=>({n:x.n,s:x.t.startsWith(q)?100:(x.t.includes(q)?60:0)+q.split(' ').reduce((a,p)=>a+(x.t.includes(p)?8:0),0)}))
    .filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,limit).map(x=>x.n);
}
function pintarSugerencias(list){ const c=$('#sugerencias'); c.innerHTML='';
  list.forEach(txt=>{ const b=document.createElement('button'); b.type='button'; b.textContent=txt;
    b.onclick=()=>{ $('#search').value=txt; c.innerHTML=''; accionBuscar(); }; c.appendChild(b);
  });
  const dl=document.getElementById('opts'); if(dl){ dl.innerHTML=''; list.forEach(v=>{const o=document.createElement('option'); o.value=v; dl.appendChild(o);}); }
}

/* ========= Gauge ========= */
function etiqueta(p){ p=Math.max(0,Math.min(100,Number(p)||0));
  if(p<=16.6) return {txt:'Muy bajo',color:'#0fa15d'};
  if(p<=33.3) return {txt:'Bajo',color:'#23b46b'};
  if(p<=50.0) return {txt:'Moderado',color:'#a6e42b'};
  if(p<=66.6) return {txt:'Moderado-alto',color:'#f1c40f'};
  if(p<=83.3) return {txt:'Alto',color:'#e67e22'};
  return {txt:'Inminente',color:'#e74c3c'};
}
function setGauge(p){
  const val=Math.max(0,Math.min(100,Number(p)||0));
  const angle=-90+(val/100)*180;
  const needle=document.getElementById('needle'); if(needle) needle.style.transform=`rotate(${angle}deg)`;
  document.getElementById('porcentaje').textContent=`${Math.round(val)}%`;
  const lab=etiqueta(val);
  const badge=document.getElementById('riesgoEtiqueta'); badge.textContent=lab.txt;
  const riskLabel=document.getElementById('riskLabel'); riskLabel.textContent=`Riesgo ${lab.txt.toLowerCase()}`;
  riskLabel.style.background=lab.color; riskLabel.style.color = val>66.6?'#fff':'#0d1117';
}

/* ========= UI ========= */
function pintarResultado(item){
  document.getElementById('resultado').classList.remove('hidden');
  document.getElementById('ocupacionTitulo').textContent=item.ocupacion_es;
  document.getElementById('explicacion').textContent=item.explicacion||'—';
  setGauge(item.riesgo_automatizacion_porcentaje);

  // Sharing
  const pageUrl = location.href.split('#')[0];
  const text = `Riesgo de automatización para “${item.ocupacion_es}”: ${Math.round(item.riesgo_automatizacion_porcentaje)}%`;
  const encUrl = encodeURIComponent(pageUrl);
  const encText = encodeURIComponent(text);

  document.getElementById('shareWhats').href = `https://api.whatsapp.com/send?text=${encText}%20${encUrl}`;
  document.getElementById('shareTelegram').href = `https://t.me/share/url?url=${encUrl}&text=${encText}`;
  document.getElementById('shareFacebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`;
  document.getElementById('shareX').href = `https://twitter.com/intent/tweet?text=${encText}&url=${encUrl}`;
  document.getElementById('sharePinterest').href = `https://pinterest.com/pin/create/button/?url=${encUrl}&description=${encText}`;

  document.getElementById('btnShareNative').onclick = async ()=>{
    if(navigator.share){ try{ await navigator.share({title:'Riesgo de automatización', text, url:pageUrl}); }catch{} }
    else{ navigator.clipboard?.writeText(`${text} ${pageUrl}`); alert('Enlace copiado'); }
  };
  document.getElementById('shareCopy').onclick = async ()=>{
    try{ await navigator.clipboard.writeText(`${text} ${pageUrl}`); alert('Enlace copiado'); }catch{}
  };
}

async function accionBuscar(){
  const term = document.getElementById('search').value.trim();
  if(!term) return;
  const found = buscar(term);
  if(found) pintarResultado(found);
  else{
    document.getElementById('resultado').classList.remove('hidden');
    document.getElementById('ocupacionTitulo').textContent='No encontramos esa ocupación';
    document.getElementById('explicacion').textContent='Prueba otro sinónimo o escribe el nombre más corto de tu ocupación.';
    setGauge(0);
  }
}

/* ========= Init ========= */
document.addEventListener('DOMContentLoaded', async ()=>{
  document.getElementById('year').textContent=new Date().getFullYear();
  await cargarDatos();
  pintarSugerencias(sugerencias('',10));

  const input=document.getElementById('search');
  input.addEventListener('input', e=>pintarSugerencias(sugerencias(e.target.value,10)));
  document.getElementById('btnBuscar').addEventListener('click', accionBuscar);
  input.addEventListener('change', accionBuscar);
  input.addEventListener('keydown', e=>{if(e.key==='Enter') accionBuscar();});

  const params=new URLSearchParams(location.search);
  const q=params.get('q')||params.get('busqueda'); if(q){ input.value=q; accionBuscar(); }
});

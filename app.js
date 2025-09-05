/* =========================================================
   aimequitaeltrabajo.com — NO-REGEX EDITION
   - Búsqueda sin expresiones regulares (adiós "Invalid regular expression")
   - Datos vía data/base_de_datos.js (window.__DB__) o fallback JSON
   - Sugerencias + gauge canvas + compartir + podcast Dropbox
   ========================================================= */

/* === CONFIG === */
const DATA_JS_GLOBAL = "__DB__";                // la variable que exporta data/base_de_datos.js
const DATA_JS_URL    = "data/base_de_datos.js"; // por si necesitas inyectarlo en caliente
const DATA_JSON_URL  = "data/base_de_datos.json"; // fallback opcional

/* Pega tu enlace compartido de Dropbox del podcast (con ?dl=0/1) */
const DROPBOX_SHARE_URL = "https://www.dropbox.com/s/XXXXXXXXXXXX/podcast.mp3?dl=0";

/* === Utils === */
const $ = s => document.querySelector(s);
function showNotice(msg){ const n=$("#notice"); if(!n) return; if(!msg){ n.classList.add("hidden"); n.textContent=""; return; } n.textContent=msg; n.classList.remove("hidden"); }
function normalize(str){ return (str||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s\/\-\.\,]/g," ").replace(/\s+/g," ").trim(); }
function lev(a,b){ a=normalize(a); b=normalize(b); const m=Array.from({length:a.length+1},(_,i)=>[i]); for(let j=1;j<=b.length;j++)m[0][j]=j; for(let i=1;i<=a.length;i++){ for(let j=1;j<=b.length;j++){ const c=a[i-1]===b[j-1]?0:1; m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+c);} } return m[a.length][b.length]; }
function band(p){ if(p>=80) return {name:"Muy alto", color:"#e53935"}; if(p>=60) return {name:"Alto", color:"#fb8c00"}; if(p>=40) return {name:"Medio", color:"#ffd54f"}; if(p>=20) return {name:"Bajo", color:"#76d275"}; return {name:"Mínimo", color:"#2e7d32"}; }
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function toNumberLike(x){ if (x==null||x==="") return null; if (typeof x==="number"&&isFinite(x)) return Math.round(x); const m=String(x).match(/-?\d+(\.\d+)?/); return m? Math.round(parseFloat(m[0])):null; }
function pick(obj, keys, def=null){ for(const k of keys){ if (Object.prototype.hasOwnProperty.call(obj,k) && obj[k]!=null) return obj[k]; } return def; }

/* === Estado (expuesto para depurar desde consola) === */
window.DB = []; window.TITLES = []; window.BY_TITLE = new Map();

/* === Carga de datos (JS global -> fallback JSON) === */
async function fetchJSONNoCache(url){
  const r = await fetch(url + (url.includes("?")?"&":"?") + "__v=" + Date.now(), {cache:"no-store"});
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const txt = await r.text(); return JSON.parse(txt.replace(/^\uFEFF/,""));
}

function parseArray(rawArray){
  window.DB = []; window.TITLES = []; window.BY_TITLE.clear();

  for(const r of rawArray){
    const titulo = String(pick(r, ["ocupacion_es","titulo","ocupacion","title_es","nombre","profesion"], "")).trim();
    if(!titulo) continue;
    const isco   = pick(r, ["codigo_isco","isco","isco_code"], null);
    const riesgo = toNumberLike(pick(r, ["riesgo_automatizacion_porcentaje","riesgo","porcentaje","probabilidad","score"], null));
    const explicacion = pick(r, ["explicacion","descripcion","nota"], "");
    const f_raw  = pick(r, ["fuentes","sources","source","fuente"], []);
    const s_raw  = pick(r, ["sinonimos","sinónimos","aliases","alias"], []);

    const fuentes = Array.isArray(f_raw) ? f_raw.map(String) : (f_raw ? [String(f_raw)] : []);
    let sinonimos = Array.isArray(s_raw) ? s_raw : (s_raw ? [String(s_raw)] : []);
    if (sinonimos.length===1 && typeof sinonimos[0]==="string"){
      const x=sinonimos[0]; if(x.includes(",")) sinonimos = x.split(",").map(s=>s.trim()).filter(Boolean);
      if(x.includes(";")) sinonimos = x.split(";").map(s=>s.trim()).filter(Boolean);
    }

    window.DB.push({ titulo, isco, riesgo: (riesgo!=null? Math.max(0,Math.min(100,riesgo)) : null), explicacion, fuentes, sinonimos });
  }

  // Índices para búsqueda/sugerencias (sin regex)
  const seen = new Set();
  for(const reg of window.DB){
    const bundle = new Set([reg.titulo, ...reg.sinonimos]);
    for(const t of bundle){
      const key = normalize(String(t)); if(!key) continue;
      const uniq = key+"→"+reg.titulo; if (seen.has(uniq)) continue;
      seen.add(uniq);
      if(!window.BY_TITLE.has(key)) window.BY_TITLE.set(key, reg);
      window.TITLES.push(String(t));
    }
  }
  window.TITLES.sort((a,b)=> a.localeCompare(b,"es"));
}

async function loadData(){
  try{
    // 1) Preferimos que ya esté cargado por <script src="data/base_de_datos.js" defer>
    if (Array.isArray(window[DATA_JS_GLOBAL])) {
      parseArray(window[DATA_JS_GLOBAL]);
      showNotice(`Base cargada (JS): ${DB.length} ocupaciones (${TITLES.length} términos)`);
      return;
    }
    // 2) Intento de inyección en caliente (por si el script no estaba en index.html)
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script"); s.src=DATA_JS_URL; s.defer=true;
      s.onload=()=>resolve(); s.onerror=()=>reject(new Error("No se pudo cargar data/base_de_datos.js"));
      document.head.appendChild(s);
    });
    if (Array.isArray(window[DATA_JS_GLOBAL])) {
      parseArray(window[DATA_JS_GLOBAL]);
      showNotice(`Base cargada (JS): ${DB.length} ocupaciones (${TITLES.length} términos)`);
      return;
    }
  }catch(_){ /* seguimos */ }

  // 3) Fallback JSON
  const data = await fetchJSONNoCache(DATA_JSON_URL);
  const arr  = Array.isArray(data) ? data : (data.ocupaciones||data.data||data.items||data.results||data.records||[]);
  if(!Array.isArray(arr)) throw new Error("El JSON debe ser un array o contener un array en ocupaciones/data/items…");
  parseArray(arr);
  showNotice(`Base cargada (JSON): ${DB.length} ocupaciones (${TITLES.length} términos)`);
}

/* === Búsqueda (sin regex) === */
function computeSuggestions(q, limit=8){
  const nq=normalize(q); if(!nq) return [];
  return window.TITLES
    .map(t=>{ const nt=normalize(t); let s=0; if(nt.startsWith(nq)) s+=70; else if(nt.includes(nq)) s+=50; s+=Math.max(0,40-lev(nt,nq)); return {t,score:s}; })
    .sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.t);
}
function showSuggestions(q){
  const cont=$("#sugerencias-panel"), ul=$("#lista-sugerencias");
  const items=computeSuggestions(q,8);
  if(!items.length){ cont.classList.add("hidden"); ul.innerHTML=""; return; }
  ul.innerHTML = items.map(t=>`<li><button class="linklike" data-job="${escapeHtml(t)}">${escapeHtml(t)}</button></li>`).join("");
  cont.classList.remove("hidden");
}
function hideSuggestions(){ $("#sugerencias-panel")?.classList.add("hidden"); const ul=$("#lista-sugerencias"); if(ul) ul.innerHTML=""; }

function bestMatch(q){
  if(!q) return null;
  const nq=normalize(q);

  // 1) exacto por normalización
  const ex = window.BY_TITLE.get(nq);
  if (ex) return { reg: ex, exact:true };

  // 2) si hay exactamente un título que lo incluye
  const incl = window.TITLES.filter(t => normalize(t).includes(nq));
  if (incl.length === 1) return { reg: window.BY_TITLE.get(normalize(incl[0])), exact:false };

  // 3) distancia mínima
  let best=null, bestD=Infinity, bestTitle=null;
  for(const t of window.TITLES){
    const d=lev(t,q);
    if(d<bestD){ bestD=d; best=window.BY_TITLE.get(normalize(t)); bestTitle=t; }
  }
  return best ? { reg:best, exact:false, suggested:bestTitle } : null;
}

/* === Render === */
function renderSources(arr){ if(!arr||!arr.length) return "<p class='fuente'>—</p>"; return `<ul>${arr.map(x=>`<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`; }

function showResult(reg, {query, exact}){
  $("#resultado")?.classList.remove("hidden");
  $("#res-titulo").textContent = reg.titulo;

  const nota=$("#res-nota");
  if(!exact && query){ nota.textContent=`No encontramos “${query}”. Mostramos la opción más cercana: “${reg.titulo}”.`; nota.classList.remove("hidden"); }
  else { nota.classList.add("hidden"); nota.textContent=""; }

  const pct = reg.riesgo!=null ? reg.riesgo : null;
  const b   = band(pct ?? 0);
  $("#res-porcentaje").textContent = (pct==null? "—" : pct) + "%";
  const pill=$("#res-nivel"); pill.textContent=b.name; pill.style.background="#1f2937"; pill.style.borderColor="rgba(255,255,255,.08)";

  drawGaugeCanvas(pct ?? 0);

  $("#res-explicacion").textContent = reg.explicacion || "—";
  $("#res-fuentes").innerHTML = renderSources(reg.fuentes);
  $("#res-codigos").textContent = reg.isco ? `ISCO: ${reg.isco}` : "";

  updateShare(reg);
}

/* === Gauge en canvas (semicírculo con bandas + aguja corta) === */
function drawGaugeCanvas(pct){
  const canvas = document.getElementById("gaugeCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const cx=W/2, cy=H-24;
  const R=Math.min(W/2-30, H-40);
  const thick=24, start=Math.PI;

  const segs=[{to:20,color:"#2e7d32"},{to:40,color:"#76d275"},{to:60,color:"#ffd54f"},{to:80,color:"#fb8c00"},{to:100,color:"#e53935"}];
  let prev=0;
  for(const s of segs){
    const a0=start-(prev/100)*Math.PI, a1=start-(s.to/100)*Math.PI;
    ctx.beginPath(); ctx.arc(cx,cy,R,a0,a1,true);
    ctx.lineWidth=thick; ctx.lineCap="round"; ctx.strokeStyle=s.color; ctx.stroke();
    prev=s.to;
  }
  // ticks 10%
  ctx.lineWidth=2; ctx.strokeStyle="rgba(230,231,234,.6)";
  for(let i=0;i<=10;i++){
    const a=start-(i/10)*Math.PI, r1=R-thick-6, r2=r1+10;
    const x1=cx+r1*Math.cos(a), y1=cy+r1*Math.sin(a);
    const x2=cx+r2*Math.cos(a), y2=cy+r2*Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
  // aguja
  const value=Math.max(0,Math.min(100, Number(pct)||0));
  const ang=start-(value/100)*Math.PI;
  ctx.save(); ctx.translate(cx,cy); ctx.shadowColor="rgba(0,0,0,.5)"; ctx.shadowBlur=6;
  ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fillStyle="#e6e7ea"; ctx.fill();
  ctx.beginPath(); ctx.lineCap="round"; ctx.lineWidth=4; ctx.strokeStyle="#e6e7ea";
  ctx.moveTo(0,0); ctx.lineTo(R - thick - 4, 0); ctx.rotate(-ang); ctx.stroke();
  ctx.restore();
  ctx.fillStyle="rgba(230,231,234,.75)"; ctx.font="12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign="left";  ctx.fillText("0%", 20, cy-4);
  ctx.textAlign="right"; ctx.fillText("100%", W-20, cy-4);
}

/* === Compartir === */
function updateShare(job){
  const title=`Riesgo de automatización: ${job.titulo}`;
  const text =`${job.titulo}: ${job.riesgo ?? "—"}% • ${job.explicacion || ""}`;
  const url  = withQuery(location.href,"q",job.titulo);
  document.querySelectorAll(".share-btn").forEach(btn=>{
    btn.onclick = async ()=> {
      const t=btn.getAttribute("data-share");
      try{
        if(t==="native" && navigator.share){ await navigator.share({title,text,url}); return; }
        if(t==="whatsapp"){ window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,"_blank","noopener"); return; }
        if(t==="twitter"){ window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,"_blank","noopener"); return; }
        if(t==="facebook"){ window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,"_blank","noopener"); return; }
        if(t==="linkedin"){ window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,"_blank","noopener"); return; }
        if(t==="copy"){ await navigator.clipboard.writeText(url); }
      }catch(_){}
    };
  });
}
function withQuery(href,key,val){ const u=new URL(href); u.searchParams.set(key,val); return u.toString(); }

/* === Podcast (Dropbox) === */
function toDropboxRaw(u){
  try{
    const url = new URL(u);
    if (url.hostname.endsWith("dropbox.com")){
      url.searchParams.set("raw","1"); url.searchParams.delete("dl");
      return url.toString();
    }
    return u;
  }catch{return u;}
}
function initPodcast(){
  const audio=$("#podcast-audio"), link=$("#podcast-link");
  if(!audio || !DROPBOX_SHARE_URL) return;
  const raw = toDropboxRaw(DROPBOX_SHARE_URL);
  audio.src = raw;            // reproducción directa
  if(link) link.href = raw;   // enlace de respaldo
}

/* === UI === */
function bindUI(){
  $("#year") && ($("#year").textContent = new Date().getFullYear());

  $("#search-form")?.addEventListener("submit", e=>{
    e.preventDefault();
    const q=$("#q")?.value.trim(); if(!q) return;
    const m=bestMatch(q);
    if(!m){ showNotice(`No encontramos “${q}”. Prueba otra palabra o elige una sugerencia.`); showSuggestions(q); return; }
    showNotice("");
    showResult(m.reg,{query:q, exact:m.exact});
    hideSuggestions();
    history.replaceState(null,"",withQuery(location.href,"q",m.reg.titulo));
  });

  $("#q")?.addEventListener("input", e=>{
    const v=e.target.value.trim();
    if(v.length>=2) showSuggestions(v); else hideSuggestions();
  });

  $("#lista-sugerencias")?.addEventListener("click", e=>{
    const btn=e.target.closest("button[data-job]"); if(!btn) return;
    const v=btn.getAttribute("data-job");
    $("#q").value=v;
    const m=bestMatch(v);
    if(m){ showResult(m.reg,{query:v, exact:m.exact}); hideSuggestions(); history.replaceState(null,"",withQuery(location.href,"q",m.reg.titulo)); }
  });
}

function handleUrlOnLoad(){
  const q=new URL(location.href).searchParams.get("q");
  if(q){ $("#q").value=q; const m=bestMatch(q); if(m){ showResult(m.reg,{query:q,exact:m.exact}); } }
}

/* === Init === */
document.addEventListener("DOMContentLoaded", async ()=>{
  bindUI();
  await loadData();
  initPodcast();
  handleUrlOnLoad();
});

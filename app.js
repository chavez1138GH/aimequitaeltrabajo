/* =========================================================
   aimequitaeltrabajo.com — "modo seguro"
   Dataset único: /data/base_de_datos.json
   - Cache-buster
   - Parser flexible (claves y formatos)
   - Diagnóstico visible y tolerancia a filas malas
   - Canvas gauge (semicírculo con bandas)
   ========================================================= */

const DATA_FILE = "data/base_de_datos.json";
const ADSENSE = { CLIENT:"ca-pub-XXXXXXXXXXXXXXXX", SLOT_TOP:"1111111111", SLOT_INCONTENT:"2222222222", SLOT_SIDEBAR:"3333333333", SLOT_FOOTER:"4444444444" };

const $ = s => document.querySelector(s);
function showNotice(msg){ const n=$("#notice"); if(!n) return; if(!msg){ n.classList.add("hidden"); n.textContent=""; return; } n.textContent=msg; n.classList.remove("hidden"); }
function normalize(str){ return (str||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s\/\-\.\,]/g," ").replace(/\s+/g," ").trim(); }
function lev(a,b){ a=normalize(a); b=normalize(b); const m=Array.from({length:a.length+1},(_,i)=>[i]); for(let j=1;j<=b.length;j++)m[0][j]=j; for(let i=1;i<=a.length;i++){ for(let j=1;j<=b.length;j++){ const c=a[i-1]===b[j-1]?0:1; m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+c);} } return m[a.length][b.length]; }
function band(p){ if(p>=80) return {name:"Muy alto", color:"#e53935"}; if(p>=60) return {name:"Alto", color:"#fb8c00"}; if(p>=40) return {name:"Medio", color:"#ffd54f"}; if(p>=20) return {name:"Bajo", color:"#76d275"}; return {name:"Mínimo", color:"#2e7d32"}; }
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function toNumberLike(x){
  if (x==null || x==="") return null;
  if (typeof x === "number" && isFinite(x)) return Math.round(x);
  const m = String(x).match(/-?\d+(\.\d+)?/); // acepta "60%", "60.5", "aprox 60"
  return m ? Math.round(parseFloat(m[0])) : null;
}
function pick(obj, keys, def=null){ for(const k of keys){ if (Object.prototype.hasOwnProperty.call(obj,k) && obj[k]!=null) return obj[k]; } return def; }

let DB = [];
let TITLES = [];
let BY_TITLE = new Map();
let DIAG = { skipped:0, reasons:[] };

async function fetchJSONNoCache(url){
  const res = await fetch(url + (url.includes("?")?"&":"?") + "v=" + Date.now(), { cache:"no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} al cargar ${url}`);
  const text = await res.text();
  try {
    // quita BOM si lo hubiera
    const clean = text.replace(/^\uFEFF/,"");
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON inválido:", e);
    throw new Error("El archivo no es un JSON válido. Revisa comas finales, comillas y llaves.");
  }
}

function unwrapArrayMaybe(data){
  if (Array.isArray(data)) return data;
  // soporta estructuras envueltas
  const keys = ["ocupaciones","data","items","results","records"];
  for (const k of keys){ if (Array.isArray(data?.[k])) return data[k]; }
  throw new Error("El JSON debe ser un array o contener un array en 'ocupaciones' / 'data' / 'items'.");
}

function parseArray(rawArray){
  DB = [];
  BY_TITLE.clear(); TITLES = []; DIAG = { skipped:0, reasons:[] };

  for (let i=0; i<rawArray.length; i++){
    const r = rawArray[i] || {};
    const titulo = String(pick(r, ["ocupacion_es","titulo","ocupacion","title_es","nombre","profesion"], "")).trim();
    const isco   = pick(r, ["codigo_isco","isco","isco_code"], null);
    const riesgo = toNumberLike(pick(r, ["riesgo_automatizacion_porcentaje","riesgo","porcentaje","probabilidad","score"], null));
    const explicacion = pick(r, ["explicacion","descripcion","nota"], "");
    const f_raw  = pick(r, ["fuentes","sources","source","fuente"], []);
    const sin_raw = pick(r, ["sinonimos","sinónimos","aliases","alias"], []);

    // normaliza arrays flexibles
    const fuentes = Array.isArray(f_raw) ? f_raw.map(x=>String(x)) : (f_raw ? [String(f_raw)] : []);
    let sinonimos = Array.isArray(sin_raw) ? sin_raw : (sin_raw ? [String(sin_raw)] : []);
    // si viene una sola cadena con comas o punto y coma, dividimos
    if (sinonimos.length === 1 && typeof sinonimos[0] === "string" && sinonimos[0].includes(",")){
      sinonimos = sinonimos[0].split(",").map(s=>s.trim()).filter(Boolean);
    } else if (sinonimos.length === 1 && typeof sinonimos[0] === "string" && sinonimos[0].includes(";")){
      sinonimos = sinonimos[0].split(";").map(s=>s.trim()).filter(Boolean);
    }

    if (!titulo){
      DIAG.skipped++; DIAG.reasons.push(`Fila ${i+1}: sin título válido`);
      continue;
    }

    DB.push({ titulo, isco, riesgo: (riesgo!=null? Math.max(0, Math.min(100, riesgo)) : null), explicacion, fuentes, sinonimos });
  }

  // índices para búsqueda/sugerencias
  const setPairs = new Set();
  for (const reg of DB){
    const bundle = new Set([reg.titulo, ...reg.sinonimos]);
    for (const t of bundle){
      const key = normalize(String(t));
      if(!key) continue;
      // evita que diferentes registros con el mismo sinónimo se pisen
      const uniq = key + "→" + reg.titulo;
      if (setPairs.has(uniq)) continue;
      setPairs.add(uniq);
      if (!BY_TITLE.has(key)) BY_TITLE.set(key, reg);
      TITLES.push(String(t));
    }
  }
  TITLES.sort((a,b)=> a.localeCompare(b,"es"));
}

async function initData(){
  $("#loader")?.classList.remove("hidden");
  try{
    const parsed = await fetchJSONNoCache(DATA_FILE);
    const arr = unwrapArrayMaybe(parsed);
    parseArray(arr);
    const msg = `Base cargada: ${DB.length} ocupaciones • ${TITLES.length} términos (incl. sinónimos)` + (DIAG.skipped? ` • Omitidas: ${DIAG.skipped}` : "");
    showNotice(msg);
    if (DIAG.skipped) console.warn("Registros omitidos:", DIAG.reasons.slice(0,20));
  }catch(e){
    console.error(e);
    showNotice(e.message + " — Abre /data/base_de_datos.json en el navegador para verificar.");
  }finally{
    $("#loader")?.classList.add("hidden");
  }
}

function computeSuggestions(q, limit=8){
  const nq = normalize(q);
  if(!nq) return [];
  return TITLES
    .map(t => {
      const nt = normalize(t);
      let score = 0;
      if (nt.startsWith(nq)) score += 70;
      else if (nt.includes(nq)) score += 50;
      score += Math.max(0, 40 - lev(nt, nq));
      return {t, score};
    })
    .sort((a,b)=>b.score-a.score)
    .slice(0, limit)
    .map(x=>x.t);
}
function showSuggestions(q){
  const cont=$("#sugerencias-panel"), ul=$("#lista-sugerencias");
  const items = computeSuggestions(q, 8);
  if(!items.length){ cont.classList.add("hidden"); ul.innerHTML=""; return; }
  ul.innerHTML = items.map(t => `<li><button class="linklike" data-job="${escapeHtml(t)}">${escapeHtml(t)}</button></li>`).join("");
  cont.classList.remove("hidden");
}
function hideSuggestions(){ $("#sugerencias-panel")?.classList.add("hidden"); const ul=$("#lista-sugerencias"); if(ul) ul.innerHTML=""; }

function bestMatch(q){
  if(!q) return null;
  const nq = normalize(q);

  const ex = BY_TITLE.get(nq);
  if (ex) return { reg: ex, exact: true };

  const incl = TITLES.filter(t => normalize(t).includes(nq));
  if(incl.length === 1) return { reg: BY_TITLE.get(normalize(incl[0])), exact: false };

  let best = null, bestD = Infinity, bestTitle=null;
  for(const t of TITLES){
    const d = lev(t, q);
    if (d < bestD){ bestD = d; best = BY_TITLE.get(normalize(t)); bestTitle = t; }
  }
  return best ? { reg: best, exact: false, suggested: bestTitle } : null;
}

function renderSources(arr){
  if(!arr || !arr.length) return "<p class='fuente'>—</p>";
  const rows = arr.map(x => `<li>${escapeHtml(String(x))}</li>`).join("");
  return `<ul>${rows}</ul>`;
}

function showResult(reg, {query, exact}){
  $("#resultado")?.classList.remove("hidden");
  const titleEl = $("#res-titulo"); if(titleEl) titleEl.textContent = reg.titulo;

  const nota = $("#res-nota");
  if(!exact && query){
    if(nota){ nota.textContent = `No encontramos “${query}”. Mostramos la opción más cercana: “${reg.titulo}”. Puedes elegir otra profesión similar.`; nota.classList.remove("hidden"); }
  } else {
    if(nota){ nota.classList.add("hidden"); nota.textContent = ""; }
  }

  const pct = reg.riesgo!=null ? reg.riesgo : null;
  const b = band(pct ?? 0);
  const pctEl=$("#res-porcentaje"); if(pctEl) pctEl.textContent = (pct==null? "—" : pct) + "%";
  const pill=$("#res-nivel"); if(pill){ pill.textContent = b.name; pill.style.background="#1f2937"; pill.style.borderColor="rgba(255,255,255,.08)"; }

  drawGaugeCanvas(pct ?? 0);

  const exp=$("#res-explicacion"); if(exp) exp.textContent = reg.explicacion || "—";
  const f=$("#res-fuentes"); if(f) f.innerHTML = renderSources(reg.fuentes);
  const cod=$("#res-codigos"); if(cod) cod.textContent = reg.isco ? `ISCO: ${reg.isco}` : "";

  updateShare(reg);
}

/* === Canvas gauge: semicírculo con bandas + ticks + marcación === */
function drawGaugeCanvas(pct){
  const canvas = document.getElementById("gaugeCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const cx = W/2;
  const cy = H - 24;
  const R  = Math.min(W/2 - 30, H - 40);
  const thick = 24;
  const start = Math.PI, end = 0;

  const segments = [
    {to: 20, color:"#2e7d32"},
    {to: 40, color:"#76d275"},
    {to: 60, color:"#ffd54f"},
    {to: 80, color:"#fb8c00"},
    {to:100, color:"#e53935"}
  ];
  let prev = 0;
  for(const s of segments){
    const a0 = start - (prev/100)*Math.PI;
    const a1 = start - (s.to/100)*Math.PI;
    ctx.beginPath();
    ctx.arc(cx,cy,R,a0,a1,true);
    ctx.lineWidth = thick;
    ctx.lineCap = "round";
    ctx.strokeStyle = s.color;
    ctx.stroke();
    prev = s.to;
  }

  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(230,231,234,.6)";
  for(let i=0;i<=10;i++){
    const a = start - (i/10)*Math.PI;
    const r1 = R - thick - 6, r2 = r1 + 10;
    const x1 = cx + r1*Math.cos(a), y1 = cy + r1*Math.sin(a);
    const x2 = cx + r2*Math.cos(a), y2 = cy + r2*Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }

  const value = Math.max(0, Math.min(100, toNumberLike(pct)||0));
  const ang = start - (value/100)*Math.PI;

  ctx.save();
  ctx.translate(cx,cy);
  ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 6;
  // centro
  ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fillStyle="#e6e7ea"; ctx.fill();
  // aguja corta
  ctx.beginPath(); ctx.lineCap="round"; ctx.lineWidth=4; ctx.strokeStyle="#e6e7ea";
  ctx.moveTo(0,0); ctx.lineTo(R - thick - 4, 0);
  ctx.rotate(-ang); ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(230,231,234,.75)";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "left";  ctx.fillText("0%", 20, cy-4);
  ctx.textAlign = "right"; ctx.fillText("100%", W-20, cy-4);
}

function updateShare(job){
  const title = `Riesgo de automatización: ${job.titulo}`;
  const text  = `${job.titulo}: ${job.riesgo ?? "—"}% • ${job.explicacion || ""}`;
  const url   = withQuery(location.href, "q", job.titulo);

  document.querySelectorAll(".share-btn").forEach(btn=>{
    btn.onclick = async () => {
      const t = btn.getAttribute("data-share");
      try{
        if(t==="native" && navigator.share){ await navigator.share({title, text, url}); setShareStatus("Compartido."); return; }
        if(t==="whatsapp"){ openShare(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`); return; }
        if(t==="twitter"){ openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`); return; }
        if(t==="facebook"){ openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`); return; }
        if(t==="linkedin"){ openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`); return; }
        if(t==="copy"){ await navigator.clipboard.writeText(url); setShareStatus("Enlace copiado."); return; }
        if(navigator.share){ await navigator.share({title, text, url}); setShareStatus("Compartido."); }
      }catch(e){ setShareStatus("No se pudo compartir. Intenta de nuevo."); }
    };
  });
}
function setShareStatus(msg){ const el=$("#share-status"); if(!el) return; el.textContent=msg||""; if(msg) setTimeout(()=> el.textContent="", 3000); }
function openShare(u){ window.open(u,"_blank","noopener,noreferrer,width=560,height=640"); }
function withQuery(href,key,val){ const u=new URL(href); u.searchParams.set(key,val); return u.toString(); }

function bindUI(){
  const y=$("#year"); if(y) y.textContent = new Date().getFullYear();

  $("#search-form")?.addEventListener("submit", e=>{
    e.preventDefault();
    const q = $("#q")?.value.trim();
    if(!q) return;
    const m = bestMatch(q);
    if(!m){ showNotice(`No encontramos “${q}”. Prueba otra palabra o elige una sugerencia.`); showSuggestions(q); return; }
    showNotice("");
    showResult(m.reg, {query:q, exact:m.exact});
    hideSuggestions();
    history.replaceState(null,"",withQuery(location.href,"q",m.reg.titulo));
  });

  $("#q")?.addEventListener("input", e=>{
    const v = e.target.value.trim();
    if(v.length>=2) showSuggestions(v); else hideSuggestions();
  });

  $("#lista-sugerencias")?.addEventListener("click", e=>{
    const btn = e.target.closest("button[data-job]");
    if(!btn) return;
    const v = btn.getAttribute("data-job");
    const q = $("#q"); if(q) q.value = v;
    const m = bestMatch(v);
    if(m){ showResult(m.reg, {query:v, exact:m.exact}); hideSuggestions(); history.replaceState(null,"",withQuery(location.href,"q",m.reg.titulo)); }
  });
}

function handleUrlOnLoad(){
  const url = new URL(location.href);
  const q = url.searchParams.get("q");
  if(q){ const input=$("#q"); if(input) input.value=q; const m=bestMatch(q); if(m){ showResult(m.reg, {query:q, exact:m.exact}); } }
}

document.addEventListener("DOMContentLoaded", async ()=>{
  bindUI();
  await initData();
  handleUrlOnLoad();
});

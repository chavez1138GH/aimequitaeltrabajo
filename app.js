/* =========================================================
   aimequitaeltrabajo.com
   Versión: dataset único en /data/base_de_datos.json + gráfico canvas
   ========================================================= */

// ==== Config ====
const DATA_FILE = "data/base_de_datos.json"; // TU archivo
const ADSENSE = {
  CLIENT: "ca-pub-XXXXXXXXXXXXXXXX",
  SLOT_TOP: "1111111111",
  SLOT_INCONTENT: "2222222222",
  SLOT_SIDEBAR: "3333333333",
  SLOT_FOOTER: "4444444444"
};

// ==== Utils ====
const $ = s => document.querySelector(s);
function showNotice(msg){ const n=$("#notice"); if(!n) return; if(!msg){ n.classList.add("hidden"); n.textContent=""; return;} n.textContent=msg; n.classList.remove("hidden"); }
function normalize(str){ return (str || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s\/\-\.\,]/g," ").replace(/\s+/g," ").trim(); }
function lev(a,b){ a=normalize(a); b=normalize(b); const m=Array.from({length:a.length+1},(_,i)=>[i]); for(let j=1;j<=b.length;j++)m[0][j]=j; for(let i=1;i<=a.length;i++){ for(let j=1;j<=b.length;j++){ const c=a[i-1]===b[j-1]?0:1; m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+c);} } return m[a.length][b.length]; }
function band(p){ if(p>=80) return {name:"Muy alto", color:"#e53935"}; if(p>=60) return {name:"Alto", color:"#fb8c00"}; if(p>=40) return {name:"Medio", color:"#ffd54f"}; if(p>=20) return {name:"Bajo", color:"#76d275"}; return {name:"Mínimo", color:"#2e7d32"}; }
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// ==== Estado ====
let DB = [];             // registros normalizados
let TITLES = [];         // lista de strings (títulos + sinónimos) para datalist
let BY_TITLE = new Map(); // mapa de title->registro (para sinónimos también)

// ==== Carga ====
async function loadJSON(url){
  const res = await fetch(url, {cache:"no-store"});
  if(!res.ok) throw new Error("No se pudo cargar " + url);
  return res.json();
}

function buildDB(raw){
  DB = (raw||[]).map(r => ({
    titulo: r.ocupacion_es,
    isco: r.codigo_isco || null,
    riesgo: Number(r.riesgo_automatizacion_porcentaje ?? null),
    explicacion: r.explicacion || "",
    fuentes: (r.fuentes||[]).map(f => String(f)),
    sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos : []
  }));

  // Índices: título + sinónimos apuntan al mismo registro
  BY_TITLE.clear();
  TITLES = [];
  for(const reg of DB){
    const all = new Set([reg.titulo, ...reg.sinonimos]);
    for(const t of all){
      BY_TITLE.set(normalize(t), reg);
      TITLES.push(t);
    }
  }
  TITLES.sort((a,b)=> a.localeCompare(b,"es"));
}

function fillDatalist(){
  const dl = $("#sugerencias-datalist");
  dl.innerHTML = TITLES.slice(0, 1500).map(t => `<option value="${escapeHtml(t)}"></option>`).join("");
}

async function initData(){
  $("#loader").classList.remove("hidden");
  try{
    const raw = await loadJSON(DATA_FILE);
    buildDB(raw);
    fillDatalist();
    showNotice(""); // ok
  }catch(e){
    console.error(e);
    showNotice("No se pudo cargar /data/base_de_datos.json. Verifica el nombre y la ruta.");
  }finally{
    $("#loader").classList.add("hidden");
  }
}

// ==== Búsqueda ====
function bestMatch(q){
  if(!q) return null;
  const nq = normalize(q);

  // 1) exacto por título o sinónimo
  const ex = BY_TITLE.get(nq);
  if (ex) return { reg: ex, exact: true };

  // 2) único por inclusión
  const incl = TITLES.filter(t => normalize(t).includes(nq));
  if(incl.length === 1) return { reg: BY_TITLE.get(normalize(incl[0])), exact: false };

  // 3) por distancia
  let best = null, bestD = Infinity, bestTitle=null;
  for(const t of TITLES){
    const d = lev(t, q);
    if (d < bestD){ bestD = d; best = BY_TITLE.get(normalize(t)); bestTitle = t; }
  }
  return best ? { reg: best, exact: false, suggested: bestTitle } : null;
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
    .sort((a,b)=>b.score-a.score).slice(0, limit).map(x=>x.t);
}

function showSuggestions(q){
  const cont=$("#sugerencias-panel"), ul=$("#lista-sugerencias");
  const items = computeSuggestions(q, 8);
  if(!items.length){ cont.classList.add("hidden"); ul.innerHTML=""; return; }
  ul.innerHTML = items.map(t => `<li><button class="linklike" data-job="${escapeHtml(t)}">${escapeHtml(t)}</button></li>`).join("");
  cont.classList.remove("hidden");
}
function hideSuggestions(){ $("#sugerencias-panel").classList.add("hidden"); $("#lista-sugerencias").innerHTML=""; }

// ==== Render resultado ====
function showResult(reg, {query, exact}){
  $("#resultado").classList.remove("hidden");
  $("#res-titulo").textContent = reg.titulo;

  // Nota si fue aproximación
  if(!exact && query){
    $("#res-nota").textContent = `No encontramos “${query}”. Mostramos la opción más cercana: “${reg.titulo}”. Puedes elegir otra profesión similar.`;
    $("#res-nota").classList.remove("hidden");
  }else{
    $("#res-nota").classList.add("hidden");
    $("#res-nota").textContent = "";
  }

  // Número + nivel
  const pct = Number(reg.riesgo ?? 0);
  const b = band(pct);
  $("#res-porcentaje").textContent = `${isFinite(pct)? pct : "—"}%`;
  const pill = $("#res-nivel");
  pill.textContent = b.name;
  pill.style.background = "#1f2937";
  pill.style.borderColor = "rgba(255,255,255,.08)";

  drawGaugeCanvas(pct); // 🎯 gráfico nuevo

  // Explicación y fuentes
  $("#res-explicacion").textContent = reg.explicacion || "—";
  $("#res-fuentes").innerHTML = renderSources(reg.fuentes);
  $("#res-codigos").textContent = reg.isco ? `ISCO: ${reg.isco}` : "";
  updateShare(reg);
}

function renderSources(arr){
  if(!arr || !arr.length) return "<p class='fuente'>—</p>";
  const rows = arr.map(x => `<li>${escapeHtml(String(x))}</li>`).join("");
  return `<ul>${rows}</ul>`;
}

// ==== NUEVO GRÁFICO: Canvas semicircular con bandas + aguja corta ====
function drawGaugeCanvas(pct){
  const canvas = document.getElementById("gaugeCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  // Clear
  ctx.clearRect(0,0,W,H);

  // Geometría
  const cx = W/2;
  const cy = H - 24;           // centro cerca del borde inferior
  const R  = Math.min(W/2 - 30, H - 40); // radio
  const thick = 24;             // grosor de banda
  const start = Math.PI;        // 0%  -> 180°
  const end   = 0;              // 100% ->   0°

  // Bandas (5 tramos iguales de 0-100)
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

  // Ticks cada 10%
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(230,231,234,.6)";
  for(let i=0;i<=10;i++){
    const a = start - (i/10)*Math.PI;
    const r1 = R - thick - 6, r2 = r1 + 10;
    const x1 = cx + r1*Math.cos(a), y1 = cy + r1*Math.sin(a);
    const x2 = cx + r2*Math.cos(a), y2 = cy + r2*Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }

  // Aguja corta (marca)
  const value = Math.max(0, Math.min(100, Number(pct)||0));
  const ang = start - (value/100)*Math.PI; // map 0..100 -> π..0
  const rNeed = R - thick/2;
  ctx.save();
  ctx.translate(cx,cy);
  // sombra suave
  ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 6;
  // círculo en el extremo
  ctx.beginPath();
  ctx.arc(rNeed*Math.cos(ang - Math.PI), rNeed*Math.sin(ang - Math.PI), 8, 0, Math.PI*2);
  ctx.fillStyle = "#e6e7ea"; ctx.fill();
  // centro
  ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fillStyle="#e6e7ea"; ctx.fill();
  // línea de aguja
  ctx.beginPath();
  ctx.lineCap="round"; ctx.lineWidth=4; ctx.strokeStyle="#e6e7ea";
  ctx.moveTo(0,0);
  ctx.lineTo(R - thick - 4, 0); // dibujamos a 0 y luego rotamos
  ctx.rotate(-ang); // giramos al ángulo correcto
  ctx.stroke();
  ctx.restore();

  // Texto min/max
  ctx.fillStyle = "rgba(230,231,234,.75)";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "left";  ctx.fillText("0%", 20, cy-4);
  ctx.textAlign = "right"; ctx.fillText("100%", W-20, cy-4);
}

// ==== Compartir ====
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
function setShareStatus(msg){ const el=$("#share-status"); el.textContent=msg||""; if(msg) setTimeout(()=> el.textContent="", 3000); }
function openShare(u){ window.open(u,"_blank","noopener,noreferrer,width=560,height=640"); }
function withQuery(href,key,val){ const u=new URL(href); u.searchParams.set(key,val); return u.toString(); }

// ==== Eventos ====
function bindUI(){
  $("#year").textContent = new Date().getFullYear();

  $("#search-form").addEventListener("submit", e=>{
    e.preventDefault();
    const q = $("#q").value.trim();
    if(!q) return;
    const m = bestMatch(q);
    if(!m){ showNotice(`No encontramos “${q}”. Prueba otra palabra o elige una sugerencia.`); showSuggestions(q); return; }
    showNotice("");
    showResult(m.reg, {query:q, exact:m.exact});
    hideSuggestions();
    history.replaceState(null,"",withQuery(location.href,"q",m.reg.titulo));
  });

  $("#q").addEventListener("input", e=>{
    const v = e.target.value.trim();
    if(v.length>=2) showSuggestions(v); else hideSuggestions();
  });

  $("#lista-sugerencias").addEventListener("click", e=>{
    const btn = e.target.closest("button[data-job]");
    if(!btn) return;
    const v = btn.getAttribute("data-job");
    $("#q").value = v;
    const m = bestMatch(v);
    if(m){ showResult(m.reg, {query:v, exact:m.exact}); hideSuggestions(); history.replaceState(null,"",withQuery(location.href,"q",m.reg.titulo)); }
  });
}

function handleUrlOnLoad(){
  const url = new URL(location.href);
  const q = url.searchParams.get("q");
  if(q){ $("#q").value = q; const m = bestMatch(q); if(m){ showResult(m.reg, {query:q, exact:m.exact}); } }
}

// ==== Init ====
document.addEventListener("DOMContentLoaded", async ()=>{
  bindUI();
  await initData();
  handleUrlOnLoad();
});

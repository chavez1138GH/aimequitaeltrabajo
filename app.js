/* =========================================================
   aimequitaeltrabajo.com — Multi-fuente + sugerencias en vivo
   Gauge (velocímetro) + compartir + sin enlaces en sidebar
   100% estático — /data/*.json
   ========================================================= */

/** CONFIG ADSENSE **/
const ADSENSE = {
  CLIENT: "ca-pub-XXXXXXXXXXXXXXXX",
  SLOT_TOP: "1111111111",
  SLOT_INCONTENT: "2222222222",
  SLOT_SIDEBAR: "3333333333",
  SLOT_FOOTER: "4444444444"
};

/* ---- Fuentes y pesos ---- */
const SOURCES = [
  { id: "oxford",  name: "Oxford/Frey-Osborne (adaptado)", weight: 0.45, file: "data/oxford.json" },
  { id: "bls_onet",name: "BLS/O*NET (adaptado)",           weight: 0.35, file: "data/bls_onet.json" },
  { id: "custom",  name: "Curación LATAM",                 weight: 0.20, file: "data/custom_latam.json" }
];

const SYNONYMS_FILE = "data/synonyms.json";

/* ---------- Utilidades ---------- */
const $ = sel => document.querySelector(sel);

function normalize(str){
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s\/\-\.\,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein
function lev(a, b){
  a = normalize(a); b = normalize(b);
  const m = Array.from({length: a.length+1}, (_,i)=>[i]);
  for(let j=1;j<=b.length;j++){ m[0][j]=j; }
  for(let i=1;i<=a.length;i++){
    for(let j=1;j<=b.length;j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      m[i][j] = Math.min(
        m[i-1][j] + 1,
        m[i][j-1] + 1,
        m[i-1][j-1] + cost
      );
    }
  }
  return m[a.length][b.length];
}

function riskLevel(pct){
  if (pct >= 80) return {label:"Muy alto", cls:"danger"};
  if (pct >= 60) return {label:"Alto", cls:"warn"};
  if (pct >= 30) return {label:"Medio", cls:"mid"};
  return {label:"Bajo", cls:"ok"};
}

/* ---------- Carga de datos ---------- */
let DATA = [];           // ocupaciones fusionadas
let RAW_BY_SOURCE = {};  // {sourceId: []}
let SYNONYMS = {};       // { normalizedTitle: [alias...] }

async function loadJSON(url){
  const res = await fetch(url, {cache: "no-store"});
  if (!res.ok) throw new Error("No se pudo cargar: " + url);
  return res.json();
}

async function loadAll(){
  $("#loader").classList.remove("hidden");
  try {
    SYNONYMS = await loadJSON(SYNONYMS_FILE);
  } catch { SYNONYMS = {}; }

  for (const src of SOURCES){
    try {
      RAW_BY_SOURCE[src.id] = await loadJSON(src.file);
    } catch {
      RAW_BY_SOURCE[src.id] = [];
    }
  }

  DATA = mergeSources(RAW_BY_SOURCE);
  fillDatalist(DATA);
  $("#loader").classList.add("hidden");
}

/* ---------- Fusión ---------- */
function mergeSources(rawBySource){
  const all = [];
  for (const src of SOURCES){
    for (const item of (rawBySource[src.id] || [])){
      all.push({ ...item, _src: src.id });
    }
  }

  const groups = new Map();
  function keyFor(item){
    if (item.onet) return "onet:" + item.onet;
    if (item.isco) return "isco:" + item.isco;
    return "t:" + normalize(item.titulo || "");
  }

  for (const it of all){
    let k = keyFor(it);
    if (!k.startsWith("t:")){
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
      continue;
    }
    const base = normalize(it.titulo);
    let foundKey = null;
    for (const [gk, arr] of groups.entries()){
      const first = arr[0];
      const firstTitle = normalize(first.titulo || "");
      const same = (first.onet && it.onet && first.onet === it.onet)
                || (first.isco && it.isco && first.isco === it.isco)
                || (firstTitle === base)
                || areSynonyms(firstTitle, base)
                || lev(firstTitle, base) <= 3;
      if (same){ foundKey = gk; break; }
    }
    if (!foundKey) foundKey = k;
    if (!groups.has(foundKey)) groups.set(foundKey, []);
    groups.get(foundKey).push(it);
  }

  const merged = [];
  for (const arr of groups.values()){
    const title = arr.map(x=>x.titulo).sort((a,b)=> (b?.length||0)-(a?.length||0))[0] || "Ocupación";
    const isco = arr.map(x=>x.isco).find(Boolean) || null;
    const onet = arr.map(x=>x.onet).find(Boolean) || null;
    const categoria = arr.map(x=>x.categoria).find(Boolean) || null;
    const pais = arr.map(x=>x.pais).find(Boolean) || null;

    const fuentes = {};
    for (const src of SOURCES){
      const hit = arr.find(x => x._src === src.id);
      if (hit){
        const riesgo = getNested(hit, ["fuentes", src.id, "riesgo"]) ?? hit.riesgo ?? null;
        const explicacion = getNested(hit, ["fuentes", src.id, "explicacion"]) ?? hit.explicacion ?? "";
        const ref = getNested(hit, ["fuentes", src.id, "ref"]) ?? hit.ref ?? "";
        if (riesgo !== null){
          fuentes[src.id] = { riesgo, explicacion, ref };
        }
      }
    }

    const final = weightedRisk(fuentes);
    const expl = bestExplanation(fuentes) || "Estimación combinada a partir de varias fuentes y descripciones ocupacionales.";
    const aliases = collectAliases(arr);

    merged.push({ titulo: title, isco, onet, categoria, pais, aliases, riesgo: final, explicacion: expl, fuentes });
  }

  return merged.sort((a,b)=> a.titulo.localeCompare(b.titulo, "es"));
}

function areSynonyms(a, b){
  const la = SYNONYMS[a] || [];
  const lb = SYNONYMS[b] || [];
  return la.includes(b) || lb.includes(a);
}
function collectAliases(arr){
  const set = new Set();
  for (const it of arr){ (it.aliases || []).forEach(x=> set.add(x)); }
  return Array.from(set).slice(0, 12);
}
function getNested(obj, pathArr){
  return pathArr.reduce((o,k)=> (o && k in o ? o[k] : undefined), obj);
}
function weightedRisk(fuentes){
  let sum = 0, w = 0;
  for (const src of SOURCES){
    const f = fuentes[src.id];
    if (f && typeof f.riesgo === "number"){
      sum += f.riesgo * src.weight;
      w += src.weight;
    }
  }
  return w === 0 ? null : Math.round(sum / w);
}
function bestExplanation(fuentes){
  const order = ["custom","bls_onet","oxford"];
  for (const id of order){ if (fuentes[id]?.explicacion) return fuentes[id].explicacion; }
  const any = Object.values(fuentes)[0];
  return any?.explicacion || "";
}

/* ---------- UI ---------- */
function fillDatalist(db){
  const dl = $("#sugerencias-datalist");
  dl.innerHTML = db.map(j => `<option value="${j.titulo}"></option>`).join("");
}

function riskPill(pct){
  const lvl = riskLevel(pct ?? 0);
  const pill = $("#res-nivel");
  pill.textContent = pct == null ? "Sin dato" : `${lvl.label}`;
  pill.className = "pill";
  if (lvl.cls === "danger") pill.style.background = "#3b0d0d";
  else if (lvl.cls === "warn") pill.style.background = "#3b2a0d";
  else if (lvl.cls === "mid") pill.style.background = "#1f2a3b";
  else pill.style.background = "#13301c";

  // Semáforo activo
  document.querySelectorAll(".light").forEach(l => l.classList.remove("active"));
  if (pct == null){ /* nada */ }
  else if (pct >= 80) $(".light-red").classList.add("active");
  else if (pct >= 60) $(".light-yellow").classList.add("active");
  else $(".light-green").classList.add("active");
}

function renderSourcesTable(fuentes){
  const rows = SOURCES.map(src=>{
    const f = fuentes[src.id];
    if (!f) return `<tr><td><span class="source-pill">${src.name}</span></td><td>—</td><td>—</td><td>—</td></tr>`;
    return `<tr>
      <td><span class="source-pill">${src.name}</span></td>
      <td>${f.riesgo}%</td>
      <td>${escapeHtml(f.explicacion || "—")}</td>
      <td>${f.ref ? `<a href="${f.ref}" target="_blank" rel="noopener">Referencia</a>` : "—"}</td>
    </tr>`;
  }).join("");
  return `<table class="tabla-fuentes">
    <thead><tr><th>Fuente</th><th>Riesgo</th><th>Explicación (breve)</th><th>Ref</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

/* ---------- Gauge ---------- */
function setGauge(pct){
  // Aguja: -90° (0%) → +90° (100%)
  const clamped = Math.max(0, Math.min(100, pct ?? 0));
  const angle = -90 + (clamped * 1.8);
  const needle = $("#needle");
  const cx = 160, cy = 160, r = 110;
  const rad = angle * Math.PI / 180;
  const x2 = cx + r * Math.cos(rad);
  const y2 = cy + r * Math.sin(rad);
  needle.setAttribute("x2", x2.toFixed(1));
  needle.setAttribute("y2", y2.toFixed(1));
}

/* ---------- Resultado ---------- */
function setNote(text){
  const el = $("#res-nota");
  if (!text){ el.classList.add("hidden"); el.textContent = ""; return; }
  el.textContent = text;
  el.classList.remove("hidden");
}

function showResult(job){
  $("#resultado").classList.remove("hidden");
  $("#res-titulo").textContent = job.titulo;

  const pct = job.riesgo;
  $("#res-porcentaje").textContent = pct == null ? "— %" : `${pct}%`;
  setGauge(pct ?? 0);
  riskPill(pct);

  $("#res-explicacion").textContent = job.explicacion || "—";
  $("#res-fuentes").innerHTML = renderSourcesTable(job.fuentes);
  const ids = [];
  if (job.isco) ids.push(`ISCO: ${job.isco}`);
  if (job.onet) ids.push(`O*NET: ${job.onet}`);
  $("#res-fuente").textContent = ids.join(" · ");

  // Actualiza enlaces de compartir
  updateShare(job);
}

/* ---------- Sugerencias ---------- */
function computeSuggestions(q, limit=8){
  const nq = normalize(q);
  if (!nq) return [];
  return DATA.map(j => {
      const ntitle = normalize(j.titulo);
      let score = 0;
      if (ntitle.startsWith(nq)) score += 70;
      else if (ntitle.includes(nq)) score += 50;
      const d = lev(ntitle, nq);
      score += Math.max(0, 40 - d);
      return { title: j.titulo, score };
    })
    .sort((a,b)=>b.score - a.score)
    .slice(0, limit)
    .map(x=>x.title);
}

function showSuggestions(q){
  const cont = $("#sugerencias-panel");
  const ul = $("#lista-sugerencias");
  const items = computeSuggestions(q, 8);
  if (!items.length){ cont.classList.add("hidden"); ul.innerHTML = ""; return; }
  ul.innerHTML = items.map(t => `<li><button class="linklike" data-job="${t}">${t}</button></li>`).join("");
  cont.classList.remove("hidden");
}
function hideSuggestions(){
  $("#sugerencias-panel").classList.add("hidden");
  $("#lista-sugerencias").innerHTML = "";
}

function searchJob(q, {explicitSubmit=false}={}){
  if (!q || !DATA.length) return;
  const nq = normalize(q);

  // Coincidencia exacta
  let found = DATA.find(j => normalize(j.titulo) === nq);

  // Si no exacta, coincidencia por inclusión única
  if (!found){
    const list = DATA.filter(j => normalize(j.titulo).includes(nq));
    if (list.length === 1) found = list[0];
  }

  if (found){
    setNote("");
    showResult(found);
    hideSuggestions();
  } else {
    const best = DATA.map(j => ({ j, d: lev(j.titulo, q) }))
                     .sort((a,b) => a.d - b.d)[0]?.j;
    if (best){
      showResult(best);
      setNote(`No encontramos “${q}”. Te mostramos la opción más cercana: “${best.titulo}”. Puedes elegir otra profesión similar de la lista.`);
      showSuggestions(q);
    }
  }
}

/* ---------- Compartir ---------- */
function updateShare(job){
  const title = `Riesgo de automatización: ${job.titulo}`;
  const text = `${job.titulo}: ${job.riesgo ?? "—"}% • ${job.explicacion}`;
  const url = withQuery(window.location.href, "q", job.titulo);

  const buttons = document.querySelectorAll(".share-btn");
  buttons.forEach(btn=>{
    btn.onclick = async () => {
      const type = btn.getAttribute("data-share");
      try {
        if (type === "native" && navigator.share){
          await navigator.share({ title, text, url });
          setShareStatus("Compartido.");
          return;
        }
        if (type === "whatsapp"){
          const u = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
          openShare(u); return;
        }
        if (type === "twitter"){
          const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
          openShare(u); return;
        }
        if (type === "facebook"){
          const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
          openShare(u); return;
        }
        if (type === "linkedin"){
          const u = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
          openShare(u); return;
        }
        if (type === "telegram"){
          const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
          openShare(u); return;
        }
        if (type === "copy"){
          await navigator.clipboard.writeText(url);
          setShareStatus("Enlace copiado al portapapeles.");
          return;
        }
        if (navigator.share){
          await navigator.share({ title, text, url });
          setShareStatus("Compartido.");
        }
      } catch(e){
        setShareStatus("No se pudo compartir. Intenta de nuevo.");
      }
    };
  });
}
function setShareStatus(msg){
  const el = $("#share-status");
  el.textContent = msg || "";
  if (msg) setTimeout(()=> el.textContent="", 3000);
}
function openShare(u){
  window.open(u, "_blank", "noopener,noreferrer,width=560,height=640");
}
function withQuery(href, key, val){
  const url = new URL(href);
  url.searchParams.set(key, val);
  return url.toString();
}

/* ---------- Eventos ---------- */
function bindUI(){
  $("#year").textContent = new Date().getFullYear();

  // Chips
  $("#chips").addEventListener("click", (e)=>{
    const el = e.target.closest("[data-job]");
    if (!el) return;
    const v = el.getAttribute("data-job");
    $("#q").value = v;
    updateUrlQuery(v);
    searchJob(v, {explicitSubmit:true});
  });

  // Click en sugerencias (panel)
  $("#lista-sugerencias").addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-job]");
    if (!btn) return;
    const v = btn.getAttribute("data-job");
    $("#q").value = v;
    updateUrlQuery(v);
    searchJob(v, {explicitSubmit:true});
  });

  // Búsqueda con submit
  $("#search-form").addEventListener("submit", (e)=>{
    e.preventDefault();
    const q = $("#q").value.trim();
    updateUrlQuery(q);
    searchJob(q, {explicitSubmit:true});
  });

  // Sugerencias en vivo al escribir
  $("#q").addEventListener("input", (e)=>{
    const q = e.target.value.trim();
    setNote(""); // limpiamos nota al escribir
    if (q.length >= 2){
      showSuggestions(q);
    } else {
      hideSuggestions();
    }
  });
}

function updateUrlQuery(q){
  const url = new URL(location.href);
  if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
  history.replaceState(null, "", url.toString());
}

function handleUrlOnLoad(){
  const url = new URL(location.href);
  const q = url.searchParams.get("q");
  if (q){
    $("#q").value = q;
    searchJob(q, {explicitSubmit:true});
  }
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  bindUI();
  await loadAll();
  handleUrlOnLoad();
});

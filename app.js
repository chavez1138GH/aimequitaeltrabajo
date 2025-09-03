/* =========================================================
   aimequitaeltrabajo.com — Carga multi-fuente + fusión
   100% estático: /data/*.json
   ========================================================= */

/** CONFIG ADSENSE (rellena cuando tengas AdSense) **/
const ADSENSE = {
  CLIENT: "ca-pub-XXXXXXXXXXXXXXXX",
  SLOT_TOP: "1111111111",
  SLOT_INCONTENT: "2222222222",
  SLOT_SIDEBAR: "3333333333",
  SLOT_FOOTER: "4444444444"
};

/* ---- Fuentes y pesos (ajusta como prefieras) ----
   Cada fuente aporta un "riesgo" 0-100 (o null si no tiene).
   El riesgo final = promedio ponderado de las fuentes disponibles.
*/
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

// Distancia Levenshtein
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
let DATA = [];        // arreglo de ocupaciones fusionadas
let RAW_BY_SOURCE = {}; // {sourceId: [items]}
let SYNONYMS = {};    // { normalizedTitle: [alias1, alias2, ...] }

async function loadJSON(url){
  const res = await fetch(url, {cache: "no-store"});
  if (!res.ok) throw new Error("No se pudo cargar: " + url);
  return res.json();
}

async function loadAll(){
  $("#loader").classList.remove("hidden");
  // cargar sinónimos
  try {
    SYNONYMS = await loadJSON(SYNONYMS_FILE);
  } catch(e){
    SYNONYMS = {};
  }

  // cargar fuentes
  for (const src of SOURCES){
    try {
      const arr = await loadJSON(src.file);
      RAW_BY_SOURCE[src.id] = arr;
    } catch(e){
      RAW_BY_SOURCE[src.id] = [];
    }
  }

  // fusionar
  DATA = mergeSources(RAW_BY_SOURCE);
  fillDatalist(DATA);
  $("#loader").classList.add("hidden");
}

/* ---------- Fusión de fuentes ----------
   Esquema esperado por item (flexible):
   {
     titulo: "Desarrollador/a frontend",
     isco: "2512",                // opcional
     onet: "15-1254.00",          // opcional
     aliases: ["Frontend dev", ...],
     categoria: "Tecnología",     // opcional
     pais: "EC/CO/MX/ES",         // opcional
     fuentes: {
       oxford:  { riesgo: 23, explicacion: "...", ref: "..." },
       bls_onet:{ riesgo: 28, explicacion: "...", ref: "..." },
       custom:  { riesgo: 18, explicacion: "...", ref: "..." }
     }
   }
*/
function mergeSources(rawBySource){
  // Paso 1: volcar todos en una lista con su sourceId
  const all = [];
  for (const src of SOURCES){
    const list = rawBySource[src.id] || [];
    for (const item of list){
      all.push({ ...item, _src: src.id });
    }
  }

  // Paso 2: agrupar por clave canónica (preferir isco/onet; si no, por título+sinónimos)
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
    // sin códigos: intentar agrupar por sinónimos aproximados
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

  // Paso 3: por grupo, construir un item fusionado
  const merged = [];
  for (const arr of groups.values()){
    // título representativo: el más largo/específico
    const title = arr.map(x=>x.titulo).sort((a,b)=> (b?.length||0)-(a?.length||0))[0] || "Ocupación";
    const isco = arr.map(x=>x.isco).find(Boolean) || null;
    const onet = arr.map(x=>x.onet).find(Boolean) || null;
    const categoria = arr.map(x=>x.categoria).find(Boolean) || null;
    const pais = arr.map(x=>x.pais).find(Boolean) || null;

    // mapear fuentes → riesgo/explicación/ref
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

    // calcular riesgo final ponderado
    const final = weightedRisk(fuentes);

    // explicación combinada (breve): elige la más específica o compón
    const expl = bestExplanation(fuentes) || "Estimación combinada a partir de varias fuentes y descripciones ocupacionales.";

    // aliases
    const aliases = collectAliases(arr);

    merged.push({
      titulo: title,
      isco, onet, categoria, pais,
      aliases,
      riesgo: final,
      explicacion: expl,
      fuentes
    });
  }

  // orden alfabético
  merged.sort((a,b)=> a.titulo.localeCompare(b.titulo, "es"));
  return merged;
}

function areSynonyms(a, b){
  // consulta en SYNONYMS (normalizados)
  const la = SYNONYMS[a] || [];
  const lb = SYNONYMS[b] || [];
  return la.includes(b) || lb.includes(a);
}

function collectAliases(arr){
  const set = new Set();
  for (const it of arr){
    (it.aliases || []).forEach(x=> set.add(x));
    const base = normalize(it.titulo || "");
    // agrega también variantes de género y país si vinieran en fuentes
  }
  return Array.from(set).slice(0, 12);
}

function getNested(obj, pathArr){
  return pathArr.reduce((o,k)=> (o && k in o ? o[k] : undefined), obj);
}

function weightedRisk(fuentes){
  let sum = 0, w = 0;
  for (const src of SOURCES){
    const entry = fuentes[src.id];
    if (entry && typeof entry.riesgo === "number"){
      sum += entry.riesgo * src.weight;
      w += src.weight;
    }
  }
  if (w === 0) return null;
  return Math.round(sum / w);
}

function bestExplanation(fuentes){
  // prioriza custom, luego bls_onet, luego oxford
  const order = ["custom","bls_onet","oxford"];
  for (const id of order){
    if (fuentes[id]?.explicacion) return fuentes[id].explicacion;
  }
  // si no, concatena la primera disponible
  const any = Object.values(fuentes)[0];
  return any?.explicacion || "";
}

/* ---------- UI ---------- */
function fillDatalist(db){
  const dl = $("#sugerencias");
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

function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function showResult(job){
  $("#resultado").classList.remove("hidden");
  $("#res-titulo").textContent = job.titulo;

  const pct = job.riesgo;
  $("#res-porcentaje").textContent = pct == null ? "— %" : `${pct}%`;
  $("#bar").style.width = pct == null ? "0%" : `${pct}%`;
  riskPill(pct);

  $("#res-explicacion").textContent = job.explicacion || "—";
  $("#res-fuentes").innerHTML = renderSourcesTable(job.fuentes);
  const ids = [];
  if (job.isco) ids.push(`ISCO: ${job.isco}`);
  if (job.onet) ids.push(`O*NET: ${job.onet}`);
  $("#res-fuente").textContent = ids.join(" · ");
}

function showSuggestions(q){
  const cont = $("#sugerencias");
  const ul = $("#lista-sugerencias");
  const nq = normalize(q);
  const ranked = DATA.map(j => {
      const ntitle = normalize(j.titulo);
      let score = 0;
      if (ntitle.includes(nq)) score += 60;
      const d = lev(ntitle, nq);
      score += Math.max(0, 40 - d);
      return { title: j.titulo, score };
    })
    .sort((a,b)=>b.score - a.score)
    .slice(0, 8)
    .map(x=>x.title);

  ul.innerHTML = ranked.map(t => `<li><button class="linklike" data-job="${t}">${t}</button></li>`).join("");
  cont.classList.remove("hidden");
}

function searchJob(q){
  if (!q || !DATA.length) return;
  const nq = normalize(q);

  let found = DATA.find(j => normalize(j.titulo) === nq);
  if (!found){
    const list = DATA.filter(j => normalize(j.titulo).includes(nq));
    if (list.length === 1) found = list[0];
  }

  if (found){
    showResult(found);
    $("#sugerencias").classList.add("hidden");
  } else {
    const best = DATA.map(j => ({ j, d: lev(j.titulo, q) }))
                     .sort((a,b) => a.d - b.d)[0]?.j;
    if (best) showResult(best);
    showSuggestions(q);
  }
}

function bindUI(){
  $("#year").textContent = new Date().getFullYear();

  $("#chips").addEventListener("click", (e)=>{
    const el = e.target.closest("[data-job]");
    if (!el) return;
    const v = el.getAttribute("data-job");
    $("#q").value = v;
    updateUrlQuery(v);
    searchJob(v);
  });

  $("#lista-sugerencias").addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-job]");
    if (!btn) return;
    const v = btn.getAttribute("data-job");
    $("#q").value = v;
    updateUrlQuery(v);
    searchJob(v);
  });

  $("#search-form").addEventListener("submit", (e)=>{
    e.preventDefault();
    const q = $("#q").value.trim();
    updateUrlQuery(q);
    searchJob(q);
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
    searchJob(q);
  }
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  bindUI();
  await loadAll();   // carga data/*.json y fusiona
  handleUrlOnLoad();
});

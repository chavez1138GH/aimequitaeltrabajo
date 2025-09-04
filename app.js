/* ========= Helpers ========= */
const $ = (s, d=document) => d.querySelector(s);
const $$ = (s, d=document) => Array.from(d.querySelectorAll(s));
const norm = (str="") =>
  str.toString().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu,'')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ').trim();

const getFirst = (obj, keys, fallback=null) => {
  for (const k of keys) if (obj && obj[k] != null) return obj[k];
  return fallback;
};
const asNumber = (v, d=0) => {
  const n = Number(String(v).replace('%','').trim());
  return Number.isFinite(n) ? n : d;
};

/* ========= Estado ========= */
let DATA = [];
let INDEX = [];   // [{i, tokens}]
let NAMES = [];   // autocompletar

/* ========= Carga robusta del JSON ========= */
async function fetchJSON(url){
  const u = `${url}${url.includes('?')?'&':'?'}v=${Date.now()}`; // evita caché
  const res = await fetch(u, {cache:'no-store'});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function cargarDatos() {
  const status = $('#dbStatus');
  try {
    // intenta varias rutas comunes por si el archivo quedó en subcarpeta
    const candidates = [
      'base_de_datos.json',
      './base_de_datos.json',
      'data/base_de_datos.json'
    ];
    let raw = null, lastErr = null;
    for (const c of candidates) {
      try { raw = await fetchJSON(c); break; }
      catch(e){ lastErr = e; }
    }
    if (!raw) throw lastErr || new Error('No se pudo leer la base');

    if (!Array.isArray(raw)) throw new Error('El JSON no es un array');
    DATA = normalizar(raw);

    construirIndices();
    status.textContent = `Base de datos cargada: ${DATA.length} ocupaciones.`;
  } catch (e) {
    console.warn('Fallo al cargar la base, usando fallback.', e);
    DATA = normalizar([
      {
        codigo_isco: "4311",
        ocupacion_es: "Empleados de contabilidad y teneduría de libros",
        riesgo_automatizacion_porcentaje: 64,
        explicacion: "Tareas repetitivas con reglas claras; alto potencial de automatización con supervisión humana.",
        sinonimos: ["Auxiliar contable","Asistente contable","Tenedor de libros","Administrativo contable"]
      },
      {
        codigo_isco: "7112",
        ocupacion_es: "Albañiles",
        riesgo_automatizacion_porcentaje: 9,
        explicacion: "Destreza manual y entornos no estructurados; difícil de automatizar por completo.",
        sinonimos: ["Maestro de obra","Oficial de construcción","Oficial albañil"]
      }
    ]);
    construirIndices();
    if (status) status.textContent =
      "⚠️ No se pudo cargar base_de_datos.json. Revisa la ruta y vuelve a publicar.";
  }
}

function normalizar(arr){
  return arr.map((it) => {
    const ocup = getFirst(it, ['ocupacion_es','ocupación_es','ocupacion','ocupación'], '').toString();
    const syn  = getFirst(it, ['sinonimos','sinónimos'], []);
    const riesgo = asNumber(getFirst(it, ['riesgo_automatizacion_porcentaje','riesgo','riesgo_porcentaje'], 0));
    const exp = getFirst(it, ['explicacion','explicación','descripcion','descripción'], '');
    return {
      codigo_isco: getFirst(it, ['codigo_isco','código_isco','isco','isco08'], ''),
      ocupacion_es: ocup,
      riesgo_automatizacion_porcentaje: Math.max(0, Math.min(100, riesgo)),
      explicacion: exp,
      sinonimos: Array.isArray(syn) ? syn.filter(Boolean) : []
    };
  }).filter(x => x.ocupacion_es);
}

function construirIndices(){
  const s = new Set();
  INDEX = DATA.map((it, i) => {
    const base = [it.ocupacion_es, ...(it.sinonimos||[])].join(' ');
    [it.ocupacion_es, ...(it.sinonimos||[])].forEach(n => s.add(n));
    return { i, tokens: norm(base) };
  });
  NAMES = Array.from(s).sort((a,b)=>a.localeCompare(b,'es'));
}

/* ========= Buscador + Autocompletar ========= */
function scoreMatch(haystack, needle) {
  if (!needle) return 0;
  if (haystack.startsWith(needle+' ')) return 120;
  if (haystack === needle) return 110;
  if (haystack.includes(` ${needle} `)) return 90;
  if (haystack.includes(needle)) return Math.min(80, Math.floor(needle.length*2));
  let s = 0;
  for (const p of needle.split(' ')) if (p && haystack.includes(p)) s += 10;
  return s;
}

function buscar(term) {
  const q = norm(term);
  let best = null, bestScore = 0;
  INDEX.forEach(obj => {
    const s = scoreMatch(obj.tokens, q);
    if (s > bestScore) { bestScore = s; best = DATA[obj.i]; }
  });
  return best;
}

function sugerencias(term, limit=10){
  const q = norm(term);
  if (!q) return NAMES.slice(0, limit);
  const scored = NAMES.map(n => {
    const t = norm(n);
    let s = 0;
    if (t.startsWith(q)) s += 100;
    else if (t.includes(q)) s += 60;
    q.split(' ').forEach(p => { if (t.includes(p)) s += 8; });
    return {n, s};
  }).filter(x => x.s > 0)
    .sort((a,b)=>b.s-a.s)
    .slice(0, limit)
    .map(x => x.n);
  return scored;
}

function pintarSugerencias(list){
  const cont = $('#sugerencias');
  cont.innerHTML = '';
  list.forEach(txt => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.onclick = () => { $('#search').value = txt; cont.innerHTML=''; accionBuscar(); };
    cont.appendChild(b);
  });
  const dl = $('#opts');
  if (dl){
    dl.innerHTML = '';
    list.forEach(txt => {
      const opt = document.createElement('option');
      opt.value = txt;
      dl.appendChild(opt);
    });
  }
}

/* ========= Velocímetro ========= */
function etiquetaRiesgo(pct){
  const p = Math.max(0, Math.min(100, pct));
  if (p <= 16.6) return {txt:'Muy bajo', color:'#0fa15d'};
  if (p <= 33.3) return {txt:'Bajo', color:'#23b46b'};
  if (p <= 50.0) return {txt:'Moderado', color:'#a6e42b'};
  if (p <= 66.6) return {txt:'Moderado-alto', color:'#f1c40f'};
  if (p <= 83.3) return {txt:'Alto', color:'#e67e22'};
  return {txt:'Inminente', color:'#e74c3c'};
}

function setGauge(pct){
  const clamp = Math.max(0, Math.min(100, Number(pct)||0));
  const angle = -90 + (clamp/100)*180;
  const needle = document.getElementById('needle');
  if (needle) needle.style.transform = `rotate(${angle}deg)`;

  const {txt, color} = etiquetaRiesgo(clamp);
  const pctEl = document.getElementById('porcentaje');
  if (pctEl) pctEl.textContent = `${Math.round(clamp)}%`;
  const badge = document.getElementById('riesgoEtiqueta');
  if (badge) badge.textContent = txt;
  const banner = document.getElementById('gaugeBanner');
  if (banner){
    banner.textContent = `Riesgo ${txt.toLowerCase()}`;
    banner.style.background = color;
    banner.style.color = clamp > 66.6 ? '#fff' : '#0d1117';
  }
}

/* ========= UI ========= */
function pintarResultado(item){
  $('#resultado').classList.remove('hidden');
  $('#ocupacionTitulo').textContent = item.ocupacion_es;
  $('#explicacion').textContent = item.explicacion || '—';
  setGauge(asNumber(item.riesgo_automatizacion_porcentaje, 0));

  const texto = encodeURIComponent(`Riesgo de automatización para “${item.ocupacion_es}”: ${item.riesgo_automatizacion_porcentaje}% — aimequitaeltrabajo.com`);
  $('#shareWhats').href = `https://api.whatsapp.com/send?text=${texto}`;
  $('#btnShare').onclick = async () => {
    if (navigator.share){
      try { await navigator.share({title:'Riesgo de automatización', text: decodeURIComponent(texto), url: location.href}); } catch {}
    } else {
      navigator.clipboard?.writeText(location.href);
      alert('Enlace copiado. ¡Compártelo!');
    }
  };
}

async function accionBuscar(){
  const term = $('#search').value.trim();
  if (!term) return;
  const found = buscar(term);
  if (found) pintarResultado(found);
  else {
    $('#resultado').classList.remove('hidden');
    $('#ocupacionTitulo').textContent = 'No encontramos esa ocupación';
    $('#explicacion').textContent = 'Prueba otro sinónimo o escribe el nombre más corto de tu ocupación.';
    setGauge(0);
  }
}

/* ========= Eventos ========= */
document.addEventListener('DOMContentLoaded', async () => {
  const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

  await cargarDatos();

  // Muestra sugerencias iniciales para guiar al usuario
  pintarSugerencias(sugerencias('', 10));

  const input = $('#search');
  input.addEventListener('input', e => {
    const list = sugerencias(e.target.value, 10);
    pintarSugerencias(list);
  });

  $('#btnBuscar').addEventListener('click', accionBuscar);
  input.addEventListener('change', accionBuscar);     // seleccionar del datalist busca solo
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') accionBuscar(); });

  const params = new URLSearchParams(location.search);
  const q = params.get('q') || params.get('busqueda');
  if (q){ input.value = q; accionBuscar(); }
});

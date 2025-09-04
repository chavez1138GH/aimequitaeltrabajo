/* ====== Utilidades ====== */
const $ = (s, d=document) => d.querySelector(s);
const $$ = (s, d=document) => Array.from(d.querySelectorAll(s));
const norm = (str="") =>
  str.toString().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu,'')  // quita acentos
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ').trim();

const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ====== Carga de datos ====== */
let DATA = [];
let INDEX = []; // {i, tokens[]}

async function cargarDatos() {
  try {
    const res = await fetch('base_de_datos.json', {cache:'no-store'});
    DATA = await res.json();
    // Construye índice (ocupación + sinónimos)
    INDEX = DATA.map((it, i) => {
      const base = [it.ocupacion_es, ...(it.sinonimos||[])].join(' ');
      return { i, tokens: norm(base) };
    });
  } catch (e) {
    console.error('Error cargando base_de_datos.json', e);
  }
}

/* ====== Búsqueda ====== */
function sugerir(term) {
  if (!term) return [];
  const q = norm(term);
  const hits = INDEX
    .map(obj => ({ i: obj.i, score: scoreMatch(obj.tokens, q) }))
    .filter(x => x.score > 0)
    .sort((a,b)=>b.score-a.score)
    .slice(0, 8)
    .map(x => DATA[x.i].ocupacion_es);
  return [...new Set(hits)];
}

function scoreMatch(haystack, needle) {
  // Puntúa: coincidencia completa > incluye palabra > substring
  if (haystack === needle) return 100;
  if (haystack.includes(` ${needle} `)) return 80;
  if (haystack.startsWith(needle+' ') || haystack.endsWith(' '+needle)) return 70;
  if (haystack.includes(needle)) return Math.min(60, Math.floor(needle.length*2));
  // Divide y suma
  const parts = needle.split(' ');
  let s = 0; parts.forEach(p => { if (haystack.includes(p)) s += 10; });
  return s;
}

function buscar(term) {
  const q = norm(term);
  let best = null;
  let bestScore = 0;
  INDEX.forEach(obj => {
    const s = scoreMatch(obj.tokens, q);
    if (s > bestScore) { bestScore = s; best = DATA[obj.i]; }
  });
  return best;
}

/* ====== Velocímetro ====== */
function etiquetaRiesgo(pct){
  const p = Math.max(0, Math.min(100, pct));
  if (p <= 16.6) return 'Muy bajo';
  if (p <= 33.3) return 'Bajo';
  if (p <= 50.0) return 'Moderado';
  if (p <= 66.6) return 'Moderado-alto';
  if (p <= 83.3) return 'Alto';
  return 'Inminente';
}

function setGauge(pct){
  const clamp = Math.max(0, Math.min(100, pct));
  const angle = -90 + (clamp/100)*180; // 0%=-90°, 50%=0°, 100%=+90°
  const needle = document.getElementById('needle');
  needle.style.transform = `rotate(${angle}deg)`;
  document.getElementById('porcentaje').textContent = `${Math.round(clamp)}%`;
  document.getElementById('riesgoEtiqueta').textContent = etiquetaRiesgo(clamp);
}

/* ====== UI ====== */
function pintarResultado(item){
  $('#resultado').classList.remove('hidden');
  $('#ocupacionTitulo').textContent = item.ocupacion_es;
  $('#explicacion').textContent = item.explicacion || '—';
  setGauge(Number(item.riesgo_automatizacion_porcentaje || 0));
  // Share
  const texto = encodeURIComponent(`Riesgo de automatización para “${item.ocupacion_es}”: ${item.riesgo_automatizacion_porcentaje}% — aimequitaeltrabajo.com`);
  $('#shareWhats').href = `https://api.whatsapp.com/send?text=${texto}`;
  $('#btnShare').onclick = async () => {
    if (navigator.share){
      try { await navigator.share({title:'Riesgo de automatización', text:`${decodeURIComponent(texto)}`, url: location.href}); } catch {}
    } else {
      alert('Comparte copiando este link:\n' + location.href);
    }
  };
}

function pintarSugerencias(list){
  const cont = $('#sugerencias');
  cont.innerHTML = '';
  list.forEach(txt => {
    const b = document.createElement('button');
    b.textContent = txt;
    b.onclick = () => { $('#search').value = txt; cont.innerHTML=''; accionBuscar(); };
    cont.appendChild(b);
  });
}

/* ====== Eventos ====== */
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

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatos();

  // Autocompletar simple
  $('#search').addEventListener('input', e => {
    const s = sugerir(e.target.value);
    pintarSugerencias(s);
  });

  $('#btnBuscar').addEventListener('click', accionBuscar);
  $('#search').addEventListener('keydown', (e)=>{ if(e.key==='Enter') accionBuscar(); });

  // Si viene ?q= en la URL, búscalo
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || params.get('busqueda');
  if (q){ $('#sear

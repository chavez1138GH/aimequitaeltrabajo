/* =========================================================
   aimequitaeltrabajo.com — App principal
   Sin dependencias. Sitio estático para GitHub Pages.
   ========================================================= */

/** CONFIG ADSENSE (rellena cuando tengas AdSense) **/
const ADSENSE = {
  CLIENT: "ca-pub-XXXXXXXXXXXXXXXX",   // <-- tu ID
  SLOT_TOP: "1111111111",
  SLOT_INCONTENT: "2222222222",
  SLOT_SIDEBAR: "3333333333",
  SLOT_FOOTER: "4444444444"
};

/** Datos de ejemplo (traducciones y aproximaciones educativas).
 *  Estructura: titulo (es), riesgo 0-100, explicacion breve, fuente textual
 *  Añade/edita libremente o migra a un archivo JSON externo. */
const JOBS = [
  { titulo: "Cajero/a", riesgo: 96, explicacion: "Gran parte de tareas repetitivas (cobro, registro, cambio) ya se realizan con terminales y autoservicio.", fuente: "Estimación basada en estudios de automatización y observación del mercado retail." },
  { titulo: "Teleoperador/a", riesgo: 94, explicacion: "Centros de contacto migran a bots de voz y chat con IA que resuelven consultas frecuentes.", fuente: "Tendencias de adopción de asistentes virtuales en atención al cliente." },
  { titulo: "Digitador/a de datos", riesgo: 97, explicacion: "La captura y validación de datos se automatiza con OCR, RPA y modelos de lenguaje.", fuente: "Casos de uso RPA/OCR generalizados." },
  { titulo: "Recepcionista", riesgo: 91, explicacion: "Check-in digital, kioscos y asistentes de IA reducen tareas de agenda y recepción.", fuente: "Automatización en hotelería y oficinas." },
  { titulo: "Vendedor/a minorista", riesgo: 85, explicacion: "E-commerce, self-checkout y recomendaciones automáticas desplazan funciones tradicionales.", fuente: "Transformación digital del retail." },
  { titulo: "Auxiliar administrativo", riesgo: 88, explicacion: "Trámites, reportes y documentos estándar se automatizan con IA y flujos RPA.", fuente: "Automatización administrativa." },
  { titulo: "Operario/a de fábrica", riesgo: 92, explicacion: "Robótica industrial y visión computarizada asumen tareas repetitivas y peligrosas.", fuente: "Industria 4.0." },
  { titulo: "Taquillero/a", riesgo: 95, explicacion: "Venta online y máquinas expendedoras sustituyen taquillas físicas.", fuente: "Digitalización de boletería." },
  { titulo: "Repartidor/a", riesgo: 90, explicacion: "Rutas optimizadas y vehículos autónomos/semiautónomos reducen demanda humana.", fuente: "Logística y conducción asistida." },

  { titulo: "Contador/a", riesgo: 81, explicacion: "Software contable e IA automatizan conciliaciones, registros y reportes estándar.", fuente: "SaaS contable e IA generativa." },
  { titulo: "Auditor/a", riesgo: 77, explicacion: "Análisis automatizado detecta anomalías; el criterio humano sigue siendo clave en riesgos complejos.", fuente: "Analítica avanzada en auditoría." },
  { titulo: "Bibliotecario/a", riesgo: 58, explicacion: "Gestión documental y búsquedas automatizadas; curaduría humana mantiene relevancia.", fuente: "Sistemas de información." },
  { titulo: "Dependiente de supermercado", riesgo: 84, explicacion: "Cajas automáticas, inventario inteligente y pedidos online reducen funciones.", fuente: "Retail automatizado." },
  { titulo: "Community manager", riesgo: 55, explicacion: "Herramientas de IA generan copys/banners; estrategia y tono siguen requiriendo juicio humano.", fuente: "Marketing digital asistido por IA." },
  { titulo: "Diseñador/a gráfico", riesgo: 52, explicacion: "IA acelera bocetos y variantes; dirección creativa humana agrega valor.", fuente: "Modelos generativos en diseño." },
  { titulo: "Fotógrafo/a", riesgo: 57, explicacion: "Edición/postproducción automatizada; capturas estándar compiten con bancos e IA.", fuente: "Edición con IA." },
  { titulo: "Periodista", riesgo: 49, explicacion: "Automatización de notas rutinarias; reportería, investigación y verificación siguen humanas.", fuente: "Redacciones con IA." },
  { titulo: "Farmacéutico/a", riesgo: 47, explicacion: "Sistemas de dispensación y verificación; atención clínica y consejo siguen necesarios.", fuente: "Automatización de farmacia." },
  { titulo: "Técnico/a de laboratorio", riesgo: 65, explicacion: "Robots de pipeteo y análisis automático; interpretación clínica requiere supervisión.", fuente: "Laboratorios automatizados." },
  { titulo: "Auxiliar de enfermería", riesgo: 40, explicacion: "Tareas físicas pueden asistirse, pero el cuidado humano sigue central.", fuente: "Cuidados asistidos." },
  { titulo: "Analista de datos", riesgo: 61, explicacion: "ETL, dashboards y análisis descriptivo se automatizan; análisis causal y comunicación, humanos.", fuente: "BI/AutoML." },
  { titulo: "Científico/a de datos", riesgo: 38, explicacion: "Modelado y evaluación siguen requiriendo criterio; herramientas automatizan partes del flujo.", fuente: "ML asistido." },

  { titulo: "Conductor/a de camión", riesgo: 64, explicacion: "Asistencia avanzada y piloto autónomo en pruebas; adopción depende de regulación/infra.", fuente: "AD/ADAS en logística." },
  { titulo: "Conductor/a de taxi", riesgo: 66, explicacion: "Plataformas + autonomización gradual; interacción local aún importante.", fuente: "Movilidad urbana." },
  { titulo: "Piloto/a comercial", riesgo: 35, explicacion: "Cabinas más automatizadas; supervisión y toma de decisiones críticas humanas.", fuente: "Aviación." },
  { titulo: "Piloto/a de dron", riesgo: 68, explicacion: "Vuelos programados y enjambres; supervisión humana en misiones especiales.", fuente: "Operaciones con UAS." },

  { titulo: "Desarrollador/a web", riesgo: 23, explicacion: "Asistentes de código aceleran tareas, pero diseño, arquitectura y debugging requieren humanos.", fuente: "Software asistido por IA." },
  { titulo: "Desarrollador/a de software", riesgo: 21, explicacion: "Automatización parcial del código; resolución de problemas y producto siguen humanos.", fuente: "Herramientas de IA para programación." },
  { titulo: "Arquitecto/a", riesgo: 33, explicacion: "Generación de planos/variantes se acelera; coordinación normativa y diseño requieren humanos.", fuente: "CAD/BIM inteligente." },
  { titulo: "Ingeniero/a civil", riesgo: 29, explicacion: "Cálculos y simulaciones asistidos; dirección de obra y seguridad siguen humanas.", fuente: "Ingeniería asistida." },
  { titulo: "Electricista", riesgo: 33, explicacion: "Diagnóstico asistido; intervención física, compleja y variable.", fuente: "Oficios técnicos." },
  { titulo: "Plomero/a", riesgo: 30, explicacion: "Automatización limitada en campo; trabajo manual y diagnóstico situacional.", fuente: "Oficios técnicos." },
  { titulo: "Carpintero/a", riesgo: 35, explicacion: "Corte/producción automatizable; trabajo a medida y montaje manual.", fuente: "Manufactura y oficio." },
  { titulo: "Chef", riesgo: 29, explicacion: "Robots de cocina emergen, pero creatividad y servicio siguen humanas.", fuente: "Restauración." },

  { titulo: "Maestro/a de primaria", riesgo: 27, explicacion: "IA apoya personalización; guía pedagógica y vínculo humano son centrales.", fuente: "Educación." },
  { titulo: "Profesor/a universitario/a", riesgo: 23, explicacion: "Generación de materiales y evaluación asistidas; investigación y tutoría humanas.", fuente: "Educación superior." },
  { titulo: "Psicólogo/a", riesgo: 20, explicacion: "Herramientas de apoyo, pero la intervención terapéutica es humana.", fuente: "Salud mental." },
  { titulo: "Trabajador/a social", riesgo: 24, explicacion: "Gestión de casos asistida; trabajo comunitario y empatía humanas.", fuente: "Intervención social." },
  { titulo: "Fisioterapeuta", riesgo: 21, explicacion: "Aparatología y rutinas guiadas; evaluación y manipulación terapéutica humanas.", fuente: "Rehabilitación." },
  { titulo: "Terapeuta ocupacional", riesgo: 17, explicacion: "Diseño de planes personalizados con apoyo de IA; ejecución humana.", fuente: "Salud." },
  { titulo: "Bombero/a", riesgo: 15, explicacion: "Robots en entornos peligrosos, pero coordinación/decisión humana.", fuente: "Emergencias." },
  { titulo: "Policía", riesgo: 26, explicacion: "Analítica predictiva; interacción situacional humana.", fuente: "Seguridad pública." },

  { titulo: "Médico/a general", riesgo: 22, explicacion: "Apoyo diagnóstico por IA; juicio clínico y trato humano indispensables.", fuente: "Salud." },
  { titulo: "Cirujano/a", riesgo: 8, explicacion: "Robótica asistida, pero la responsabilidad y decisión quirúrgica siguen humanas.", fuente: "Cirugía asistida." },
  { titulo: "Abogado/a", riesgo: 34, explicacion: "Revisión documental automatizada; estrategia legal y litigio requieren humanos.", fuente: "Legal tech." },
  { titulo: "Juez/a", riesgo: 22, explicacion: "Análisis por IA de expedientes; decisión judicial humana.", fuente: "Sistema judicial." },
  { titulo: "Gerente de marketing", riesgo: 31, explicacion: "Automatización de campañas; visión de marca y estrategia humanas.", fuente: "MarTech." },
  { titulo: "Gerente de producto", riesgo: 28, explicacion: "Análisis y roadmap asistidos; priorización y liderazgo humanos.", fuente: "Producto." },
  { titulo: "Agricultor/a", riesgo: 72, explicacion: "Maquinaria autónoma y sensores; labores especializadas aún humanas.", fuente: "AgTech." },
  { titulo: "Guardia de seguridad", riesgo: 62, explicacion: "Monitoreo por visión/IA; intervención física humana.", fuente: "Seguridad privada." }
];

/* ---------- Utilidades ---------- */
const $ = sel => document.querySelector(sel);

function normalize(str){
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9\s\/\-\.\,]/g, " ") // limpia
    .replace(/\s+/g, " ")
    .trim();
}

// Distancia de Levenshtein simple para sugerencias
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

function fillDatalist(){
  const dl = $("#sugerencias");
  dl.innerHTML = JOBS
    .map(j => `<option value="${j.titulo}"></option>`)
    .join("");
}

function showResult(job){
  $("#resultado").classList.remove("hidden");
  $("#res-titulo").textContent = job.titulo;
  $("#res-porcentaje").textContent = `${job.riesgo}%`;
  $("#bar").style.width = `${job.riesgo}%`;

  const lvl = riskLevel(job.riesgo);
  const pill = $("#res-nivel");
  pill.textContent = lvl.label;
  pill.className = "pill";
  if (lvl.cls === "danger") pill.style.background = "#3b0d0d";
  else if (lvl.cls === "warn") pill.style.background = "#3b2a0d";
  else if (lvl.cls === "mid") pill.style.background = "#1f2a3b";
  else pill.style.background = "#13301c";

  $("#res-explicacion").textContent = job.explicacion;
  $("#res-fuente").textContent = `Fuente: ${job.fuente}`;
}

function showSuggestions(q){
  const cont = $("#sugerencias");
  const ul = $("#lista-sugerencias");
  const nq = normalize(q);
  // ranking por: coincidencia incluye + distancia Levenshtein
  const ranked = JOBS.map(j => {
    const title = j.titulo;
    const ntitle = normalize(title);
    let score = 0;
    if (ntitle.includes(nq)) score += 50;
    const d = lev(ntitle, nq);
    score += Math.max(0, 40 - d); // menor distancia, más score
    return { title, score };
  }).sort((a,b)=>b.score - a.score)
    .slice(0, 7)
    .map(x=>x.title);

  ul.innerHTML = ranked.map(t => `<li><button class="linklike" data-job="${t}">${t}</button></li>`).join("");
  cont.classList.remove("hidden");
}

function searchJob(q){
  if (!q) return;
  const nq = normalize(q);

  // Exacta
  let found = JOBS.find(j => normalize(j.titulo) === nq);
  if (!found){
    // Inclusión
    const list = JOBS.filter(j => normalize(j.titulo).includes(nq));
    if (list.length === 1) found = list[0];
  }

  if (found){
    showResult(found);
    $("#sugerencias").classList.add("hidden");
  } else {
    // Elegimos la mejor por distancia como fallback para mostrar primero
    const best = JOBS.map(j => ({ j, d: lev(j.titulo, q) }))
                     .sort((a,b) => a.d - b.d)[0]?.j;
    if (best) showResult(best);
    showSuggestions(q);
  }
}

function bindUI(){
  // año footer
  $("#year").textContent = new Date().getFullYear();

  // chips rápidos
  $("#chips").addEventListener("click", (e)=>{
    const el = e.target.closest("[data-job]");
    if (!el) return;
    const v = el.getAttribute("data-job");
    $("#q").value = v;
    updateUrlQuery(v);
    searchJob(v);
  });

  // sugerencias click
  $("#lista-sugerencias").addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-job]");
    if (!btn) return;
    const v = btn.getAttribute("data-job");
    $("#q").value = v;
    updateUrlQuery(v);
    searchJob(v);
  });

  // formulario
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
document.addEventListener("DOMContentLoaded", ()=>{
  fillDatalist();
  bindUI();
  handleUrlOnLoad();
});

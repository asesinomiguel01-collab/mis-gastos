/* Almacenamiento en el propio móvil (IndexedDB). Todos los datos viven en un único documento. */
import { CATEGORIAS, REGLAS_INICIALES, MENSUALIDADES_INICIALES, tipoDe, subsDe } from "./catalogo.js";
import { ErrorDatos, normalizar, parseImporte } from "./importador.js";
import { diasEntre, hoyISO } from "./util.js";

export { ErrorDatos };
export let datos = null;

/* ---------------------------------------------------------------- IndexedDB */

let conexion;
function abrir() {
  conexion ??= new Promise((ok, ko) => {
    const r = indexedDB.open("mis-gastos", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  return conexion;
}

async function leer() {
  const db = await abrir();
  return new Promise((ok, ko) => {
    const q = db.transaction("kv").objectStore("kv").get("datos");
    q.onsuccess = () => ok(q.result);
    q.onerror = () => ko(q.error);
  });
}

export async function guardar() {
  const db = await abrir();
  return new Promise((ok, ko) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(JSON.parse(JSON.stringify(datos)), "datos");
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
}

function docInicial() {
  const doc = { version: 1, siguienteId: 1, movimientos: [], reglas: [], mensualidades: [], generadas: {}, ultimaCopia: null };
  for (const [palabra, categoria, subcategoria] of REGLAS_INICIALES) {
    doc.reglas.push({ id: doc.siguienteId++, palabra: normalizar(palabra), tipo: tipoDe(categoria), categoria, subcategoria: subcategoria || null });
  }
  for (const m of MENSUALIDADES_INICIALES) doc.mensualidades.push({ id: doc.siguienteId++, activa: true, ...m });
  return doc;
}

export async function cargar() {
  datos = (await leer()) ?? docInicial();
  await guardar();
  // Pide al navegador que no borre estos datos si falta espacio.
  navigator.storage?.persist?.().catch(() => {});
}

const nuevoId = () => datos.siguienteId++;

/* -------------------------------------------------------------- movimientos */

export function validarMovimiento(d) {
  const tipo = d.tipo;
  if (!(tipo in CATEGORIAS)) throw new ErrorDatos("El tipo debe ser gasto o ingreso.");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d.fecha || ""));
  const f = m && new Date(+m[1], +m[2] - 1, +m[3]);
  if (!f || f.getFullYear() !== +m[1] || f.getMonth() !== +m[2] - 1 || f.getDate() !== +m[3]) throw new ErrorDatos("La fecha no es válida.");
  const categoria = d.categoria;
  if (!CATEGORIAS[tipo].some(c => c.nombre === categoria)) throw new ErrorDatos("Elige una categoría.");
  const subcategoria = d.subcategoria || null;
  if (subcategoria !== null && !subsDe(tipo, categoria).includes(subcategoria)) throw new ErrorDatos("El detalle no pertenece a esa categoría.");
  let cent = "importe_cent" in d ? d.importe_cent : parseImporte(d.importe);
  if (!Number.isInteger(cent)) throw new ErrorDatos("El importe no es válido.");
  cent = Math.abs(cent);
  if (cent <= 0 || cent > 1e10) throw new ErrorDatos("Escribe un importe mayor que 0.");
  return { fecha: d.fecha, tipo, categoria, subcategoria, importe_cent: cent, descripcion: String(d.descripcion || "").trim().slice(0, 200) };
}

export async function anadirMovimiento(d) {
  const m = { ...validarMovimiento(d), id: nuevoId(), origen: "manual" };
  datos.movimientos.push(m);
  await guardar();
  return m;
}

export async function editarMovimiento(id, d) {
  const m = datos.movimientos.find(x => x.id === id);
  if (!m) throw new ErrorDatos("Ese movimiento ya no existe.");
  Object.assign(m, validarMovimiento(d));
  await guardar();
}

export async function borrarMovimiento(id) {
  datos.movimientos = datos.movimientos.filter(x => x.id !== id);
  await guardar();
}

/** Guarda filas del banco. Un cobro fijo ya previsto (mensualidad) se sustituye por el real del banco. */
export async function confirmarImportacion(filas) {
  const validas = filas.map(f => {
    const huella = String(f.huella || "");
    if (huella.length < 8 || huella.length > 64) throw new ErrorDatos("Movimiento sin identificador.");
    return { ...validarMovimiento(f), huella };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const existentes = new Set(datos.movimientos.map(m => m.huella).filter(Boolean));
  let insertados = 0, sustituidos = 0;
  for (const v of validas) {
    if (existentes.has(v.huella)) continue;
    if (v.tipo === "gasto") {
      const previstos = datos.movimientos.filter(m => m.origen === "mensualidad" && m.categoria === v.categoria
        && Math.abs(diasEntre(m.fecha, v.fecha)) <= 5);
      if (previstos.length) {
        const cercano = previstos.reduce((a, b) => (Math.abs(diasEntre(b.fecha, v.fecha)) < Math.abs(diasEntre(a.fecha, v.fecha)) ? b : a));
        datos.movimientos = datos.movimientos.filter(m => m.id !== cercano.id);
        sustituidos++;
      }
    }
    datos.movimientos.push({ ...v, id: nuevoId(), origen: "banco" });
    existentes.add(v.huella);
    insertados++;
  }
  await guardar();
  return { insertados, ignorados: validas.length - insertados, sustituidos };
}

/* ------------------------------------------------------------------- reglas */

export async function guardarRegla({ palabra, categoria, subcategoria }) {
  const p = normalizar(palabra);
  const tipo = tipoDe(categoria);
  if (!p || !tipo) throw new ErrorDatos("Escribe una palabra y elige una categoría.");
  if (subcategoria && !subsDe(tipo, categoria).includes(subcategoria)) throw new ErrorDatos("El detalle no pertenece a esa categoría.");
  const existente = datos.reglas.find(r => r.palabra === p);
  if (existente) Object.assign(existente, { tipo, categoria, subcategoria: subcategoria || null });
  else datos.reglas.push({ id: nuevoId(), palabra: p, tipo, categoria, subcategoria: subcategoria || null });
  await guardar();
}

export async function borrarRegla(id) {
  datos.reglas = datos.reglas.filter(r => r.id !== id);
  await guardar();
}

/* ------------------------------------------------------------ mensualidades */

export async function guardarMensualidad(d, id = null) {
  const nombre = String(d.nombre || "").trim().slice(0, 60);
  if (!nombre) throw new ErrorDatos("Pon un nombre.");
  if (!CATEGORIAS.gasto.some(c => c.nombre === d.categoria)) throw new ErrorDatos("Elige una categoría de gasto.");
  const cent = Math.abs(parseImporte(d.importe) ?? 0);
  if (!cent) throw new ErrorDatos("Escribe un importe mayor que 0.");
  const cada = Number(d.cada);
  if (!Number.isInteger(cada) || cada < 1 || cada > 52) throw new ErrorDatos("«Cada» debe ser un número entre 1 y 52.");
  if (!["meses", "semanas"].includes(d.unidad)) throw new ErrorDatos("Elige meses o semanas.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.ancla || ""))) throw new ErrorDatos("Elige la fecha de un cobro.");
  const campos = { nombre, categoria: d.categoria, importe_cent: cent, cada, unidad: d.unidad, ancla: d.ancla, activa: d.activa !== false };
  const existente = id !== null && datos.mensualidades.find(m => m.id === id);
  if (existente) Object.assign(existente, campos);
  else datos.mensualidades.push({ id: nuevoId(), ...campos });
  await guardar();
}

export async function borrarMensualidad(id) {
  datos.mensualidades = datos.mensualidades.filter(m => m.id !== id);
  await guardar();
}

/* ------------------------------------------------------------ copia de datos */

export async function exportar() {
  datos.ultimaCopia = hoyISO();
  await guardar();
  return JSON.stringify(datos);
}

export async function restaurar(texto) {
  let doc;
  try { doc = JSON.parse(texto); } catch { throw new ErrorDatos("El archivo no es una copia válida."); }
  const ok = doc && ["movimientos", "reglas", "mensualidades"].every(k => Array.isArray(doc[k]))
    && doc.movimientos.every(m => m && typeof m.fecha === "string" && Number.isInteger(m.importe_cent));
  if (!ok) throw new ErrorDatos("El archivo no es una copia de esta aplicación.");
  doc.generadas ??= {};
  doc.siguienteId = Math.max(doc.siguienteId || 1, 1 + Math.max(0, ...[...doc.movimientos, ...doc.reglas, ...doc.mensualidades].map(x => x.id || 0)));
  datos = doc;
  await guardar();
}

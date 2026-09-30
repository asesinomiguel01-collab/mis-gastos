/* Lectura de extractos bancarios en CSV y clasificación automática (sin servidor: todo en el móvil). */

// Cabeceras habituales (normalizadas: minúsculas y sin tildes), por prioridad.
const CAB_FECHA = ["fecha operacion", "f. operacion", "f.operacion", "fecha", "started date", "date"];
const CAB_IMPORTE = ["importe", "amount", "cantidad"];
const CAB_CARGO = ["cargo", "debe", "debit"];
const CAB_ABONO = ["abono", "haber", "credit"];
const CAB_DESC = ["concepto", "resumen", "mas datos", "descripcion", "description", "detalle", "movimiento",
  "referencia", "observaciones", "beneficiario"];

export class ErrorDatos extends Error {}

export function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** '15/09/2026', '15-09-26' o '2026-09-15 10:30' -> '2026-09-15' (o null). */
export function parseFecha(texto) {
  const m = /^\s*(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?:[ T].*)?$/.exec(texto || "");
  if (!m) return null;
  const [a, b, c] = [m[1], m[2], m[3]];
  let y, mo, d;
  if (a.length === 4) [y, mo, d] = [+a, +b, +c];
  else {
    if (c.length !== 2 && c.length !== 4) return null;
    [d, mo, y] = [+a, +b, +c + (c.length === 2 ? 2000 : 0)];
  }
  const f = new Date(y, mo - 1, d);
  if (f.getFullYear() !== y || f.getMonth() !== mo - 1 || f.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** '1.234,56', '-12,5', '(30.00)', '-30,00EUR' -> céntimos con signo (entero) o null. */
export function parseImporte(valor) {
  let s = String(valor ?? "").trim().replace(/−/g, "-");
  if (!s) return null;
  const negativo = s.startsWith("-") || s.endsWith("-") || (s.startsWith("(") && s.endsWith(")"));
  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  if (s.includes(",") && s.includes(".")) {
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    s = s.split(miles).join("").replace(decimal, ".");
  } else if (s.includes(",")) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d*\.?\d*$/.test(s) || s === "." || s === "") return null;
  const [entera, dec = ""] = s.split(".");
  const tres = dec.padEnd(3, "0");
  let cent = (parseInt(entera || "0", 10)) * 100 + parseInt(tres.slice(0, 2), 10) + (parseInt(tres[2], 10) >= 5 ? 1 : 0);
  return negativo ? -cent : cent;
}

function decodificar(buffer) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { return new TextDecoder("windows-1252").decode(buffer); }
}

function detectarDelimitador(texto) {
  const lineas = texto.split(/\r?\n/).slice(0, 20).filter(l => l.trim());
  let mejor = ";", mejorPuntos = 0;
  for (const delim of [";", "\t", ",", "|"]) {
    const cuentas = lineas.map(l => l.split(delim).length - 1);
    const frecuencia = new Map();
    for (const c of cuentas) frecuencia.set(c, (frecuencia.get(c) || 0) + 1);
    let moda = 0, veces = 0;
    for (const [c, n] of frecuencia) if (n > veces) { moda = c; veces = n; }
    if (moda >= 1 && moda * veces > mejorPuntos) { mejor = delim; mejorPuntos = moda * veces; }
  }
  return mejor;
}

/** CSV con comillas: devuelve una lista de filas (listas de texto). */
function parsearCSV(texto, delim) {
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += c;
    } else if (c === '"' && campo === "") comillas = true;
    else if (c === delim) { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  fila.push(campo);
  filas.push(fila);
  return filas;
}

function buscar(cabeceras, patrones, excluir = new Set()) {
  for (const patron of patrones) {
    for (let i = 0; i < cabeceras.length; i++) if (!excluir.has(i) && cabeceras[i].includes(patron)) return i;
  }
  return null;
}

function columnasPorCabecera(filas) {
  for (let n = 0; n < Math.min(filas.length, 40); n++) {
    const cab = filas[n].map(normalizar);
    const iFecha = buscar(cab, CAB_FECHA);
    if (iFecha === null) continue;
    const usadas = new Set([iFecha]);
    const iImporte = buscar(cab, CAB_IMPORTE, usadas);
    const iCargo = buscar(cab, CAB_CARGO, usadas);
    const iAbono = buscar(cab, CAB_ABONO, usadas);
    if (iImporte === null && (iCargo === null || iAbono === null)) continue;
    for (const i of [iImporte, iCargo, iAbono]) if (i !== null) usadas.add(i);
    const desc = cab.map((c, i) => i).filter(i => !usadas.has(i) && CAB_DESC.some(p => cab[i].includes(p)) && !cab[i].includes("fecha"));
    return { fila: n, columnas: { fecha: iFecha, importe: iImporte, cargo: iCargo, abono: iAbono, desc } };
  }
  return null;
}

function columnasPorContenido(filas) {
  const muestra = filas.filter(f => f.some(c => c.trim())).slice(0, 60);
  const ancho = Math.max(0, ...muestra.map(f => f.length));
  const fraccion = (i, prueba) => {
    const valores = muestra.map(f => (f[i] ?? "").trim()).filter(Boolean);
    return valores.length ? valores.filter(prueba).length / valores.length : 0;
  };
  let iFecha = null, mejor = 0;
  for (let i = 0; i < ancho; i++) {
    const p = fraccion(i, v => parseFecha(v) !== null);
    if (p > mejor) { mejor = p; iFecha = i; }
  }
  if (iFecha === null || mejor < 0.6) return null;
  const numericas = [], textos = [];
  for (let i = 0; i < ancho; i++) {
    if (i === iFecha) continue;
    (fraccion(i, v => parseImporte(v) !== null && parseFecha(v) === null) >= 0.8 ? numericas : textos).push(i);
  }
  if (!numericas.length || !textos.length) return null;
  const largo = i => muestra.reduce((t, f) => t + (f[i] ?? "").length, 0);
  const iDesc = textos.reduce((a, b) => (largo(b) > largo(a) ? b : a));
  return { fecha: iFecha, importe: numericas[0], cargo: null, abono: null, desc: [iDesc] };
}

/** Prepara las reglas para clasificar (las palabras largas primero). */
export function compilarReglas(reglas) {
  return [...reglas].sort((a, b) => b.palabra.length - a.palabra.length).map(r => ({
    ...r, re: new RegExp(`(?<![a-z0-9])${r.palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`),
  }));
}

/** Devuelve [categoría, subcategoría, ¿coincidió una regla?]. */
export function clasificar(descripcion, tipo, reglas) {
  const d = normalizar(descripcion);
  for (const r of reglas) if (r.tipo === tipo && r.re.test(d)) return [r.categoria, r.subcategoria || null, true];
  return [tipo === "gasto" ? "Otros" : "Otros ingresos", null, false];
}

function huella(texto) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** Convierte el CSV de un banco en movimientos. Lanza ErrorDatos si no lo entiende. */
export function leerExtracto(buffer, reglasCompiladas) {
  const texto = decodificar(buffer);
  const filas = parsearCSV(texto, detectarDelimitador(texto));
  const porCabecera = columnasPorCabecera(filas);
  const primera = porCabecera ? porCabecera.fila + 1 : 0;
  const col = porCabecera ? porCabecera.columnas : columnasPorContenido(filas);
  if (!col) {
    throw new ErrorDatos("No he reconocido las columnas del archivo. Necesito una fecha, un concepto y un importe. "
      + "¿Es un CSV de movimientos exportado del banco?");
  }
  const celda = (fila, i) => (i !== null && i < fila.length ? fila[i].trim() : "");

  const movimientos = [];
  const vistas = new Map();
  let saltadas = 0;
  for (const fila of filas.slice(primera)) {
    if (!fila.some(c => c.trim())) continue;
    const fecha = parseFecha(celda(fila, col.fecha));
    let importe;
    if (col.importe !== null) importe = parseImporte(celda(fila, col.importe));
    else {
      const cargo = parseImporte(celda(fila, col.cargo)), abono = parseImporte(celda(fila, col.abono));
      importe = cargo ? -Math.abs(cargo) : abono;
    }
    if (fecha === null || !importe) { saltadas++; continue; }
    const partes = [];
    for (const i of col.desc) {
      const valor = celda(fila, i).replace(/\s+/g, " ");
      if (valor && !partes.includes(valor)) partes.push(valor);
    }
    const descripcion = partes.join(" · ").slice(0, 200);
    const tipo = importe > 0 ? "ingreso" : "gasto";
    const [categoria, subcategoria, clasificado] = clasificar(descripcion, tipo, reglasCompiladas);
    // Dos movimientos idénticos el mismo día (dos cafés) deben poder coexistir.
    const clave = `${fecha}|${importe}|${normalizar(descripcion)}`;
    vistas.set(clave, (vistas.get(clave) || 0) + 1);
    movimientos.push({
      fecha, descripcion, tipo, importe_cent: Math.abs(importe), categoria, subcategoria, clasificado,
      huella: huella(`${clave}|${vistas.get(clave)}`),
    });
  }
  if (!movimientos.length) throw new ErrorDatos("El archivo no contiene movimientos con fecha e importe válidos.");
  return { movimientos, saltadas };
}

/* Utilidades comunes: formato de dinero y fechas, y creación segura de elementos del DOM. */

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];
export const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const f2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });
const f0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });
export const fmtCompacto = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 });

export const eur = c => f2.format(c / 100);
export const eur0 = c => f0.format(c / 100);
export const eurEuros0 = euros => f0.format(euros);
export const eurSigno = c => (c > 0 ? "+" : c < 0 ? "−" : "") + eur(Math.abs(c));
export const claseSigno = c => (c > 0 ? "pos" : c < 0 ? "neg" : "");
export const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
export const pad = n => String(n).padStart(2, "0");
export const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  .replace(/\n/g, "&#10;");

/* ---- fechas (siempre como texto AAAA-MM-DD en hora local) ---- */

export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoyISO = () => iso(new Date());
export const aFecha = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

export function sumarDias(s, n) {
  const d = aFecha(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Suma meses conservando el día; si el mes no llega (p. ej. 31), usa el último día. */
export function sumarMeses(s, n) {
  const [y, m, d] = s.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = total % 12;
  const ultimo = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, ultimo))}`;
}

export const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
export const finDeMes = (anio, mes) => `${anio}-${pad(mes)}-${pad(new Date(anio, mes, 0).getDate())}`;

export function fechaCorta(s) {
  const d = aFecha(s);
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}
export function fechaConDia(s) {
  return cap(new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(aFecha(s)));
}
export const enDias = n => (n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : n > 0 ? `en ${n} días` : `hace ${-n} días`);

/* ---- DOM ---- */

/** Crea un elemento. El texto siempre entra como texto, nunca como HTML. */
export function h(etiqueta, atributos, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

let temporizadorAviso;
export function aviso(texto) {
  const el = document.getElementById("aviso");
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { el.hidden = true; }, 2800);
}

/** Descarga un texto como archivo (copia de seguridad). */
export function descargar(nombre, texto, tipo = "application/json") {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = h("a", { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

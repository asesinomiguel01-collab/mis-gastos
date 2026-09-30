/* Resúmenes por mes y año, y cálculo de las mensualidades (cobros fijos). */
import { datos, guardar } from "./almacen.js";
import { APARTE, CATEGORIAS } from "./catalogo.js";
import { diasEntre, finDeMes, pad, sumarDias, sumarMeses } from "./util.js";

export const esAparte = categoria => APARTE.has(categoria);

export function movimientosDelMes(anio, mes) {
  const prefijo = `${anio}-${pad(mes)}`;
  return datos.movimientos.filter(m => m.fecha.startsWith(prefijo))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}

/** 12 meses con ingresos, gastos, sobrante y acumulados. Los Bizum van en bizum_recibido / bizum_enviado. */
export function resumenMeses(anio) {
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1, ingresos: 0, gastos: 0, n: 0, bizum_recibido: 0, bizum_enviado: 0, nb: 0,
  }));
  const prefijo = `${anio}-`;
  for (const m of datos.movimientos) {
    if (!m.fecha.startsWith(prefijo)) continue;
    const mes = meses[+m.fecha.slice(5, 7) - 1];
    if (esAparte(m.categoria)) {
      mes[m.tipo === "ingreso" ? "bizum_recibido" : "bizum_enviado"] += m.importe_cent;
      mes.nb++;
    } else {
      mes[m.tipo === "ingreso" ? "ingresos" : "gastos"] += m.importe_cent;
      mes.n++;
    }
  }
  const ultimo = Math.max(0, ...meses.filter(m => m.n || m.nb).map(m => m.mes));
  let acumIng = 0, acumGas = 0;
  for (const m of meses) {
    m.ahorro = m.ingresos - m.gastos;
    m.bizum_neto = m.bizum_recibido - m.bizum_enviado;
    if (m.mes <= ultimo) {
      acumIng += m.ingresos;
      acumGas += m.gastos;
      Object.assign(m, { acum_ingresos: acumIng, acum_gastos: acumGas, acum_ahorro: acumIng - acumGas });
    } else {
      Object.assign(m, { acum_ingresos: null, acum_gastos: null, acum_ahorro: null });
    }
  }
  return { meses, ultimo };
}

export function resumenMes(anio, mes) {
  const gastos = new Map(CATEGORIAS.gasto.filter(c => !esAparte(c.nombre)).map(c => [c.nombre, { total: 0, n: 0, subs: new Map() }]));
  const bizum = { recibido: 0, enviado: 0, n: 0 };
  for (const m of movimientosDelMes(anio, mes)) {
    if (esAparte(m.categoria)) {
      bizum[m.tipo === "ingreso" ? "recibido" : "enviado"] += m.importe_cent;
      bizum.n++;
    } else if (m.tipo === "gasto") {
      if (!gastos.has(m.categoria)) gastos.set(m.categoria, { total: 0, n: 0, subs: new Map() });
      const c = gastos.get(m.categoria);
      c.total += m.importe_cent;
      c.n++;
      if (m.subcategoria) c.subs.set(m.subcategoria, (c.subs.get(m.subcategoria) || 0) + m.importe_cent);
    }
  }
  const { meses } = resumenMeses(anio);
  const hasta = meses.slice(0, mes);
  const acumIng = hasta.reduce((t, m) => t + m.ingresos, 0), acumGas = hasta.reduce((t, m) => t + m.gastos, 0);
  const actual = meses[mes - 1];
  return {
    anio, mes, ingresos: actual.ingresos, gastos: actual.gastos, ahorro: actual.ahorro,
    acum: { ingresos: acumIng, gastos: acumGas, ahorro: acumIng - acumGas },
    categorias: [...gastos].map(([nombre, c]) => ({ nombre, total: c.total, n: c.n, subs: [...c.subs].map(([s, total]) => ({ nombre: s, total })) })),
    bizum: { ...bizum, neto: bizum.recibido - bizum.enviado },
  };
}

export function resumenAnio(anio) {
  const { meses, ultimo } = resumenMeses(anio);
  const ingresos = meses.reduce((t, m) => t + m.ingresos, 0), gastos = meses.reduce((t, m) => t + m.gastos, 0);
  const matriz = new Map(CATEGORIAS.gasto.filter(c => !esAparte(c.nombre)).map(c => [c.nombre, Array(12).fill(0)]));
  for (const m of datos.movimientos) {
    if (m.tipo !== "gasto" || esAparte(m.categoria) || !m.fecha.startsWith(`${anio}-`)) continue;
    if (!matriz.has(m.categoria)) matriz.set(m.categoria, Array(12).fill(0));
    matriz.get(m.categoria)[+m.fecha.slice(5, 7) - 1] += m.importe_cent;
  }
  const conGasto = meses.filter(m => m.gastos);
  const mayor = conGasto.length ? conGasto.reduce((a, b) => (b.gastos > a.gastos ? b : a)) : null;

  // Mismo periodo del año anterior, para saber si este año gastas más o menos.
  let anterior = null;
  if (ultimo) {
    const previos = resumenMeses(anio - 1).meses;
    if (previos.some(m => m.n)) {
      anterior = {
        anio: anio - 1,
        ingresos: previos.slice(0, ultimo).reduce((t, m) => t + m.ingresos, 0),
        gastos: previos.slice(0, ultimo).reduce((t, m) => t + m.gastos, 0),
      };
    }
  }
  return {
    anio, ultimo, meses,
    totales: {
      ingresos, gastos, ahorro: ingresos - gastos,
      porcentajeGastado: ingresos ? Math.round(gastos / ingresos * 1000) / 10 : null,
      mediaGastoMensual: ultimo ? Math.round(gastos / ultimo) : 0,
      mesMayorGasto: mayor ? { mes: mayor.mes, gastos: mayor.gastos } : null,
    },
    categorias: [...matriz].map(([nombre, v]) => ({ nombre, meses: v, total: v.reduce((t, x) => t + x, 0) })),
    anterior,
    bizum: {
      recibido: meses.reduce((t, m) => t + m.bizum_recibido, 0),
      enviado: meses.reduce((t, m) => t + m.bizum_enviado, 0),
      neto: meses.reduce((t, m) => t + m.bizum_neto, 0),
    },
  };
}

/* ------------------------------------------------------------ mensualidades */

/** Fecha del cobro número n (0 = la fecha de referencia; negativos = anteriores). */
export const ocurrencia = (m, n) => (m.unidad === "meses" ? sumarMeses(m.ancla, n * m.cada) : sumarDias(m.ancla, n * m.cada * 7));

/** Índice del primer cobro que cae hoy o después. */
function indiceProximo(m, hoy) {
  let n = 0;
  for (let i = 0; i < 1000 && ocurrencia(m, n - 1) >= hoy; i++) n--;
  for (let i = 0; i < 1000 && ocurrencia(m, n) < hoy; i++) n++;
  return n;
}

export function proximosCobros(m, hoy, cuantos = 3) {
  const n = indiceProximo(m, hoy);
  return Array.from({ length: cuantos }, (_, i) => ocurrencia(m, n + i));
}

export function ultimosCobros(m, hoy, cuantos = 3) {
  const n = indiceProximo(m, hoy);
  return Array.from({ length: cuantos }, (_, i) => ocurrencia(m, n - 1 - i));
}

export const cobrosAlAnio = m => (m.unidad === "meses" ? 12 / m.cada : 365 / (7 * m.cada));
export const importeAnual = m => Math.round(m.importe_cent * cobrosAlAnio(m));
export const importeMensual = m => Math.round(importeAnual(m) / 12);

/** Lo que aún se cobrará de aquí a fin de mes (hoy incluido). */
export function pendienteEsteMes(hoy) {
  const [y, mes] = hoy.split("-").map(Number);
  const fin = finDeMes(y, mes);
  let total = 0;
  for (const m of datos.mensualidades.filter(x => x.activa)) {
    for (const f of proximosCobros(m, hoy, 6)) if (f <= fin) total += m.importe_cent;
  }
  return total;
}

/** Próximos cobros de todas las mensualidades activas, ordenados por fecha. */
export function agenda(hoy, cuantos = 4) {
  const lista = [];
  for (const m of datos.mensualidades.filter(x => x.activa)) {
    for (const f of proximosCobros(m, hoy, cuantos)) lista.push({ fecha: f, dias: diasEntre(hoy, f), mensualidad: m });
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, cuantos);
}

/**
 * Registra como gasto los cobros fijos que ya han llegado (fecha posterior a la de referencia y hasta hoy).
 * Nunca rellena el pasado ni repite un cobro, aunque lo hayas borrado.
 */
export async function aplicarMensualidades(hoy) {
  let creados = 0;
  for (const m of datos.mensualidades.filter(x => x.activa)) {
    for (let n = 1; n < 500; n++) {
      const fecha = ocurrencia(m, n);
      if (fecha > hoy) break;
      const clave = `${m.id}|${fecha}`;
      if (datos.generadas[clave]) continue;
      datos.generadas[clave] = true;
      datos.movimientos.push({
        id: datos.siguienteId++, fecha, tipo: "gasto", categoria: m.categoria, subcategoria: null,
        importe_cent: m.importe_cent, descripcion: `${m.nombre} (mensualidad)`, origen: "mensualidad", mensualidadId: m.id,
      });
      creados++;
    }
  }
  if (creados) await guardar();
  return creados;
}

export const mensualidadDeCategoria = categoria => datos.mensualidades.find(m => m.activa && m.categoria === categoria) || null;

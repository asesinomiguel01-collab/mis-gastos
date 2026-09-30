/* ESTADÍSTICAS: ¿gastas mucho? Ingresos frente a gastos, acumulado del año y reparto por categoría. */
import { resumenAnio } from "../calculos.js";
import { controlAnio, tarjetaBizum } from "../componentes.js";
import { estado } from "../estado.js";
import { graficoAcumulado, graficoColumnas, tarjetaGrafico } from "../graficos.js";
import { MESES, eur, eurSigno, h } from "../util.js";

const NIVELES = [
  { hasta: 70, clase: "bien", icono: "✓", titulo: "Vas bien", texto: "Gastas menos del 70 % de lo que ingresas y te queda un buen margen de ahorro." },
  { hasta: 90, clase: "aviso", icono: "!", titulo: "Vas justo", texto: "Gastas entre el 70 % y el 90 % de lo que ingresas: el margen de ahorro es pequeño." },
  { hasta: 100, clase: "serio", icono: "▲", titulo: "Gastas casi todo lo que ingresas", texto: "Apenas te queda nada ahorrado; conviene revisar en qué categorías recortar." },
  { hasta: Infinity, clase: "critico", icono: "✕", titulo: "Gastas más de lo que ingresas", texto: "Estás gastando más de lo que entra; el ahorro del año es negativo." },
];

function tarjetaVeredicto(r) {
  const t = r.totales;
  if (t.porcentajeGastado === null) {
    return h("div", { class: "tarjeta" }, h("h3", {}, "Sin ingresos registrados"),
      h("p", { class: "vacio" }, "Añade tus ingresos para poder comparar lo que ganas con lo que gastas."));
  }
  const nivel = NIVELES.find(n => t.porcentajeGastado <= n.hasta);
  const lineas = [`Llevas ingresado ${eur(t.ingresos)} y gastado ${eur(t.gastos)} (sin contar Bizum): ${eurSigno(t.ahorro)} de diferencia.`];
  const ant = r.anterior;
  if (ant && ant.gastos > 0) {
    const dif = (t.gastos - ant.gastos) / ant.gastos * 100;
    const mismo = `hasta ${MESES[r.ultimo - 1]} de ${ant.anio} (${eur(ant.gastos)})`;
    lineas.push(Math.abs(dif) < 1 ? `Gastas lo mismo que ${mismo}.` : `Gastas un ${Math.round(Math.abs(dif))} % ${dif > 0 ? "más" : "menos"} que ${mismo}.`);
  }
  if (t.mesMayorGasto) lineas.push(`Mes con más gasto: ${MESES[t.mesMayorGasto.mes - 1]} (${eur(t.mesMayorGasto.gastos)}).`);
  return h("div", { class: `tarjeta veredicto ${nivel.clase}` },
    h("div", { class: "insignia", "aria-hidden": "true" }, nivel.icono),
    h("div", {},
      h("h3", {}, `${nivel.titulo}: gastas el ${Math.round(t.porcentajeGastado)} % de lo que ingresas`),
      h("p", {}, nivel.texto), lineas.map(l => h("p", {}, l))));
}

function tarjetaReparto(r) {
  const total = r.totales.gastos;
  const cats = r.categorias.filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const max = cats.length ? cats[0].total : 1;
  const cuerpo = cats.length === 0 ? h("p", { class: "vacio" }, "Sin gastos este año.")
    : cats.map(c => h("div", { class: "hbar" },
      h("span", {}, c.nombre),
      h("span", { class: "valor" }, eur(c.total), h("span", {}, `${(c.total / total * 100).toFixed(1).replace(".", ",")} %`)),
      h("div", { class: "pista" }, h("i", { style: `width:${(c.total / max * 100).toFixed(1)}%` }))));
  return h("div", { class: "tarjeta" }, h("h3", {}, "En qué gastas"),
    h("p", { class: "sub" }, "Cada categoría, sobre el total gastado en el año."), cuerpo);
}

export function vistaEstadisticas() {
  const r = resumenAnio(estado.anio);
  const cabecera = controlAnio();
  if (!r.ultimo) {
    return h("div", { class: "vista" }, h("h2", { class: "titulo" }, "Estadísticas"), cabecera,
      h("div", { class: "tarjeta" }, h("p", { class: "vacio" }, `Todavía no hay movimientos en ${r.anio}.`)));
  }
  const colores = [["var(--ingresos)", "Ingresos"], ["var(--gastos)", "Gastos"]];
  return h("div", { class: "vista" }, h("h2", { class: "titulo" }, "Estadísticas"), cabecera, tarjetaVeredicto(r),
    tarjetaGrafico("Lo que ganas y lo que gastas cada mes", "Toca un mes para ver el detalle.", colores, med => graficoColumnas(med, r.meses)),
    tarjetaGrafico("Acumulado del año", "La distancia entre las dos líneas es lo que llevas ahorrado.", colores, med => graficoAcumulado(med, r.meses, r.ultimo)),
    tarjetaReparto(r),
    tarjetaBizum(r.bizum, "Total del año. No cuenta en ingresos, gastos ni ahorro."));
}

/* MENSUALIDAD: cuándo te cobran cada gasto fijo (IA, gimnasio…). Solo para ver; se edita en Modificar. */
import { datos } from "../almacen.js";
import { cobrosAlAnio, importeAnual, importeMensual, pendienteEsteMes, proximosCobros, ultimosCobros } from "../calculos.js";
import { tile } from "../componentes.js";
import { estado, ir } from "../estado.js";
import { aFecha, diasEntre, eur, enDias, fechaConDia, fechaCorta, h, hoyISO } from "../util.js";

export function textoCadencia(m) {
  if (m.unidad === "semanas") return m.cada === 1 ? "Cada semana" : `Cada ${m.cada} semanas`;
  const dia = aFecha(m.ancla).getDate();
  return (m.cada === 1 ? "Cada mes" : `Cada ${m.cada} meses`) + `, hacia el día ${dia}`;
}

function tarjeta(m, hoy) {
  const [proximo, ...luego] = proximosCobros(m, hoy, 3);
  const dias = diasEntre(hoy, proximo);
  const veces = Math.round(cobrosAlAnio(m) * 10) / 10;
  return h("div", { class: "tarjeta mensualidad" + (m.activa ? "" : " pausada") },
    h("div", { class: "fila-lista sin-borde" },
      h("div", {}, h("h3", { class: "sin-margen" }, m.nombre), h("div", { class: "desc" }, `${m.categoria} · ${textoCadencia(m)}`)),
      h("div", { class: "importe-grande" }, eur(m.importe_cent))),
    m.activa
      ? h("div", { class: "proximo" },
        h("div", { class: "tile-label" }, dias === 0 ? "Se cobra hoy" : "Próximo cobro"),
        h("div", { class: "proximo-fecha" }, fechaConDia(proximo)),
        h("div", { class: "tile-sub" }, `${fechaCorta(proximo)} · ${enDias(dias)}`))
      : h("div", { class: "proximo" }, h("div", { class: "tile-sub" }, "En pausa: no se registrarán cobros nuevos.")),
    m.activa && h("div", { class: "fechas" },
      h("div", {}, h("div", { class: "tile-label" }, "Después"), luego.map(f => h("div", {}, fechaCorta(f)))),
      h("div", {}, h("div", { class: "tile-label" }, "Últimos cobros"), ultimosCobros(m, hoy, 3).map(f => h("div", {}, fechaCorta(f))))),
    h("div", { class: "desc pie" }, `≈ ${eur(importeMensual(m))} al mes · ${eur(importeAnual(m))} al año (${String(veces).replace(".", ",")} cobros)`));
}

export function vistaMensualidad() {
  const hoy = hoyISO();
  const lista = datos.mensualidades;
  const activas = lista.filter(m => m.activa);
  const mensual = activas.reduce((t, m) => t + importeMensual(m), 0);
  const anual = activas.reduce((t, m) => t + importeAnual(m), 0);
  return h("div", { class: "vista" },
    h("h2", { class: "titulo" }, "Mensualidad"),
    h("div", { class: "tiles" },
      tile("Fijo al mes", `≈ ${eur(mensual)}`),
      tile("Fijo al año", `≈ ${eur(anual)}`)),
    tile("Falta por cobrar este mes", eur(pendienteEsteMes(hoy)), "", "Cobros fijos que aún llegan hasta fin de mes"),
    lista.length === 0
      ? h("div", { class: "tarjeta" }, h("p", { class: "vacio" }, "Aún no tienes cobros fijos."),
        h("button", { class: "btn", onclick: () => { estado.seccion = "mensualidades"; ir("modificar"); } }, "Añadir uno"))
      : lista.map(m => tarjeta(m, hoy)),
    h("p", { class: "nota" }, "Estos cobros se apuntan solos como gasto el día que llegan. Para cambiar un importe o una fecha, ve a Modificar → Mensualidades."));
}

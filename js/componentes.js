/* Piezas de interfaz que usan varias pantallas. */
import { MESES, cap, eur, eurSigno, claseSigno, h } from "./util.js";
import { estado, moverMes, moverAnio, irAHoy, gancho } from "./estado.js";

export function tile(etiqueta, valor, clase, detalle) {
  return h("div", { class: "tile" },
    h("div", { class: "tile-label" }, etiqueta),
    h("div", { class: "tile-value " + (clase || "") }, valor),
    detalle && h("div", { class: "tile-sub" }, detalle));
}

export function controlMes() {
  return h("div", { class: "periodo" },
    h("button", { class: "btn sec icono", "aria-label": "Mes anterior", onclick: () => moverMes(-1) }, "‹"),
    h("h2", {}, `${cap(MESES[estado.mes - 1])} ${estado.anio}`),
    h("button", { class: "btn sec icono", "aria-label": "Mes siguiente", onclick: () => moverMes(1) }, "›"),
    h("span", { class: "espacio" }),
    h("button", { class: "btn sec", onclick: irAHoy }, "Hoy"));
}

export function controlAnio() {
  return h("div", { class: "periodo" },
    h("button", { class: "btn sec icono", "aria-label": "Año anterior", onclick: () => moverAnio(-1) }, "‹"),
    h("h2", {}, String(estado.anio)),
    h("button", { class: "btn sec icono", "aria-label": "Año siguiente", onclick: () => moverAnio(1) }, "›"),
    h("span", { class: "espacio" }),
    h("button", { class: "btn sec", onclick: () => { estado.anio = new Date().getFullYear(); gancho.render(); } }, "Este año"));
}

/** Bizum: se muestra aparte y no cuenta en ingresos, gastos ni ahorro. */
export function tarjetaBizum(b, subtitulo) {
  const hay = b.recibido > 0 || b.enviado > 0;
  const dato = (etiqueta, valor, clase) => h("div", { class: "mini" },
    h("div", { class: "tile-label" }, etiqueta), h("div", { class: "mini-valor " + (clase || "") }, valor));
  return h("div", { class: "tarjeta" }, h("h3", {}, "Bizum (aparte)"), h("p", { class: "sub" }, subtitulo),
    h("div", { class: "minis" },
      dato("Recibido", b.recibido ? `+${eur(b.recibido)}` : "—", b.recibido ? "pos" : ""),
      dato("Enviado", b.enviado ? `−${eur(b.enviado)}` : "—"),
      dato("Diferencia", hay ? eurSigno(b.neto) : "—", hay ? claseSigno(b.neto) : "")));
}

/** Botones de elección única (categorías, detalle…). */
export function chips(opciones, valor, alElegir, etiqueta) {
  const caja = h("div", { class: "chips", role: "radiogroup", "aria-label": etiqueta });
  for (const o of opciones) {
    caja.append(h("button", {
      type: "button", class: "chip", role: "radio", "aria-checked": String(o.valor === valor),
      onclick: () => alElegir(o.valor),
    }, o.texto ?? o.valor));
  }
  return caja;
}

/* INICIO: toda la información del mes y del año, solo para ver (nada se puede modificar aquí). */
import { agenda, esAparte, mensualidadDeCategoria, movimientosDelMes, resumenAnio, resumenMes } from "../calculos.js";
import { subsDe } from "../catalogo.js";
import { controlMes, tarjetaBizum, tile } from "../componentes.js";
import { estado, ir } from "../estado.js";
import { MESES, MESES_CORTO, claseSigno, eur, eurSigno, enDias, fechaCorta, h, hoyISO } from "../util.js";

function tarjetaSobrante(r) {
  const pct = r.ingresos ? Math.round(r.gastos / r.ingresos * 100) : null;
  return h("div", { class: "tarjeta hero" },
    h("div", { class: "tile-label" }, `Te sobra en ${MESES[estado.mes - 1]}`),
    h("div", { class: "hero-valor " + claseSigno(r.ahorro) }, eurSigno(r.ahorro)),
    h("div", { class: "tile-sub" }, pct === null ? "Aún no hay ingresos este mes" : `Gastas el ${pct} % de lo que ingresas`));
}

function tarjetaCategorias(r) {
  const max = Math.max(...r.categorias.map(c => c.total), 1);
  const filas = r.categorias.map(c => {
    const fija = mensualidadDeCategoria(c.nombre);
    return h("div", { class: "cat" + (c.total ? "" : " vacia") },
      h("div", { class: "cat-cab" },
        h("span", {}, c.nombre, fija && [" ", h("span", { class: "etiqueta" }, "fijo")]),
        h("span", { class: "num" }, c.total ? eur(c.total) : "—")),
      c.total > 0 && h("div", { class: "barra" }, h("i", { style: `width:${(c.total / max * 100).toFixed(1)}%` })),
      c.total > 0 && subsDe("gasto", c.nombre).length > 0 && c.subs.length > 0
        && h("div", { class: "subs" }, c.subs.map(s => h("span", {}, `${s.nombre}: ${eur(s.total)}`))));
  });
  return h("div", { class: "tarjeta" }, h("h3", {}, "Gasto por categoría"),
    h("p", { class: "sub" }, "Lo fijo (IA, gimnasio) se apunta solo; lo demás, según lo vas metiendo."), filas);
}

function tarjetaProximos() {
  const lista = agenda(hoyISO(), 3);
  return h("div", { class: "tarjeta" }, h("h3", {}, "Próximos cobros fijos"),
    lista.length === 0 ? h("p", { class: "vacio" }, "No hay mensualidades activas.")
      : lista.map(({ fecha, dias, mensualidad }) => h("div", { class: "fila-lista" },
        h("div", {}, h("div", { class: "fuerte" }, mensualidad.nombre), h("div", { class: "desc" }, `${fechaCorta(fecha)} · ${enDias(dias)}`)),
        h("div", { class: "num" }, eur(mensualidad.importe_cent)))),
    h("button", { class: "enlace", onclick: () => ir("mensualidad") }, "Ver mensualidades →"));
}

function tarjetaAnio(anio) {
  const r = resumenAnio(anio);
  const t = r.totales;
  const fila = m => {
    const vacio = m.n === 0, futuro = m.mes > r.ultimo;
    const val = (v, f = eur) => h("td", { class: "num" + (vacio ? " apagado" : "") }, vacio ? "—" : f(v));
    return h("tr", {},
      h("th", { scope: "row" }, MESES_CORTO[m.mes - 1]),
      val(m.ingresos), val(m.gastos),
      h("td", { class: "num " + (vacio ? "apagado" : claseSigno(m.ahorro)) }, vacio ? "—" : eurSigno(m.ahorro)),
      h("td", { class: "num destacada" + (futuro ? " apagado" : "") }, futuro ? "—" : eur(m.acum_gastos)),
      h("td", { class: "num destacada " + (futuro ? "apagado" : claseSigno(m.acum_ahorro)) }, futuro ? "—" : eurSigno(m.acum_ahorro)));
  };
  const tabla = h("div", { class: "scroll" }, h("table", {},
    h("thead", {}, h("tr", {}, h("th", {}, "Mes"), h("th", { class: "num" }, "Ingresos"), h("th", { class: "num" }, "Gastos"),
      h("th", { class: "num" }, "Sobra"), h("th", { class: "num" }, "Gastado hasta aquí"), h("th", { class: "num" }, "Ahorrado hasta aquí"))),
    h("tbody", {}, r.meses.map(fila)),
    h("tfoot", {}, h("tr", {}, h("th", {}, "Total"), h("td", { class: "num" }, eur(t.ingresos)), h("td", { class: "num" }, eur(t.gastos)),
      h("td", { class: "num " + claseSigno(t.ahorro) }, eurSigno(t.ahorro)), h("td", {}), h("td", {})))));
  const matriz = h("div", { class: "scroll" }, h("table", {},
    h("thead", {}, h("tr", {}, h("th", {}, "Categoría"), MESES_CORTO.map(m => h("th", { class: "num" }, m)), h("th", { class: "num" }, "Total"))),
    h("tbody", {}, r.categorias.map(c => h("tr", {}, h("th", { scope: "row" }, c.nombre),
      c.meses.map(v => h("td", { class: "num" + (v ? "" : " apagado") }, v ? eur(v) : "—")),
      h("td", { class: "num destacada" }, c.total ? eur(c.total) : "—"))))));
  return h("div", { class: "tarjeta" }, h("h3", {}, `El año ${anio}, mes a mes`),
    h("p", { class: "sub" }, "Las dos últimas columnas suman los meses anteriores. Sin contar Bizum."), tabla,
    h("details", { class: "desplegable" }, h("summary", {}, "Gasto por categoría y mes"), matriz));
}

function tarjetaMovimientos(movs) {
  const cuerpo = movs.length === 0 ? h("p", { class: "vacio" }, "No hay movimientos este mes.")
    : movs.map(m => h("div", { class: "fila-lista" },
      h("div", { class: "izq" },
        h("div", { class: "fuerte" }, `${m.fecha.slice(8, 10)}/${m.fecha.slice(5, 7)} · ${m.categoria}${m.subcategoria ? ` · ${m.subcategoria}` : ""}`,
          esAparte(m.categoria) && [" ", h("span", { class: "etiqueta" }, "aparte")],
          m.origen === "mensualidad" && [" ", h("span", { class: "etiqueta" }, "fijo")]),
        m.descripcion && h("div", { class: "desc" }, m.descripcion)),
      h("div", { class: "num " + (m.tipo === "ingreso" ? "pos" : "") }, (m.tipo === "ingreso" ? "+" : "−") + eur(m.importe_cent))));
  return h("div", { class: "tarjeta" }, h("h3", {}, `Movimientos de ${MESES[estado.mes - 1]}`), cuerpo);
}

export function vistaInicio() {
  const { anio, mes } = estado;
  const r = resumenMes(anio, mes);
  return h("div", { class: "vista" },
    controlMes(),
    tarjetaSobrante(r),
    h("div", { class: "tiles" },
      tile("Ingresos", eur(r.ingresos), "", "Sin contar Bizum"),
      tile("Gastos", eur(r.gastos), "", "Sin contar Bizum")),
    tile("Gastado en el año", eur(r.acum.gastos), "", `Hasta ${MESES[mes - 1]} · ahorro acumulado ${eurSigno(r.acum.ahorro)}`),
    tarjetaCategorias(r),
    tarjetaBizum(r.bizum, "Este mes. No cuenta en ingresos, gastos ni ahorro."),
    tarjetaProximos(),
    tarjetaAnio(anio),
    tarjetaMovimientos(movimientosDelMes(anio, mes)));
}

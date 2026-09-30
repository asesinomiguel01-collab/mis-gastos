/* MODIFICAR: aquí se mete y se cambia todo (movimientos, mensualidades, importación del banco y copias). */
import {
  ErrorDatos, anadirMovimiento, borrarMensualidad, borrarMovimiento, borrarRegla, confirmarImportacion, datos,
  editarMovimiento, exportar, guardarMensualidad, guardarRegla, restaurar,
} from "../almacen.js";
import { aplicarMensualidades, esAparte, movimientosDelMes } from "../calculos.js";
import { CATEGORIAS, subsDe, tipoDe } from "../catalogo.js";
import { chips, controlMes } from "../componentes.js";
import { estado, gancho } from "../estado.js";
import { compilarReglas, leerExtracto } from "../importador.js";
import { aviso, descargar, eur, fechaCorta, h, hoyISO } from "../util.js";

/* ------------------------------------------------------------ movimientos */

function formulario() {
  const ed = estado.editando;
  const base = ed || estado.ultimo || {};
  const s = { tipo: base.tipo || "gasto", categoria: base.categoria || null, sub: base.subcategoria || null };

  const zonaTipo = h("div"), zonaCat = h("div"), zonaSub = h("div");
  const inFecha = h("input", { type: "date", required: true });
  inFecha.value = ed ? ed.fecha : hoyISO();
  const inImporte = h("input", { type: "text", inputmode: "decimal", placeholder: "0,00", required: true, autocomplete: "off", "aria-label": "Importe en euros" });
  if (ed) inImporte.value = (ed.importe_cent / 100).toFixed(2).replace(".", ",");
  const inNota = h("input", { type: "text", maxlength: 200, placeholder: "Opcional", autocomplete: "off" });
  if (ed) inNota.value = ed.descripcion;
  const error = h("p", { class: "error", hidden: true });

  function pintar() {
    if (!CATEGORIAS[s.tipo].some(c => c.nombre === s.categoria)) s.categoria = CATEGORIAS[s.tipo][0].nombre;
    const subs = subsDe(s.tipo, s.categoria);
    if (!subs.includes(s.sub)) s.sub = null;
    zonaTipo.replaceChildren(chips([{ valor: "gasto", texto: "Gasto" }, { valor: "ingreso", texto: "Ingreso" }], s.tipo,
      v => { s.tipo = v; s.categoria = null; s.sub = null; pintar(); }, "Tipo"));
    zonaCat.replaceChildren(chips(CATEGORIAS[s.tipo].map(c => ({ valor: c.nombre })), s.categoria,
      v => { s.categoria = v; s.sub = null; pintar(); }, "Categoría"));
    zonaSub.replaceChildren(...(subs.length ? [h("div", { class: "etiqueta-campo" }, "Detalle"),
      chips([{ valor: "", texto: "Sin detalle" }, ...subs.map(x => ({ valor: x }))], s.sub || "", v => { s.sub = v || null; pintar(); }, "Detalle")] : []));
  }
  pintar();

  async function guardar(e) {
    e.preventDefault();
    error.hidden = true;
    const cuerpo = { tipo: s.tipo, fecha: inFecha.value, categoria: s.categoria, subcategoria: s.sub, importe: inImporte.value, descripcion: inNota.value };
    try {
      if (ed) await editarMovimiento(ed.id, cuerpo);
      else await anadirMovimiento(cuerpo);
    } catch (err) {
      if (!(err instanceof ErrorDatos)) throw err;
      error.textContent = err.message;
      error.hidden = false;
      return;
    }
    estado.ultimo = { tipo: s.tipo, categoria: s.categoria, subcategoria: s.sub };
    estado.editando = null;
    [estado.anio, estado.mes] = cuerpo.fecha.split("-").map(Number);
    aviso(ed ? "Cambios guardados" : "Movimiento guardado");
    gancho.render();
  }

  return h("div", { class: "tarjeta", id: "form-mov" },
    h("h3", {}, ed ? "Editar movimiento" : "Añadir movimiento"),
    h("form", { class: "form", onsubmit: guardar },
      zonaTipo,
      h("label", {}, "Importe (€)", inImporte),
      h("div", { class: "etiqueta-campo" }, "Categoría"), zonaCat, zonaSub,
      h("div", { class: "fila" }, h("label", {}, "Fecha", inFecha), h("label", {}, "Nota", inNota)),
      error,
      h("div", { class: "form-acciones" },
        h("button", { class: "btn", type: "submit" }, ed ? "Guardar cambios" : "Añadir"),
        ed && h("button", { class: "btn sec", type: "button", onclick: () => { estado.editando = null; gancho.render(); } }, "Cancelar"))));
}

async function editar(m) {
  estado.editando = m;
  gancho.render();
  document.getElementById("form-mov")?.scrollIntoView({ block: "center", behavior: "smooth" });
}

async function borrar(m) {
  if (!confirm(`¿Borrar este movimiento?\n\n${m.categoria} · ${eur(m.importe_cent)} (${fechaCorta(m.fecha)})`)) return;
  await borrarMovimiento(m.id);
  aviso("Movimiento borrado");
  gancho.render();
}

function listaMovimientos() {
  const movs = movimientosDelMes(estado.anio, estado.mes);
  const cuerpo = movs.length === 0 ? h("p", { class: "vacio" }, "No hay movimientos este mes.")
    : movs.map(m => h("div", { class: "fila-lista" },
      h("div", { class: "izq" },
        h("div", { class: "fuerte" }, `${m.fecha.slice(8, 10)}/${m.fecha.slice(5, 7)} · ${m.categoria}${m.subcategoria ? ` · ${m.subcategoria}` : ""}`,
          esAparte(m.categoria) && [" ", h("span", { class: "etiqueta" }, "aparte")],
          m.origen === "mensualidad" && [" ", h("span", { class: "etiqueta" }, "fijo")]),
        m.descripcion && h("div", { class: "desc" }, m.descripcion),
        h("div", { class: "acciones" },
          h("button", { class: "enlace", onclick: () => editar(m) }, "Editar"),
          h("button", { class: "enlace peligro", onclick: () => borrar(m) }, "Borrar"))),
      h("div", { class: "num " + (m.tipo === "ingreso" ? "pos" : "") }, (m.tipo === "ingreso" ? "+" : "−") + eur(m.importe_cent))));
  return h("div", { class: "tarjeta" }, h("h3", {}, "Movimientos del mes"), cuerpo);
}

function seccionMovimientos() {
  return [formulario(), controlMes(), listaMovimientos()];
}

/* ---------------------------------------------------------- mensualidades */

function formMensualidad(m) {
  const nuevo = !m;
  const inNombre = h("input", { type: "text", maxlength: 60, required: true, autocomplete: "off" });
  const selCat = h("select", { "aria-label": "Categoría" }, CATEGORIAS.gasto.map(c => h("option", { value: c.nombre }, c.nombre)));
  const inImporte = h("input", { type: "text", inputmode: "decimal", required: true, autocomplete: "off", placeholder: "0,00" });
  const inCada = h("input", { type: "number", min: 1, max: 52, step: 1, required: true, inputmode: "numeric" });
  const selUnidad = h("select", { "aria-label": "Unidad" }, h("option", { value: "meses" }, "meses"), h("option", { value: "semanas" }, "semanas"));
  const inAncla = h("input", { type: "date", required: true });
  const cajaActiva = h("input", { type: "checkbox" });
  const error = h("p", { class: "error", hidden: true });

  inNombre.value = m?.nombre ?? "";
  selCat.value = m?.categoria ?? "Otros";
  inImporte.value = m ? (m.importe_cent / 100).toFixed(2).replace(".", ",") : "";
  inCada.value = m?.cada ?? 1;
  selUnidad.value = m?.unidad ?? "meses";
  inAncla.value = m?.ancla ?? hoyISO();
  cajaActiva.checked = m ? m.activa : true;

  async function enviar(e) {
    e.preventDefault();
    error.hidden = true;
    try {
      await guardarMensualidad({
        nombre: inNombre.value, categoria: selCat.value, importe: inImporte.value, cada: inCada.value,
        unidad: selUnidad.value, ancla: inAncla.value, activa: cajaActiva.checked,
      }, m?.id ?? null);
      await aplicarMensualidades(hoyISO());
    } catch (err) {
      if (!(err instanceof ErrorDatos)) throw err;
      error.textContent = err.message;
      error.hidden = false;
      return;
    }
    aviso(nuevo ? "Mensualidad añadida" : "Mensualidad guardada");
    gancho.render();
  }
  async function eliminar() {
    if (!confirm(`¿Eliminar «${m.nombre}»? Los cobros ya apuntados no se borran.`)) return;
    await borrarMensualidad(m.id);
    aviso("Mensualidad eliminada");
    gancho.render();
  }

  return h("form", { class: "form", onsubmit: enviar },
    h("label", {}, "Nombre", inNombre),
    h("div", { class: "fila" }, h("label", {}, "Categoría", selCat), h("label", {}, "Importe (€)", inImporte)),
    h("div", { class: "fila" }, h("label", {}, "Se cobra cada", inCada), h("label", {}, "Unidad", selUnidad)),
    h("label", {}, "Fecha de un cobro real (el último, por ejemplo)", inAncla),
    h("p", { class: "desc" }, "A partir de esa fecha se calculan los siguientes y se apuntan solos como gasto el día que llegan."),
    h("label", { class: "opcion" }, cajaActiva, "Activa"),
    error,
    h("div", { class: "form-acciones" },
      h("button", { class: "btn", type: "submit" }, nuevo ? "Añadir mensualidad" : "Guardar"),
      !nuevo && h("button", { class: "btn sec peligro", type: "button", onclick: eliminar }, "Eliminar")));
}

function seccionMensualidades() {
  return [
    ...datos.mensualidades.map(m => h("details", { class: "tarjeta desplegable" },
      h("summary", {}, `${m.nombre} · ${eur(m.importe_cent)}${m.activa ? "" : " (en pausa)"}`), formMensualidad(m))),
    h("details", { class: "tarjeta desplegable", open: datos.mensualidades.length === 0 }, h("summary", {}, "＋ Añadir mensualidad"), formMensualidad(null)),
  ];
}

/* --------------------------------------------------------------- importar */

function opcionesCategoria(tipo) {
  return CATEGORIAS[tipo].map(c => h("option", { value: c.nombre }, c.nombre));
}

function tarjetaSubida() {
  const archivo = h("input", { type: "file", accept: ".csv,.txt,text/csv,text/plain" });
  const error = h("p", { class: "error", hidden: true });
  async function leer() {
    error.hidden = true;
    if (!archivo.files[0]) { error.textContent = "Elige primero un archivo CSV."; error.hidden = false; return; }
    try {
      const { movimientos, saltadas } = leerExtracto(await archivo.files[0].arrayBuffer(), compilarReglas(datos.reglas));
      const existentes = new Set(datos.movimientos.map(m => m.huella).filter(Boolean));
      estado.importacion = movimientos.map(f => ({ ...f, duplicado: existentes.has(f.huella), incluir: !existentes.has(f.huella) }));
      estado.saltadas = saltadas;
      gancho.render();
    } catch (err) {
      if (!(err instanceof ErrorDatos)) throw err;
      error.textContent = err.message;
      error.hidden = false;
    }
  }
  return h("div", { class: "tarjeta" }, h("h3", {}, "Importar movimientos del banco"),
    h("p", { class: "sub" }, "Descarga los movimientos en CSV desde la app de tu banco y elígelos aquí. Antes de guardar podrás revisar y cambiar cada categoría. "
      + "Si subes el mismo archivo dos veces, los repetidos se detectan y no se duplican."),
    h("label", {}, "Archivo CSV", archivo),
    h("button", { class: "btn", type: "button", onclick: leer }, "Leer archivo"), error);
}

function tarjetaPrevia() {
  const filas = estado.importacion;
  const resumen = h("p", { class: "resumen-import" });
  const boton = h("button", { class: "btn", type: "button" });
  const opcion = (texto, marcada, alCambiar) => {
    const caja = h("input", { type: "checkbox" });
    caja.checked = marcada;
    if (alCambiar) caja.addEventListener("change", alCambiar);
    return [h("label", { class: "opcion" }, caja, texto), caja];
  };
  const [etPendientes, cajaPendientes] = opcion("Mostrar solo los sin clasificar", false, () => {
    for (const f of filas) f._fila.hidden = cajaPendientes.checked && (f.clasificado || f.duplicado);
  });
  const [etIguales, cajaIguales] = opcion("Al cambiar una categoría, aplicarla a los movimientos con el mismo concepto", true);
  const [etRecordar, cajaRecordar] = opcion("Recordar las categorías que cambie para próximas importaciones", true);

  function actualizar() {
    const elegidas = filas.filter(f => f.incluir);
    const sinClasificar = elegidas.filter(f => !f.clasificado).length;
    const repetidas = filas.filter(f => f.duplicado).length;
    resumen.textContent = `${filas.length} movimientos leídos`
      + (repetidas ? ` · ${repetidas} ya importados antes` : "")
      + (estado.saltadas ? ` · ${estado.saltadas} líneas ignoradas` : "")
      + (sinClasificar ? ` · ${sinClasificar} sin clasificar (van a «Otros»)` : "");
    boton.textContent = `Importar ${elegidas.length} movimientos`;
    boton.disabled = elegidas.length === 0;
  }

  const filaImport = f => {
    const selCat = h("select", { "aria-label": "Categoría" }, opcionesCategoria(f.tipo));
    const selSub = h("select", { "aria-label": "Detalle" });
    const pintarSubs = () => {
      const subs = subsDe(f.tipo, f.categoria);
      selSub.replaceChildren(h("option", { value: "" }, "Sin detalle"), ...subs.map(s => h("option", { value: s }, s)));
      selSub.value = f.subcategoria || "";
      selSub.hidden = subs.length === 0;
    };
    f._refrescar = () => { selCat.value = f.categoria; pintarSubs(); };
    f._refrescar();
    // El cambio se aplica a esta fila y, si está marcado, a las que tienen el mismo concepto.
    const afectadas = () => [f, ...(cajaIguales.checked ? filas.filter(g => g !== f && g.tipo === f.tipo && g.descripcion === f.descripcion) : [])];
    selCat.addEventListener("change", () => {
      for (const g of afectadas()) { Object.assign(g, { categoria: selCat.value, subcategoria: null, clasificado: true, manual: true }); g._refrescar(); }
      actualizar();
    });
    selSub.addEventListener("change", () => {
      for (const g of afectadas()) { Object.assign(g, { subcategoria: selSub.value || null, manual: true }); g._refrescar(); }
    });
    const marca = h("input", { type: "checkbox", "aria-label": "Importar este movimiento" });
    marca.checked = f.incluir;
    marca.addEventListener("change", () => { f.incluir = marca.checked; actualizar(); });
    return f._fila = h("div", { class: "fila-import" + (f.duplicado ? " duplicada" : "") },
      marca,
      h("div", { class: "izq" }, h("div", { class: "fuerte" }, f.descripcion || "(sin concepto)"),
        h("div", { class: "desc" }, fechaCorta(f.fecha), f.duplicado && [" ", h("span", { class: "etiqueta" }, "ya importado")])),
      h("div", { class: "num " + (f.tipo === "ingreso" ? "pos" : "") }, (f.tipo === "ingreso" ? "+" : "−") + eur(f.importe_cent)),
      h("div", { class: "selects" }, selCat, selSub));
  };

  async function confirmar() {
    const enviadas = filas.filter(f => f.incluir).map(f => ({
      fecha: f.fecha, tipo: f.tipo, categoria: f.categoria, subcategoria: f.subcategoria,
      importe_cent: f.importe_cent, descripcion: f.descripcion, huella: f.huella,
    }));
    try {
      const r = await confirmarImportacion(enviadas);
      if (cajaRecordar.checked) {
        const vistas = new Map();
        for (const f of filas) if (f.incluir && f.manual && f.descripcion) vistas.set(f.descripcion, f);
        for (const f of vistas.values()) await guardarRegla({ palabra: f.descripcion, categoria: f.categoria, subcategoria: f.subcategoria });
      }
      const ultima = enviadas.map(f => f.fecha).sort().pop();
      estado.importacion = null;
      estado.vista = "inicio";
      [estado.anio, estado.mes] = ultima.split("-").map(Number);
      aviso(`${r.insertados} movimientos importados`
        + (r.sustituidos ? ` · ${r.sustituidos} cobros fijos sustituidos por los reales` : "")
        + (r.ignorados ? ` · ${r.ignorados} repetidos ignorados` : ""));
      gancho.render();
      window.scrollTo(0, 0);
    } catch (err) {
      if (!(err instanceof ErrorDatos)) throw err;
      aviso(err.message);
    }
  }
  boton.addEventListener("click", confirmar);
  actualizar();

  return h("div", { class: "tarjeta" }, h("h3", {}, "Revisa antes de guardar"), resumen,
    h("div", { class: "opciones" }, etPendientes, etIguales, etRecordar),
    h("div", { class: "lista-import" }, filas.map(filaImport)),
    h("div", { class: "form-acciones" }, boton,
      h("button", { class: "btn sec", type: "button", onclick: () => { estado.importacion = null; gancho.render(); } }, "Descartar")));
}

function tarjetaReglas() {
  const palabra = h("input", { type: "text", placeholder: "p. ej. mercadona", autocomplete: "off", required: true });
  const selCat = h("select", { "aria-label": "Categoría" },
    ["gasto", "ingreso"].map(t => h("optgroup", { label: t === "gasto" ? "Gastos" : "Ingresos" }, opcionesCategoria(t))));
  const selSub = h("select", { "aria-label": "Detalle" });
  const etiquetaSub = h("label", {}, "Detalle", selSub);
  const error = h("p", { class: "error", hidden: true });
  function pintarSubs() {
    const subs = subsDe(tipoDe(selCat.value), selCat.value);
    selSub.replaceChildren(h("option", { value: "" }, "Sin detalle"), ...subs.map(s => h("option", { value: s }, s)));
    etiquetaSub.hidden = subs.length === 0;
  }
  selCat.addEventListener("change", pintarSubs);
  pintarSubs();

  async function anadir(e) {
    e.preventDefault();
    error.hidden = true;
    try {
      await guardarRegla({ palabra: palabra.value, categoria: selCat.value, subcategoria: selSub.value || null });
      aviso("Regla guardada");
      gancho.render();
    } catch (err) {
      if (!(err instanceof ErrorDatos)) throw err;
      error.textContent = err.message;
      error.hidden = false;
    }
  }
  const reglas = [...datos.reglas].sort((a, b) => a.palabra.localeCompare(b.palabra));
  return h("div", { class: "tarjeta" }, h("h3", {}, "Clasificación automática"),
    h("p", { class: "sub" }, "Si el concepto de un movimiento contiene la palabra, se le pone esa categoría al importar."),
    h("form", { class: "form", onsubmit: anadir },
      h("label", {}, "Si el concepto contiene", palabra), h("label", {}, "Categoría", selCat), etiquetaSub,
      h("button", { class: "btn", type: "submit" }, "Añadir regla"), error),
    h("details", { class: "desplegable" }, h("summary", {}, `Ver las ${reglas.length} reglas`),
      reglas.map(r => h("div", { class: "fila-lista" },
        h("div", {}, h("div", { class: "fuerte" }, r.palabra), h("div", { class: "desc" }, r.categoria + (r.subcategoria ? ` · ${r.subcategoria}` : ""))),
        h("button", { class: "enlace peligro", onclick: async () => { await borrarRegla(r.id); gancho.render(); } }, "Quitar")))));
}

function seccionImportar() {
  return [tarjetaSubida(), estado.importacion && tarjetaPrevia(), tarjetaReglas()];
}

/* ------------------------------------------------------------------ copia */

function seccionCopia() {
  const archivo = h("input", { type: "file", accept: ".json,application/json" });
  const error = h("p", { class: "error", hidden: true });
  const proteccion = h("span", {}, "comprobando…");
  navigator.storage?.persisted?.().then(p => { proteccion.textContent = p ? "sí" : "no (el móvil podría borrarlos si se queda sin espacio)"; }).catch(() => { proteccion.textContent = "desconocido"; });

  async function guardarCopia() {
    const texto = await exportar();
    const nombre = `mis-gastos-${hoyISO()}.json`;
    const archivoCopia = new File([texto], nombre, { type: "application/json" });
    try {
      if (navigator.canShare?.({ files: [archivoCopia] })) await navigator.share({ files: [archivoCopia], title: "Copia de Mis gastos" });
      else descargar(nombre, texto);
      aviso("Copia guardada");
    } catch (err) {
      if (err.name !== "AbortError") descargar(nombre, texto);
    }
    gancho.render();
  }
  async function restaurarCopia() {
    error.hidden = true;
    if (!archivo.files[0]) { error.textContent = "Elige primero el archivo de la copia."; error.hidden = false; return; }
    if (!confirm("Se sustituirán TODOS los datos actuales por los de la copia. ¿Continuar?")) return;
    try {
      await restaurar(await archivo.files[0].text());
      aviso("Copia restaurada");
      gancho.render();
    } catch (err) {
      if (!(err instanceof ErrorDatos)) throw err;
      error.textContent = err.message;
      error.hidden = false;
    }
  }
  return [
    h("div", { class: "tarjeta" }, h("h3", {}, "Copia de seguridad"),
      h("p", { class: "sub" }, "Tus datos están solo en este móvil. Si borras los datos de Chrome o desinstalas la app, se pierden. Guarda una copia de vez en cuando (por ejemplo, en Drive)."),
      h("p", {}, "Última copia: ", h("strong", {}, datos.ultimaCopia ? fechaCorta(datos.ultimaCopia) : "nunca")),
      h("p", { class: "desc" }, "Almacenamiento protegido: ", proteccion),
      h("button", { class: "btn", type: "button", onclick: guardarCopia }, "Guardar copia")),
    h("div", { class: "tarjeta" }, h("h3", {}, "Restaurar una copia"),
      h("label", {}, "Archivo de la copia (.json)", archivo),
      h("button", { class: "btn sec", type: "button", onclick: restaurarCopia }, "Restaurar"), error),
  ];
}

/* ----------------------------------------------------------------- vista */

const SECCIONES = [["movimientos", "Movimientos"], ["mensualidades", "Mensualidades"], ["importar", "Importar banco"], ["copia", "Copia"]];

export function vistaModificar() {
  const cuerpo = { movimientos: seccionMovimientos, mensualidades: seccionMensualidades, importar: seccionImportar, copia: seccionCopia }[estado.seccion]();
  return h("div", { class: "vista" },
    h("h2", { class: "titulo" }, "Modificar"),
    h("div", { class: "pildoras", role: "group", "aria-label": "Qué quieres modificar" }, SECCIONES.map(([id, texto]) =>
      h("button", { type: "button", "aria-pressed": String(estado.seccion === id), onclick: () => { Object.assign(estado, { seccion: id, editando: null }); gancho.render(); } }, texto))),
    cuerpo);
}

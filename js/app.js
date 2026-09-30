/* Arranque de la aplicación: carga los datos del móvil, dibuja la pantalla y gestiona la barra inferior. */
import { cargar } from "./almacen.js";
import { aplicarMensualidades } from "./calculos.js";
import { estado, gancho } from "./estado.js";
import { h, hoyISO } from "./util.js";
import { vistaEstadisticas } from "./vistas/estadisticas.js";
import { vistaInicio } from "./vistas/inicio.js";
import { vistaMensualidad } from "./vistas/mensualidad.js";
import { vistaModificar } from "./vistas/modificar.js";

const VISTAS = { inicio: vistaInicio, mensualidad: vistaMensualidad, estadisticas: vistaEstadisticas, modificar: vistaModificar };
const globo = document.getElementById("tip");

function render() {
  globo.hidden = true;
  for (const b of document.querySelectorAll("#nav button")) {
    b.setAttribute("aria-current", b.dataset.vista === estado.vista ? "page" : "false");
  }
  let contenido;
  try {
    contenido = VISTAS[estado.vista]();
  } catch (err) {
    console.error(err);
    contenido = h("div", { class: "tarjeta" }, h("p", { class: "error" }, `Ha ocurrido un error: ${err.message}`));
  }
  const y = window.scrollY;
  document.getElementById("vista").replaceChildren(contenido);
  window.scrollTo(0, y);
}
gancho.render = render;

document.getElementById("nav").addEventListener("click", e => {
  const boton = e.target.closest("button[data-vista]");
  if (!boton) return;
  Object.assign(estado, { vista: boton.dataset.vista, editando: null });
  render();
  window.scrollTo(0, 0);
});

/* Detalle de los gráficos: se muestra al tocar (o al pulsar con el ratón). */
document.addEventListener("click", e => {
  const el = e.target instanceof Element ? e.target.closest("[data-tip]") : null;
  if (!el) { globo.hidden = true; return; }
  globo.textContent = el.dataset.tip;
  globo.hidden = false;
  const x = Math.min(Math.max(8, e.clientX - globo.offsetWidth / 2), window.innerWidth - globo.offsetWidth - 8);
  const arriba = e.clientY - globo.offsetHeight - 16;
  globo.style.left = `${x}px`;
  globo.style.top = `${arriba < 8 ? e.clientY + 20 : arriba}px`;
});
window.addEventListener("scroll", () => { globo.hidden = true; }, { passive: true });

(async () => {
  try {
    await cargar();
    await aplicarMensualidades(hoyISO());
  } catch (err) {
    console.error(err);
    document.getElementById("vista").textContent = `No puedo abrir el almacenamiento de este móvil: ${err.message}`;
    return;
  }
  render();
  // Al volver a abrir la app otro día, se apuntan los cobros fijos que hayan llegado.
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && await aplicarMensualidades(hoyISO())) render();
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
})();

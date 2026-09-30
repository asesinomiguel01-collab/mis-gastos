/* Estado de la pantalla compartido por todas las vistas. */
const hoy = new Date();

export const estado = {
  vista: "inicio",          // inicio | mensualidad | estadisticas | modificar
  anio: hoy.getFullYear(),
  mes: hoy.getMonth() + 1,
  seccion: "movimientos",   // dentro de Modificar: movimientos | mensualidades | importar | copia
  editando: null,           // movimiento que se está editando
  ultimo: null,             // última categoría usada, para agilizar la siguiente entrada
  importacion: null,        // filas del CSV pendientes de confirmar
  saltadas: 0,
};

// app.js rellena esto con la función que vuelve a dibujar la pantalla.
export const gancho = { render: () => {} };

export function ir(vista) {
  Object.assign(estado, { vista, editando: null });
  gancho.render();
  window.scrollTo(0, 0);
}

export function moverAnio(d) {
  estado.anio += d;
  gancho.render();
}

export function moverMes(d) {
  let m = estado.mes + d, a = estado.anio;
  if (m < 1) { m = 12; a--; }
  if (m > 12) { m = 1; a++; }
  Object.assign(estado, { mes: m, anio: a, editando: null });
  gancho.render();
}
export function irAHoy() {
  const h = new Date();
  Object.assign(estado, { anio: h.getFullYear(), mes: h.getMonth() + 1, editando: null });
  gancho.render();
}

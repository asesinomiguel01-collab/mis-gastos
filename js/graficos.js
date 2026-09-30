/* Gráficos SVG sin librerías. Se dibujan al ancho real de su tarjeta para que el texto se lea bien en el móvil. */
import { MESES, MESES_CORTO, cap, esc, eur, eurSigno, eurEuros0, fmtCompacto, h } from "./util.js";

const medidas = W => ({ W, H: 260, l: W < 480 ? 46 : 62, t: 12, b: 28, estrecho: W < 480 });

function escala(maxCent) {
  const max = Math.max(maxCent / 100, 1);
  const bruto = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / potencia;
  const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * potencia;
  return { paso, tope: Math.ceil(max / paso) * paso };
}

function armazon(med, tope, paso, margenDer) {
  const base = med.H - med.b, ancho = med.W - med.l - margenDer;
  const y = v => med.t + (base - med.t) * (1 - v / tope);
  const banda = ancho / 12;
  const x = i => med.l + banda * i + banda / 2;
  const formato = v => (med.estrecho ? fmtCompacto.format(v) : eurEuros0(v));
  let html = "";
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    html += `<line class="${v === 0 ? "eje" : "rejilla"}" x1="${med.l}" x2="${(med.l + ancho).toFixed(1)}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`
      + `<text x="${med.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(formato(v))}</text>`;
  }
  MESES_CORTO.forEach((mes, i) => {
    html += `<text x="${x(i).toFixed(1)}" y="${med.H - 8}" text-anchor="middle">${banda < 26 ? mes[0] : mes}</text>`;
  });
  return { y, x, banda, base, html };
}

const barra = (x, w, y, base, color) => {
  const alto = base - y;
  if (alto < 0.5) return "";
  const r = Math.min(4, alto, w / 2);
  return `<path fill="${color}" d="M${x.toFixed(1)},${base} V${(y + r).toFixed(1)} Q${x.toFixed(1)},${y.toFixed(1)} ${(x + r).toFixed(1)},${y.toFixed(1)} `
    + `H${(x + w - r).toFixed(1)} Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + r).toFixed(1)} V${base} Z"/>`;
};

const zonaMes = (med, g, i, tip) =>
  `<rect class="hit" x="${(g.x(i) - g.banda / 2).toFixed(1)}" y="${med.t}" width="${g.banda.toFixed(1)}" height="${g.base - med.t}" data-tip="${esc(tip)}"/>`;

export function graficoColumnas(med, meses) {
  const { tope, paso } = escala(Math.max(...meses.map(m => Math.max(m.ingresos, m.gastos))));
  const g = armazon(med, tope, paso, 8);
  const w = Math.min(18, g.banda * 0.32);
  let marcas = "", zonas = "";
  meses.forEach((m, i) => {
    const cx = g.x(i);
    marcas += barra(cx - w - 1, w, g.y(m.ingresos / 100), g.base, "var(--ingresos)")
      + barra(cx + 1, w, g.y(m.gastos / 100), g.base, "var(--gastos)");
    zonas += zonaMes(med, g, i, m.n === 0 ? `${cap(MESES[i])}\nSin movimientos`
      : `${cap(MESES[i])}\nIngresos: ${eur(m.ingresos)}\nGastos: ${eur(m.gastos)}\nSobra: ${eurSigno(m.ahorro)}`);
  });
  return `<svg viewBox="0 0 ${med.W} ${med.H}" role="img" aria-label="Ingresos y gastos de cada mes">${g.html}${marcas}${zonas}</svg>`;
}

export function graficoAcumulado(med, meses, ultimo) {
  const activos = meses.filter(m => m.mes <= ultimo);
  const { tope, paso } = escala(Math.max(...activos.map(m => Math.max(m.acum_ingresos, m.acum_gastos))));
  const g = armazon(med, tope, paso, med.estrecho ? 70 : 112);
  const trazo = clave => activos.map((m, i) => `${i ? "L" : "M"}${g.x(i).toFixed(1)},${g.y(m[clave] / 100).toFixed(1)}`).join(" ");
  const ult = activos[activos.length - 1];
  const xf = g.x(activos.length - 1);
  const yIng = g.y(ult.acum_ingresos / 100), yGas = g.y(ult.acum_gastos / 100);
  const series = [["acum_ingresos", "var(--ingresos)", "Ingresos", yIng], ["acum_gastos", "var(--gastos)", "Gastos", yGas]];
  // Si los dos finales quedan muy juntos se separan las etiquetas (no los puntos).
  const sep = 30, medio = (yIng + yGas) / 2;
  const etiquetas = Math.abs(yIng - yGas) < sep
    ? (yIng <= yGas ? [medio - sep / 2, medio + sep / 2] : [medio + sep / 2, medio - sep / 2]) : [yIng, yGas];

  let lineas = "", extremos = "", zonas = "";
  series.forEach(([clave, color, nombre, y], i) => {
    lineas += `<path d="${trazo(clave)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    extremos += `<circle class="punto" cx="${xf.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${color}"/>`
      + `<text class="fin fuerte" x="${(xf + 11).toFixed(1)}" y="${(etiquetas[i] - 2).toFixed(1)}">${nombre}</text>`
      + `<text class="fin" x="${(xf + 11).toFixed(1)}" y="${(etiquetas[i] + 12).toFixed(1)}">${esc(eurEuros0(ult[clave] / 100))}</text>`;
  });
  activos.forEach((m, i) => {
    zonas += zonaMes(med, g, i, `${cap(MESES[m.mes - 1])} (acumulado)\nIngresado: ${eur(m.acum_ingresos)}\nGastado: ${eur(m.acum_gastos)}\nAhorrado: ${eurSigno(m.acum_ahorro)}`);
  });
  return `<svg viewBox="0 0 ${med.W} ${med.H}" role="img" aria-label="Ingresos y gastos acumulados durante el año">${g.html}${lineas}${zonas}${extremos}</svg>`;
}

export function leyenda(elementos) {
  return h("div", { class: "leyenda" }, elementos.map(([color, texto]) =>
    h("span", {}, h("i", { class: "marca", style: `background:${color}` }), texto)));
}

/** `dibujar(medidas)` devuelve el SVG; se vuelve a llamar cada vez que cambia el ancho de la tarjeta. */
export function tarjetaGrafico(titulo, subtitulo, elementosLeyenda, dibujar) {
  const cuadro = h("div", { class: "grafico" });
  let anchoAnterior = 0;
  new ResizeObserver(([entrada]) => {
    const ancho = Math.round(entrada.contentRect.width);
    if (ancho < 200 || ancho === anchoAnterior) return;
    anchoAnterior = ancho;
    cuadro.innerHTML = dibujar(medidas(Math.min(ancho, 700)));
  }).observe(cuadro);
  return h("div", { class: "tarjeta" }, h("h3", {}, titulo), h("p", { class: "sub" }, subtitulo), leyenda(elementosLeyenda), cuadro);
}

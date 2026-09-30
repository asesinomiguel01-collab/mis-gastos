/* Categorías, reglas de clasificación y mensualidades iniciales. */

// El orden de este objeto es el orden en el que se muestran las categorías.
export const CATEGORIAS = {
  gasto: [
    { nombre: "Gasolina", subs: [] },
    { nombre: "IA", subs: [] },
    { nombre: "Gimnasio", subs: [] },
    { nombre: "Salir", subs: ["Cine", "Restaurante", "Amigos", "Otros"] },
    { nombre: "Ropa", subs: ["Chaqueta", "Zapatos", "Camisetas", "Pantalones", "Otros"] },
    { nombre: "Imprevistos", subs: ["Coche", "Casa", "Moto", "Compra urgente", "Otros"] },
    { nombre: "Bizum enviado", subs: [] },
    { nombre: "Otros", subs: [] },
  ],
  ingreso: [
    { nombre: "Nómina", subs: [] },
    { nombre: "Bizum recibido", subs: [] },
    { nombre: "Otros ingresos", subs: [] },
  ],
};

// No cuentan en ingresos, gastos, ahorro ni estadísticas: se muestran aparte.
export const APARTE = new Set(["Bizum enviado", "Bizum recibido"]);

export const tipoDe = nombre => Object.keys(CATEGORIAS).find(t => CATEGORIAS[t].some(c => c.nombre === nombre)) || null;
export const subsDe = (tipo, nombre) => (CATEGORIAS[tipo].find(c => c.nombre === nombre) || { subs: [] }).subs;

// [palabra que aparece en el concepto, categoría, subcategoría]
export const REGLAS_INICIALES = [
  ["repsol", "Gasolina"], ["cepsa", "Gasolina"], ["moeve", "Gasolina"], ["shell", "Gasolina"],
  ["galp", "Gasolina"], ["petronor", "Gasolina"], ["ballenoil", "Gasolina"], ["plenoil", "Gasolina"],
  ["gasolinera", "Gasolina"], ["gasoil", "Gasolina"], ["petroprix", "Gasolina"], ["gasexpress", "Gasolina"],
  ["gasolineras", "Gasolina"],
  ["openai", "IA"], ["chatgpt", "IA"], ["anthropic", "IA"], ["claude", "IA"], ["midjourney", "IA"],
  ["perplexity", "IA"], ["cursor", "IA"],
  ["gimnasio", "Gimnasio"], ["gym", "Gimnasio"], ["basic-fit", "Gimnasio"], ["basicfit", "Gimnasio"],
  ["mcfit", "Gimnasio"], ["altafit", "Gimnasio"], ["vivagym", "Gimnasio"], ["fitnesspark", "Gimnasio"],
  ["fp nuevacondomina", "Gimnasio"],
  ["cinesa", "Salir", "Cine"], ["yelmo", "Salir", "Cine"], ["kinepolis", "Salir", "Cine"],
  ["cine", "Salir", "Cine"], ["neocine", "Salir", "Cine"],
  ["restaurante", "Salir", "Restaurante"], ["mcdonald", "Salir", "Restaurante"],
  ["burger king", "Salir", "Restaurante"], ["telepizza", "Salir", "Restaurante"],
  ["glovo", "Salir", "Restaurante"], ["just eat", "Salir", "Restaurante"], ["uber eats", "Salir", "Restaurante"],
  ["kebab", "Salir", "Restaurante"], ["kebap", "Salir", "Restaurante"], ["taco bell", "Salir", "Restaurante"],
  ["dunkin", "Salir", "Restaurante"], ["cerveceria", "Salir", "Restaurante"], ["cafe bar", "Salir", "Restaurante"],
  ["burge", "Salir", "Restaurante"], ["cantina", "Salir", "Restaurante"], ["gastronomia", "Salir", "Restaurante"],
  ["club odiseo", "Salir", "Amigos"], ["bowling", "Salir", "Amigos"],
  ["fourvenues", "Salir", "Otros"], ["my ticket", "Salir", "Otros"],
  ["zara", "Ropa"], ["bershka", "Ropa"], ["pull&bear", "Ropa"], ["pull and bear", "Ropa"],
  ["stradivarius", "Ropa"], ["h&m", "Ropa"], ["primark", "Ropa"], ["shein", "Ropa"], ["nike", "Ropa"],
  ["adidas", "Ropa"], ["massimo dutti", "Ropa"], ["zapateria", "Ropa", "Zapatos"],
  ["nomina", "Nómina"],
  ["bizum enviado", "Bizum enviado"], ["bizum recibido", "Bizum recibido"],
  ["ingreso cajero", "Otros ingresos"], ["transf. a su favor", "Otros ingresos"],
];

// Cobros fijos que se registran solos. Se editan en Modificar → Mensualidades.
// «ancla» es la fecha de un cobro real; los siguientes se calculan a partir de ella.
export const MENSUALIDADES_INICIALES = [
  { nombre: "Claude Pro", categoria: "IA", importe_cent: 2178, cada: 1, unidad: "meses", ancla: "2026-09-23" },
  { nombre: "Gimnasio", categoria: "Gimnasio", importe_cent: 3200, cada: 4, unidad: "semanas", ancla: "2026-09-12" },
];

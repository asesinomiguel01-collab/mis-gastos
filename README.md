# Mis gastos (app para el móvil)

App instalable (PWA) para Android: se instala con su icono, se abre a pantalla completa sin barra del navegador y
**funciona sin internet**. Los datos se guardan **solo en tu móvil** (en el almacenamiento de la propia app);
el código publicado no contiene ningún dato personal.

## Páginas (barra inferior, por este orden)

| Página | Qué hace |
|---|---|
| **Inicio** | Toda la información, solo para ver: lo que te sobra este mes, gasto por categoría, Bizum aparte, próximos cobros fijos, el año mes a mes con acumulados y los movimientos del mes. |
| **Mensualidad** | Cuándo te cobran cada gasto fijo (Claude Pro, gimnasio…): próximo cobro, siguientes, últimos, y lo que suponen al mes y al año. |
| **Estadísticas** | Ingresos frente a gastos, acumulado del año, en qué gastas y un veredicto (¿gastas mucho?). |
| **Modificar** | Aquí se mete y se cambia todo: movimientos, mensualidades, importar el CSV del banco y copia de seguridad. |

**Cobros fijos:** la IA y el gimnasio se apuntan solos como gasto el día que llegan (Claude Pro 21,78 € hacia el 23 de cada mes;
gimnasio 32 € cada 4 semanas). El resto (gasolina, salir, ropa, imprevistos) lo apuntas tú cuando ocurre y en Inicio ves el
recuento de cada mes. Si el banco luego trae el cobro real, sustituye al previsto (no se duplica).

**Bizum:** «Bizum enviado» y «Bizum recibido» no cuentan en ingresos, gastos ni ahorro; se ven aparte.

## Instalar en Android

1. Abre la dirección de la app en **Chrome**.
2. Menú ⋮ → **Instalar aplicación** (o «Añadir a la pantalla de inicio»).
3. Ábrela desde el icono. Ya no necesita internet.

## Copia de seguridad (importante)

Como los datos solo están en el móvil, si borras los datos de Chrome o desinstalas la app **se pierden**.
En **Modificar → Copia → Guardar copia** puedes guardarlas en Drive u otro sitio, y restaurarlas desde el mismo apartado.

## Importar el banco

Descarga los movimientos en CSV desde la app de tu banco y súbelos en **Modificar → Importar banco**.
Puedes revisar la categoría de cada movimiento antes de guardar; los ya importados se detectan y no se duplican.

## Para quien mantenga el código

- Sin dependencias ni compilación: HTML + CSS + JavaScript (módulos ES). Para probarla en local:
  `python3 -m http.server 5052` dentro de esta carpeta y abrir `http://localhost:5052`.
- Al cambiar cualquier archivo, sube `VERSION` en `sw.js` para que los móviles descarguen la versión nueva.
- Categorías, reglas de clasificación y mensualidades iniciales: `js/catalogo.js`. Qué categorías van «aparte»: `APARTE` en ese mismo archivo.

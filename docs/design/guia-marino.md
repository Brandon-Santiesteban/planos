# Diseño de mis módulos (SaaS de nómina)

> Claude: lee este archivo antes de crear o cambiar cualquier interfaz. Usa exactamente estas paletas, letras y componentes. Si necesitas algo que no está aquí, pregúntame antes de inventarlo. Los textos van en español, cortos y directos, en segunda persona. Montos en pesos colombianos (`$ 1.750.000`) y fechas `dd/mm/aaaa`.

## Estilo general

- Moderno, suave y tonal (parecido a Material Design 3), pensado para trabajar muchas horas con datos.
- Nada de franjas de color a los lados ni bordes gruesos. Se separa con espacio, fondos tonales y sombras suaves.
- Colores siempre como variables CSS, nunca escritos sueltos.
- Todo texto debe leerse bien (contraste mínimo 4.5:1) en ambos modos.
- Iconos de trazo (1.8px, puntas redondeadas) de 16–18px. Nada de emojis como iconos.
- Una sola acción principal por pantalla.
- El menú lateral del proyecto ya existe: no lo cambies.
- Capas de una pantalla: el título, el selector de periodo, las píldoras de vistas y la barra de herramientas van DIRECTO sobre el `fondo`; NO se envuelve la pantalla completa en un panel o tarjeta. Solo la tabla, las tarjetas y las ventanas tienen superficie `sup`.
- Modo oscuro: las sombras casi no se ven, así que tablas, tarjetas y paneles llevan además un contorno de 1px en `contorno` para que se note dónde empiezan y terminan. En claro ese contorno es transparente.

## Antes de construir: preguntas obligatorias

Cuando te pida aplicar este formato a un módulo o a algo nuevo (o cuando lo apliques por defecto), ANTES de escribir código pregúntame en un solo mensaje:

- Por cada lista desplegable y cada filtro multi-criterio: «¿El campo X permite crear opciones nuevas o solo elegir de las que existen?». No asumas; por defecto, ninguno permite crear.
- Si hay tablas: ¿tabla normal o tabla tipo Excel?
- Si hay textos largos que no sé si se justifican, o números que no sé si llevan máscara, pregúntalo también.

## Paletas

### Modo claro · Marino

| Variable | Color | Para qué |
|---|---|---|
| `--fondo` | #F3F6FB | Fondo de la página |
| `--sup` | #FFFFFF | Superficie (tarjetas, ventanas, tablas) |
| `--sup2` | #E9EEF6 | Superficie 2 (campos, encabezados de tabla) |
| `--tinta` | #0B1F3F | Texto principal |
| `--tenue` | #566684 | Texto secundario |
| `--linea` | #D3DCEA | Líneas (1px) |
| `--acento` | #12355E | Acento (botón principal, selección, enlaces) |
| `--acento-tinta` | #FFFFFF | Texto sobre el acento |
| `--t1` | #4338A0 | Color 1 (1º turno, novedades) |
| `--t2` | #8A5200 | Color 2 (2º turno, en revisión, advertencia) |
| `--t3` | #0B6A63 | Color 3 (3º turno) |
| `--ok` | #1E7A46 | Bien / pagada / éxito |
| `--peligro` | #B3261E | Error / anulada |
| `--tabla-enc` | #12355E | Fondo del encabezado de tablas |
| `--tabla-enc-tinta` | #FFFFFF | Texto del encabezado de tablas |
| `--contorno` | #FFFFFF00 | Contorno de tablas y tarjetas (solo se ve en oscuro) |

### Modo oscuro · Carbón

| Variable | Color | Para qué |
|---|---|---|
| `--fondo` | #0E131C | Fondo de la página |
| `--sup` | #1F2226 | Superficie (tarjetas, ventanas, tablas) |
| `--sup2` | #2A2E33 | Superficie 2 (campos, encabezados de tabla) |
| `--tinta` | #E7E9EC | Texto principal |
| `--tenue` | #9AA2AD | Texto secundario |
| `--linea` | #353A41 | Líneas (1px) |
| `--acento` | #9DB8DA | Acento (botón principal, selección, enlaces) |
| `--acento-tinta` | #10161F | Texto sobre el acento |
| `--t1` | #A99CF5 | Color 1 (1º turno, novedades) |
| `--t2` | #F0B45A | Color 2 (2º turno, en revisión, advertencia) |
| `--t3` | #5CC9BE | Color 3 (3º turno) |
| `--ok` | #7FD3A0 | Bien / pagada / éxito |
| `--peligro` | #F2B8B5 | Error / anulada |
| `--tabla-enc` | #2A2E33 | Fondo del encabezado de tablas |
| `--tabla-enc-tinta` | #E7E9EC | Texto del encabezado de tablas |
| `--contorno` | #353A41 | Contorno de tablas y tarjetas (solo se ve en oscuro) |

Cómo aplicarlas: las variables del modo claro en `:root` y las del oscuro en `[data-tema="oscuro"]`. El cambio de modo solo cambia ese atributo.

# Base

## Letra · Google Sans / Roboto

- Familia: `'Google Sans', Roboto, 'Segoe UI', sans-serif`.
- Pesos: 400 texto, 500 títulos y botones, 600 para encabezados de tabla y etiquetas de tarjeta.
- Encabezados de tabla y etiquetas de tarjeta: MAYÚSCULA, 600, 11.5px, letra un poco separada (0.04–0.06em), centrados horizontal y verticalmente.
- Tamaños: 22px título de pantalla o ventana, 24px cifras de tarjetas, 14px texto, 13px botones chicos y celdas, 12px datos secundarios.
- Números con `font-variant-numeric: tabular-nums` y alineados a la derecha en tablas. Pesos colombianos: `$ 1.750.000`.
- Nota: Para la parte de encabezados, me gusta que estén siempre centrados vertical y horizontalmente, que estén en mayúscula. Y en negrita

## Párrafos justificados

- Textos largos (párrafos de 2 o más líneas: descripciones, ayudas largas, condiciones, mensajes de correo): `text-align: justify`, como «Justificar» de Word.
- Para evitar huecos entre palabras: `hyphens: auto` con la página en `lang="es"`, y ancho máximo de ~68 caracteres por línea. La última línea queda a la izquierda (`text-align-last: left`).
- NO se justifica: títulos, etiquetas, botones, celdas de tabla, textos de una sola línea ni notificaciones.

## Esquinas · Medias

- Tarjetas y tablas: radio 10px. Ventanas: 14px. Campos y botones chicos: 8px. Etiquetas: 6px.

## Botones · Rectángulo redondeado

- Rectángulo con radio 10px, alto 38px; chico 30px con radio 8px.
- Principal: fondo `acento`, texto `acento-tinta`, sombra mínima. Uno por pantalla.
- Secundario: fondo `sup` con contorno interno de 1px en `linea`, texto `tinta`; al pasar el mouse toma `sup2`.
- Chico: fondo `sup2`, texto `tinta`, 13px. Solo icono: 30×30, sin fondo, `tenue`.
- Peligro (eliminar, anular): fondo `peligro`, texto `sup`. Solo dentro de una confirmación.
- Con icono: icono de 16px a la izquierda. Cargando: un círculo girando en lugar del icono y el texto en gerundio («Guardando…»).
- Deshabilitado: opacidad 45%, el texto dice por qué.

## Selectores · Interruptor en carril

- Solo con 2 o 3 opciones visibles. Carril `sup2` con 3px de relleno y radio 12px; la activa es `sup` con sombra suave.
- Con 4 opciones o más, o si se puede elegir varias: usar la lista desplegable.
- Nota: En la opción de selectores, generalmente no me gusta tenerlos sueltos, a menos que sean realmente muy pocos. Pero, de resto, yo prefiero tener un filtro que sea para elegir múltiples criterios, que no reduzca y que se abran automáticamente al pasar el mouse por encima.

## Listas desplegables

- Toda lista desplegable usa este estilo; nunca el `<select>` del navegador.
- Campo relleno (como los demás campos) con el valor elegido y una flecha que gira al abrir. Si es un botón de filtro, botón secundario con contador `acento` de lo elegido.
- Se abre al pasar el mouse y con clic o teclado; se cierra 350ms después de salir, al hacer clic afuera o con Esc. No se cierra mientras escribes en el buscador.
- Panel `sup` con sombra y radio de tarjeta: buscador arriba, opciones de 13px, «Nada coincide con tu búsqueda» si no hay resultados.
- Una sola opción: check `acento` a la izquierda de la elegida y se cierra al elegir. Varias: casillas, el panel queda abierto, abajo «Limpiar» + «Puedes elegir varias»; el campo muestra hasta 2 nombres y luego «N seleccionados».
- Si la lista viene de datos, cada opción muestra a la derecha cuántos registros tiene.
- Crear opciones nuevas: si lo que escribes en el buscador no existe, aparece «+ Crear «texto»» al final; al tocarlo se agrega a la lista y queda elegido (con una notificación de éxito). Solo se ofrece en las listas y filtros donde se definió que se puede crear; en las demás solo sale «Nada coincide con tu búsqueda».

## Calendario

- Calendario propio, nunca el del navegador. Campo relleno con máscara `dd/mm/aaaa` que se llena al escribir solo números, y botón de calendario a la derecha.
- Se abre con clic en el icono (no al pasar el mouse). Panel `sup` con sombra, mes y año arriba con flechas, semana de lunes a domingo, fines de semana en `tenue`.
- Hoy: anillo de 1.5px en `acento`. Día elegido: fondo `acento`, texto `acento-tinta`. Días de otros meses más tenues.
- Abajo: «Hoy» y «Borrar». Se cierra al elegir, con clic afuera o con Esc.

## Máscaras de números

- Documento de identidad, cuentas y montos se MUESTRAN con puntos de miles (`1.023.456.789`), pero el valor que se guarda, se envía o se exporta va solo con dígitos (`1023456789`). Nunca guardar puntos, comas, guiones ni espacios.
- Al escribir o pegar se quitan los caracteres que no son números y se vuelve a poner la máscara sola.
- Montos con prefijo `$` en `tenue`, alineados a la derecha. Fechas con máscara `dd/mm/aaaa`.

## Selector de periodo · Flechas + mes

- Botón secundario con el mes («Octubre 2026») entre dos botones de flecha cuadrados de 38px para ir al mes anterior o siguiente; la flecha siguiente se deshabilita en el mes actual.
- Clic en el nombre abre el mismo panel de 12 meses con atajos.

## Etiquetas de estado · Etiqueta cuadrada

- Etiqueta con radio 6px, fondo de su color al 14% sobre `sup`, texto en su color, 12px peso 500. Sin punto ni borde.

## Etiquetas de grupo, departamento y rol

- Toda etiqueta de color (estado, grupo, departamento, rol) usa el par de tonos de esta tabla: el tono «claro» en modo claro y el tono «oscuro» en modo oscuro. Nunca el mismo color en los dos modos.
- Fondo de la etiqueta: su color al 14% sobre `sup` en claro y al 18% en oscuro. Texto en su color, 12px 500 (o 10.5px 600 MAYÚSCULA para etiquetas mini como «OPERADOR», «RH», «GER»). Sin borde.
- Cada grupo, departamento y rol tiene SIEMPRE el mismo color en todo el sistema. Si aparece uno que no está en la lista, pregunta qué color lleva antes de asignarlo.
- Colores (claro / oscuro · contraste): azul #1D4F91 / #8DB8F2 (6.5 / 5.4); verde #1E6B3E / #7FD3A0 (5.3 / 6.0); rojo #A12C24 / #F4A6A0 (5.7 / 5.6); ambar #8A5200 / #F0B45A (5.2 / 5.9); morado #5B3BAA / #B9A6F7 (6.4 / 5.2); rosa #9C2A63 / #F3A3CB (5.7 / 5.7); turquesa #0B6A63 / #5CC9BE (5.2 / 5.5); cafe #7A4A2A / #D9AE8C (6.0 / 5.5); gris #4E5A6E / #B4BCC8 (5.7 / 5.6).
- Asignación actual — Grupos: BRASILEROS verde, GIRLS rosa, GOALS ambar, GOALS UP ambar, HOGWARTS morado, LANNISTER rojo, RACOON cafe, TARGARYEN gris, TULLY azul, RYSWELL turquesa. Departamentos: RH morado, GER azul, NÓMINA turquesa, OPERACIONES ambar. Roles: OPERADOR morado, SUPERVISOR azul, ADMIN gris.
- Las etiquetas de estado usan los tokens de la paleta (`tenue`, `t2`, `acento`, `ok`, `t1`, `peligro`), que ya traen su tono para cada modo, con el mismo fondo 14% / 18%.

## Colores neón

- Se usan SOLO cuando lo pida explícitamente con la palabra «neón». Si no lo digo, se usan los colores normales de etiquetas.
- Modo oscuro: el color neón tal cual, muy vivo y saturado, sobre `sup` o `fondo`. Modo claro: su versión intensa oscura (el neón sobre blanco no se lee).
- Colores (oscuro / claro · contraste sobre `sup`): verde #39FF88 / #0B7A3B (12.0 / 5.4); cian #22E5FF / #006E80 (10.4 / 5.9); magenta #FF6BE0 / #A3127F (6.4 / 7.1); amarillo #F5FF3B / #6B6E00 (14.6 / 5.4); naranja #FF9A2E / #9A4A00 (7.5 / 6.3); violeta #C493FF / #6A2BC2 (6.8 / 7.7); rojo #FF7381 / #B0182A (6.1 / 7.0); azul #4DA8FF / #0B5BB5 (6.4 / 6.6).
- Para qué: cifras destacadas, puntos e iconos de estado, contornos de algo seleccionado o en alerta, líneas de gráficas y etiquetas pequeñas. NUNCA como fondo grande ni para párrafos largos.
- Etiqueta neón: texto en su color 600, fondo de su color al 12% sobre `sup`, contorno de 1px de su color al 45% y punto con brillo (`box-shadow: 0 0 8px color`). Cifras neón: brillo suave (`text-shadow: 0 0 12px color al 45%`) solo en oscuro.
- Máximo 2 o 3 colores neón por pantalla para que sigan resaltando.

## Tarjetas · Blancas con sombra

- Fondo `sup`, sombra doble suave (`0 1px 2px` + `0 6px 18px`), sin borde, radio de tarjeta.
- Etiqueta arriba con punto de color: MAYÚSCULA, 11.5px, 600, `tenue`. Cifra 24px peso 500. Dato de apoyo 12px `tenue`.

## Listas · Sin líneas

- Filas sin líneas ni caja, dentro de una superficie `sup`; al pasar el mouse toman `fondo`.
- Fila: iniciales en círculo `sup2` de 32px, nombre en 500 y dato secundario en 12px `tenue`; montos a la derecha.

## Campos · Rellenos sueltos

- Alto 38px, fondo `sup2`, sin borde, radio de campo (8px).
- Etiqueta arriba 12.5px peso 500; ayuda abajo 12px `tenue`.
- Foco: contorno interno de 2px en `acento`. Error: contorno de 1.5px en `peligro` y mensaje abajo en `peligro` que dice cómo arreglarlo.
- Nota: En campos de fechas, quiero un calendario custom, con la paleta de colores previamente se leccionadas.

## Notificaciones (toast) · Píldora oscura

- Abajo al centro, apiladas (máx. 3): píldora `tinta` con texto `sup`, 13px, una sola línea con icono de 16px en el color del tipo (`ok`, `acento`, `t2`, `peligro`), acción opcional en botón chico translúcido («Deshacer», «Ver») y X para cerrar.
- Se van solas a los 5 s y se pausan al pasar el mouse. Los errores no se van solos.
- Errores: toda la notificación se puede clickear (cursor de copiar) y dice «Clic para copiar». Al hacer clic copia el error al portapapeles (título — detalle, más el código si existe), la notificación se quita de inmediato y sale una de éxito «Error copiado al portapapeles». También funciona con Enter.

## Avisos de progreso · Tarjeta con barra

- Tarjeta flotante `sup` abajo a la derecha, sombra, radio de tarjeta, 13px, con barra de 6px (`sup2` con relleno `acento`). Al terminar se convierte en una notificación de éxito o error.

## Ventanas · Centrada

- Centrada, ancho máx. 720px (confirmaciones: 440px), fondo `sup`, radio de ventana, sombra profunda y velo `tinta` al 45% con desenfoque de 3px.
- Título 20px peso 500, texto `tenue`, botones abajo a la derecha: secundario y luego principal (o peligro).
- Se cierra con Esc, clic afuera o «Cancelar». Enter hace la acción principal, salvo si es de peligro.

# Tablas y datos

## Tabla normal

- Para tablas normales de página. NO es la tabla tipo Excel (esa solo cuando se pida).
- Contenedor `sup` con radio de tarjeta, sombra suave y contorno de 1px en `contorno` (visible en oscuro). La tabla va sola sobre el `fondo`, no dentro de otro panel.
- Encabezado: fondo `tabla-enc`, texto `tabla-enc-tinta` (claro: azul marino con texto blanco; oscuro: gris `sup2` con texto claro, NUNCA el acento azul claro), MAYÚSCULA, 600, 11.5px, centrado horizontal y verticalmente; en columnas ordenables, flechita de orden a la derecha del título. Columnas de acciones con solo un icono de 16px en el encabezado.
- Primera columna: número de fila (44px, centrado, `tenue`, 11.5px).
- Filas en cebra: impares `sup`, pares `fondo` al 85%; separadores verticales de 1px en `linea` al 60%; sin líneas horizontales; al pasar el mouse la fila toma `acento` al 6%.
- Dos densidades. Con detalle (58px): avatar circular de 36px + nombre en MAYÚSCULA 500 + línea secundaria 11.5px `tenue` (grupo · turno) y etiqueta de rol (9.5px, 600, MAYÚSCULA, contorno `t1` al 40%). Compacta (38px): una sola línea.
- Códigos (EMP-222, INC-13) en letra mono, `acento`, 500.
- Montos con cifras tabulares: centrados en la tabla con detalle y a la derecha (mono) en la compacta. Lo que suma (adelantos, abonos) en `ok`; lo que descuenta (deducciones) en `t2`; el total de la fila (neto) en 600.
- Debajo de un monto puede ir una etiqueta mini (`acento` al 10%, 10.5px, 600) con el dato que lo explica («25d»).
- Columnas de acciones (ver, marcar, revisar): iconos de 16px en `tenue`, centrados.
- UNA SOLA barra de desplazamiento vertical: la de la página. La tabla NO tiene alto máximo ni scroll vertical propio (`overflow-y` nunca en `auto`/`scroll` en la tabla ni en sus contenedores; para recortar esquinas usa `overflow: clip`, que no rompe lo fijo).
- Encabezado fijo (sticky header): `position: sticky` con `top` EXACTAMENTE igual al alto de lo que esté fijo arriba (la barra superior), guardado en una variable (`--alto-barra`). Entre la barra y el encabezado no puede quedar ningún hueco por donde se vean las filas que pasan detrás.
- Fila de totales fija (pie de tabla, `<tfoot>`): `position: sticky; bottom: 0`. Debajo de ella tampoco puede verse ninguna fila.
- Todo lo fijo (barra superior, encabezado, totales) tiene fondo 100% opaco, nunca transparente ni con opacidad. Para tapar cualquier rendija, el encabezado lleva una sombra sólida de 14px hacia arriba en `fondo` y los totales una hacia abajo. Las celdas del encabezado fijo NO llevan esquinas redondeadas (por ahí se verían las filas).
- Antes de entregar, revisa bajando a mitad de una tabla larga que no se vea ninguna fila por encima del encabezado ni por debajo de los totales.
- Fila de totales (pie de tabla): SIEMPRE que la tabla tenga columnas numéricas. Primera celda «TOTALES (N)» con N = filas visibles. Cada columna de cantidad (pesos, dólares, puntos, días, horas, unidades) muestra su SUMA con su unidad en `tenue` (`783.416,54 pts`, `$ 854.806.443`, `1.132 d`). Porcentajes y tarifas muestran el promedio con «prom.». Texto, fechas y acciones quedan vacías. Los totales se recalculan con los filtros y la búsqueda. Fondo `sup2`, 600, línea de 1px `linea` arriba.
- Encima de tablas de registros: vistas como píldoras con conteo («Mis pendientes 7», «Todas las abiertas 17», «Revisiones resueltas 36»); la activa con fondo `acento`. Lo histórico o ya resuelto es una píldora más de esa fila, NUNCA un botón aparte tipo «Historial».

## Tabla tipo Excel

- Solo cuando se pida una «tabla tipo Excel». Cuadrícula completa: línea de 1px en `linea` en cada celda, columna de número de fila (40px, `sup2`, `tenue`) y filas de 32px.
- Va dentro de una superficie `sup` con radio de tarjeta, sombra suave y contorno. Igual que la tabla normal: una sola barra de desplazamiento (la de la página), encabezado fijo pegado a la barra superior sin huecos y fila TOTAL fija abajo sumando cada columna numérica.
- Encabezados: fondo `sup2`, MAYÚSCULA, 11.5px, 600, centrados, fijos arriba. Columnas calculadas con «ƒ» antes del nombre y fondo `sup2` al 45%; no se editan.
- Columnas fijas a la izquierda: identificación y nombre. Fila TOTAL fija abajo en `sup2` y 600.
- Texto a la izquierda; números a la derecha con cifras tabulares. Documentos con máscara de puntos solo visual.
- Teclado y mouse como Excel: clic selecciona; flechas mueven; Shift + flechas o arrastrar selecciona rango; Ctrl+A todo; escribir, doble clic o F2 edita; Enter guarda y baja; Tab a la derecha; Esc cancela; Supr deja en 0; Ctrl+C copia el rango para pegar en Excel; Ctrl+Z deshace.
- Celda activa: contorno de 2px en `acento`. Rango: fondo `acento` al 12%. Fila bajo el mouse: `acento` al 5%.
- Celda modificada sin guardar: triangulito `acento` arriba a la izquierda. Celda con error: fondo `peligro` al 14%, triangulito arriba a la derecha y aviso al pasar el mouse con cómo arreglarlo.
- Barra de estado abajo: a la izquierda «N cambios sin guardar», «Deshacer» y «Guardar cambios»; a la derecha, con varias celdas seleccionadas: Promedio, Recuento y Suma (como Excel).
- Clic derecho: Copiar, Editar celda, Insertar fila abajo, Ver historial y Eliminar fila (en `peligro`, con «Deshacer» en la notificación).
- Pestañas de hojas (solo en la tabla tipo Excel): debajo de la tabla, sobre una franja `sup2`; la activa es `sup` con texto `acento` y sombra mínima; contador opcional y «+» al final.

## Barra de herramientas · Barra + filtros activos

- Una fila: buscador (240px) + filtros + «Columnas» a la izquierda; «Importar» y «Exportar a Excel» a la derecha.
- Debajo, solo si hay filtros: etiquetas `acento` al 10% «Campo: valor» con X, más «Limpiar filtros».

## Filtro multi-criterio · Un botón por criterio

- Un botón secundario por criterio (Cargo, Centro de costo…) con la lista desplegable en modo varias opciones, conteo de registros por opción y contador `acento` en el botón.
- Se pueden combinar varios criterios; la tabla se filtra al instante.
- Crear criterios nuevos: solo en los filtros donde se definió; ahí, si el texto buscado no existe, aparece «+ Crear «texto»» y queda marcado.

## Pestañas de módulo · En carril

- Carril `sup2` con 3px de relleno; la activa es `sup` con sombra suave. Mejor con 2 a 5 pestañas.

## Tarjetas de totales · Con comparación

- Fila de tarjetas (empleados, devengado, deducciones, neto a pagar) que se actualizan con la tabla.
- Debajo de la cifra: chip ▲/▼ con el porcentaje frente al periodo anterior (`ok` sube, `peligro` baja) y un dato de apoyo.

## Paginación · Compacta

- A la izquierda «Filas por página» (lista desplegable: 12, 50, 100); a la derecha «1–50 de 312» y flechas.

# Otras piezas

## Formulario de empleado · Por secciones

- Por secciones (Datos personales, Contrato, Pago) con título en MAYÚSCULA 11.5px `tenue`; campos en 2 columnas que pasan a 1 en pantallas angostas.
- Toda lista es la lista desplegable con buscador; fechas con el calendario; documento y cuenta con máscara visual.
- Botones al final a la derecha: «Cancelar» y «Guardar empleado».

## Estados de una nómina

- Borrador: `tenue`. En revisión: `t2`. Aprobada: `acento`. Pagada: `ok`. Con novedades: `t1`. Anulada: `peligro`.

## Subir archivos

- Zona para soltar: `sup` con contorno de 1.5px en `acento` al 35%, icono de 32px `acento`, texto de qué se puede subir y límites, y el botón secundario «Elegir archivo». Al arrastrar encima toma `acento` al 8%.
- Excel: además «Descargar plantilla» (botón chico). Después de leerlo, resumen antes de cargar: filas listas (`ok`), con error (`peligro`) y «Ver errores»; botones «Cancelar» y «Cargar N filas».
- Foto: círculo de 96px que también recibe la foto; al elegirla se ve recortada en círculo; «Elegir foto» y «Quitar».
- Varios archivos (soportes): lista debajo con miniatura o extensión, nombre, tamaño, barra de 4px mientras sube, «Listo» al terminar y X para quitar.

## Vacío y cargando

- Mientras carga: barras `sup2` con brillo suave en el lugar de las filas; nunca pantalla en blanco.
- Vacío: SOLO cuando, ya cargado, no existe ningún registro. Dice qué va ahí y cómo empezar, con el botón principal para hacerlo.
- Si hay registros pero los filtros o la búsqueda no dejan ninguno: no es el vacío; muestra «Ningún empleado coincide con los filtros» y «Limpiar filtros».

## No usar

- Bordes de 1px alrededor de todo, ni franjas de color de 3–4px en tarjetas.
- Relleno sólido para marcar estados (solo los botones principal y de peligro van rellenos).
- El `<select>` o el calendario del navegador: usa la lista desplegable y el calendario propios.
- Guardar documentos, cuentas o montos con puntos o signos: los puntos son solo visuales.
- Selectores sueltos con más de 3 opciones.
- Emojis como iconos, degradados morado-azul o negrita 700.

---

## Decisiones para el Diseñador de casa (25/10/2026)

- Sin listas desplegables por ahora: «Tipo» (Habitación/Balcón) es un interruptor en carril. Las listas del catálogo (fase 3) se preguntarán entonces.
- Sin tablas por ahora.
- Medidas `3,50 m` y áreas `12,35 m²` sin máscara de miles.
- Letra: Roboto instalada en el equipo (no se descarga de internet).
- Plano 2D: muros `tinta`, habitaciones `acento` al 6%, balcones `t3` suave con borde punteado, selección `acento`, rejilla `linea`, cotas `tenue`.
- 3D: cielo `fondo`, suelo gris tonal, muros blanco cálido, selección `acento`.

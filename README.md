# Diseñador de casa

Herramienta para diseñar tu casa: planos en 2D con medidas en metros, varias plantas y vista 3D en tiempo real.

## Cómo abrirla

Haz doble clic en **`iniciar.bat`**. La primera vez instala lo necesario (tarda un poco); después abre la app en el navegador (`http://localhost:5173`). Deja abierta la ventana negra mientras la usas.

## Qué puedes hacer (fase 1)

- **Muros**: herramienta *Muro* (M). Clic para empezar, clic para terminar; sigue encadenando muros. Los puntos se pegan a las puntas de la cuadrícula (también en diagonal). Mientras dibujas, escribe una medida (`3,5`, `350 cm`) y pulsa **Enter**. **Esc** o doble clic termina. **Shift** fija ángulos de 45°. **Alt** desactiva el ajuste.
- **Habitación rápida**: herramienta *Rápida* (R). Escribe el ancho y el largo **por dentro**, y la habitación sigue al ratón; clic para colocarla, **R** para girarla. Si la acercas a otra se pega y comparten el muro; luego une las dos con una *Puerta*. Dentro de cada habitación rectangular ves su área y sus medidas interiores.
- **Puertas y ventanas**: herramientas *Puerta* (P) y *Ventana* (N). Clic sobre un muro.
- **Habitaciones y balcones**: herramienta *Habitación* (H). Clic en cada esquina y clic en el primer punto (o Enter) para cerrar. En el panel puedes cambiar el nombre y convertirla en **Balcón** (lleva barandilla en 3D).
- **Seleccionar y editar**: herramienta *Seleccionar* (V). Arrastra esquinas, muros o puertas. Cambia medidas en el panel derecho. **Supr** elimina.
- **Plantas**: panel *Plantas* (añadir, renombrar con doble clic, altura, subir/bajar, eliminar). La planta de abajo se ve en gris como referencia.
- **Calcar un plano**: sin nada seleccionado, *Cargar plano de fondo* (imagen o PDF), luego *Calibrar escala*: clic en dos puntos de distancia conocida, escribe la medida real y Enter.
- **3D**: arrastra para girar, rueda para acercar, botón derecho para desplazar. *Mostrar plantas superiores* enseña las plantas por encima de la actual.
- **Cuadrícula**: abajo a la izquierda del plano puedes mostrarla u ocultarla y elegir 10 cm, 50 cm o 1 m. Oculta, los puntos solo se pegan a las esquinas de los muros.
- **Metros cuadrados**: el botón **m²** (abajo a la izquierda del plano) muestra u oculta el área de cada habitación. Viene apagado; las medidas de las habitaciones rectangulares se ven siempre.
- **Mis proyectos**: todo se guarda solo, cada proyecto por separado, y arriba ves la hora del último guardado. *Nuevo* no borra el anterior: lo encuentras en *Mis proyectos*.
- **Guardar**: crea un archivo `.casa.json` en tu PC. Después de guardarlo (o abrirlo) una vez, ese archivo se actualiza solo con cada cambio.
- **Modo oscuro**: botón de la luna arriba a la derecha.

## Exportar planos

Botón **Exportar** en la barra de arriba. Eliges la planta (la actual o todas) y el formato, y pulsas **Descargar**. El archivo se llama `<proyecto> - <planta>` (o `Todas las plantas`).

- **PDF a escala**: una hoja A3 por planta, a 1:50; si la planta no cabe, a 1:100 (o 1:200). La hoja se pone horizontal o vertical según lo que quepa mejor. Lleva muros rellenos, puertas con su barrido, ventanas, habitaciones con su nombre y área, muebles, la cota de cada muro, la flecha del norte, una escala gráfica en metros y un cajetín con proyecto, planta, escala y fecha. Imprime en A3 al 100 % (sin «ajustar a la página») para que la escala sea real.
- **DXF para arquitecto**: un archivo DXF (R12, se abre en AutoCAD, BricsCAD, LibreCAD…) en metros, con una capa por tipo: MUROS, HUECOS, HABITACIONES, MUEBLES, COTAS y TEXTOS. Con *Todas*, las plantas van una al lado de otra con su nombre encima, en un solo archivo.
- Las plantas vacías no se exportan.
## Caminar por dentro

- En la vista 3D toca **Caminar** (barra de abajo). Entras a la altura de los ojos en la habitación seleccionada o, si no hay ninguna, en la primera de la planta activa. Se ven todas las plantas.
- Haz clic en la vista para mirar con el ratón. Muévete con **W A S D** o las flechas; **Shift** para correr. **Esc** suelta el ratón y **Salir de caminar** vuelve a la vista normal.
- Los muros no se atraviesan; las puertas sí. Para subir o bajar de planta, camina por una **Escalera**: elige *Tipo: Escalera* en las propiedades de la habitación, hacia dónde **sube** y su **forma** (recta o en U, con descanso al fondo y llegada del mismo lado por donde empiezas).
- En el plano la escalera se dibuja con sus escalones y una flecha que va hacia arriba. En las puertas, **Invertir apertura** cambia hacia qué lado abren.
## Muebles

- **Catálogo**: herramienta *Muebles* (U). En el panel derecho busca por nombre o elige una categoría (Dormitorio, Sala, Comedor, Cocina, Baño, Oficina y setup, Lavandería, Exterior, Rooftop, Parqueadero). Toca un mueble: su silueta sigue al ratón y un clic lo coloca (puedes poner varios seguidos). **R** lo gira (Shift+R al otro lado). Cerca de un muro (a menos de 15 cm) se pega a él de espaldas y paralelo. **Esc** termina.
- **Mover y editar**: con *Seleccionar* (V) arrastra un mueble (se ajusta cada 5 cm; con **Alt**, libre). Lo que está encima (un monitor sobre el escritorio) se mueve con él. **R** / **Shift+R** lo giran 90°, **Supr** lo elimina y **Ctrl+D** lo duplica. En el panel cambias ancho, fondo, alto, elevación, rotación y color, y tienes *Duplicar* y *Eliminar* (con *Deshacer*).
- **En 3D**: clic en un mueble para seleccionarlo; arrástralo para moverlo por su planta. Si lo sueltas encima de otro, queda apoyado sobre él (por ejemplo un monitor sobre el escritorio). Todo se deshace con Ctrl+Z, igual que en el plano.
- **Amueblar el ejemplo**: `node scripts/ejemplo-muebles.mjs public/ejemplos/casa-etapa-1.casa.json` pone muebles según el nombre de cada habitación (cambia los que hubiera) y muestra un resumen.
- Para añadir un mueble al catálogo basta una línea en `src/furniture/catalog.ts` si usa una forma que ya existe.

## Ejemplos

Abre un ejemplo directamente con su enlace (la primera vez se carga el ejemplo; después, tu copia con tus cambios):

- Casa etapa 1 en 3D: http://localhost:5173/?abrir=ejemplos/casa-etapa-1.casa.json&vista=3d

Los archivos están en `public/ejemplos/`.

## Materiales y fachada

- **Acabados de un muro**: selecciona un muro y, en *Acabados*, elige para cada cara (*Cara A* y *Cara B*) el acabado (pintura, ladrillo, piedra, madera o enchape) y el color, con las muestras o escribiendo el código (`#E4D9C6`). Cada cara dice a qué habitación mira, o si mira al exterior. En la pintura el color es el de la pared; en los demás acabados tiñe la textura (Blanco la deja natural).
- **Usar en toda la fachada**: en una cara que mira al exterior, copia ese acabado a todas las caras exteriores de la planta. Se puede deshacer.
- **Piso**: en una habitación o balcón, elige cerámica, porcelanato (60 × 60 cm, mate), madera, concreto, piedra o césped.
- **Baranda** de un balcón: *Vidrio*, *Muro* (muro de 1 m con remate) o *Celosía* (listones horizontales), con su color. En la planta baja la celosía es un cerramiento de 2 m sobre un muro de 0,6 m, que da privacidad y deja pasar el aire.
- En 3D las texturas tienen su tamaño real: un ladrillo mide lo mismo en cualquier muro.
- `node scripts/ejemplo-fachada.mjs [archivo.casa.json]` aplica a la casa de ejemplo la propuesta de fachada (hueso arenilla, frente de la escalera en madera, medianeras gris claro, cerramiento negro) y de pisos. Se puede correr varias veces.

## Atajos

| Tecla | Acción |
|---|---|
| Ctrl+Z / Ctrl+Y | Deshacer / Rehacer |
| Ctrl+S / Ctrl+O | Guardar / Mis proyectos |
| V, M, P, N, H, R, U | Herramientas |
| R / Shift+R, Supr, Ctrl+D | Girar, eliminar y duplicar el mueble seleccionado |
| Rueda | Zoom en el plano |
| Botón central/derecho o Espacio + arrastrar | Mover el plano |

## Desarrollo

```
npm test        # pruebas unitarias
npm run e2e     # prueba en navegador
npm run build   # compilación
```

Diseño: `docs/superpowers/specs/2026-10-25-disenador-casa-design.md` · Plan fase 1: `docs/superpowers/plans/2026-10-25-fase1-plano-2d-y-vista-3d.md`

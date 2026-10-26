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

## Ejemplos

Abre un ejemplo directamente con su enlace (la primera vez se carga el ejemplo; después, tu copia con tus cambios):

- Casa etapa 1 en 3D: http://localhost:5173/?abrir=ejemplos/casa-etapa-1.casa.json&vista=3d

Los archivos están en `public/ejemplos/`.

## Atajos

| Tecla | Acción |
|---|---|
| Ctrl+Z / Ctrl+Y | Deshacer / Rehacer |
| Ctrl+S / Ctrl+O | Guardar / Mis proyectos |
| V, M, P, N, H, R | Herramientas |
| Rueda | Zoom en el plano |
| Botón central/derecho o Espacio + arrastrar | Mover el plano |

## Desarrollo

```
npm test        # pruebas unitarias
npm run e2e     # prueba en navegador
npm run build   # compilación
```

Diseño: `docs/superpowers/specs/2026-10-25-disenador-casa-design.md` · Plan fase 1: `docs/superpowers/plans/2026-10-25-fase1-plano-2d-y-vista-3d.md`

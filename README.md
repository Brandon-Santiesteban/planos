# Diseñador de casa

Herramienta para diseñar tu casa: planos en 2D con medidas en metros, varias plantas y vista 3D en tiempo real.

## Cómo abrirla

Haz doble clic en **`iniciar.bat`**. La primera vez instala lo necesario (tarda un poco); después abre la app en el navegador (`http://localhost:5173`). Deja abierta la ventana negra mientras la usas.

## Qué puedes hacer (fase 1)

- **Muros**: herramienta *Muro* (M). Clic para empezar, clic para terminar; sigue encadenando muros. Mientras dibujas, escribe una medida (`3,5`, `350 cm`) y pulsa **Enter**. **Esc** o doble clic termina. **Shift** fija ángulos de 45°. **Alt** desactiva el ajuste.
- **Puertas y ventanas**: herramientas *Puerta* (P) y *Ventana* (N). Clic sobre un muro.
- **Habitaciones y balcones**: herramienta *Habitación* (H). Clic en cada esquina y clic en el primer punto (o Enter) para cerrar. En el panel puedes cambiar el nombre y convertirla en **Balcón** (lleva barandilla en 3D).
- **Seleccionar y editar**: herramienta *Seleccionar* (V). Arrastra esquinas, muros o puertas. Cambia medidas en el panel derecho. **Supr** elimina.
- **Plantas**: panel *Plantas* (añadir, renombrar con doble clic, altura, subir/bajar, eliminar). La planta de abajo se ve en gris como referencia.
- **Calcar un plano**: sin nada seleccionado, *Cargar plano de fondo* (imagen o PDF), luego *Calibrar escala*: clic en dos puntos de distancia conocida, escribe la medida real y Enter.
- **3D**: arrastra para girar, rueda para acercar, botón derecho para desplazar. *Mostrar plantas superiores* enseña las plantas por encima de la actual.
- **Guardar / Abrir**: archivos `.casa.json` en tu PC. Además se guarda solo en el navegador cada segundo.

## Atajos

| Tecla | Acción |
|---|---|
| Ctrl+Z / Ctrl+Y | Deshacer / Rehacer |
| Ctrl+S / Ctrl+O | Guardar / Abrir |
| V, M, P, N, H | Herramientas |
| Rueda | Zoom en el plano |
| Botón central/derecho o Espacio + arrastrar | Mover el plano |

## Desarrollo

```
npm test        # pruebas unitarias
npm run e2e     # prueba en navegador
npm run build   # compilación
```

Diseño: `docs/superpowers/specs/2026-10-25-disenador-casa-design.md` · Plan fase 1: `docs/superpowers/plans/2026-10-25-fase1-plano-2d-y-vista-3d.md`

# Fotos y render

Dos formas de sacar una imagen de la vista 3D. Los botones están en la barra de abajo de la vista 3D, junto a *Mañana / Tarde / Noche*.

## Tomar foto

- Guarda un PNG de lo que ves en ese momento, **al doble de la resolución** de la vista (por ejemplo, una vista de 860 × 652 px sale de 1720 × 1304 px).
- Nombre del archivo: `<proyecto> - dd-mm-aaaa hh.mm.png` (los caracteres que Windows no acepta en nombres se cambian por `-`).
- Es inmediata (menos de un segundo) y no cambia el tamaño de la vista: la imagen se dibuja aparte, con antialias (MSAA ×4), el mismo tono de color (ACES) y el mismo cielo que en pantalla.
- Si la tarjeta gráfica no admite tanta resolución, se reduce manteniendo la proporción (máximo 8192 px por lado).

Código: `src/render/photo.ts` (dibujo fuera de pantalla), `src/render/fileName.ts` (nombre).

## Render realista

Botón **Render**. Abre la ventana *Render realista*, que vuelve a dibujar la misma vista con **trazado de rayos** (*path tracing*): la luz rebota entre muros, suelo y techo, las sombras son suaves donde deben serlo, los vidrios dejan pasar la luz y las bombillas iluminan de verdad el cuarto.

Cómo se usa:

1. Coloca la cámara como quieras y elige la hora del día.
2. Pulsa **Render**. Arriba a la derecha eliges la calidad:

   | Calidad | Muestras por píxel | Tamaño de la imagen | Rebotes de luz |
   |---|---|---|---|
   | Rápido | 48 | la mitad de la vista | 3 |
   | Bueno | 256 | igual a la vista | 5 |
   | Alto | 1024 | 1,5 × la vista | 8 |

3. La imagen empieza con grano y se va limpiando. La tarjeta de abajo a la derecha muestra las muestras hechas, el tiempo y cuánto falta.
4. **Detener** congela la imagen tal como está (con **Seguir** continúa). **Guardar imagen** la descarga en PNG (`<proyecto> render - dd-mm-aaaa hh.mm.png`) en cualquier momento. Al terminar sale el aviso «Render terminado».
5. **Esc**, **Cerrar** o clic fuera de la ventana la cierran y descartan el render.

Mientras está abierta, la vista 3D normal sigue igual: el render usa su propio lienzo y su propio contexto WebGL, así que nada de la escena cambia de tamaño ni de luz.

## Qué se probó y qué se eligió

**three-gpu-pathtracer 0.0.27** (con **three-mesh-bvh 0.9.16**), la librería de trazado de rayos de referencia para three.js. Esa versión pide `three >= 0.185`, así que encaja con nuestro three 0.186.

- `@react-three/gpu-pathtracer` (la envoltura para React) **no** se usó: su última versión (0.3.2) arrastra three-gpu-pathtracer 0.0.23, demasiado vieja para three 0.186. En su lugar se usa directamente la clase `WebGLPathTracer` con un `WebGLRenderer` propio (`src/render/pathTracer.ts`).
- drei sigue usando three-mesh-bvh 0.8.3 por su cuenta; npm instala las dos versiones sin conflicto (hay que instalar three-mesh-bvh 0.9.16 primero y luego el path tracer).
- La librería ya marca `WebGLPathTracer` como «obsoleta» y recomienda `WebGPUPathTracer` (que trae además un quitarruido OIDN). No lo usamos porque nuestra app es WebGL y WebGPU no está en todos los navegadores; cambiar es una mejora futura posible.

Lo que se comprobó con nuestra escena (casa de ejemplo, Mañana / Tarde / Noche):

| Elemento de la escena | En el render |
|---|---|
| Materiales `MeshStandardMaterial` / `MeshPhysicalMaterial` (muros, pisos, barandas metálicas) | Funcionan tal cual. |
| Vidrio de ventanas y barandas (transparente, opacidad 0,25–0,3) | Funciona: deja pasar la luz y se ve el interior. |
| Bombillas (`pointLight` con `distance` y `decay`) | Funcionan; respetan la distancia de corte. |
| Pantallas de lámpara emisivas | Se ven encendidas y además iluminan un poco (luz real desde la superficie). |
| Sol / luna (`directionalLight`) | Funciona, con sombra dura (el path tracer trata la luz direccional como un punto en el infinito). |
| Luz de cielo (`hemisphereLight`) | **No la soporta**. Se reemplaza solo durante el render por un cielo degradado (color de cielo arriba, de suelo abajo, calibrado ÷ π para que la exterior se vea igual de clara que en la vista normal; `src/render/sky.ts`). |
| Césped (textura de lienzo repetida) | Funciona. |
| Rejilla (`gridHelper`, son líneas) | No sale: el path tracer solo dibuja mallas. |

Luces que soporta three-gpu-pathtracer: direccional, puntual, foco (spot, también con perfil IES) y rectangular de área. No soporta `hemisphereLight`, `ambientLight` ni `lightProbe` (por eso el cielo degradado), ni sombras «suaves» de la luz direccional.

**Alternativa que no hizo falta.** Si el trazado de rayos no hubiera funcionado, el plan B era un «modo calidad» dibujado al momento: oclusión ambiental (N8AO), luz de entorno `RoomEnvironment`, sombras de mayor resolución. Es instantáneo, pero no calcula los rebotes de luz ni el vidrio de verdad: el interior no se aclara con la luz que entra por la ventana. Como el path tracer sí funciona con nuestros materiales y luces, se eligió éste.

## Límites

- **Necesita tarjeta gráfica.** Pide WebGL 2 con texturas de coma flotante (`EXT_color_buffer_float`); si falta, la ventana lo dice y no dibuja. En la gráfica integrada de un portátil va lento; con una gráfica dedicada, *Bueno* a 1600 × 900 debería tardar del orden de uno a pocos minutos (estimación, no medido aquí: depende mucho del equipo).
- **La primera vez compila un sombreador grande**: entre unos segundos y casi un minuto, según el navegador y la gráfica. La tarjeta muestra «Compilando sombreadores».
- **Grano**: no hay quitarruido. Con pocas muestras (Rápido) la noche y los interiores se ven granulados; sube a *Bueno* o *Alto*, o deja correr más tiempo.
- **Los interiores son más oscuros que en la vista normal**: es lo correcto. La vista normal ilumina todo con la luz de cielo aunque haya techo; en el render solo entra la luz que pasa por puertas y ventanas, más las bombillas.
- **Tiempo de bloqueo al preparar**: construir la estructura de rayos (BVH) se hace en el hilo principal; con una casa normal son milisegundos, con muchos muebles puede notarse un momento.
- **Mientras renderiza** el navegador gasta mucha GPU; la ventana sigue respondiendo porque cada fotograma solo calcula un cuarto de la imagen.
- **Si la gráfica se reinicia** (el controlador corta un cálculo demasiado largo), la ventana avisa y propone bajar a *Rápido*.
- **Pruebas hechas**: en la máquina de pruebas, sin GPU (render por software SwiftShader), *Rápido* a 430 × 326 px tardó 2:48 (Mañana) y unos 2:20 (Noche), más ~60 s compilando el sombreador. Con tan pocas muestras y tan poca resolución la imagen todavía tiene grano (puntos claros en el césped de noche, cerca de las luces del jardín). En una GPU real el mismo trabajo es cientos de veces más rápido. En una de las corridas de noche el navegador de pruebas se quedó congelado cerca del final; no se repitió y se atribuye a SwiftShader, pero por eso se añadió el aviso de reinicio de la gráfica.
- **La vista de noche normal ilumina las fachadas más de la cuenta**: las bombillas de la vista 3D no proyectan sombra y «atraviesan» los muros. En el render las fachadas quedan oscuras y solo brillan ventanas, puertas y el suelo junto a las luces del jardín: es el resultado físicamente correcto.

## Archivos

- `src/render/RenderButtons.tsx`: botones *Tomar foto* y *Render* (van en la barra de la vista 3D).
- `src/render/RenderBridge.tsx`: dentro del `<Canvas>`, comparte renderizador, escena y cámara con los botones.
- `src/render/RenderWindow.tsx`: ventana *Render realista* y tarjeta de progreso. Se carga solo al abrirla (el path tracer pesa ~60 kB comprimido).
- `src/render/pathTracer.ts`: envoltura de `WebGLPathTracer`.
- `src/render/presets.ts`, `progress.ts`, `resolution.ts`, `fileName.ts`, `sky.ts`, `renderStore.ts`: lógica con pruebas unitarias.

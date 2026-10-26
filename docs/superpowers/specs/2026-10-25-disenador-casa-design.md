# Diseñador de casa — Documento de diseño

Fecha: 2026-10-25
Estado: aprobado por el usuario ("Empieza")

## 1. Intención y porqué

El usuario está diseñando su apartamento de soltero (y luego su casa completa) con *My Dream Setup* (Steam) y la herramienta se le queda corta:

- Muy pocos objetos y materiales para amueblar.
- Límites a lo que se puede construir.
- No sirve para hacer planos.
- La perspectiva se ve mal y la cámara libre funciona mal.
- No se puede ver bien la casa "desde adentro".

Quiere **su propia herramienta de diseño**, sin límites artificiales, para diseñar su casa real: planos en 2D, vista en 3D y recorrerla por dentro como en un videojuego. Es una herramienta personal (un solo usuario), no un juego ni un producto comercial.

**Éxito** = puede dibujar su apartamento real con medidas en metros, amueblarlo con lo que necesita, caminar por dentro a la altura de los ojos y sacar los planos para enseñárselos a un arquitecto.

## 2. Objetivos

### 2.1 Plano 2D (editor principal)
- Dibujar paredes con medidas en **metros** (entrada numérica de longitud y grosor, además de dibujo con ratón).
- Ajuste opcional a rejilla y a ángulos (0/45/90°), desactivable — la colocación libre debe seguir siendo posible.
- Puertas y ventanas insertadas en paredes (ancho, alto, altura de antepecho editables).
- Las habitaciones se detectan o definen como polígonos cerrados; muestran nombre y área en m².
- Cotas visibles (longitudes de pared, dimensiones de habitación).
- **Balcones** (losa exterior con barandilla).
- Mover, girar, duplicar y borrar cualquier elemento. Deshacer/rehacer.

### 2.2 Varias plantas
- Crear, renombrar, reordenar y borrar plantas; cada una con altura de piso a techo.
- Ver la planta inferior en gris tenue como referencia al dibujar.
- **Escaleras** que conectan plantas (rectas y en L como mínimo).

### 2.3 Vista 3D
- El modelo 3D se genera en vivo desde el plano 2D (sin paso de "exportar").
- **Cámara orbital** para ver la casa desde fuera, con opción de ocultar plantas superiores / techos para ver el interior desde arriba.
- **Modo paseo en primera persona**: altura de ojos ~1,65 m, WASD + ratón (pointer lock), colisión con paredes y muebles, subir por escaleras entre plantas. Debe sentirse fluido y natural; esta es una de las razones principales del proyecto.
- Perspectiva correcta (campo de visión razonable, sin distorsión exagerada).

### 2.4 Catálogo de objetos y materiales
Primer catálogo, enfocado en el apartamento de soltero:
- **Setup**: escritorio, silla gamer, monitores, PC/torre, periféricos, estanterías, iluminación LED.
- **Dormitorio principal con balcón**: cama, armario, mesitas, lámparas; mobiliario exterior y plantas para el balcón.
- **Sala**: sofá, mesa de centro, TV, mueble de TV, alfombra.
- **Baño**: inodoro, lavabo, ducha y/o bañera, espejo, mueble de baño.
- **Decoración general**: plantas, cuadros/pósters, lámparas.

Materiales: colores de pared libres, suelos (madera, cerámica, porcelanato…), revestimientos (azulejo de baño).

El catálogo debe ser **ampliable sin tocar el código** (añadir un modelo + una entrada de datos), porque después vendrán cocina, comedor, lavandería y el resto de la casa. Importar modelos 3D propios (GLB/GLTF) también.

### 2.5 Paridad con My Dream Setup
Lo que tenía *My Dream Setup* también debe estar:
- Colocación libre de objetos (sin rejilla obligatoria), apilar objetos sobre otros (p. ej. monitor sobre escritorio).
- Pintar paredes.
- Cambiar hora del día (iluminación de mañana/tarde/noche) en la vista 3D.
- Edición de estructura (mover paredes, puertas y ventanas) — aquí ya cubierto por el editor 2D.

### 2.6 Guardar y exportar
- Guardar/abrir proyectos como archivos en el PC (sin cuenta ni nube).
- Exportar plano a **PDF a escala** (p. ej. 1:50) con cotas, por planta.
- Exportar plano a **DXF** para que un arquitecto lo abra en AutoCAD u otro CAD.

### 2.7 Decisiones tomadas tras la revisión
(El usuario pidió empezar sin contestar estas preguntas; son decisiones de Claude, revisables.)
- **Edición también en 3D**: colocar, mover, girar y apilar muebles y pintar paredes directamente en la vista 3D (selección, manejadores, ajuste a superficies), con un único historial de deshacer compartido con el editor 2D.
- **Medidas reales de muebles**: ancho, fondo y alto editables en metros. Los muebles "de caja" (escritorios, estanterías, armarios, camas, mesas) son paramétricos y se generan a partir de sus medidas; los modelos orgánicos (sillas, plantas, inodoros) se escalan dentro de unos márgenes.
- **Calcar plano existente**: cargar una imagen o PDF de fondo en el editor 2D y calibrar su escala con una longitud conocida. Va en la primera fase.
- **Aspecto realista**: materiales con textura (PBR, Poly Haven / ambientCG). Las lámparas y tiras LED iluminan de verdad, con un número limitado de luces dinámicas activas y un brillo emisivo para el resto, para mantener la fluidez. La hora del día cambia el sol y el cielo.
- **Paredes rectas** en cualquier ángulo; sin paredes curvas por ahora.
- **Techos y losas planas**; el modelo de datos deja hueco para tejados inclinados en el futuro. Sin terreno.
- **Muebles en el plano 2D y en las exportaciones** como siluetas en planta; el DXF va organizado por capas (paredes, huecos, muebles, cotas).
- **Modelos importados** (GLB/GLTF) se guardan dentro del archivo del proyecto para que sea portable. El catálogo base vive como carpeta de datos y modelos en el repositorio.
- Claude arranca y mantiene la app; el usuario no necesita usar la consola.

## 3. No-objetivos (por ahora)
- Multiusuario, cuentas, nube, colaboración.
- Formato IFC/BIM, cálculo estructural, instalaciones (eléctrica, fontanería), presupuestos.
- Renderizado fotorrealista tipo ray tracing.
- Versión móvil.
- Mecánicas de juego (progresión, desbloqueos, dinero, misiones).

## 4. Anti-objetivos (sería un fracaso aunque "funcione")
- Límites artificiales a cuánto se puede construir o colocar.
- Cámara o modo paseo torpes, mareantes o que atraviesen paredes sin querer.
- Medidas imprecisas: lo que se dibuja debe coincidir con los metros reales.
- Catálogo cerrado que obligue a tocar código para añadir objetos.

## 5. Restricciones y decisiones técnicas
(Decisiones de Claude; el usuario delegó lo técnico y autorizó usar las herramientas/librerías necesarias.)
- Aplicación web que se ejecuta en local en el navegador (Chrome/Edge) en Windows 11.
- TypeScript + React (interfaz) + Three.js (3D, probablemente vía react-three-fiber).
- Sin backend: todo en el cliente; los proyectos son archivos JSON en el disco del usuario.
- Unidades internas en metros.
- Modelos 3D gratuitos con licencia que permita su uso (p. ej. CC0: Kenney, Poly Haven, Quaternius); texturas CC0 (Poly Haven, ambientCG).
- Empaquetable más adelante como app de escritorio (Electron/Tauri) sin reescribir.
- Idioma de la interfaz: español.
- Ubicación del proyecto: `D:\Proyectos\setup`.

## 6. Decisiones que quedan al constructor
- Estructura de módulos, gestión de estado, librerías concretas de PDF/DXF.
- Diseño visual de la interfaz (paneles, barras de herramientas, atajos), siempre que sea simple de usar.
- Algoritmo de detección de habitaciones, generación de geometría de paredes y huecos.
- Orden de construcción por fases (sugerido: plano 2D → 3D orbital → modo paseo → catálogo/materiales → plantas/escaleras → exportaciones).

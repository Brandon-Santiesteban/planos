# Fase 1 — Plano 2D, plantas y vista 3D: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local browser app where the user draws their apartment in 2D (walls, doors, windows, rooms) in metres across several floors, traces over an existing plan image, saves/opens project files, and sees the result live in an orbitable 3D view.

**Architecture:** One Vite + React + TypeScript single-page app, no backend. The `Project` (plain JSON, metres) is the single source of truth; pure domain operations in `src/model/ops.ts` mutate it through an immer-based zustand store that keeps undo/redo history. The 2D editor is an SVG whose coordinates are metres; the 3D view (react-three-fiber) derives meshes from the same project with pure geometry functions. Plan (x, y) maps to world (x, elevation, y).

**Tech Stack:** Node 24, Vite, React 19, TypeScript (strict), zustand + immer, zod, three + @react-three/fiber + @react-three/drei, idb-keyval, pdfjs-dist, Vitest + @testing-library/react + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-disenador-casa-design.md`

### Roadmap (this plan is Phase 1 of 5; each later phase gets its own plan)
1. **This plan** — 2D plan, floors, tracing background, save/open, orbital 3D.
2. Walk mode — first-person at 1.65 m, WASD + mouse, collisions, stairs between floors (stairs as a plan element).
3. Furniture catalog — move/rotate/duplicate for every element, catalog data folder, parametric box furniture with real dimensions, CC0 models, GLB import embedded in project, placement/move/stack in 2D *and* 3D with shared undo, 2D silhouettes.
4. Materials & lighting — wall paint, floor/wall textures (PBR), LED/lamps with capped dynamic lights + emissive, time of day, realistic look.
5. Export — PDF at 1:50 per floor with dimensions; DXF with layers (MUROS, HUECOS, MUEBLES, COTAS).

## Global Constraints
- All lengths stored and computed in **metres** (number). Displayed with comma decimals: `3,50 m`, areas `12,35 m²`.
- UI text in **Spanish**.
- Runs locally in Chrome/Edge on Windows 11; no backend, no account, no network needed at runtime.
- No artificial limits on number of walls, rooms, floors or objects.
- Project file = JSON with `version: 1`, extension `.casa.json`; background images embedded as data URLs (portable to another PC).
- Default values: wall thickness `0.15`, floor height `2.6`, door `0.8 × 2.1` sill `0`, window `1.2 × 1.2` sill `0.9`, grid step `0.05`, minimum wall length `0.05`, opening margin from wall end `0.05`, endpoint-connection tolerance `0.001`.
- First floor is named `Planta baja`; new floors `Planta 1`, `Planta 2`, …
- The user never needs the console: provide `iniciar.bat` that installs (if needed) and launches the app in the browser.

## Review Focus
1. **Degenerate input** — clicking twice on the same point or a wall shorter than 0.05 m: no wall is created, no crash. (Task 2 `addWall` test.)
2. **Opening that doesn't fit** — door wider than the wall, overlapping another opening, or dragged past the wall end: refused or clamped, never rendered outside the wall. (Task 2 `fitOpening` tests.)
3. **Corrupt or foreign file opened** — shows a Spanish error, current project untouched. (Task 4 `parseProject` tests.)
4. **Cascading deletes** — deleting a wall removes its openings; deleting a floor removes its contents and background; the last floor cannot be deleted. (Task 2 tests.)
5. **Spanish decimal input** — typing `3,5` (or `350 cm`) in any length field means 3.5 m; garbage like `abc` or `-2` is rejected, not stored as NaN. (Task 2 `parseLength` tests.)

---

### Task 1: Project scaffold, data model and launcher

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `iniciar.bat`
- Create: `src/main.tsx`, `src/App.tsx`, `src/App.css`
- Create: `src/model/types.ts`, `src/model/defaults.ts`, `src/model/ids.ts`
- Test: `src/model/defaults.test.ts`

**Interfaces:**
- Produces (`src/model/types.ts`):
  ```ts
  export type Vec2 = { x: number; y: number };
  export interface Wall { id: string; a: Vec2; b: Vec2; thickness: number; height: number | null } // null = floor height
  export type OpeningKind = 'door' | 'window';
  export interface Opening { id: string; wallId: string; kind: OpeningKind; offset: number; width: number; height: number; sill: number } // offset = distance from wall.a to opening centre
  export type RoomKind = 'room' | 'balcony';
  export interface Room { id: string; name: string; kind: RoomKind; points: Vec2[] } // balcony = exterior slab with 1.0 m railing on edges not touching a wall
  export interface Background { dataUrl: string; origin: Vec2; metresPerPixel: number; opacity: number; widthPx: number; heightPx: number }
  export interface Floor { id: string; name: string; height: number; walls: Wall[]; openings: Opening[]; rooms: Room[]; background: Background | null }
  export interface Project { version: 1; name: string; floors: Floor[] } // floors ordered bottom → top
  ```
- Produces (`src/model/defaults.ts`): `export const DEFAULTS` (object with every default value from Global Constraints, keys: `wallThickness, floorHeight, door:{width,height,sill}, window:{width,height,sill}, gridStep, minWallLength, openingMargin, joinTolerance`), `createEmptyProject(name?: string): Project`, `createFloor(name: string): Floor`.
- Produces (`src/model/ids.ts`): `newId(): string` (uses `crypto.randomUUID()`).

- [ ] **Step 1:** `git init` in `D:\Proyectos\setup`; scaffold Vite React-TS in place (`npm create vite@latest . -- --template react-ts`, keep existing `docs/`); install runtime deps `zustand immer zod three @react-three/fiber @react-three/drei idb-keyval pdfjs-dist` and dev deps `vitest jsdom @testing-library/react @testing-library/jest-dom @types/three @playwright/test`. Configure Vitest in `vite.config.ts` (`environment: 'jsdom'`). Add scripts `"test": "vitest run"`, `"e2e": "playwright test"`.
- [ ] **Step 2: Write the failing test** `src/model/defaults.test.ts`:
  ```ts
  test('empty project has one floor called Planta baja', () => {
    const p = createEmptyProject();
    expect(p.version).toBe(1);
    expect(p.floors).toHaveLength(1);
    expect(p.floors[0].name).toBe('Planta baja');
    expect(p.floors[0].height).toBe(2.6);
    expect(p.floors[0].walls).toEqual([]);
    expect(p.floors[0].background).toBeNull();
  });
  ```
- [ ] **Step 3:** Run `npm test` — expect FAIL (module not found).
- [ ] **Step 4:** Implement `types.ts`, `defaults.ts`, `ids.ts`. Replace the Vite demo `App.tsx` with an empty Spanish shell titled "Diseñador de casa".
- [ ] **Step 5:** Run `npm test` — PASS. Run `npm run build` — succeeds.
- [ ] **Step 6:** Write `iniciar.bat`: `cd /d "%~dp0"`, `if not exist node_modules call npm install`, `start "" http://localhost:5173`, `npm run dev`. Commit: `git add -A && git commit -m "chore: scaffold app and data model"`.

---

### Task 2: Geometry helpers and domain operations

**Files:**
- Create: `src/geometry/vec.ts`, `src/geometry/walls.ts`, `src/geometry/polygons.ts`, `src/geometry/snap.ts`, `src/model/units.ts`, `src/model/ops.ts`
- Test: `src/geometry/walls.test.ts`, `src/geometry/polygons.test.ts`, `src/geometry/snap.test.ts`, `src/model/units.test.ts`, `src/model/ops.test.ts`

**Interfaces:**
- Consumes: types and `DEFAULTS` from Task 1.
- Produces:
  - `vec.ts`: `add, sub, scale, len, dist, normalize, lerp, dot, perp` on `Vec2`.
  - `walls.ts`:
    - `wallLength(w: Wall): number`
    - `isEndConnected(walls: Wall[], wallId: string, end: 'a' | 'b'): boolean` — another wall has an endpoint within `joinTolerance`.
    - `wallFootprint(w: Wall, extendA: boolean, extendB: boolean): Vec2[]` — 4-point polygon (a-left, b-left, b-right, a-right); each extended end grows by `thickness/2` along the wall.
    - `fitOpening(wallLen: number, offset: number, width: number, others: { offset: number; width: number }[]): number | null` — clamps the centre so the opening stays ≥ `openingMargin` from both ends; `null` if it can't fit or would overlap any other opening.
    - `projectOntoWall(w: Wall, p: Vec2): { offset: number; distance: number }`
  - `polygons.ts`: `polygonArea(pts: Vec2[]): number` (absolute), `polygonCentroid(pts: Vec2[]): Vec2`.
  - `snap.ts`: `snapToGrid(p: Vec2, step: number): Vec2`, `snapAngle(from: Vec2, to: Vec2, stepDeg: number): Vec2` (keeps length), `snapPoint(p: Vec2, ctx: { gridStep: number; endpoints: Vec2[]; radius: number }): { point: Vec2; kind: 'endpoint' | 'grid' }` (endpoint wins when within radius).
  - `units.ts`: `parseLength(text: string): number | null` (accepts `3,5`, `3.5`, `3,5 m`, `350 cm`, `350cm`; rejects empty, non-numeric, ≤ 0), `formatMetres(m: number): string` (`"3,50 m"`), `formatArea(m2: number): string` (`"12,35 m²"`).
  - `ops.ts` — all mutate a `Project` draft in place (immer-friendly), take `floorId` first after the project:
    - `addWall(p, floorId, a: Vec2, b: Vec2, thickness?: number): string | null` (null if shorter than `minWallLength`)
    - `updateWall(p, floorId, wallId, patch: Partial<Pick<Wall, 'thickness' | 'height'>>): void`
    - `setWallLength(p, floorId, wallId, length: number): void` — moves `b` along the wall direction (connected endpoints at `b` follow); re-fits openings, deleting those that no longer fit.
    - `moveWallEndpoint(p, floorId, wallId, end: 'a' | 'b', to: Vec2): void` — moves every wall endpoint (on that floor) that coincided with the original point.
    - `moveWall(p, floorId, wallId, delta: Vec2): void` — translates both ends, dragging connected endpoints.
    - `deleteWall(p, floorId, wallId): void` — also deletes its openings.
    - `addOpening(p, floorId, wallId, kind: OpeningKind, offset: number): string | null` — uses kind defaults + `fitOpening`.
    - `updateOpening(p, floorId, openingId, patch: Partial<Pick<Opening, 'offset' | 'width' | 'height' | 'sill'>>): boolean` — false (no change) if result doesn't fit.
    - `deleteOpening(p, floorId, openingId): void`
    - `addRoom(p, floorId, points: Vec2[], name: string): string | null` (null if < 3 points or area < 0.01), `renameRoom(p, floorId, roomId, name)`, `deleteRoom(p, floorId, roomId)`
    - `addFloor(p): string` (name `Planta N`, appended on top), `renameFloor(p, floorId, name)`, `setFloorHeight(p, floorId, h)`, `moveFloor(p, floorId, dir: -1 | 1)`, `deleteFloor(p, floorId): boolean` (false if last floor)
    - `floorElevation(p, floorId): number` — sum of heights of floors below.

- [ ] **Step 1: Write the failing tests.** Key assertions (one `test` each):
  ```ts
  // units
  expect(parseLength('3,5')).toBe(3.5); expect(parseLength('350 cm')).toBe(3.5);
  expect(parseLength('2.75m')).toBe(2.75); expect(parseLength('abc')).toBeNull();
  expect(parseLength('-2')).toBeNull(); expect(parseLength('')).toBeNull();
  expect(formatMetres(3.5)).toBe('3,50 m'); expect(formatArea(12.345)).toBe('12,35 m²');
  // polygons
  expect(polygonArea([{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}])).toBeCloseTo(12);
  expect(polygonArea([{x:0,y:0},{x:0,y:3},{x:4,y:3},{x:4,y:0}])).toBeCloseTo(12); // clockwise too
  // snap
  expect(snapToGrid({x:1.234,y:0.026}, 0.05)).toEqual({x:1.25,y:0.05});
  expect(snapAngle({x:0,y:0},{x:3,y:0.2},45).y).toBeCloseTo(0);
  expect(snapPoint({x:1.02,y:0}, {gridStep:0.05, endpoints:[{x:1,y:0}], radius:0.1}).kind).toBe('endpoint');
  // walls
  expect(fitOpening(4, 2, 1.2, [])).toBe(2);
  expect(fitOpening(4, 0.1, 0.8, [])).toBeCloseTo(0.45);        // clamped to margin
  expect(fitOpening(0.7, 0.35, 0.8, [])).toBeNull();             // wider than wall
  expect(fitOpening(4, 2, 1, [{offset:2.5,width:1}])).toBeNull(); // overlap
  expect(wallFootprint(w4x0_t02, true, false)[0].x).toBeCloseTo(-0.1); // extended end
  // ops
  addWall(p, f, {x:0,y:0}, {x:0.01,y:0}) === null;                   // degenerate
  // deleting wall with opening removes the opening
  // moveWallEndpoint drags the connected wall's endpoint
  // setWallLength(…, 3) on a 4 m wall with a window at offset 3.5 deletes that window
  // deleteFloor on the only floor returns false and keeps it
  // addFloor twice → names 'Planta 1','Planta 2'; floorElevation of 'Planta 2' with heights 2.6 = 5.2
  ```
- [ ] **Step 2:** Run `npm test` — FAIL.
- [ ] **Step 3:** Implement the modules with the signatures above.
- [ ] **Step 4:** Run `npm test` — PASS.
- [ ] **Step 5:** Commit `feat: geometry helpers and domain operations`.

---

### Task 3: Editor store with undo/redo

**Files:**
- Create: `src/store/editorStore.ts`
- Test: `src/store/editorStore.test.ts`

**Interfaces:**
- Consumes: `ops.ts`, `createEmptyProject`.
- Produces:
  ```ts
  export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'calibrate';
  export type Selection =
    | { kind: 'wall' | 'opening' | 'room'; id: string }
    | null;
  export interface EditorState {
    project: Project; activeFloorId: string; selection: Selection; tool: Tool;
    snapping: boolean; showUpperFloors: boolean;
    past: Project[]; future: Project[]; dirty: boolean;
    apply(recipe: (draft: Project) => void, opts?: { record?: boolean }): void; // record defaults true
    checkpoint(): void;           // push current project to past (start of a drag); later applies use record:false
    undo(): void; redo(): void;   // no-op when stacks empty; clear selection if its target vanished
    setTool(t: Tool): void; select(s: Selection): void; setActiveFloor(id: string): void;
    setSnapping(on: boolean): void; setShowUpperFloors(on: boolean): void;
    loadProject(p: Project): void; // resets history, selects first floor, dirty=false
    markSaved(): void;
  }
  export const useEditor: UseBoundStore<StoreApi<EditorState>>;
  ```
  History limit 200 entries. `apply` with record sets `future = []` and `dirty = true`.

- [ ] **Step 1: Write failing tests:** apply(addWall) then undo → no walls; redo → wall back; drag pattern (`checkpoint` + three `apply(…, {record:false})`) undoes in one step; `loadProject` clears `past`; undo after deleting the selected wall's creation clears `selection`; `setActiveFloor` with unknown id is ignored.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement with `zustand` + `immer`'s `produce`. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: editor store with undo/redo`.

---

### Task 4: Save, open and autosave

**Files:**
- Create: `src/persistence/projectFile.ts`, `src/persistence/autosave.ts`
- Test: `src/persistence/projectFile.test.ts`

**Interfaces:**
- Produces:
  - `serializeProject(p: Project): string` (pretty JSON)
  - `parseProject(text: string): { ok: true; project: Project } | { ok: false; error: string }` — zod schema mirroring `types.ts`; errors in Spanish (`"El archivo no es un proyecto válido"`, `"Versión de proyecto no compatible"`).
  - `saveProject(p: Project, handle?: FileSystemFileHandle): Promise<FileSystemFileHandle | null>` — `showSaveFilePicker` (suggested name `${p.name}.casa.json`); falls back to an `<a download>` when the API is missing; returns null if the user cancels.
  - `openProject(): Promise<{ project: Project; handle: FileSystemFileHandle | null } | { error: string } | null>`
  - `autosave.ts`: `startAutosave(): () => void` — subscribes to `useEditor`, writes `serializeProject` to IndexedDB key `autosave` debounced 1000 ms; `loadAutosave(): Promise<Project | null>`.

- [ ] **Step 1: Write failing tests:** round-trip `parseProject(serializeProject(p))` equals `p` (with walls, openings, rooms, background); `parseProject('{')` → `ok:false`; `parseProject('{"version":2,…}')` → error mentions versión; an opening whose `wallId` doesn't exist → `ok:false`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: project save/open and autosave`.

---

### Task 5: App layout, 2D viewport and plan rendering

**Files:**
- Create: `src/editor2d/viewport.ts`, `src/editor2d/Plan2D.tsx`, `src/editor2d/layers/GridLayer.tsx`, `WallsLayer.tsx`, `OpeningsLayer.tsx`, `RoomsLayer.tsx`, `DimensionsLayer.tsx`, `BackgroundLayer.tsx`
- Create: `src/ui/Toolbar.tsx`, `src/ui/TopBar.tsx`, `src/ui/PropertiesPanel.tsx` (empty-state only in this task)
- Modify: `src/App.tsx`, `src/App.css`
- Test: `src/editor2d/viewport.test.ts`, `src/editor2d/Plan2D.test.tsx`

**Interfaces:**
- Produces:
  - `viewport.ts`: `type View = { centre: Vec2; pxPerMetre: number }`; `screenToWorld(v: View, size: {w:number;h:number}, s: Vec2): Vec2`; `worldToScreen(...)`; `zoomAt(v: View, size, screenPt: Vec2, factor: number): View` (point under cursor stays fixed; pxPerMetre clamped 10–2000).
  - `Plan2D` props: none (reads `useEditor`); exposes pointer events in world coords to the active tool via `src/editor2d/tools/index.ts` (Task 6 defines the tool interface; in this task Plan2D only pans with middle/right-drag or space+drag and zooms with the wheel).
  - Layout: top bar (Nuevo, Abrir, Guardar, Deshacer, Rehacer, project name, snapping toggle), left vertical toolbar (tools), centre split 2D | 3D with buttons to maximise either side, right properties panel, floors panel bottom-left (Task 10). Keyboard: Ctrl+Z, Ctrl+Y/Ctrl+Shift+Z, Ctrl+S, Ctrl+O, Esc → select tool.
  - Rendering of the active floor: walls via `wallFootprint` (extend connected ends) filled dark grey; doors as a gap with a 90° swing arc; windows as a gap with a thin double line; rooms as light fill with `name` and `formatArea` at the centroid; each wall's `formatMetres(length)` label offset outside; selected element highlighted in blue.

- [ ] **Step 1: Write failing tests:** `zoomAt` keeps the world point under the cursor fixed (round-trip `screenToWorld` before/after within 1e-9); `worldToScreen(screenToWorld(s)) ≈ s`; rendering `<Plan2D/>` with a store holding one 4 m wall shows text `4,00 m` and one wall `<polygon>`; a room 4×3 named `Sala` shows `Sala` and `12,00 m²`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS; `npm run dev` and check the layout loads with grid, pan and zoom.
- [ ] **Step 5:** Commit `feat: app layout and 2D plan rendering`.

---

### Task 6: Wall tool with snapping and typed length

**Files:**
- Create: `src/editor2d/tools/index.ts`, `src/editor2d/tools/wallTool.ts`, `src/ui/LengthInput.tsx`
- Modify: `src/editor2d/Plan2D.tsx`, `src/ui/Toolbar.tsx`
- Test: `src/editor2d/tools/wallTool.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ToolContext { state: EditorState; view: View; altKey: boolean; shiftKey: boolean }
  export interface ToolHandler {
    onPointerDown?(p: Vec2, ctx: ToolContext): void;
    onPointerMove?(p: Vec2, ctx: ToolContext): void;
    onPointerUp?(p: Vec2, ctx: ToolContext): void;
    onKey?(key: string, ctx: ToolContext): boolean; // true = handled
    preview(): ToolPreview | null; // what Plan2D draws on top (ghost wall, ghost polygon, snap marker, live length)
    reset(): void;
  }
  export type ToolPreview = { kind: 'wall'; a: Vec2; b: Vec2; length: number } | { kind: 'polygon'; points: Vec2[]; cursor: Vec2 } | { kind: 'marker'; at: Vec2 };
  export function createWallTool(): ToolHandler;
  ```
  Behaviour: click sets start; moving shows ghost with live length; click commits the wall and chains (next wall starts at the end); Esc or double-click ends the chain. Snapping (when `state.snapping` and Alt not held): endpoint snap radius = 12 px converted to metres, else grid; Shift locks to 45° steps. Typing digits opens `LengthInput` near the cursor; Enter commits a wall of that `parseLength` value along the current direction; invalid text shows the field in red and commits nothing.

- [ ] **Step 1: Write failing tests** (drive the handler directly with a real store): click (0,0) then (4,0) → one wall length 4; chain click (4,3) → second wall sharing endpoint (4,0); typing `3,5` + Enter after first click with cursor toward +x → wall length 3.5; typing `abc` + Enter → no wall; clicking the same point twice → no wall; Esc resets.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement and wire into Plan2D/Toolbar (shortcut `M`). **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: wall drawing tool`.

---

### Task 7: Select tool and properties panel

**Files:**
- Create: `src/editor2d/tools/selectTool.ts`, `src/editor2d/hitTest.ts`
- Modify: `src/ui/PropertiesPanel.tsx`, `src/editor2d/Plan2D.tsx`
- Test: `src/editor2d/hitTest.test.ts`, `src/editor2d/tools/selectTool.test.ts`, `src/ui/PropertiesPanel.test.tsx`

**Interfaces:**
- Produces:
  - `hitTest(floor: Floor, p: Vec2, tolerance: number): { kind: 'endpoint'; wallId: string; end: 'a' | 'b' } | { kind: 'opening' | 'wall' | 'room'; id: string } | null` — priority endpoint > opening > wall > room.
  - `createSelectTool(): ToolHandler` — click selects; drag endpoint → `checkpoint` + `moveWallEndpoint` (snapping applies); drag wall body → `moveWall`; drag opening → `updateOpening` offset along its wall; drag room → no-op; Delete/Backspace deletes the selection.
  - PropertiesPanel (Spanish labels, all lengths via `parseLength`, invalid input highlighted red and not applied):
    - Muro: Longitud, Grosor, Altura (vacío = altura de planta), Eliminar.
    - Puerta/Ventana: Ancho, Alto, Antepecho (ventana), Posición desde el inicio, Eliminar.
    - Habitación: Nombre, Tipo (Habitación / Balcón → `setRoomKind(p, floorId, roomId, kind: RoomKind)` added to `ops.ts` in this task), Área (read-only), Eliminar.

- [ ] **Step 1: Write failing tests:** hitTest priority (point near an endpoint of a wall with an opening returns endpoint); dragging a shared corner moves both walls and undo restores both in one step; typing `3` in Longitud sets length 3; typing `x` leaves the length unchanged; Delete removes selected wall and its openings.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement (shortcut `V`). **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: selection, dragging and properties panel`.

---

### Task 8: Door, window and room tools

**Files:**
- Create: `src/editor2d/tools/openingTool.ts`, `src/editor2d/tools/roomTool.ts`
- Modify: `src/editor2d/Plan2D.tsx`, `src/ui/Toolbar.tsx`
- Test: `src/editor2d/tools/openingTool.test.ts`, `src/editor2d/tools/roomTool.test.ts`

**Interfaces:**
- Produces:
  - `createOpeningTool(kind: OpeningKind): ToolHandler` — hover shows a ghost on the nearest wall within 0.3 m (via `projectOntoWall`, centre clamped by `fitOpening`); click calls `addOpening`; no wall nearby or no fit → nothing and ghost shown red. Shortcuts `P` (puerta), `N` (ventana).
  - `createRoomTool(): ToolHandler` — clicks add points (snapping to wall endpoints and grid); clicking the first point or pressing Enter closes; `addRoom` with name `Habitación N` (N = count on floor + 1), then selects it so the user can rename. Esc cancels. Shortcut `H`.

- [ ] **Step 1: Write failing tests:** clicking 0.1 m from the middle of a 4 m wall with door tool adds a door at offset ≈ 2; clicking 1 m away from every wall adds nothing; clicking a 0.6 m wall with door tool adds nothing; room tool with 4 clicks + click on first point creates a room of area 12 named `Habitación 1`; 2 clicks + Enter creates nothing.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: door, window and room tools`.

---

### Task 9: Background plan import and scale calibration

**Files:**
- Create: `src/background/loadBackground.ts`, `src/background/calibrate.ts`, `src/editor2d/tools/calibrateTool.ts`, `src/ui/BackgroundControls.tsx`
- Modify: `src/editor2d/layers/BackgroundLayer.tsx`, `src/model/ops.ts`
- Test: `src/background/calibrate.test.ts`, `src/editor2d/tools/calibrateTool.test.ts`

**Interfaces:**
- Produces:
  - `loadBackgroundFile(file: File): Promise<{ dataUrl: string; widthPx: number; heightPx: number }>` — PNG/JPG read as data URL; PDF → first page rendered with `pdfjs-dist` at 2× scale to PNG data URL.
  - `calibratedMetresPerPixel(currentMpp: number, measuredMetres: number, realMetres: number): number` = `currentMpp * realMetres / measuredMetres`.
  - ops additions: `setBackground(p, floorId, bg: Background | null)`, `updateBackground(p, floorId, patch: Partial<Pick<Background, 'origin' | 'metresPerPixel' | 'opacity'>>)`.
  - `createCalibrateTool(): ToolHandler` — click two points on the image, prompt `LengthInput` "Medida real"; Enter applies scale keeping the first clicked point fixed in the world.
  - BackgroundControls (in properties panel when nothing is selected): Cargar plano de fondo, Calibrar escala, Opacidad slider, Mover fondo (drag), Quitar fondo. New background starts at origin (0,0) with `metresPerPixel = 0.01` and opacity 0.5; rendered under the grid-free walls, not hit-testable.

- [ ] **Step 1: Write failing tests:** `calibratedMetresPerPixel(0.01, 2, 4)` = 0.02; calibrate tool: two clicks 2 m apart in world, input `4` → stored `metresPerPixel` doubles and the first clicked point maps to the same world position; input `0` → unchanged.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS; manually load a PNG and a PDF in the dev app.
- [ ] **Step 5:** Commit `feat: background plan import and calibration`.

---

### Task 10: Floors panel and lower-floor ghost

**Files:**
- Create: `src/ui/FloorsPanel.tsx`
- Modify: `src/editor2d/Plan2D.tsx`, `src/editor2d/layers/WallsLayer.tsx`
- Test: `src/ui/FloorsPanel.test.tsx`

**Interfaces:**
- Consumes: `addFloor, renameFloor, setFloorHeight, moveFloor, deleteFloor` (Task 2).
- Produces: panel listing floors top → bottom; click to activate; double-click to rename; height field (`parseLength`); buttons Añadir planta, Subir, Bajar, Eliminar (confirm dialog "¿Eliminar «Planta 1» y todo su contenido?"; button disabled when one floor). Plan2D draws the walls of the floor directly below the active one in light grey, non-interactive, beneath the active floor.

- [ ] **Step 1: Write failing tests:** clicking Añadir planta shows `Planta 1` and activates it; Eliminar disabled with a single floor; deleting active floor activates the one below; WallsLayer renders ghost walls with class `ghost` for the floor below.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: multiple floors panel`.

---

### Task 11: 3D view (orbital)

**Files:**
- Create: `src/view3d/wallPieces.ts`, `src/view3d/Scene3D.tsx`, `src/view3d/FloorMeshes.tsx`, `src/view3d/WallMesh.tsx`, `src/view3d/RoomSlab.tsx`
- Modify: `src/App.tsx`
- Test: `src/view3d/wallPieces.test.ts`

**Interfaces:**
- Produces:
  - `type Piece = { u0: number; u1: number; z0: number; z1: number }` (u along the wall from `a`, z up from floor level).
  - `wallPieces(length: number, height: number, openings: { offset: number; width: number; sill: number; height: number }[], extA: number, extB: number): Piece[]` — full-height pieces between openings, a below-sill piece (if sill > 0) and an above-head piece (if sill+height < wall height) per opening; ends extended by `extA`/`extB` (`thickness/2` when connected).
  - `Scene3D`: r3f `<Canvas>` with `OrbitControls` (drei), perspective camera FOV 60, hemisphere + directional light with shadows, ground plane. For each floor up to the active one (plus higher ones when `showUpperFloors`) at `floorElevation`: walls as boxes per piece (light grey), window gaps get a transparent glass pane (0.02 m thick, mid-wall), rooms as a 0.02 m slab from `polygon` via `THREE.Shape` (beige; balconies grey stone-like) and, for balconies, a 1.0 m railing (posts + top rail + translucent panel) along every edge for which `edgeTouchesWall(edge, walls, tolerance = thickness/2 + 0.01): boolean` (in `wallPieces.ts`, tested: edge lying on a wall's face → true; free edge → false) is false. Re-renders live on project change. Toolbar toggle "Mostrar plantas superiores". Selected wall tinted blue in 3D too.

- [ ] **Step 1: Write failing test** for `wallPieces(4, 2.6, [{offset:2,width:1.2,sill:0.9,height:1.2}], 0, 0)` → exactly `[{u0:0,u1:1.4,z0:0,z1:2.6},{u0:1.4,u1:2.6,z0:0,z1:0.9},{u0:1.4,u1:2.6,z0:2.1,z1:2.6},{u0:2.6,u1:4,z0:0,z1:2.6}]` (order-insensitive); a door with sill 0 and height 2.1 yields no below piece; an opening as tall as the wall yields no above piece; `extA=0.075` makes the first piece start at -0.075.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS; in the dev app draw a 4×3 room with a door and a window and check the 3D view matches and orbits smoothly.
- [ ] **Step 5:** Commit `feat: live orbital 3D view`.

---

### Task 12: End-to-end smoke test and wiring check

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `src/App.tsx` (wire `startAutosave` + restore on start), `README.md` (Spanish, how to launch with `iniciar.bat`, shortcuts)

**Interfaces:**
- Consumes: everything above. Test ids: `data-testid="plan2d"`, `"scene3d"`, `"tool-wall"`, `"tool-door"`.

- [ ] **Step 1: Write failing e2e test** (`webServer: npm run dev`, Chromium): select wall tool, click two points on `plan2d`, type `4` + Enter → text `4,00 m` visible; Ctrl+Z → text gone; Ctrl+Y → back; reload page → wall restored from autosave; `scene3d` canvas present.
- [ ] **Step 2:** `npx playwright install chromium`; run `npm run e2e` — FAIL. **Step 3:** Wire autosave restore and test ids. **Step 4:** Run `npm test && npm run e2e && npm run build` — all PASS.
- [ ] **Step 5:** Commit `test: e2e smoke and autosave restore`.

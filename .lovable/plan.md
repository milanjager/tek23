# Přestavba Vrstev + rovina reproduktorů + dark + presety

Rozsah je jasný. Nejdřív potvrď plán, pak jedu.

## 1. Layers panel jako ve Photoshopu

V pravém sidebaru v `StageBuilder3D.tsx`:

- **Aktivní vrstva vždy viditelná** — když je vybraná bedna (klikem v 3D, Elevation, Iso, Schema), Layers panel se auto-scrollne na tu položku, skupinu, do které patří, rozbalí se, a řádek dostane silný accent border + levý indikátor barvy (acid).
- **Skupiny = složky** — ikona `📁` (chevron pro collapse) a odsazené vnořené vrstvy (indent 12 px, vertikální linka jako v PS Layers).
- **Drag & drop reorder** přes `@dnd-kit/core` (už v projektu). Táhnutí položky:
  - mezi dvě jiné = přeřadit pořadí (v poli `items` — pořadí = z-order v Layers panelu, nemění se pozice v 3D)
  - na složku = přidat do skupiny (nastaví `groupId`)
  - mimo skupinu (nahoru na root) = vyjmout ze skupiny
- **Skupina má sliders pro rozestup** mezi bednami:
  - `spacingX` (horizontální mezera mezi bednami ve skupině, m)
  - `spacingZ` (dopředu-dozadu — u nás pouze pro backline skupiny, viz níže o rovině)
  - `spacingY` (vertikální, mezi patry stacku)
- Skupina má tlačítko **„Přerovnat"** — aplikuje aktuální spacing hodnoty na členy: seřadí je zleva doprava podle X, přepočítá X pozice s daným krokem, Y stacky respektují `spacingY`.
- Řádek vrstvy má: barevný swatch (per-kind), název (klik = rename), toggle `👁` visible, `🔒` lock, badge s výškou stacku (`▲n`).

## 2. Jedna Z-rovina pro reproduktory

Reproduktory dávají smysl jen v jedné čáře publikum-facing. Přidávám globální `speakerLineZ` (default 0).

- Při umístění, dropu, arrow-key posunu **jakéhokoli reproduktoru** (kind s kategorií `sound`, mimo mixer/rozvaděč/amp) se `z` snapuje na `speakerLineZ`. Šipky nahoru/dolů v XZ (arrow keys) pro reproduktory nedělají Z posun.
- Ne-reproduktory (amp, mixer, distro, lights, truss) mohou být kdekoli.
- V ghostu při dragu reproduktoru se ukáže tenká acid čára v rovině `speakerLineZ` jako guide.
- **Vertikální stacking** funguje beze změny — Y může jít nahoru.
- **Šipky orientace ▼** na modelu reproduktoru se odstraní (front-of-box glyph v `PicusBinModel` a v Elevation/Iso SVG). Není třeba — všichni směřují na publikum.

Slider „Rovina reproduktorů (m)" v Layers panelu vedle Auto srovnat.

## 3. Dark mode

- V `src/styles.css` už `.dark` existuje, ale má jen 2 tokeny. Doplním celou paletu tokenů pro dark.
- Přidám `ThemeToggle` (☀/🌙) do horního toolbaru v `StageBuilder3D.tsx`. Přepíná třídu `dark` na `document.documentElement`, persist v `localStorage("stage.theme")`.
- Three.js scéna: `scene.background`, ContactShadows opacity, fog — čtou tokeny přes `useTheme()` hook.

## 4. Presety — reset

Smažu `picus_wall` (a všechny zbytkové odkazy). Přidám 3 nové:

1. **„Namel Wall"** — replikace poslední fotky (spodní 4×2 subs scoop, řada bass_row, mid grill sloupec + horní 3way tops flanked hex_horn). Auto-wire PWR/SPK/SIG.
2. **„Club Stack"** — kompaktní 2×2 sub base + 2× top L/R, 1 amp rack, 1 mixer.
3. **„Festival Ground"** — 3× cluster subs (L / C / R), 2 sloupy midů, 2× wing_horn na křídlech.

Odstraním komponent `dance_floor` z `Kind`, `SPECS`, `ModelFor`, palety a všech presetů.

## 5. Šipky orientace

Vzhledem k jednorovinnému pravidlu (bod 2) odstraním glyph front-of-box z modelů reproduktorů a ze všech 2D views.

## Technický breakdown

- `StageBuilder3D.tsx`:
  - `speakerLineZ` state (persist).
  - `snapSpeakerZ(kind, pos)` helper — voláno v `handleTransformEnd`, `addItem`, `nudge` (arrow keys), `PlacementGhost`.
  - `LayersPanel` kompletně přepsat: strom `groups → items`, dnd-kit sortable, active-scroll-into-view přes `useEffect(selectedId)`.
  - Odstranit `dance_floor`, presety, front-of-box arrow glyph.
  - `ThemeProvider` + toggle.
- `src/styles.css`: doplnit dark tokeny (bg, panel, muted, border, ring…) v `.dark`.
- `ElevationView.tsx`, `IsometricView.tsx`, `GridPlannerView.tsx`: odstranit orientation arrows na reproduktorech.
- Regresní testy (`placement.test.ts`): přidat test, že `snapSpeakerZ` vrací `speakerLineZ` pro sound-kind a original z pro jiné.

## Co NEDĚLÁM v tomhle kole

- Přepínání per-cluster Z (víc rovin) — pokud budeš chtít později, řekni.
- Vlastní preset editor — presety zůstávají tvrdě zadané v kódu.

Řekni „jedeme" a pustím to.

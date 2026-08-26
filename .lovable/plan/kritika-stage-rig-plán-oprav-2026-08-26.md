# Kritika Stage Rig + plán oprav

Kompletní audit (kód + živý náhled desktop/mobil/dark). Níže shrnutí findingů a opravy, které provedu po schválení.

## Hlavní zjištění (Critical)

1. **Monolit `StageBuilder3D.tsx` (6 500+ řádků)** — veškerý stav v jednom souboru; posun jedné bedny re-renderuje celé UI. *(Critical)*
2. **Výkon 3D scény:**
   - `CornerBracket` = 3 meshe × 8 na bednu → při 20 bednách ~480 draw calls jen za rohy.
   - Každý kabinet klonuje texturu grilu (`grilleTex.clone()`) → desítky kopií v GPU paměti.
   - Geometrie `<boxGeometry>` v renderu bez `useMemo`; každá bedna `castShadow`; každý kabel vlastní `useFrame`.
3. **Duplikace typů** — `Placed`/`Cable` definovány ~7× napříč view soubory.

## Zjištění z živého náhledu

4. **První načtení ukazuje prázdný canvas** — kamera se nezaměří na rig, uživatel vidí bílo (screenshot). *(Critical UX)*
5. **Žluté X rámy scoopů jsou pořád křiklavé** — předchozí ztlumení se projevilo jen u crosshaire, rámy grilu září žlutě. *(Warning)*
6. **Zelené label chipy (SCOOP LO 1…)** se překrývají a špiní scénu při větším rigu. *(Warning)*
7. **Mobilní toolbar přetéká** — tlačítko presetů je useknuté („Načís…"), 3 řádky toolbaru na desktopu. *(Warning)*
8. **Dark mode se po reloadu neaplikoval** přes persistovaný klíč — ověřit persistenci theme (pravděpodobně špatný localStorage klíč / chybějící init). *(Warning, k ověření)*
9. **Překlep** v popisku „Rozmísti a srovnej aparát". *(Info)*
10. **A11y**: icon-only tlačítka (zoom +/− v GridPlanneru, sidebar toggly) bez `aria-label`; tap targety presetů na mobilu pod 44 px. *(Warning)*
11. **Dark mode kontrasty** — `--muted-foreground` na `--background` může být pod WCAG AA. *(Info)*

## Plán oprav (po schválení)

### Fáze 1 — Rychlé UX opravy (viditelné hned)
- Opravit výchozí kameru: po mountu/nahrání presetu automaticky `fitView` na bounding box scény.
- Ztlumit žluté rámy scoopů (grafitová místo žluté, jako crosshair) + sjednotit barvu rámu s materiálem grilu.
- Label chipy: menší, zobrazovat jen při výběru/hoveru nebo přepínatelné v toolbaru (👁 Popisky).
- Mobilní toolbar: horizontal scroll s viditelnými tlačítky, preset dropdown neuseknutý; tap targety ≥44 px.
- Opravit překlep, doplnit chybějící `aria-label`.
- Ověřit + opravit persistenci dark mode (init při startu z localStorage).

### Fáze 2 — Výkon 3D
- Sdílená textura grilu (jedna instance, `repeat` řešit přes UV/clone materiálu, ne textury).
- `CornerBracket` → jedna sloučená geometrie per bedna (nebo InstancedMesh).
- Memoizovat geometrie (`useMemo` / modulové cache podle rozměru).
- Stíny: `castShadow` jen na vybrané/glavní objekty, jinak ContactShadows.
- `CableFlow`/`CableEndpoint` animace: jedna sdílená `useFrame` smyčka nebo shader uniform místo N smyček.

### Fáze 3 — Architektura (bez změny chování)
- Vyextrahovat typy `Placed`, `Cable`, `Kind`, `Spec` do `src/types/stage.ts` a sjednotit importy (7 definic → 1).
- Z `StageBuilder3D.tsx` vyčlenit: `catalog.ts` (SPECS), `models/` (Cabinet, Distro, Generator…), `panels/` (Layers, Detail). Cíl: hlavní soubor pod ~2 000 řádků.

### Co NEDĚLÁM
- Nepřepisuji stavový management na Zustand (velký zásah; můžeme jako samostatný krok později).
- Neměním funkcionalitu zapojení/presetů — jen výkon, UI a strukturu.

## Ověření
- Po každé fázi: build OK + Playwright screenshoty (desktop/mobil/dark, 3D i Schéma) pro porovnání před/po.

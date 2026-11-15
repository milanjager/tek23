# Architecture
- The app is a stage/sound-rig builder: `src/routes/index.tsx` renders `StageBuilder3D` (3D scene + toolbar + panels); every other view (Schematic, GridPlanner, Elevation — the only four views besides 3D) is a sibling component under `src/components/stage`, not a separate route — views share one live state, so splitting them into routes would fork that state.
- Placement/stacking/collision rules live in `src/components/stage/placement.ts` (pure, tested by `placement.test.ts`); view components call it instead of re-implementing geometry, so 3D, elevation and isometric stay in agreement.
- All project state persists to `localStorage` (`stage.*` keys) and is read inside `useEffect` after mount, never during render — SSR HTML and the first client render must match or hydration throws.
- Work steps are build → wire → spec; checks are a derived header badge (read-only over scene + wiring), never a separate mode, so validation never forks scene logic.
- Saved rigs live in `src/components/stage/rigStore.ts` (list under its own key, the legacy single-scene key still written); the start screen always opens on load so SSR and client render match.
- Per-type weight and peak mains draw live in the SPEC_RATINGS table beside SPECS; header totals read from it, while wiring/overload logic keeps using `powerW`.
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Per-box surface (`finish`/`grille` on Placed) is applied in ItemObject by swapping cabinet-coloured materials after mount, so model components stay untouched and the global cabinet style remains the default.
- Below 768 px the palette and inspector are bottom sheets and steps move to a bottom nav; desktop side panels are `md:` only, so one component tree serves both layouts.
- Rig check rules (unwired, generator load, Ω per channel, boxes per channel) live in `src/components/stage/rigChecks.ts` (pure, tested); the scene badges, issue cards and step-2 Sources panel only read its output, so every view reports the same problems.
- Techrider/plan/schema drawings are plain SVG in `rigDrawings.tsx`, shared by step 3 (`SpecStudio`) and the read-only `/view` page; the share link carries the whole rig in the URL hash (deflate + base64url), so no backend is needed.
- AI layout suggestions use a typed `createServerFn` and Gateway structured JSON; `aiPlanner.ts` sanitizes model output against room bounds and available quantities before the shared scene state and normal wiring rules consume it.
- Shell UI: one 56 px header (identity · steps · undo/redo/share/⋯) plus one step-context row; every secondary action lives in the ⋯ menu and buttons use the `sr-*` utilities in styles.css, so toolbars stay grey with a single yellow accent.

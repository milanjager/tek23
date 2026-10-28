# Architecture
- The app is a stage/sound-rig builder: `src/routes/index.tsx` renders `StageBuilder3D` (3D scene + toolbar + panels); every other view (Schematic, GridPlanner, Elevation, Isometric, Technical) is a sibling component under `src/components/stage`, not a separate route — views share one live state, so splitting them into routes would fork that state.
- Placement/stacking/collision rules live in `src/components/stage/placement.ts` (pure, tested by `placement.test.ts`); view components call it instead of re-implementing geometry, so 3D, elevation and isometric stay in agreement.
- All project state persists to `localStorage` (`stage.*` keys) and is read inside `useEffect` after mount, never during render — SSR HTML and the first client render must match or hydration throws.
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

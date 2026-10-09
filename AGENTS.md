# Architecture
- One route file per bottom-nav tab (index, codes, live, templates, settings); shared shell rendered in __root around Outlet — keeps tabs SSR-indexable.
- All OBD state (settings, simulated live values, active DTCs) lives in ObdProvider (src/lib/obd/store.tsx) — single source for every tab; settings persist in localStorage.
- DTC database and diagnostic templates are static data modules in src/lib/obd — edit data, not components, to add codes/templates.
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

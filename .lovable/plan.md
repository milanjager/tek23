
# Přestavba Stage Builderu — jednodušší, chytřejší, pro non‑IT crew

Cíl: nástroj, který zvládne parťák z party crew bez čtení manuálu. Miř na „SimCity/RTS" pocit — snap na grid, zelený/červený ghost při umisťování, ☰ sbalit vše, jedno velké tlačítko „⚡ Zapojit vše".

## 1. Rotace pryč (UI bedny)

- V **Detail výběru** (StageBuilder3D.tsx) smazat blok tlačítek 0/90/180/270°, slider a numerický input rotace.
- V `GridPlannerView` a `ElevationView` smazat tlačítka „Otoč 90°" a klávesu **R**.
- Šipku „front-of-box" ▼ nechat (vizuální orientace publikum), rotY v modelu ponechat na 0 — kód rotY zůstává, aby se nerozbila persistence, ale UI ho neexponuje.

## 2. Sbalitelné panely (mobil i desktop)

Zavedeme jednotný `usePanel(id)` hook (localStorage persist). Každý panel dostane úchyt s chevronem a shortcut.

- **Levá paleta komponent** — sbalí se do 40px pásu s ikonami kategorií (Sound/Lights/Infra). Klik na ikonu = flyout. Klávesa `[`.
- **Pravý panel (Detail výběru + Kabelový inspektor)** — sbalí se úplně na okraj (44px tab s ikonou). Klávesa `]`.
- **Horní toolbar** — rozdělit na 3 klastry (Režim, Preset, Nástroje) a přesunout „vedlejší" akce (Auto rozmístit, Legenda kabelů, Realistický vzhled, Schéma toggle) do jedné rozbalovací nabídky **⋯ Více**.
- **Legendy** (SIG/PWR/DMX) — do jednoho plovoucího chip „🎨 Legenda" s popoverem.
- **Spodní status bar** — nový úzký pás: počet beden, počet chyb kabeláže, stav auto‑layoutu, tlačítko „⚡ Zapojit vše".

## 3. Grid snap + RTS validace umísťování v 3D

Aktuální free‑3D placement se nahradí za deterministický grid, stejný pro 3D i Nárys/Plán, aby všechny pohledy seděly.

- Konstanta `GRID = 0.5 m` globálně (mirror z `GridPlannerView`).
- V `StageBuilder3D` obalit drag/drop novým hookem `usePlacementGhost({ kind, gridSize })`:
  - Pod kurzorem plovoucí **ghost mesh** s barevným rámečkem.
  - **Zelená** = volno, žádná kolize footprintu.
  - **Žlutá** = do 0.4 m od jiné bedny (těsně vedle — OK, ale upozornění).
  - **Červená** = overlap → klik zakázán, tooltip „Nelze umístit — kolize s {label}".
- Kolize řeší sdílená utilita `computeFootprintConflicts(items, candidate)` v novém `src/components/stage/placement.ts` — použije ji 3D i `ElevationView`/`GridPlannerView`, aby chování bylo shodné.
- Existující bedny při dragu chovají stejně — vlečená bedna se snapuje, ghost červeně blokuje drop.
- Auto‑stack: pokud ghost přesně sedí na půdorys bedny pod ním, zvedne se automaticky na `pos[1] = topOf(base)` a rámeček je modrý = „stackovat".

## 4. Marquee (rectangle) výběr v 3D

- Nový režim `SelectTool`:
  - Left‑drag na prázdnu = kreslí rubber‑band DOM overlay (2D CSS na `<canvas>`).
  - Při release: projekce každé bedny přes camera `project()` → screen‑space AABB → intersect s rectanglem → doplní do `selection` (`additive` když je Shift).
  - Escape ruší výběr.
- Hlavní tlačítko myši:
  - **Prázdno + drag** → marquee.
  - **Nad bednou** → drag = přesun.
  - **Shift+klik na bednu** → toggle výběru.
- Aktualizovat `selection` state (už je sdílený mezi pohledy z minulé iterace).

## 5. Chytrá auto‑kabeláž „⚡ Zapojit vše"

Nová utilita `src/components/stage/autoWire.ts` s deterministickým rozvrhem:

1. **PWR** — pro každou bednu/zesilovač/pult najde nejbližší `distro` (rozvaděč). Přidá PowerCON kabel. Jedna distribuce má max 8 outletů → přeteče na další nejbližší, jinak vyhodí varování „Chybí distro pro X".
2. **SPK (Speakon) — beden ↔ ampy + link‑out řetěz:**
   - Ampy (Powersoft) mají 4 SPK OUT (A/B/C/D). Alokace podle role: `sub`, `top`, `mid`.
   - První bedna dané role v clusteru → přímo z ampu.
   - Další bedny stejné role a stejného clusteru (do 3 m) → **link OUT → IN** předchozí bedny (řetěz).
   - Dva kabely na bednu tam, kde má vstup L+R (dva Speakony).
3. **SIG (XLR/analog):**
   - Najde FOH mixer (kind `mixer` / `foh`). Z jeho outputů (Main L/R, Aux 1..N) rozdělí kanály na ampy podle role — Main L → top-left cluster, Main R → top-right, Aux1 → subs, atd.
   - Pokud není mixer, hodí varování a auto‑založí virtual `FOH` node do inspektoru s návrhem přidat.
4. **DMX** — pokud jsou lights: chainuje světla přes DMX-in/out z nejbližší DMX kontroly.
5. **Validátor** — po každém auto‑runu vyplní status bar: „✓ 24 kabelů, ⚠ 2 varování". Kliknutí na varování otevře Kabelový inspektor filtrovaný na dané spoje.

Manhattan routing z minulé iterace zůstává; přidáme jen **barevný accent per‑cluster** (levá strana modrá, pravá růžová, subs žlutá), aby v přehledu bylo hned jasné, co kam patří.

## 6. UI kompaktifikace pro non‑IT crew

- **Typografie** — základ text `11px`, popisky `10px`, výška tlačítka `28px`. Ikony `14px`.
- **Tokens** — sjednotit barvy do `--stage-*` v `src/styles.css` (bg-panel, bg-panel-2, border, accent-lime, warn-amber, danger-red, cluster-L, cluster-R, cluster-sub).
- **Command palette** `Ctrl/Cmd+K` — vyhledávání „přidat sub", „zapojit vše", „preset picus"…
- **Rychlé první‑spuštění** — když je scéna prázdná: velké tlačítko uprostřed „🚀 Začít z presetu…" místo prázdna.
- **Tooltip s piktogramy** místo textových popisků na tlačítkách toolbaru (šetří šířku).

## Technická sekce

Nové soubory:
- `src/components/stage/placement.ts` — sdílené kolize a snap.
- `src/components/stage/autoWire.ts` — routing PWR/SPK/SIG/DMX.
- `src/components/stage/PlacementGhost.tsx` — three.js ghost mesh + barevný outline.
- `src/components/stage/MarqueeOverlay.tsx` — DOM overlay pro rectangle výběr.
- `src/components/stage/panels/usePanel.ts` — hook stavu sbalení + localStorage.
- `src/components/stage/StatusBar.tsx` — spodní bar + „⚡ Zapojit vše".

Úpravy:
- `StageBuilder3D.tsx` — vyjmout rotaci z Detail výběru, wire panel hooky, integrovat ghost + marquee, přesunout drobná tlačítka do „⋯ Více" popoveru.
- `StageBuilder.tsx` — layout: 40px lišty místo pevných sidebarů, klávesové zkratky `[`, `]`, `\` (marquee), `Ctrl/Cmd+K`.
- `GridPlannerView.tsx`, `ElevationView.tsx` — smazat R‑rotaci a tlačítka Otoč, používat `placement.ts` pro validaci.
- `SchematicView.tsx` — konzumovat `autoWire.ts` výstup, zobrazovat varování inline.

Persistuje se v `localStorage`:
- Stav sbalení každého panelu (`stage.panel.<id>`).
- Poslední scéna už tam je — beze změny schématu.

Kompatibilita: `rotY` v datovém modelu **zůstává** (fixně 0 přes UI), aby staré uložené scény nespadly.

Odhad rozsahu: ~2 200 řádků čistý přírůstek, ~600 smazaných (rotace + duplicitní kolize + rozházené toolbar tlačítka).

## Co v tomhle kole NEDĚLÁM

- Import CAD/DWG, export PDF ridera, sdílené real‑time editace, akustickou simulaci pokrytí, DMX patch matrix editor. Ty zvlášť, až tohle sedne.

Řekni „jedeme" a pustím to. Když chceš něco přehodit (např. rotace nechat, marquee vynechat), napiš změny stručně.

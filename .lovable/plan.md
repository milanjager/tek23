# Vylepšené kabelové propojování

Přidám na každou komponentu **konektory (porty)** s typy a barvami. V režimu "Kabel" se porty zvýrazní, kabel se táhne z portu do portu a snapuje se na kompatibilní cíl.

## Typy portů

- **AUDIO** (acid green) — signál mezi mixerem, ampem, reproduktory
- **POWER** (amber) — z generátoru do všeho ostatního
- **DMX** (magenta) — z mixeru/DJ do světel (strobo, laser, moving head)

Každá komponenta dostane 1–3 porty podle role, umístěné na okrajích boxu:

| Komponenta        | Porty                                   |
| ----------------- | --------------------------------------- |
| Generator         | 3× POWER out (pravá strana)             |
| Amp rack          | 1× POWER in, 1× AUDIO in, 2× AUDIO out  |
| Mixer / DJ booth  | 1× POWER in, 1× AUDIO out, 1× DMX out   |
| Horn / Mid / Bass / Sub | 1× AUDIO in                       |
| Strobo / Laser / Moving head | 1× POWER in, 1× DMX in       |
| Bar               | 1× POWER in                             |
| Crowd             | žádné                                   |

## Interakce

1. **Klikneš na "Kabel"** — na všech komponentách se rozsvítí porty barvou svého typu, s pulzujícím prstencem.
2. **Podržíš pointer na portu** — kabel se z něj začne táhnout jako čára za kurzorem.
3. **Když je kurzor blízko kompatibilního portu (do 24 px)** — cílový port se zvětší a rozzáří, kabel na něj „skočí" (magnet snap). Nekompatibilní porty ztlumí (šedivý outline).
4. **Uvolníš na portu** — vznikne kabel v barvě typu (audio/power/dmx). Bez cíle se táhnutí zruší.
5. Kabel se kreslí jako Bézier křivka mezi porty (ne středy komponent) v barvě typu.

## Vizuální detail

- Port = kroužek o průměru 10 px na okraji boxu s vnitřní tečkou v barvě typu.
- V klidu je port neviditelný. V režimu Kabel: viditelný, s glow. Když je hover cíl: 1.6× větší + silný glow.
- Nekompatibilní porty v režimu táhnutí kabelu: opacity 0.3, bez glow.
- Kabely dostanou barvu podle typu (audio zelený, power jantarový, DMX magenta) místo současné jednotné amber.

## Technické detaily

Změny jen v `src/components/stage/StageBuilder.tsx`:

- Nový typ `PortType = "audio" | "power" | "dmx"` a `Port = { id, type, dir: "in"|"out", ox, oy }` (offset od left/top komponenty).
- `SPECS[kind].ports: Port[]` — statická definice pro každý `ComponentKind`.
- Helper `absolutePort(item, port) → {x, y, type, dir}` pro absolutní pozici s ohledem na rotaci (aplikuje rotaci kolem středu boxu).
- `CableLink` rozšířen o `fromPort: string`, `toPort: string`, `type: PortType`; migrace ze starých dat: pokud portId chybí, přeskočit render.
- Nový state `pendingCable: { from: {itemId, portId}, x, y, hoverTarget: {itemId, portId} | null } | null`.
- Pointer flow v režimu kabel:
  - `onPortPointerDown` → `setPendingCable`; pointer capture.
  - Globální `pointermove` → aktualizuje kurzor a hledá nejbližší kompatibilní port (jiná komponenta, opačný `dir`, stejný `type`, vzdálenost ≤ 24 px). Nastaví `hoverTarget`.
  - Globální `pointerup` → pokud `hoverTarget`, přidá kabel; jinak zahodí.
- Kompatibilita: `out → in` nebo `in → out`, ale ne dva stejné směry, a stejný `type`.
- Rendering:
  - Porty se kreslí v absolutních souřadnicích jako `<circle>` v SVG vrstvě nad komponentami (pointer-events: auto jen v režimu Kabel).
  - Kabely: `<path>` s `stroke` podle `type` (audio `--acid`, power `--amber`, dmx `--magenta`).
  - Pending kabel: dashed čára od zdrojového portu ke kurzoru (nebo k `hoverTarget` při snapu).
- Odstranit původní klikací tok „klikni zdroj → klikni cíl". Zjednodušit stavový výstup ve status baru: „Táhni kabel z portu na kompatibilní port".
- `STORAGE` bump na `stagerig:v3` (staré uložené kabely bez portId ignorovat).
- Zůstává: přetahování komponent, snap, guides, keyboard shortcuts.

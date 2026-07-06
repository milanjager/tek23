# Kde získat volně použitelné 3D modely reproduktorů

Cíl: sehnat 3–5 GLB modelů (line array, subwoofer, top PA, stage monitor, případně bar/light) s licencí, která umožňuje použití v aplikaci, a integrovat je do `StageBuilder3D.tsx` přes `<Gltf/>` s cachováním na Lovable CDN.

## 1. Zdroje modelů (seřazeno podle použitelnosti)

### A. CC0 / public domain (bez atribuce, nejjednodušší)

| Zdroj | Co tam hledat | Poznámka |
|---|---|---|
| **Poly Haven** (polyhaven.com/models) | `megaphone`, `boombox` – PA line array bohužel nemá | CC0, ověřená kvalita, přímé `.glb` |
| **ambientCG** | Reproduktory řídce, ale worth a check | CC0 |
| **Kenney.nl** – Audio Kit | Stylizované low-poly reproduktory | CC0, minimalistický vzhled ✅ ideální pro náš styl |
| **Quaternius** | Low-poly asset packy | CC0 |
| **Sketchfab – filtr CC0** | `speaker`, `line array`, `subwoofer` s licencí "CC0" | Vzácné, ale existují |

### B. CC-BY 4.0 (s atribuce v UI/creditech)

| Zdroj | Kandidáti | Licence |
|---|---|---|
| **Sketchfab** (již proskenováno) | Line Array, Bass Bin 1, PA concert speaker clean, Stage Monitor, PA bass clean | CC-BY 4.0 |
| **Free3D** | Search `PA speaker`, filtr Free | Různé, číst per model |
| **TurboSquid Free** | Občas CC-BY | Číst per model |

**Podmínka atribuce**: přidat sekci „Credits" v UI (např. tlačítko ⓘ v 3D toolbaru → dialog se seznamem autorů + odkazy). To je jediný požadavek CC-BY.

### C. Vytvořit vlastní (fallback)

Pokud nic nesedí stylově: vygenerovat jednoduché GLB v Blenderu jako one-off a commitnout do repa. Náročné, ale plně kontrolovatelné a bez licenčních starostí.

## 2. Doporučený postup (v tomto pořadí)

1. **Kenney Audio Kit** – stáhnout ZIP, vybrat 3–5 vhodných modelů (speaker, subwoofer, mic stand jako proxy pro monitor). CC0, minimalistický low-poly styl **přesně odpovídá aktuálnímu vizuálu appky**.
2. Pokud Kenney nestačí, doplnit **1–2 CC-BY modely ze Sketchfabu** (line array + sub – hi-fi varianta pro „HQ" toggle).
3. Fallback: procedurální meshe zůstávají jako výchozí zobrazení, GLB se načítá jen když je „HQ modely" toggle zapnutý.

## 3. Integrační plán (po schválení zdrojů)

### Uložení modelů
- Nahrát každý `.glb` přes `lovable-assets create --file <path>` → vznikne `.asset.json` pointer, soubor jde na CDN (rychlé, cachované, mimo repo).
- Ukládat pod `src/assets/models/<name>.glb.asset.json`.

### Kód (`StageBuilder3D.tsx`)
- Přidat mapu `MODEL_URLS: Record<ComponentKind, string | null>` s URL z `.asset.json`.
- Použít `useGLTF` z `@react-three/drei` (už používáme) s preloadem: `useGLTF.preload(url)`.
- Nová komponenta `<RealisticModel kind={...} />`:
  - Pokud existuje URL a je zapnutý toggle „HQ modely" → renderovat `<primitive object={gltf.scene.clone()} />` s uniform scale podle bounding boxu na cílovou velikost boxu z `SPECS`.
  - Jinak fallback na současný procedurální mesh.
- `<Suspense fallback={<proceduralMesh/>}>` pro plynulé načítání.
- Nový toggle „HQ modely" vedle stávajícího „Realistický vzhled" (persistováno v localStorage).

### Credits UI (jen pro CC-BY)
- `src/components/stage/ModelCredits.tsx` – malý popover/dialog v toolbaru se seznamem: model název, autor, odkaz, licence.

### Licenční metadata
- `src/assets/models/credits.json` – strukturovaný seznam `{ kind, name, author, url, license }`, čtený komponentou Credits.
- Pro CC-BY modely přiložit i `LICENSE.md` do `src/assets/models/`.

## 4. Otevřené otázky před implementací

1. **Preferuješ čistě CC0 (Kenney low-poly, žádná atribuce)** nebo **realistické CC-BY** (potřebuje credits sekci v UI)?
2. Mám modely stáhnout sám (Kenney a Poly Haven jde přes `curl`, veřejné `.glb` odkazy) nebo je pošleš ručně (nutné pro Sketchfab kvůli OAuth stažení)?
3. Rozsah – stačí 3 kusy (line array, sub, monitor) nebo chceš i světla / bar / DJ booth?

/* Read-only odkaz: rig zakódovaný do #hash (deflate + base64url) — žádný server. */
export interface SharedRig {
  name: string;
  items: { kind: string; pos: [number, number, number]; label?: string }[];
  cables: { from: number; to: number; type: "signal" | "speaker" | "power" | "dmx" }[];
}

const b64url = (bytes: Uint8Array) => {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
async function pipe(bytes: Uint8Array, t: CompressionStream | DecompressionStream) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(t as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function packRig(name: string, items: { id: string; kind: string; pos: [number, number, number]; label?: string }[], cables: { from: string; to: string; type: SharedRig["cables"][number]["type"] }[]): SharedRig {
  const idx = new Map(items.map((it, i) => [it.id, i]));
  return {
    name,
    items: items.map((it) => ({ kind: it.kind, pos: it.pos.map((v) => Math.round(v * 100) / 100) as [number, number, number], ...(it.label ? { label: it.label } : {}) })),
    cables: cables.filter((c) => idx.has(c.from) && idx.has(c.to)).map((c) => ({ from: idx.get(c.from)!, to: idx.get(c.to)!, type: c.type })),
  };
}

export async function encodeRig(rig: SharedRig): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(rig));
  return b64url(await pipe(json, new CompressionStream("deflate-raw")));
}
export async function decodeRig(s: string): Promise<SharedRig> {
  const bytes = await pipe(fromB64url(s), new DecompressionStream("deflate-raw"));
  return JSON.parse(new TextDecoder().decode(bytes)) as SharedRig;
}

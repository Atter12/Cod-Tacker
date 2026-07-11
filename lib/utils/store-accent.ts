const STORE_ACCENTS = [
  { background: "bg-orange-500", text: "text-white" },
  { background: "bg-violet-500", text: "text-white" },
  { background: "bg-cyan-500", text: "text-slate-950" },
  { background: "bg-emerald-500", text: "text-slate-950" },
  { background: "bg-pink-500", text: "text-white" },
] as const;

export type StoreAccent = (typeof STORE_ACCENTS)[number];

/** Stable accent color derived from storeId (or name fallback). */
export function getStoreAccent(storeId: string, nameFallback = ""): StoreAccent {
  const seed = storeId || nameFallback;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return STORE_ACCENTS[hash % STORE_ACCENTS.length] ?? STORE_ACCENTS[0];
}

import type { Access, Water } from "../fishing/fishCatalog";
import type { HoleQuality } from "../fishing/fishingHoles";

/**
 * The overworld: US territory → regions → fishing spots (POIs). A `Spot` is the
 * bridge between the map and the fishing scene — it carries the water type,
 * access, hole quality (wait curve) and a weighted fish-tier pool. Tapping a
 * spot configures the fishing store.
 *
 * Parity rule: each region's spots collectively cover tiers 1–8 in BOTH fresh
 * and salt water. Because the catalog gates access by tier (T1–5 land, T6–8
 * boat), land spots cap at T5 and boat spots cover T6–8:
 *   Fresh: stream(1–2) + river(2–4) + lake(3–5) + deep-lake(6–8 boat)
 *   Salt:  beach(1–3) + pier(2–5) + offshore(6–8 boat)
 * Verified by `npm run sim:regions`.
 */

export type WaterBody = "stream" | "river" | "lake" | "deep-lake" | "beach" | "pier" | "offshore";

export interface TierWeight {
  tier: number;
  /** Relative likelihood this tier is what bites (lower tiers weighted higher). */
  weight: number;
}

export interface Spot {
  id: string;
  name: string;
  regionId: string;
  blurb: string;
  water: Water;
  body: WaterBody;
  access: Access;
  quality: HoleQuality;
  tiers: TierWeight[];
  /** Position on the region map (x, z). */
  pos: [number, number];
}

export interface Region {
  id: string;
  name: string;
  blurb: string;
  /** Label/marker position on the US map (x, z), roughly the polygon centroid. */
  pos: [number, number];
  /** Pastel fill color for the region's area on the US map. */
  color: string;
  /** Polygon outline on the US map (x, z); the 8 regions tile a US silhouette. */
  shape: [number, number][];
  /** Locked (interior) regions are gray + non-selectable until they're unlocked. */
  locked?: boolean;
  spots: Spot[];
}

const LOCKED_GRAY = "#b9bdbd";

/**
 * Stylized US silhouette partitioned into 8 regions that share vertices so they
 * tile with no gaps. The 4 playable regions hug the coasts; the 4 locked
 * (gray) regions fill the interior + Northeast. Coords: x = west→east,
 * z = north(−)→south(+).
 */
const GEO: Record<string, { pos: [number, number]; color: string; shape: [number, number][] }> = {
  // --- playable coastal ---
  pnw: {
    pos: [-10, -3.5],
    color: "#b6d6a8",
    shape: [[-12, -6], [-8.5, -6], [-8, -1], [-11.5, -1]],
  },
  california: {
    pos: [-9.4, 1.7],
    color: "#ecd9a3",
    shape: [[-11.5, -1], [-8, -1], [-7.5, 4.5], [-9, 5], [-11, 3]],
  },
  gulf: {
    pos: [0.2, 5.4],
    color: "#a6d6d0",
    // Texas bulge + Louisiana delta dip along the Gulf coast.
    shape: [[-3.5, 4], [1.5, 4], [4.5, 5], [3, 6], [1.5, 6.9], [-0.3, 6.6], [-1.6, 7.7], [-3, 6]],
  },
  florida: {
    pos: [6.9, 1.8],
    color: "#edc2c2",
    // Narrow Florida peninsula hanging off a curved SE Atlantic coast.
    shape: [[1.5, 0], [6.5, 0.5], [11, -0.5], [10, 2], [8.8, 3.6], [8.3, 4.2], [7.9, 8], [6.8, 5.2], [6, 4.6], [4.5, 5], [1.5, 4]],
  },
  // --- locked interior (gray) ---
  mountainwest: {
    pos: [-5.7, -1],
    color: LOCKED_GRAY,
    shape: [[-8.5, -6], [-3.5, -6], [-3.5, 4], [-7.5, 4.5], [-8, -1]],
  },
  greatplains: {
    pos: [-1, -1],
    color: LOCKED_GRAY,
    shape: [[-3.5, -6], [1.5, -6], [1.5, 4], [-3.5, 4]],
  },
  midwest: {
    pos: [3.9, -2.7],
    color: LOCKED_GRAY,
    shape: [[1.5, -6], [6.5, -6], [6.5, 0.5], [1.5, 0]],
  },
  northeast: {
    pos: [8.7, -2.8],
    color: LOCKED_GRAY,
    // Maine juts up to the northeast.
    shape: [[6.5, -6], [11.5, -6.2], [12.3, -5], [11, -0.5], [6.5, 0.5]],
  },
};

function tw(pairs: [number, number][]): TierWeight[] {
  return pairs.map(([tier, weight]) => ({ tier, weight }));
}

/** Per-waterbody defaults: water, access, quality, tier pool, and map layout slot. */
const BODY: Record<WaterBody, Omit<Spot, "id" | "name" | "regionId" | "blurb" | "body">> = {
  stream: { water: "fresh", access: "land", quality: "C", tiers: tw([[1, 0.65], [2, 0.35]]), pos: [-6, -4] },
  river: { water: "fresh", access: "land", quality: "B", tiers: tw([[2, 0.5], [3, 0.35], [4, 0.15]]), pos: [-5, 2] },
  lake: { water: "fresh", access: "land", quality: "B", tiers: tw([[3, 0.5], [4, 0.35], [5, 0.15]]), pos: [-2, -2] },
  "deep-lake": { water: "fresh", access: "boat", quality: "A", tiers: tw([[6, 0.55], [7, 0.3], [8, 0.15]]), pos: [-3, 5] },
  beach: { water: "salt", access: "land", quality: "C", tiers: tw([[1, 0.5], [2, 0.35], [3, 0.15]]), pos: [5, -3] },
  pier: { water: "salt", access: "land", quality: "B", tiers: tw([[2, 0.4], [3, 0.3], [4, 0.2], [5, 0.1]]), pos: [6, 1] },
  offshore: { water: "salt", access: "boat", quality: "S", tiers: tw([[6, 0.55], [7, 0.3], [8, 0.15]]), pos: [7, 4] },
};

interface SpotInput {
  body: WaterBody;
  name: string;
  blurb: string;
  /** Optional per-spot flavor overrides. */
  quality?: HoleQuality;
  pos?: [number, number];
}

/** A locked interior region: gray, no spots, not selectable yet. */
function makeLocked(id: string, name: string, blurb: string): Region {
  const geo = GEO[id];
  return { id, name, blurb, pos: geo.pos, color: geo.color, shape: geo.shape, locked: true, spots: [] };
}

function makeRegion(id: string, name: string, blurb: string, spots: SpotInput[]): Region {
  const geo = GEO[id];
  return {
    id,
    name,
    blurb,
    pos: geo.pos,
    color: geo.color,
    shape: geo.shape,
    spots: spots.map((s) => {
      const base = BODY[s.body];
      return {
        id: `${id}-${s.body}`,
        name: s.name,
        regionId: id,
        blurb: s.blurb,
        body: s.body,
        water: base.water,
        access: base.access,
        quality: s.quality ?? base.quality,
        tiers: base.tiers,
        pos: s.pos ?? base.pos,
      };
    }),
  };
}

export const REGIONS: Region[] = [
  makeRegion("pnw", "Pacific Northwest", "Misty rivers, deep cold lakes, and a rugged Pacific coast.", [
    { body: "stream", name: "Cascade Creek", blurb: "Snowmelt riffles full of little forage fish." },
    { body: "river", name: "Columbia River", blurb: "Mighty river run — trout, salmon, and steelhead." },
    { body: "lake", name: "Lake Washington", blurb: "City lake with scrappy bass and trout." },
    { body: "deep-lake", name: "Lake Roosevelt", blurb: "Vast reservoir hiding monster sturgeon.", quality: "A" },
    { body: "beach", name: "Westport Beach", blurb: "Surf-cast for forage along the Pacific sand." },
    { body: "pier", name: "Seattle Pier", blurb: "Puget Sound pier — rockfish to salmon." },
    { body: "offshore", name: "Pacific Bluewater", blurb: "Open ocean. Tuna and the truly huge.", quality: "S" },
  ]),
  makeRegion("california", "California", "Delta sloughs, Sierra lakes, and warm Pacific surf.", [
    { body: "stream", name: "Sierra Creek", blurb: "High-country trickle of bait and panfish." },
    { body: "river", name: "Sacramento Delta", blurb: "Sprawling delta — stripers and sturgeon." },
    { body: "lake", name: "Clear Lake", blurb: "Legendary bass factory.", quality: "A" },
    { body: "deep-lake", name: "Lake Shasta", blurb: "Deep, cold, and full of giants." },
    { body: "beach", name: "Huntington Beach", blurb: "Classic SoCal surf fishing." },
    { body: "pier", name: "Santa Monica Pier", blurb: "Iconic pier over the kelp." },
    { body: "offshore", name: "San Diego Bluewater", blurb: "Tuna alley and marlin grounds.", quality: "S" },
  ]),
  makeRegion("gulf", "Gulf Coast", "Bayous, trophy bass lakes, and the warm Gulf.", [
    { body: "stream", name: "Caddo Creek", blurb: "Cypress-shaded creek of minnows." },
    { body: "river", name: "Atchafalaya Bayou", blurb: "Sprawling swamp — catfish country." },
    { body: "lake", name: "Lake Fork", blurb: "The bass capital of Texas.", quality: "A" },
    { body: "deep-lake", name: "Sam Rayburn", blurb: "Big reservoir, bigger fish." },
    { body: "beach", name: "Galveston Beach", blurb: "Gulf surf for croaker and reds." },
    { body: "pier", name: "Gulf Shores Pier", blurb: "Long pier into warm water." },
    { body: "offshore", name: "Gulf Bluewater", blurb: "Rigs and reefs — tuna and grouper.", quality: "S" },
  ]),
  makeRegion("florida", "Florida / Southeast", "Endless lakes, spring rivers, and bluewater legends.", [
    { body: "stream", name: "Spring Creek", blurb: "Crystal spring run teeming with bait." },
    { body: "river", name: "St. Johns River", blurb: "Slow tannic river — bass and panfish." },
    { body: "lake", name: "Lake Okeechobee", blurb: "The Big O — famous for giant bass.", quality: "A" },
    { body: "deep-lake", name: "Okeechobee Deep", blurb: "Open-water trolling for the biggest." },
    { body: "beach", name: "Cocoa Beach", blurb: "Atlantic surf and pompano." },
    { body: "pier", name: "Naples Pier", blurb: "Gulf-side pier sunsets and snook." },
    { body: "offshore", name: "Florida Keys", blurb: "Marlin, sailfish, swordfish. The dream.", quality: "S" },
  ]),

  // Locked interior regions (gray, unlock later)
  makeLocked("mountainwest", "Mountain West", "Alpine lakes and rushing rivers — coming soon."),
  makeLocked("greatplains", "Great Plains", "Prairie reservoirs and farm ponds — coming soon."),
  makeLocked("midwest", "Midwest / Great Lakes", "The inland seas — coming soon."),
  makeLocked("northeast", "Northeast", "Storied rivers and the Atlantic coast — coming soon."),
];

export function getRegion(id: string): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

export function getSpot(id: string): Spot | undefined {
  for (const r of REGIONS) {
    const s = r.spots.find((sp) => sp.id === id);
    if (s) return s;
  }
  return undefined;
}

/** Weighted random tier from a spot's pool. */
export function pickTier(tiers: TierWeight[], rng: () => number = Math.random): number {
  const total = tiers.reduce((sum, t) => sum + t.weight, 0);
  let r = rng() * total;
  for (const t of tiers) {
    r -= t.weight;
    if (r <= 0) return t.tier;
  }
  return tiers[tiers.length - 1].tier;
}

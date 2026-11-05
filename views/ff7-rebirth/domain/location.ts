/**
 * Where the player is: the area's name as the game's popup gives it, and the region map to draw.
 *
 * The game keeps no field for the current area. `locations` lists the location volumes the player
 * is standing in, as the game itself judges it (its own enter/leave margins included), and the area
 * is the smallest of them: a sub-area volume sits inside its area's, which sits inside the region's.
 * Each volume names its place by its LocationID (`2250-CORLM` is `$map2250`, "Miniera di carbone"),
 * and some add a sub-area text key (`$area2250_Railway`, "Binari di trasporto").
 *
 * Region maps are the game's own NaviMap textures, one image per region (assets/README.md says how
 * they were made), with the world position of their top-left pixel and their scale.
 */
import { computed } from 'vue';
import { values } from '../stream';
import names from '../assets/names.it.json';
import maps from '../assets/maps.json';

interface MapMeta {
  /** World X and Y of the image's top-left corner, in cm. */
  x: number;
  y: number;
  cmPerPx: number;
  w: number;
  h: number;
}

const images = import.meta.glob<string>('../assets/maps/*.webp', { eager: true, query: '?url', import: 'default' });
const imageOf = (region: string) => images[`../assets/maps/${region}.webp`];

const NAMES: Record<string, string> = names;
const MAPS: Record<string, MapMeta> = maps;

/** The FName the game writes for "no name". */
const NONE = 'None';

/**
 * The world map's own volume. Its brush is a token 200-unit cube although it covers the whole world,
 * so its box says nothing about its size: it is the last resort, never the smallest.
 */
const WORLD = '0001-WORLD';

export interface Place {
  /** The region the map belongs to, e.g. "Corel". Null when it has no name of its own. */
  region: string | null;
  /** The area, e.g. "Miniera di carbone". */
  area: string | null;
  /** The sub-area the volume names on top of its area, e.g. "Binari di trasporto". */
  sub: string | null;
}

export interface RegionMap {
  id: string;
  url: string;
  meta: MapMeta;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** `$map2250` for `2250-CORLM`: the area name every volume of that location shares. */
function areaKey(id: string): string | null {
  const digits = /^(\d{4})-/.exec(id);
  return digits ? `$map${digits[1]}` : null;
}

function textOf(key: string | null | undefined): string | null {
  if (!key || key === NONE) return null;
  return NAMES[key] ?? null;
}

interface Volume {
  id: string;
  name: string | null;
  /** The brush's box volume in world units, for ordering only. */
  size: number;
}

/** The active location volumes, smallest first. A volume whose box cannot be read sorts last. */
const volumes = computed<Volume[]>(() => {
  const out: Volume[] = [];
  for (const one of values.locations ?? []) {
    if (!one || !one.id || one.id === NONE) continue;
    const spans = [
      [one.min_x, one.max_x, one.scale_x],
      [one.min_y, one.max_y, one.scale_y],
      [one.min_z, one.max_z, one.scale_z],
    ].map(([lo, hi, scale]) => {
      const a = finite(lo);
      const b = finite(hi);
      const s = finite(scale);
      return a === null || b === null || s === null ? null : Math.abs((b - a) * s);
    });
    const product = spans.every((span) => span !== null) ? spans.reduce((p, s) => p! * s!, 1)! : NaN;
    // An unreadable box, or one whose product is not a number (0 times infinity), sorts last.
    const size = Number.isNaN(product) || one.id === WORLD ? Infinity : product;
    out.push({ id: one.id, name: one.name ?? null, size });
  }
  // Not `a.size - b.size`: two infinite sizes would make that NaN, and the order undefined.
  return out.sort((a, b) => (a.size < b.size ? -1 : a.size > b.size ? 1 : 0));
});

/** The region whose map is drawn: the smallest active volume that has one. */
export const regionMap = computed<RegionMap | null>(() => {
  for (const volume of volumes.value) {
    const meta = MAPS[volume.id];
    const url = imageOf(volume.id);
    if (meta && url) return { id: volume.id, url, meta };
  }
  return null;
});

/** Where the player is, in the game's words. Null before any location volume is known. */
export const place = computed<Place | null>(() => {
  const here = volumes.value[0];
  if (!here) return null;
  // The region is the largest named location around the player that is not the world map itself.
  const region = [...volumes.value]
    .reverse()
    .map((volume) => textOf(areaKey(volume.id)))
    .find((text) => text !== null && text !== textOf('$map0001'));
  const area = textOf(areaKey(here.id));
  // A region's own volume can name itself again (`1200-GRASA` with `$map1200`): one line is enough.
  const named = textOf(here.name);
  const sub = named === area ? null : named;
  if (!area && !sub) return null;
  return { region: region && region !== area ? region : null, area, sub };
});

/** The player's position on the region map, in that image's pixels. Null when either is unknown. */
export const marker = computed<{ x: number; y: number } | null>(() => {
  const map = regionMap.value;
  const x = finite(values.player?.x);
  const y = finite(values.player?.y);
  if (!map || x === null || y === null) return null;
  return { x: (x - map.meta.x) / map.meta.cmPerPx, y: (y - map.meta.y) / map.meta.cmPerPx };
});

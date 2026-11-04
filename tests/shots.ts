/**
 * Named screens to photograph, per view: what a person looks at before a view ships.
 *
 * Unlike the generated pictures in pictures.ts, these are written by hand on purpose: each one is a
 * moment worth seeing (the party line folded and open, a town, the open world), with values chosen
 * to look like a real game. They are fed to the built view exactly as the app feeds it, so a shot is
 * what the panel would show.
 */
import type { Picture } from './pictures';

export interface Shot {
  name: string;
  /** The `values` of a snapshot announcing the view's contract at the version under test. */
  values: Picture;
  /** CSS selectors to click once the snapshot has landed, in order. */
  clicks?: string[];
  /** A selector that must be on screen before the shot is taken. */
  ready?: string;
}

// --- Final Fantasy VII Rebirth ------------------------------------------------------------------

function character(level: number, hp: number, hpMax: number, mp: number, mpMax: number): Picture {
  return { level, hp, hp_max: hpMax, mp, mp_max: mpMax, exp: 0 };
}

/** A location volume as the profile reads it: a centred local box of these half-extents. */
function volume(id: string, name: string, half: [number, number, number], scale = 1): Picture {
  const [x, y, z] = half;
  return {
    state: 1,
    kind: 0,
    id,
    name,
    min_x: -x,
    min_y: -y,
    min_z: -z,
    max_x: x,
    max_y: y,
    max_z: z,
    scale_x: scale,
    scale_y: scale,
    scale_z: scale,
  };
}

const WORLD = volume('0001-WORLD', 'None', [400000, 400000, 100000], 10);
const COREL = volume('2200-CORLA', '$map2100', [28111, 48888, 100000], 4);

/** Cloud, Tifa and Aerith out in the field, the system menu closed. */
function ff7Field(player: Picture, locations: Picture[]): Picture {
  return {
    game_state: 6,
    game_pause: 0,
    location: '0001-WORLD',
    battle_hud: 1,
    play_time_s: 27 * 3600 + 14 * 60,
    gil: 14820,
    party: [0, 2, 3],
    characters: [
      character(32, 3480, 4122, 212, 268),
      character(31, 4410, 4410, 160, 160),
      character(31, 2980, 3540, 241, 255),
      character(32, 1510, 2905, 377, 402),
      character(30, 3300, 3300, 150, 150),
      null,
      null,
      null,
      null,
    ],
    target_hp_pct: null,
    target_stagger_pct: null,
    player,
    locations,
  };
}

/** The volumes and position read in game on the Corel coal mine's railway. */
const MINE = ff7Field({ x: -7032, y: -41302, z: 3148 }, [
  WORLD,
  COREL,
  volume('2250-CORLM', 'None', [5250, 2000, 5000]),
  volume('2250-CORLM', 'None', [2500, 2500, 5000]),
  volume('2250-CORLM', '$area2250_Railway', [1250, 1500, 500]),
]);

const FIELD = '[data-state=field] .area';

export const shots: Record<string, Shot[]> = {
  'ff7-rebirth': [
    {
      name: 'field-grasslands',
      values: ff7Field({ x: 160000, y: -40000, z: 2000 }, [
        WORLD,
        volume('1200-GRASA', '$map1200', [210000, 210000, 100000]),
      ]),
      ready: FIELD,
    },
    { name: 'field-mine', values: MINE, ready: FIELD },
    { name: 'field-mine-party-open', values: MINE, clicks: ['.bottom'], ready: '.bottom.open' },
    {
      name: 'field-north-corel',
      values: ff7Field({ x: 3927, y: -34666, z: 2996 }, [WORLD, COREL, volume('2260-CORLV', 'None', [5500, 8750, 5000])]),
      ready: FIELD,
    },
    {
      name: 'field-no-location',
      values: { ...ff7Field({ x: 0, y: 0, z: 0 }, []), locations: null, player: null },
      ready: FIELD,
    },
  ],
};

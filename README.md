# zefiro-telemetry-views

A telemetry view is the page Zefiro draws on the companion panel while a game is streaming. This
repository builds them.

Each view draws one **contract** — the shape of the values a game offers, defined in
[scry-profiles](../scry-profiles) — and declares which versions of it it reads. It knows nothing about
which profile, build or storefront produced the values: many profiles implement one contract, and a
game patch that only moves offsets changes nothing here. See scry's `docs/contracts-and-views.md`
for the whole model.

Right now there is one view: `views/sea-of-stars`, reading the `sea-of-stars` contract `^2.0`.

## What a view is allowed to be

The panel loads a view with `loadDataWithBaseURL(null, …)`, which gives it an **opaque origin**: no
network, no file access, no storage, no way to call back into the app. Frames go in through one
function and nothing comes out. The envelope is typed in [`src/scry/contract.ts`](src/scry/contract.ts)
and described in prose in Zefiro's `examples/telemetry-views/example.html`:

```js
window.scry.onFrame('snapshot' | 'diff' | 'detached', body)
// snapshot: { attached, slug, process, profile, contract: { id, version }, values }
```

**A view is only on screen while a game is attached.** Zefiro loads it from the first snapshot
that names its contract and removes it on `detached`, or on a snapshot with `attached: false`, going
back to the performance stats. So a view has no "no game" screen and no "the game ended" screen to
draw, and should not have one: nobody would ever see it. `detached` still arrives, just before the
view is removed, and a view only has to not fail on it. A game that is attached but has nothing to
show yet, such as a title screen, is the view's to handle.

Two consequences shape everything here:

- **One file.** CSS, JS and the font are inlined by the build; nothing is fetched. That is why this is
  a Vite project with `vite-plugin-singlefile` rather than a hand-written page.
- **No input from the pad.** The presentation window sets `FLAG_NOT_FOCUSABLE`, so the gamepad stays
  with the game. It is *not* `FLAG_NOT_TOUCHABLE`, so **touch works** — the tabs in this view are
  tapped. Anything driven by the pad would need a new frame kind on the app side.

## Views, contracts and ranges

```
views/<name>/manifest.json     { "title": …, "contract": { "id": "sea-of-stars", "range": "^2.0" } }
views/<name>/…                 the view: index.html, main.ts, App.vue, components/, domain/
src/scry/                      shared by every view: the frame envelope, the stream, version ranges
contracts/<id>/<v>.schema.json vendored from scry-profiles — do not edit
fixtures/<id>/<v>/…            vendored captures from scry-profiles — do not edit
contracts.lock.json            which scry-profiles commit the two above came from, and their hashes
src/contracts/<id>/<v>.ts      generated from the schemas — do not edit
```

- **The range** is a caret range: `^2.0` is every version from 2.0 up to, not including, 3.0. A minor
  only adds, so a view that treats every value as optional reads every later minor of its major.
- **The types** are generated from the schema with `json-schema-to-typescript`, one file per version,
  each exporting `Values`. A view imports them as `@contracts/<id>`, which resolves to the lowest
  version its range accepts. They say what the stream really does: every value, record field and
  collection entry may be `null`, and top-level watches may be missing. With `strict` on, reading a
  watch the contract does not have, or forgetting that one can be `null`, does not compile.
- **The runtime check**: the view reads its own manifest and checks the `contract` each snapshot
  announces. Anything outside the range — another game, another major, a malformed version, the
  deprecated bare integer, or no contract at all — gets an "Unsupported contract" screen and the
  values are not even kept. The app is meant to never load a mismatched view; this is the second lock.

### Where the contracts come from

There is no published scry-profiles yet, so the schemas and captures are **vendored**:

```sh
npm run sync-contracts                    # from ../scry-profiles
npm run sync-contracts -- /path/to/scry-profiles
npm run gen-types                         # then regenerate the types
```

`sync-contracts` copies every version of every contract a view names, refuses a checkout with
uncommitted changes under `contracts/` or `fixtures/`, and writes `contracts.lock.json` with the
source commit and a hash per file. `--check` (run in CI) fails if anything vendored no longer matches
the lock. **Once scry-profiles is published this becomes a pinned dependency** — a git dependency at
a tag, or an npm package — the package manager's lock replaces `contracts.lock.json`, and the script
goes.

## Build, check and install

```sh
npm install
npx playwright install chromium   # once, for the tests
npm run dev          # localhost:5173, with a real capture replaying through the real bridge
npm run build        # -> dist/<contract>@<from>-<below>.html and dist/index.json
npm run typecheck    # vue-tsc, once per contract version each view's range covers
npm test             # build, then load every view headless and try to break it
npm run check        # all of the above plus the lock and generated-types checks: what CI runs
npm run push         # build, then adb push onto the device
```

The output is named by **contract and range**, never by a profile's label:

```
dist/sea-of-stars@2.0-3.0.html     reads sea-of-stars from 2.0 up to, not including, 3.0
dist/index.json                    { views: [{ view, contract, range, file, sha256, covers }] }
```

There is no unversioned copy. `index.json` is what a client looks a view up in: the entry whose range
includes the version the stream announced, and the hash to check the file against. `covers` lists the
vendored versions inside the range at build time, which are the versions it was type-checked and
tested against. Two views that would build to the same name fail the build.

## How views reach the device

**Published.** Every push to `main` that passes the checks deploys `index.json` and the built views to
GitHub Pages, at <https://danieles.github.io/zefiro-telemetry-views/>. Zefiro reads the index
from there and downloads only the view for the contract a game announces, never the whole catalogue.
It keeps both in its private files and uses them offline afterwards, refetches the index at most once
a day (and once per run for a contract the index did not know), and refuses a file whose sha256 does
not match. Pages serves with a ten-minute cache, so a new view can take that long to be picked up.

**By hand, for trying a view before publishing it.** `npm run push` builds and writes the views and the
index to `/sdcard/Android/data/dev.kylobyte.zefiro.debug/files/telemetry-views/`. A view found there
wins over the published one. Override the package with `PACKAGE=…`, and pin the device with
`ANDROID_SERIAL=…` when the Thor shows up twice under wireless debugging. Empty that folder to go back
to the published views.

## A new major keeps the old view

A contract's new major means a new view, and the view for the previous major stays in the repository.
Hosts do not all move at once: one still running a profile on `sea-of-stars 2.x` needs the `^2.0`
view after a `^3.0` one exists. So:

- **Write the new major as a new view folder**, for instance `views/sea-of-stars/` for `^3.0` while
  the old one moves to `views/sea-of-stars-v2/`, each with its own `manifest.json`. They build to
  different files (`sea-of-stars@2.0-3.0.html`, `sea-of-stars@3.0-4.0.html`), both go into
  `index.json`, and the app picks the one whose range holds the version the host announces.
- **Keep the old major's schemas vendored**, so CI goes on type-checking and testing the old view
  against the versions it claims. A view that is published but no longer tested is how a broken one
  reaches a device.
- **Retire a view by deleting its folder**, once no host is expected to announce that major any
  more. The next publish drops it from the index, and a device stops using it once it refreshes the
  index, within a day, even though the file may still sit in its cache: the app picks views from the
  index, not from whatever it has downloaded.

A new *minor* is not a new view: the view raises or keeps its range, because a minor only adds.

## What the checks do

- **Lock** (`sync-contracts --check`): the vendored schemas and captures are byte-for-byte what was
  synced from the recorded scry-profiles commit.
- **Generated types** (`gen-types --check`): `src/contracts/` is what the vendored schemas generate.
- **Type-check matrix** (`npm run typecheck`): `vue-tsc` in strict mode once per contract version in
  each view's range, with `@contracts/<id>` pointed at that version. A `^2.0` view that stops
  compiling against 2.1 fails here. Today only 2.0 exists, so the matrix has one cell; it grows on
  its own when a minor is synced.
- **Headless tests** (`npm test`): one Playwright project per view and covered version
  (`sea-of-stars@2.0`). Each loads the *built* file in Chromium and feeds it, announced as that
  version: every real capture of the major, an all-`null` picture, six seeded partial pictures, and
  every value at each of four edges generated from the schema — integers at the top and bottom of
  their wire type, floats at ±f32 max, empty and long strings, every collection at its cap, every
  collection full of `null`, and everything empty. Each picture is validated against the schema
  first, then sent as a snapshot, steered into each screen (tabs tapped), replayed as per-watch
  diffs, resynced and detached. The view must not throw, log an error, or take more than five
  seconds to render a frame. Separately, six announcements it must refuse, and must keep refusing
  when a diff follows.

## Developing without a device

`npm run dev` loads [`views/sea-of-stars/dev/replay.ts`](views/sea-of-stars/dev/replay.ts), which drives
`window.scry.onFrame` with the vendored capture `fixtures/sea-of-stars/2.0/steam-first-tick.json`. The
capture predates `contract` on the wire, so the harness announces the version the fixture is filed
under. It is a single tick, so everything after the first snapshot (damage, a fight starting, combo
points filling) is invented by the harness; it also frames the page as a square, since the panel is
roughly square and a browser window is not. The harness is behind `import.meta.env.DEV` and is not in
the built file at all. `VIEW=<name> npm run dev` serves another view.

Keys: `1` title screen · `2` voyage · `3` battle · `d`/`h` hurt/heal Zale · `r` resync snapshot ·
`x` detach · `s` stop the script · `p` restart it.

### Seeing a view without a device: `npm run shots`

`npm run shots` builds the views, then photographs each one in the screens listed for it in
[`tests/shots.ts`](tests/shots.ts), at the panel's size (538x444 CSS px, at 2x). The PNGs land in
`shots/<view>@<version>/`, which git ignores. Each shot loads the built file, feeds it a snapshot
through `window.scry.onFrame` as the app does, waits for the screen's selector and for any scene
transition to finish, and stops the animations, so two runs of the same values give the same
picture. A page error fails the run.

Add a shot when a view gains a screen or a state worth looking at: a name, the snapshot's `values`,
optional `clicks`, and the selector that means the screen is up.

Both this and `npm test` drive Playwright's Chromium by default. `PW_CHANNEL=msedge` (or `chrome`)
drives an installed browser instead, and on Windows that is the default, so nothing has to be
downloaded there.

## How the Sea of Stars view is put together

| | |
|---|---|
| `src/scry/` | the envelope, the stream as reactive state, and version ranges — shared |
| `views/sea-of-stars/stream.ts` | the stream, typed by the contract and gated by the manifest's range |
| `views/sea-of-stars/domain/` | the 43 watches read as a game: party, world, inventory, scene selection |
| `views/sea-of-stars/components/` | the panel itself |

Three things in here are less obvious than they look:

- **Snapshots are adopted, not applied.** The app resends the whole picture every few seconds as a
  resync. The stream writes only the keys whose value actually differs, so the repeat mutates nothing
  and renders nothing.
- **Animations are keyed on a change counter, never on a render.** `pulses[watch]` goes up whenever
  the host reports a watch moved — including when it moved back — and the flashing element is
  `:key`ed to it. Keying off a render would fire on every resync.
- **Sizing is one number.** Everything is in `rem` and `main.ts` sets the root font size from the
  panel's short side, so the view scales as a piece to whatever the second screen is. No breakpoints.

## Known view issues, not fixed here

Found while putting the view under the tests above, and deliberately left for a change of their own:

- **Labels are quadratic in their length.** `domain/labels.ts` segments a key by dynamic programming
  that copies the whole tail at every position and scans the dictionary at each. Fine for a 30-letter
  key; a 4096-character string (an unterminated read, say) across the 512-entry catalogue stalls the
  panel for minutes. The tests cap long strings at 256 characters so that they test everything else.
- **Numbers are printed unclamped.** `ult` is used as a percentage (`min(100, ult)`) but
  printed raw, and quantities, levels and XP are printed at whatever width an i32 reaches. Nothing
  breaks, but a garbage read shows up as a ten-digit number.
- **`gold` is gone from the header.** It used to read a `gold` watch the contract does not declare, on
  the theory it would appear one day. That no longer compiles, which is the point; when a minor adds
  `gold`, this view raises its range to that minor and reads it.

The one issue the extremes did fix: the combo gauge's `v-for` ran over `max_combo_points` directly,
so an i32 at its maximum built two billion elements and froze the panel. It is clamped to twelve pips.

## Where the data stops being exact

Worth knowing before trusting a number on the panel, mostly about what the Sea of Stars contract
and its profiles do and do not read:

- **Item names are guessed.** The game stores localisation *keys* (`ARMOR_PIRATEGARB_NAME`), not text,
  and this profile does not read the string table. `views/sea-of-stars/domain/labels.ts` strips the affixes, splits on
  underscores and camelCase, and segments what is left against a word list harvested from the game's
  own 439-entry catalogue. It gets all 155 level names and all but a handful of items right. **When a
  real name mapping (CSV) turns up, it becomes a generated `OVERRIDES` table and the word list stays
  only as the fallback.**
- **Stat ids are inferred.** Trinkets and upgrades report `{ stat: 3, amount: 4 }`. The mapping in
  `views/sea-of-stars/domain/stats.ts` (0 HP, 1 SP, 3 ATK, 4 DEF, 5 M.ATK, 6 M.DEF) is deduced from equipment whose
  effect is known — the Power Belt's +4 attack, the Green Leaf's +15 HP. Id 2 has never been observed
  and renders as `Stat 2`.
- **Combo points look like thousandths.** One snapshot read 3000 against a max of 3. The view scales
  only when the counter overshoots its own maximum, so a plain count still works if that is wrong.
- **The `roster_*` watches are not about the party.** `roster_hp_total` sums `hp` over the whole
  `characters` collection — all nine entries, including characters who have not joined and two 280 HP
  entries that look like scripted fights — so it reads **1086** for a party of three carrying **239**
  between them. `roster_downed` counts the same nine. The panel totals the party itself and labels the
  roster figure as the roster.
- **Max HP exists for three characters.** The profile derives `zale/valere/garl_max_hp`. A later party
  member gets a number with no bar rather than a bar against an invented maximum — a profile gap, not
  a view one.
- **M.ATK and M.DEF are computed here**, as base plus the equipped piece, because the profile derives
  only their physical counterparts.
- **There is no gold watch.** The counter in the header shows unspent XP.

## Fonts

Fonts come from npm, not from this repository. [Fontsource](https://fontsource.org) republishes
every Google Font as a package (`@fontsource/<name>`, or `@fontsource-variable/<name>` for a
variable font), so a view that wants one adds the package and points an `@font-face` at the
subset it needs:

```css
@font-face {
  font-family: 'Pixelify Sans';
  src: url('@fontsource-variable/pixelify-sans/files/pixelify-sans-latin-wght-normal.woff2')
    format('woff2');
  font-weight: 400 700;
}
```

The build inlines the file into the view like any other asset. Nothing is fetched at run time,
which matters twice over: the panel blocks network loads, and a font request would tell a third
party every time a game's view opened. The lockfile pins each font's version and hash, and the
licence ships inside the package.

Name the file directly rather than importing the package's CSS: that CSS declares every subset
(cyrillic, latin-ext, …) and the build would inline all of them. A font that is not on Google
Fonts cannot come this way; check that its licence allows redistribution before vendoring it.

The Sea of Stars view uses [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) from
`@fontsource-variable/pixelify-sans`, under the SIL Open Font License 1.1.
